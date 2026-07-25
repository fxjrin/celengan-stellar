#![no_std]

use soroban_sdk::auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation};
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, token, vec, Address, Env, IntoVal, Map, Symbol, Val, Vec,
};
use stellar_access::ownable;
use stellar_contract_utils::pausable;
use stellar_macros::{only_owner, when_not_paused};

pub const BPS_DENOM: u32 = 10_000;
pub const DEFAULT_SPLIT_BPS: u32 = 2_000;

const ACCOUNT_TTL_THRESHOLD: u32 = 518_400; // 30 days in ledgers
const ACCOUNT_TTL_EXTEND_TO: u32 = 3_110_400; // 180 days in ledgers
const MAX_LOCK_SECS: u64 = 157_680_000; // 5 years; caps fat-fingered locks

// verified live on the deployed testnet pool: USDC is reserve index 3
// (get_reserve_list position and get_reserve().config.index both agree)
const BLEND_USDC_RESERVE_INDEX: u32 = 3;
// blend-contracts-v2 pool/src/pool/actions.rs RequestType enum
const BLEND_REQUEST_SUPPLY: u32 = 0; // non-collateral supply; never opens a borrow-eligible position
const BLEND_REQUEST_WITHDRAW: u32 = 1;
// blend-contracts-v2 pool/src/constants.rs SCALAR_12; b_rate is always fixed-point at this
// scale regardless of the underlying asset's own decimals
const BLEND_RATE_SCALAR: i128 = 1_000_000_000_000;

// applied to every on-chain-computed Soroswap quote (never to a zero or
// caller-supplied minimum), since swaps and liquidity additions are the
// only price-manipulable operations in this contract
const SOROSWAP_SLIPPAGE_BPS: i128 = 100; // 1%
const SOROSWAP_DEADLINE_SECS: u64 = 300; // execution window for router calls

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InvalidSplit = 2,
    InsufficientSpend = 3,
    InsufficientShares = 4,
    SavingsLocked = 5,
    LockNotExtended = 6,
    EmptyWithdrawal = 7,
    LockTooLong = 8,
    SwitchTargetWithBalance = 9,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub usdc: Address,
    pub vault: Address,
    pub blend_pool: Address,
    pub soroswap_router: Address,
    pub soroswap_factory: Address,
    pub soroswap_pair: Address,
    pub xlm: Address,
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum YieldTarget {
    Defindex,
    Blend,
    Soroswap,
}

#[contracttype]
#[derive(Clone)]
pub struct Account {
    pub split_bps: u32,
    pub spend: i128,
    pub shares: i128,
    pub lock_until: u64,
    // shares only ever mean units of whichever target this is; switching
    // targets is blocked while a balance is held, so different targets'
    // shares never mix
    pub yield_target: YieldTarget,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Account(Address),
}

// Mirrors the DeFindex vault interface; the allocation report in deposit's
// return value is decoded as a raw Val because it is never inspected here.
#[contractclient(name = "VaultClient")]
pub trait Vault {
    fn deposit(
        e: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> (Vec<i128>, i128, Val);

    fn withdraw(
        e: Env,
        withdraw_shares: i128,
        min_amounts_out: Vec<i128>,
        from: Address,
    ) -> Vec<i128>;
}

// Mirrors blend-contracts-v2's Request/Positions/Reserve* shapes (field
// names and types only; Soroban struct XDR is keyed by name, not
// declaration order). request_type is a bare u32 on the wire, matching the
// pool's own interface, even though Blend's Rust source models it as an enum.
#[contracttype]
#[derive(Clone)]
pub struct BlendRequest {
    pub address: Address,
    pub amount: i128,
    pub request_type: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct BlendPositions {
    pub collateral: Map<u32, i128>,
    pub liabilities: Map<u32, i128>,
    pub supply: Map<u32, i128>,
}

#[contracttype]
#[derive(Clone)]
pub struct BlendReserveConfig {
    pub c_factor: u32,
    pub decimals: u32,
    pub enabled: bool,
    pub index: u32,
    pub l_factor: u32,
    pub max_util: u32,
    pub r_base: u32,
    pub r_one: u32,
    pub r_three: u32,
    pub r_two: u32,
    pub reactivity: u32,
    pub supply_cap: i128,
    pub util: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct BlendReserveData {
    pub b_rate: i128,
    pub b_supply: i128,
    pub backstop_credit: i128,
    pub d_rate: i128,
    pub d_supply: i128,
    pub ir_mod: i128,
    pub last_time: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct BlendReserve {
    pub asset: Address,
    pub config: BlendReserveConfig,
    pub data: BlendReserveData,
    pub scalar: i128,
}

#[contractclient(name = "BlendPoolClient")]
pub trait BlendPool {
    fn submit(
        e: Env,
        from: Address,
        spender: Address,
        to: Address,
        requests: Vec<BlendRequest>,
    ) -> BlendPositions;

    fn get_positions(e: Env, address: Address) -> BlendPositions;

    fn get_reserve(e: Env, asset: Address) -> BlendReserve;
}

// Mirrors the Soroswap router interface (Uniswap V2 style). The pair
// contract's own deposit/withdraw/swap take no amount arguments and rely on
// the caller having already transferred tokens in, so the router - not the
// raw pair - is the safe integration point: it handles the SEP-41 transfers
// and auth itself.
#[contractclient(name = "SoroswapRouterClient")]
pub trait SoroswapRouter {
    fn add_liquidity(
        e: Env,
        token_a: Address,
        token_b: Address,
        amount_a_desired: i128,
        amount_b_desired: i128,
        amount_a_min: i128,
        amount_b_min: i128,
        to: Address,
        deadline: u64,
    ) -> (i128, i128, i128);

    fn remove_liquidity(
        e: Env,
        token_a: Address,
        token_b: Address,
        liquidity: i128,
        amount_a_min: i128,
        amount_b_min: i128,
        to: Address,
        deadline: u64,
    ) -> (i128, i128);

    fn swap_exact_tokens_for_tokens(
        e: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Vec<i128>;

    fn get_reserves(e: Env, factory: Address, token_a: Address, token_b: Address) -> (i128, i128);

    fn get_amounts_out(e: Env, factory: Address, amount_in: i128, path: Vec<Address>) -> Vec<i128>;

    fn quote(e: Env, amount_a: i128, reserve_a: i128, reserve_b: i128) -> i128;
}

// The pair contract is itself the LP token, so balance() reads on it go
// through the standard token::TokenClient; total_supply is the one extra
// read that interface doesn't expose.
#[contractclient(name = "SoroswapPairClient")]
pub trait SoroswapPair {
    fn total_supply(e: Env) -> i128;
}

#[contract]
pub struct Celengan;

#[contractimpl]
impl Celengan {
    pub fn __constructor(
        e: &Env,
        owner: Address,
        usdc: Address,
        vault: Address,
        blend_pool: Address,
        soroswap_router: Address,
        soroswap_factory: Address,
        soroswap_pair: Address,
        xlm: Address,
    ) {
        ownable::set_owner(e, &owner);
        e.storage().instance().set(
            &DataKey::Config,
            &Config {
                usdc,
                vault,
                blend_pool,
                soroswap_router,
                soroswap_factory,
                soroswap_pair,
                xlm,
            },
        );
    }

    /// Pays `to` through the splitter: the savings share of `amount` goes to
    /// `to`'s chosen yield source, the rest is credited to the spendable balance.
    #[when_not_paused]
    pub fn pay(e: &Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(e, Error::InvalidAmount);
        }
        let cfg = Self::config(e);
        token::TokenClient::new(e, &cfg.usdc).transfer(
            &from,
            &e.current_contract_address(),
            &amount,
        );

        let mut acc = Self::load_account(e, &to);
        let saved = amount * acc.split_bps as i128 / BPS_DENOM as i128;
        acc.spend += amount - saved;
        if saved > 0 {
            let usdc = token::TokenClient::new(e, &cfg.usdc);
            let before = usdc.balance(&e.current_contract_address());
            let minted = match acc.yield_target {
                YieldTarget::Defindex => Self::supply_defindex(e, &cfg, saved),
                YieldTarget::Blend => Self::supply_blend(e, &cfg, saved),
                YieldTarget::Soroswap => Self::supply_soroswap(e, &cfg, saved),
            };
            match minted {
                Some(shares) => acc.shares += shares,
                None => {
                    // Defindex and Blend fail as a single atomic call, so no
                    // funds ever move and this is just `saved`. Soroswap's
                    // failure path can still lose a little to its own
                    // unwind swap after the first swap already landed, so
                    // this is measured as a balance delta rather than
                    // assumed, credit exactly what the contract still
                    // holds instead of the amount originally intended.
                    let after = usdc.balance(&e.current_contract_address());
                    acc.spend += saved - (before - after);
                }
            }
        }
        Self::store_account(e, &to, &acc);
        e.events()
            .publish((symbol_short!("pay"), &to), (from, amount, saved));
    }

    // Withdrawals are deliberately not pausable: pause stops inflows only,
    // so the owner can never freeze user exits.
    pub fn withdraw_spend(e: &Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(e, Error::InvalidAmount);
        }
        let mut acc = Self::load_account(e, &user);
        if amount > acc.spend {
            panic_with_error!(e, Error::InsufficientSpend);
        }
        acc.spend -= amount;
        Self::store_account(e, &user, &acc);

        let cfg = Self::config(e);
        token::TokenClient::new(e, &cfg.usdc).transfer(
            &e.current_contract_address(),
            &user,
            &amount,
        );
        e.events()
            .publish((symbol_short!("wd_spend"), &user), amount);
    }

    /// Redeems savings shares from `user`'s yield source and sends the
    /// resulting USDC to them.
    pub fn withdraw_savings(e: &Env, user: Address, shares: i128) -> i128 {
        user.require_auth();
        if shares <= 0 {
            panic_with_error!(e, Error::InvalidAmount);
        }
        let mut acc = Self::load_account(e, &user);
        if shares > acc.shares {
            panic_with_error!(e, Error::InsufficientShares);
        }
        if e.ledger().timestamp() < acc.lock_until {
            panic_with_error!(e, Error::SavingsLocked);
        }

        // The payout is measured as a balance delta instead of trusting a
        // source's reported amount, so the pooled spend funds stay untouchable.
        let cfg = Self::config(e);
        let usdc = token::TokenClient::new(e, &cfg.usdc);
        let before = usdc.balance(&e.current_contract_address());
        let burnt = match acc.yield_target {
            YieldTarget::Defindex => {
                VaultClient::new(e, &cfg.vault).withdraw(
                    &shares,
                    &vec![e, 0],
                    &e.current_contract_address(),
                );
                shares
            }
            YieldTarget::Blend => Self::redeem_blend(e, &cfg, shares),
            YieldTarget::Soroswap => Self::redeem_soroswap(e, &cfg, shares),
        };
        let amount = usdc.balance(&e.current_contract_address()) - before;
        if amount <= 0 {
            panic_with_error!(e, Error::EmptyWithdrawal);
        }
        acc.shares -= burnt;
        Self::store_account(e, &user, &acc);
        usdc.transfer(&e.current_contract_address(), &user, &amount);
        e.events()
            .publish((symbol_short!("wd_save"), &user), (burnt, amount));
        amount
    }

    pub fn set_split(e: &Env, user: Address, bps: u32) {
        user.require_auth();
        if bps > BPS_DENOM {
            panic_with_error!(e, Error::InvalidSplit);
        }
        let mut acc = Self::load_account(e, &user);
        acc.split_bps = bps;
        Self::store_account(e, &user, &acc);
        e.events().publish((symbol_short!("split"), &user), bps);
    }

    /// Locks savings withdrawals until `until`; a lock can only be extended.
    pub fn set_lock(e: &Env, user: Address, until: u64) {
        user.require_auth();
        let mut acc = Self::load_account(e, &user);
        if until <= acc.lock_until {
            panic_with_error!(e, Error::LockNotExtended);
        }
        if until > e.ledger().timestamp() + MAX_LOCK_SECS {
            panic_with_error!(e, Error::LockTooLong);
        }
        acc.lock_until = until;
        Self::store_account(e, &user, &acc);
        e.events().publish((symbol_short!("lock"), &user), until);
    }

    /// Switches which protocol `user`'s future savings earn yield in. Only
    /// allowed at a zero balance, since the sources' shares are not
    /// interchangeable and withdrawing first keeps the accounting simple.
    pub fn set_yield_target(e: &Env, user: Address, target: YieldTarget) {
        user.require_auth();
        let mut acc = Self::load_account(e, &user);
        if acc.shares != 0 {
            panic_with_error!(e, Error::SwitchTargetWithBalance);
        }
        acc.yield_target = target;
        Self::store_account(e, &user, &acc);
        e.events()
            .publish((symbol_short!("target"), &user), target);
    }

    pub fn account_of(e: &Env, user: Address) -> Account {
        Self::load_account(e, &user)
    }

    pub fn usdc(e: &Env) -> Address {
        Self::config(e).usdc
    }

    pub fn vault(e: &Env) -> Address {
        Self::config(e).vault
    }

    pub fn blend_pool(e: &Env) -> Address {
        Self::config(e).blend_pool
    }

    pub fn soroswap_pair(e: &Env) -> Address {
        Self::config(e).soroswap_pair
    }

    pub fn owner(e: &Env) -> Option<Address> {
        ownable::get_owner(e)
    }

    pub fn paused(e: &Env) -> bool {
        pausable::paused(e)
    }

    #[only_owner]
    pub fn pause(e: &Env) {
        pausable::pause(e);
    }

    #[only_owner]
    pub fn unpause(e: &Env) {
        pausable::unpause(e);
    }

    fn config(e: &Env) -> Config {
        e.storage().instance().get(&DataKey::Config).unwrap()
    }

    fn supply_defindex(e: &Env, cfg: &Config, saved: i128) -> Option<i128> {
        Self::authorize_pull(e, &cfg.usdc, &cfg.vault, saved);
        match VaultClient::new(e, &cfg.vault).try_deposit(
            &vec![e, saved],
            &vec![e, saved],
            &e.current_contract_address(),
            &true,
        ) {
            Ok(Ok((_, shares, _))) => Some(shares),
            _ => None,
        }
    }

    // b-tokens minted are measured as a Positions delta (read before and
    // after submit) instead of computed from `saved` and a locally-read
    // b_rate, so a rate change between the two reads can never desync our
    // ledger from Blend's own truth.
    fn supply_blend(e: &Env, cfg: &Config, saved: i128) -> Option<i128> {
        let pool = BlendPoolClient::new(e, &cfg.blend_pool);
        let before = match pool.try_get_positions(&e.current_contract_address()) {
            Ok(Ok(positions)) => positions,
            _ => return None,
        };
        Self::authorize_pull(e, &cfg.usdc, &cfg.blend_pool, saved);
        let requests = vec![
            e,
            BlendRequest {
                address: cfg.usdc.clone(),
                amount: saved,
                request_type: BLEND_REQUEST_SUPPLY,
            },
        ];
        let after = match pool.try_submit(
            &e.current_contract_address(),
            &e.current_contract_address(),
            &e.current_contract_address(),
            &requests,
        ) {
            Ok(Ok(positions)) => positions,
            _ => return None,
        };
        let before_supply = before.supply.get(BLEND_USDC_RESERVE_INDEX).unwrap_or(0);
        let after_supply = after.supply.get(BLEND_USDC_RESERVE_INDEX).unwrap_or(0);
        Some(after_supply - before_supply)
    }

    // Blend's Withdraw request takes an amount in underlying units and burns
    // b_token_up(amount), clamped to this CONTRACT's total pooled balance -
    // not to any individual user's shares. Requesting the wrong amount could
    // therefore redeem another user's savings, so the underlying amount is
    // floor-rounded from `shares` (never rounds up past what the caller
    // owns), and the actual burn is re-measured from the Positions delta
    // rather than assumed to equal the request.
    fn redeem_blend(e: &Env, cfg: &Config, shares: i128) -> i128 {
        let pool = BlendPoolClient::new(e, &cfg.blend_pool);
        let reserve = pool.get_reserve(&cfg.usdc);
        let request_amount = (shares * reserve.data.b_rate) / BLEND_RATE_SCALAR;
        if request_amount <= 0 {
            panic_with_error!(e, Error::EmptyWithdrawal);
        }
        let before = pool.get_positions(&e.current_contract_address());
        let before_supply = before.supply.get(BLEND_USDC_RESERVE_INDEX).unwrap_or(0);
        let requests = vec![
            e,
            BlendRequest {
                address: cfg.usdc.clone(),
                amount: request_amount,
                request_type: BLEND_REQUEST_WITHDRAW,
            },
        ];
        let after = pool.submit(
            &e.current_contract_address(),
            &e.current_contract_address(),
            &e.current_contract_address(),
            &requests,
        );
        let after_supply = after.supply.get(BLEND_USDC_RESERVE_INDEX).unwrap_or(0);
        before_supply - after_supply
    }

    // Converting single-asset USDC into a two-sided LP position is
    // inherently two calls (swap half to XLM, then add both as liquidity),
    // unlike Blend or DeFindex's single-call deposit. Both legs use try_ so
    // a router outage still degrades to a spendable credit like the other
    // sources; the swap's and the liquidity add's minimums are computed
    // on-chain from get_amounts_out/live reserves, never left at zero.
    fn supply_soroswap(e: &Env, cfg: &Config, saved: i128) -> Option<i128> {
        let router = SoroswapRouterClient::new(e, &cfg.soroswap_router);
        let deadline = e.ledger().timestamp() + SOROSWAP_DEADLINE_SECS;
        let usdc_to_xlm = vec![e, cfg.usdc.clone(), cfg.xlm.clone()];

        let swap_amount = saved / 2;
        let keep_amount = saved - swap_amount;
        if swap_amount <= 0 || keep_amount <= 0 {
            return None;
        }

        let quoted = match router.try_get_amounts_out(&cfg.soroswap_factory, &swap_amount, &usdc_to_xlm)
        {
            Ok(Ok(amounts)) => amounts,
            _ => return None,
        };
        let expected_xlm = quoted.get(quoted.len().saturating_sub(1)).unwrap_or(0);
        if expected_xlm <= 0 {
            return None;
        }
        let min_xlm_out = Self::with_slippage(expected_xlm);

        let xlm_token = token::TokenClient::new(e, &cfg.xlm);
        let xlm_before = xlm_token.balance(&e.current_contract_address());
        // The router transfers straight from `to` (this contract) into the
        // pair contract itself, not into the router - verified against a
        // live testnet swap's own transfer event, since nothing in the
        // interface documents this.
        Self::authorize_pull(e, &cfg.usdc, &cfg.soroswap_pair, swap_amount);
        if router
            .try_swap_exact_tokens_for_tokens(
                &swap_amount,
                &min_xlm_out,
                &usdc_to_xlm,
                &e.current_contract_address(),
                &deadline,
            )
            .is_err()
        {
            return None; // try_ failure is atomic: no funds moved
        }
        let xlm_received = xlm_token.balance(&e.current_contract_address()) - xlm_before;
        if xlm_received <= 0 {
            return None;
        }

        // add_liquidity auto-balances to the pool's live ratio rather than
        // pulling the full desired amounts (confirmed live: a 2000000
        // desired USDC leg only pulled 1999421) - so the pre-authorized
        // transfer has to match that adjusted amount exactly, not the
        // desired one, or the real router's pull will have no matching
        // authorization. Reserves cannot move between this read and
        // add_liquidity's own internal read since both happen inside the
        // same atomic call, so computing the same optimal split here with
        // the router's own quote() is exact, not just an estimate. Both
        // reads are try_-wrapped and unwind on failure like every other
        // step here: a router outage on a plain read must not block
        // payroll any more than one on a state-changing call would.
        let (reserve_usdc, reserve_xlm) =
            match router.try_get_reserves(&cfg.soroswap_factory, &cfg.usdc, &cfg.xlm) {
                Ok(Ok(reserves)) => reserves,
                _ => {
                    Self::unwind_soroswap_xlm(e, cfg, xlm_received, deadline);
                    return None;
                }
            };
        let sized = if reserve_usdc <= 0 || reserve_xlm <= 0 {
            Some((keep_amount, xlm_received))
        } else {
            match router.try_quote(&keep_amount, &reserve_usdc, &reserve_xlm) {
                Ok(Ok(optimal_xlm)) if optimal_xlm <= xlm_received => {
                    Some((keep_amount, optimal_xlm))
                }
                Ok(Ok(_)) => match router.try_quote(&xlm_received, &reserve_xlm, &reserve_usdc) {
                    Ok(Ok(optimal_usdc)) => Some((optimal_usdc, xlm_received)),
                    _ => None,
                },
                _ => None,
            }
        };
        let (usdc_to_add, xlm_to_add) = match sized {
            Some(v) => v,
            None => {
                Self::unwind_soroswap_xlm(e, cfg, xlm_received, deadline);
                return None;
            }
        };

        let pair = token::TokenClient::new(e, &cfg.soroswap_pair);
        let lp_before = pair.balance(&e.current_contract_address());
        Self::authorize_pull(e, &cfg.usdc, &cfg.soroswap_pair, usdc_to_add);
        Self::authorize_pull(e, &cfg.xlm, &cfg.soroswap_pair, xlm_to_add);
        let added = router.try_add_liquidity(
            &cfg.usdc,
            &cfg.xlm,
            &keep_amount,
            &xlm_received,
            &Self::with_slippage(keep_amount),
            &Self::with_slippage(xlm_received),
            &e.current_contract_address(),
            &deadline,
        );
        if added.is_err() {
            Self::unwind_soroswap_xlm(e, cfg, xlm_received, deadline);
            return None;
        }
        let minted = pair.balance(&e.current_contract_address()) - lp_before;
        if minted <= 0 {
            return None;
        }
        Some(minted)
    }

    // Best-effort recovery swap shared by every failure branch in
    // supply_soroswap that runs after the first swap already landed XLM in
    // the contract: swaps it straight back to USDC so the payment still
    // degrades to an accurate spendable credit instead of stranding XLM
    // nothing accounts for. try_-wrapped like the rest of supply_soroswap: a
    // yield-source outage must not block payroll, even on this fallback
    // path. In the near-impossible case this unwind also fails - on a pool
    // that just swapped successfully moments earlier, in the same
    // transaction - the XLM is left in the contract unaccounted for rather
    // than blocking the payment.
    fn unwind_soroswap_xlm(e: &Env, cfg: &Config, xlm_amount: i128, deadline: u64) {
        let router = SoroswapRouterClient::new(e, &cfg.soroswap_router);
        let xlm_to_usdc = vec![e, cfg.xlm.clone(), cfg.usdc.clone()];
        Self::authorize_pull(e, &cfg.xlm, &cfg.soroswap_pair, xlm_amount);
        let _ = router.try_swap_exact_tokens_for_tokens(
            &xlm_amount,
            &0,
            &xlm_to_usdc,
            &e.current_contract_address(),
            &deadline,
        );
    }

    // Unlike supply, a failed withdrawal is safe to simply revert: the
    // caller still holds their shares and can retry. remove_liquidity and
    // the swap-back are plain (non-try_) calls, so any failure unwinds the
    // whole withdraw_savings call atomically instead of risking a stranded
    // XLM leg. Minimums come from live reserves and total supply, the same
    // proportional-share math the pool itself uses, not a trusted zero.
    fn redeem_soroswap(e: &Env, cfg: &Config, shares: i128) -> i128 {
        let router = SoroswapRouterClient::new(e, &cfg.soroswap_router);
        let pair_info = SoroswapPairClient::new(e, &cfg.soroswap_pair);
        let deadline = e.ledger().timestamp() + SOROSWAP_DEADLINE_SECS;

        let (reserve_usdc, reserve_xlm) =
            router.get_reserves(&cfg.soroswap_factory, &cfg.usdc, &cfg.xlm);
        let total_supply = pair_info.total_supply();
        if total_supply <= 0 {
            panic_with_error!(e, Error::EmptyWithdrawal);
        }
        let min_usdc = Self::with_slippage(reserve_usdc * shares / total_supply);
        let min_xlm = Self::with_slippage(reserve_xlm * shares / total_supply);

        let pair_token = token::TokenClient::new(e, &cfg.soroswap_pair);
        let lp_before = pair_token.balance(&e.current_contract_address());
        let xlm_token = token::TokenClient::new(e, &cfg.xlm);
        let xlm_before = xlm_token.balance(&e.current_contract_address());
        // The LP token being burned is transferred from `to` (this
        // contract) to the pair contract - which is also the LP token's own
        // address, since the pair contract is itself the LP token.
        Self::authorize_pull(e, &cfg.soroswap_pair, &cfg.soroswap_pair, shares);
        router.remove_liquidity(
            &cfg.usdc,
            &cfg.xlm,
            &shares,
            &min_usdc,
            &min_xlm,
            &e.current_contract_address(),
            &deadline,
        );
        let burnt = lp_before - pair_token.balance(&e.current_contract_address());
        let xlm_out = xlm_token.balance(&e.current_contract_address()) - xlm_before;

        if xlm_out > 0 {
            let xlm_to_usdc = vec![e, cfg.xlm.clone(), cfg.usdc.clone()];
            // The minimum has to come from a real USDC-denominated quote,
            // not a haircut of the XLM input amount itself - those are two
            // different tokens at a real exchange rate, not a 1:1 pair.
            let quoted = router.get_amounts_out(&cfg.soroswap_factory, &xlm_out, &xlm_to_usdc);
            let expected_usdc = quoted.get(quoted.len().saturating_sub(1)).unwrap_or(0);
            Self::authorize_pull(e, &cfg.xlm, &cfg.soroswap_pair, xlm_out);
            router.swap_exact_tokens_for_tokens(
                &xlm_out,
                &Self::with_slippage(expected_usdc),
                &xlm_to_usdc,
                &e.current_contract_address(),
                &deadline,
            );
        }
        burnt
    }

    fn with_slippage(amount: i128) -> i128 {
        amount * (BPS_DENOM as i128 - SOROSWAP_SLIPPAGE_BPS) / BPS_DENOM as i128
    }

    // The destination pulls the token from this contract inside its own
    // frame, so the transfer must be pre-authorized; invoker auth does not
    // reach it.
    fn authorize_pull(e: &Env, token: &Address, to: &Address, amount: i128) {
        e.authorize_as_current_contract(vec![
            e,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: token.clone(),
                    fn_name: Symbol::new(e, "transfer"),
                    args: (e.current_contract_address(), to.clone(), amount).into_val(e),
                },
                sub_invocations: vec![e],
            }),
        ]);
    }

    fn load_account(e: &Env, user: &Address) -> Account {
        let key = DataKey::Account(user.clone());
        match e.storage().persistent().get(&key) {
            Some(acc) => {
                e.storage().persistent().extend_ttl(
                    &key,
                    ACCOUNT_TTL_THRESHOLD,
                    ACCOUNT_TTL_EXTEND_TO,
                );
                acc
            }
            None => Account {
                split_bps: DEFAULT_SPLIT_BPS,
                spend: 0,
                shares: 0,
                lock_until: 0,
                yield_target: YieldTarget::Defindex,
            },
        }
    }

    fn store_account(e: &Env, user: &Address, acc: &Account) {
        let key = DataKey::Account(user.clone());
        e.storage().persistent().set(&key, acc);
        e.storage()
            .persistent()
            .extend_ttl(&key, ACCOUNT_TTL_THRESHOLD, ACCOUNT_TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;
