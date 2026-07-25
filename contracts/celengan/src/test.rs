#![cfg(test)]

use crate::{
    BlendPositions, BlendReserve, BlendReserveConfig, BlendReserveData, BlendRequest, Celengan,
    CelenganClient, YieldTarget, BLEND_REQUEST_SUPPLY, BLEND_REQUEST_WITHDRAW,
    BLEND_USDC_RESERVE_INDEX, DEFAULT_SPLIT_BPS,
};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{contract, contractimpl, contracttype, map, token, vec, Address, Env, Map, Vec};

#[contracttype]
enum VaultKey {
    Token,
    PriceBps,
    Fail,
}

#[soroban_sdk::contracterror]
#[derive(Copy, Clone)]
#[repr(u32)]
pub enum MockVaultError {
    Forced = 100,
}

#[contract]
pub struct MockVault;

#[contractimpl]
impl MockVault {
    pub fn __constructor(e: &Env, token: Address) {
        e.storage().instance().set(&VaultKey::Token, &token);
        e.storage().instance().set(&VaultKey::PriceBps, &10_000i128);
    }

    pub fn set_price_bps(e: &Env, bps: i128) {
        e.storage().instance().set(&VaultKey::PriceBps, &bps);
    }

    pub fn set_fail(e: &Env, fail: bool) {
        e.storage().instance().set(&VaultKey::Fail, &fail);
    }

    pub fn deposit(
        e: Env,
        amounts_desired: Vec<i128>,
        _amounts_min: Vec<i128>,
        from: Address,
        _invest: bool,
    ) -> (Vec<i128>, i128, Option<i128>) {
        from.require_auth();
        if e.storage()
            .instance()
            .get(&VaultKey::Fail)
            .unwrap_or(false)
        {
            soroban_sdk::panic_with_error!(&e, MockVaultError::Forced);
        }
        let token_addr: Address = e.storage().instance().get(&VaultKey::Token).unwrap();
        let price: i128 = e.storage().instance().get(&VaultKey::PriceBps).unwrap();
        let amount = amounts_desired.get(0).unwrap();
        token::TokenClient::new(&e, &token_addr).transfer(
            &from,
            &e.current_contract_address(),
            &amount,
        );
        (amounts_desired, amount * 10_000 / price, None)
    }

    pub fn withdraw(
        e: Env,
        withdraw_shares: i128,
        _min_amounts_out: Vec<i128>,
        from: Address,
    ) -> Vec<i128> {
        from.require_auth();
        let token_addr: Address = e.storage().instance().get(&VaultKey::Token).unwrap();
        let price: i128 = e.storage().instance().get(&VaultKey::PriceBps).unwrap();
        let amount = withdraw_shares * price / 10_000;
        token::TokenClient::new(&e, &token_addr).transfer(
            &e.current_contract_address(),
            &from,
            &amount,
        );
        vec![&e, amount]
    }
}

// Mirrors blend-contracts-v2's own floor/ceil conventions exactly (not an
// approximation), so tests exercise the same rounding boundaries the real
// pool would produce: to_b_token_down floors, to_b_token_up ceils,
// to_asset_from_b_token floors.
const MOCK_RATE_SCALE: i128 = 1_000_000_000_000;

#[contracttype]
enum BlendMockKey {
    Token,
    Rate,
    Fail,
    FailAfterTransfer,
    Supply(Address),
}

#[contract]
pub struct MockBlendPool;

#[contractimpl]
impl MockBlendPool {
    pub fn __constructor(e: &Env, token: Address) {
        e.storage().instance().set(&BlendMockKey::Token, &token);
        e.storage()
            .instance()
            .set(&BlendMockKey::Rate, &MOCK_RATE_SCALE);
    }

    pub fn set_rate(e: &Env, rate: i128) {
        e.storage().instance().set(&BlendMockKey::Rate, &rate);
    }

    pub fn set_fail(e: &Env, fail: bool) {
        e.storage().instance().set(&BlendMockKey::Fail, &fail);
    }

    // fails after the token has already left the caller, to prove a trapped
    // submit() rolls the transfer back rather than stranding it mid-call
    pub fn set_fail_after_transfer(e: &Env, fail: bool) {
        e.storage()
            .instance()
            .set(&BlendMockKey::FailAfterTransfer, &fail);
    }

    fn positions_for(e: &Env, supply: i128) -> BlendPositions {
        BlendPositions {
            collateral: Map::new(e),
            liabilities: Map::new(e),
            supply: map![e, (BLEND_USDC_RESERVE_INDEX, supply)],
        }
    }

    pub fn submit(
        e: Env,
        from: Address,
        spender: Address,
        to: Address,
        requests: Vec<BlendRequest>,
    ) -> BlendPositions {
        spender.require_auth();
        if e.storage()
            .instance()
            .get(&BlendMockKey::Fail)
            .unwrap_or(false)
        {
            panic!("blend pool forced failure");
        }
        let token_addr: Address = e.storage().instance().get(&BlendMockKey::Token).unwrap();
        let rate: i128 = e.storage().instance().get(&BlendMockKey::Rate).unwrap();
        let key = BlendMockKey::Supply(from.clone());
        let mut supply: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        let usdc = token::TokenClient::new(&e, &token_addr);

        for req in requests.iter() {
            if req.request_type == BLEND_REQUEST_SUPPLY {
                usdc.transfer(&from, &e.current_contract_address(), &req.amount);
                if e.storage()
                    .instance()
                    .get(&BlendMockKey::FailAfterTransfer)
                    .unwrap_or(false)
                {
                    panic!("blend pool forced failure after transfer");
                }
                let minted = (req.amount * MOCK_RATE_SCALE) / rate; // floor
                supply += minted;
            } else if req.request_type == BLEND_REQUEST_WITHDRAW {
                let mut burn = (req.amount * MOCK_RATE_SCALE + rate - 1) / rate; // ceil
                if burn > supply {
                    burn = supply;
                }
                let payout = (burn * rate) / MOCK_RATE_SCALE; // floor
                supply -= burn;
                if payout > 0 {
                    usdc.transfer(&e.current_contract_address(), &to, &payout);
                }
            }
        }
        e.storage().persistent().set(&key, &supply);
        Self::positions_for(&e, supply)
    }

    pub fn get_positions(e: Env, address: Address) -> BlendPositions {
        let key = BlendMockKey::Supply(address);
        let supply: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        Self::positions_for(&e, supply)
    }

    pub fn get_reserve(e: Env, asset: Address) -> BlendReserve {
        let rate: i128 = e.storage().instance().get(&BlendMockKey::Rate).unwrap();
        BlendReserve {
            asset,
            config: BlendReserveConfig {
                c_factor: 0,
                decimals: 7,
                enabled: true,
                index: BLEND_USDC_RESERVE_INDEX,
                l_factor: 0,
                max_util: 0,
                r_base: 0,
                r_one: 0,
                r_three: 0,
                r_two: 0,
                reactivity: 0,
                supply_cap: 0,
                util: 0,
            },
            data: BlendReserveData {
                b_rate: rate,
                b_supply: 0,
                backstop_credit: 0,
                d_rate: 0,
                d_supply: 0,
                ir_mod: 0,
                last_time: 0,
            },
            scalar: 10_000_000,
        }
    }
}

// A single mock plays router, factory, and pair at once (Celengan calls all
// three as separate Config addresses, but nothing about its own logic
// depends on them being different contracts). Reserves are read straight
// from this contract's own real token balances - not a separately tracked
// stat - so they can never drift from what add_liquidity/swap actually move,
// and get_amounts_out/swap_exact_tokens_for_tokens share one constant-product
// formula so a same-transaction quote-then-swap is always self-consistent,
// the same guarantee the real pool gives within one atomic call.
#[contracttype]
enum SoroswapMockKey {
    TokenA,
    TokenB,
    TotalSupply,
    LpBalance(Address),
    FailSwap,
    FailAddLiquidity,
    FailReads,
}

#[contract]
pub struct MockSoroswapRouter;

#[contractimpl]
impl MockSoroswapRouter {
    pub fn __constructor(e: &Env, token_a: Address, token_b: Address) {
        e.storage().instance().set(&SoroswapMockKey::TokenA, &token_a);
        e.storage().instance().set(&SoroswapMockKey::TokenB, &token_b);
        e.storage().instance().set(&SoroswapMockKey::TotalSupply, &0i128);
    }

    pub fn set_fail_swap(e: &Env, fail: bool) {
        e.storage().instance().set(&SoroswapMockKey::FailSwap, &fail);
    }

    pub fn set_fail_add_liquidity(e: &Env, fail: bool) {
        e.storage()
            .instance()
            .set(&SoroswapMockKey::FailAddLiquidity, &fail);
    }

    pub fn set_fail_reads(e: &Env, fail: bool) {
        e.storage().instance().set(&SoroswapMockKey::FailReads, &fail);
    }

    // Test-only: seeds the pool from a third-party LP so Celengan's own
    // calls always land against a realistic, already-nonzero pool, matching
    // how the live testnet pool actually looks.
    pub fn seed_liquidity(e: Env, from: Address, amount_a: i128, amount_b: i128, lp_to_mint: i128) {
        from.require_auth();
        let ta: Address = e.storage().instance().get(&SoroswapMockKey::TokenA).unwrap();
        let tb: Address = e.storage().instance().get(&SoroswapMockKey::TokenB).unwrap();
        token::TokenClient::new(&e, &ta).transfer(&from, &e.current_contract_address(), &amount_a);
        token::TokenClient::new(&e, &tb).transfer(&from, &e.current_contract_address(), &amount_b);
        let total_supply: i128 = e.storage().instance().get(&SoroswapMockKey::TotalSupply).unwrap();
        e.storage()
            .instance()
            .set(&SoroswapMockKey::TotalSupply, &(total_supply + lp_to_mint));
        let key = SoroswapMockKey::LpBalance(from);
        let bal: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        e.storage().persistent().set(&key, &(bal + lp_to_mint));
    }

    pub fn total_supply(e: Env) -> i128 {
        e.storage().instance().get(&SoroswapMockKey::TotalSupply).unwrap_or(0)
    }

    pub fn balance(e: Env, id: Address) -> i128 {
        e.storage()
            .persistent()
            .get(&SoroswapMockKey::LpBalance(id))
            .unwrap_or(0)
    }

    fn check_fail_reads(e: &Env) {
        if e.storage().instance().get(&SoroswapMockKey::FailReads).unwrap_or(false) {
            panic!("soroswap reads forced failure");
        }
    }

    pub fn get_reserves(e: Env, _factory: Address, token_a: Address, _token_b: Address) -> (i128, i128) {
        Self::check_fail_reads(&e);
        let ta: Address = e.storage().instance().get(&SoroswapMockKey::TokenA).unwrap();
        let tb: Address = e.storage().instance().get(&SoroswapMockKey::TokenB).unwrap();
        let balance_a = token::TokenClient::new(&e, &ta).balance(&e.current_contract_address());
        let balance_b = token::TokenClient::new(&e, &tb).balance(&e.current_contract_address());
        if token_a == ta {
            (balance_a, balance_b)
        } else {
            (balance_b, balance_a)
        }
    }

    pub fn get_amounts_out(e: Env, _factory: Address, amount_in: i128, path: Vec<Address>) -> Vec<i128> {
        let token_in = path.get(0).unwrap();
        let token_out = path.get(1).unwrap();
        let reserve_in = token::TokenClient::new(&e, &token_in).balance(&e.current_contract_address());
        let reserve_out = token::TokenClient::new(&e, &token_out).balance(&e.current_contract_address());
        let amount_out = Self::quote_out(amount_in, reserve_in, reserve_out);
        vec![&e, amount_in, amount_out]
    }

    // Constant product with a flat 0.3% fee, the same convention Soroswap
    // and Uniswap V2 both use.
    fn quote_out(amount_in: i128, reserve_in: i128, reserve_out: i128) -> i128 {
        let amount_in_with_fee = amount_in * 997;
        (amount_in_with_fee * reserve_out) / (reserve_in * 1000 + amount_in_with_fee)
    }

    pub fn quote(e: Env, amount_a: i128, reserve_a: i128, reserve_b: i128) -> i128 {
        Self::check_fail_reads(&e);
        amount_a * reserve_b / reserve_a
    }

    pub fn swap_exact_tokens_for_tokens(
        e: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        _deadline: u64,
    ) -> Vec<i128> {
        to.require_auth();
        if e.storage().instance().get(&SoroswapMockKey::FailSwap).unwrap_or(false) {
            panic!("soroswap swap forced failure");
        }
        let token_in = path.get(0).unwrap();
        let token_out = path.get(1).unwrap();
        let reserve_in = token::TokenClient::new(&e, &token_in).balance(&e.current_contract_address());
        let reserve_out = token::TokenClient::new(&e, &token_out).balance(&e.current_contract_address());
        let amount_out = Self::quote_out(amount_in, reserve_in, reserve_out);
        if amount_out < amount_out_min {
            panic!("soroswap swap slippage not met");
        }
        token::TokenClient::new(&e, &token_in).transfer(&to, &e.current_contract_address(), &amount_in);
        token::TokenClient::new(&e, &token_out).transfer(&e.current_contract_address(), &to, &amount_out);
        vec![&e, amount_in, amount_out]
    }

    pub fn add_liquidity(
        e: Env,
        token_a: Address,
        _token_b: Address,
        amount_a_desired: i128,
        amount_b_desired: i128,
        amount_a_min: i128,
        amount_b_min: i128,
        to: Address,
        _deadline: u64,
    ) -> (i128, i128, i128) {
        to.require_auth();
        if e.storage()
            .instance()
            .get(&SoroswapMockKey::FailAddLiquidity)
            .unwrap_or(false)
        {
            panic!("soroswap add_liquidity forced failure");
        }
        let ta: Address = e.storage().instance().get(&SoroswapMockKey::TokenA).unwrap();
        let tb: Address = e.storage().instance().get(&SoroswapMockKey::TokenB).unwrap();
        let same_order = token_a == ta;
        let (desired_a, desired_b, min_a, min_b) = if same_order {
            (amount_a_desired, amount_b_desired, amount_a_min, amount_b_min)
        } else {
            (amount_b_desired, amount_a_desired, amount_b_min, amount_a_min)
        };

        let reserve_a = token::TokenClient::new(&e, &ta).balance(&e.current_contract_address());
        let reserve_b = token::TokenClient::new(&e, &tb).balance(&e.current_contract_address());
        let total_supply: i128 = e.storage().instance().get(&SoroswapMockKey::TotalSupply).unwrap();

        let (amount_a, amount_b) = if reserve_a == 0 || reserve_b == 0 {
            (desired_a, desired_b)
        } else {
            let optimal_b = desired_a * reserve_b / reserve_a;
            if optimal_b <= desired_b {
                (desired_a, optimal_b)
            } else {
                let optimal_a = desired_b * reserve_a / reserve_b;
                (optimal_a, desired_b)
            }
        };
        if amount_a < min_a || amount_b < min_b {
            panic!("soroswap add_liquidity slippage not met");
        }

        token::TokenClient::new(&e, &ta).transfer(&to, &e.current_contract_address(), &amount_a);
        token::TokenClient::new(&e, &tb).transfer(&to, &e.current_contract_address(), &amount_b);

        let minted = if total_supply == 0 {
            amount_a
        } else {
            core::cmp::min(
                amount_a * total_supply / reserve_a,
                amount_b * total_supply / reserve_b,
            )
        };
        e.storage()
            .instance()
            .set(&SoroswapMockKey::TotalSupply, &(total_supply + minted));
        let key = SoroswapMockKey::LpBalance(to.clone());
        let bal: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        e.storage().persistent().set(&key, &(bal + minted));

        if same_order {
            (amount_a, amount_b, minted)
        } else {
            (amount_b, amount_a, minted)
        }
    }

    pub fn remove_liquidity(
        e: Env,
        token_a: Address,
        _token_b: Address,
        liquidity: i128,
        amount_a_min: i128,
        amount_b_min: i128,
        to: Address,
        _deadline: u64,
    ) -> (i128, i128) {
        to.require_auth();
        let ta: Address = e.storage().instance().get(&SoroswapMockKey::TokenA).unwrap();
        let tb: Address = e.storage().instance().get(&SoroswapMockKey::TokenB).unwrap();
        let same_order = token_a == ta;

        let key = SoroswapMockKey::LpBalance(to.clone());
        let bal: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        if liquidity > bal {
            panic!("soroswap insufficient LP balance");
        }
        let total_supply: i128 = e.storage().instance().get(&SoroswapMockKey::TotalSupply).unwrap();
        let reserve_a = token::TokenClient::new(&e, &ta).balance(&e.current_contract_address());
        let reserve_b = token::TokenClient::new(&e, &tb).balance(&e.current_contract_address());

        let amount_a = reserve_a * liquidity / total_supply;
        let amount_b = reserve_b * liquidity / total_supply;
        let (min_a, min_b) = if same_order {
            (amount_a_min, amount_b_min)
        } else {
            (amount_b_min, amount_a_min)
        };
        if amount_a < min_a || amount_b < min_b {
            panic!("soroswap remove_liquidity slippage not met");
        }

        e.storage().persistent().set(&key, &(bal - liquidity));
        e.storage()
            .instance()
            .set(&SoroswapMockKey::TotalSupply, &(total_supply - liquidity));
        token::TokenClient::new(&e, &ta).transfer(&e.current_contract_address(), &to, &amount_a);
        token::TokenClient::new(&e, &tb).transfer(&e.current_contract_address(), &to, &amount_b);

        if same_order {
            (amount_a, amount_b)
        } else {
            (amount_b, amount_a)
        }
    }
}

struct Setup<'a> {
    client: CelenganClient<'a>,
    owner: Address,
    usdc: TokenClient<'a>,
    usdc_admin: StellarAssetClient<'a>,
    xlm: TokenClient<'a>,
    xlm_admin: StellarAssetClient<'a>,
    vault: Address,
    blend: Address,
    soroswap: Address,
}

fn setup(e: &Env) -> Setup<'_> {
    e.mock_all_auths();
    let owner = Address::generate(e);
    let issuer = Address::generate(e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let usdc = TokenClient::new(e, &sac.address());
    let usdc_admin = StellarAssetClient::new(e, &sac.address());
    let xlm_issuer = Address::generate(e);
    let xlm_sac = e.register_stellar_asset_contract_v2(xlm_issuer);
    let xlm = TokenClient::new(e, &xlm_sac.address());
    let xlm_admin = StellarAssetClient::new(e, &xlm_sac.address());
    let vault = e.register(MockVault, (&sac.address(),));
    let blend = e.register(MockBlendPool, (&sac.address(),));
    let soroswap = e.register(MockSoroswapRouter, (&sac.address(), &xlm_sac.address()));
    let id = e.register(
        Celengan,
        (
            &owner,
            &sac.address(),
            &vault,
            &blend,
            &soroswap,
            &soroswap,
            &soroswap,
            &xlm_sac.address(),
        ),
    );
    Setup {
        client: CelenganClient::new(e, &id),
        owner,
        usdc,
        usdc_admin,
        xlm,
        xlm_admin,
        vault,
        blend,
        soroswap,
    }
}

// Seeds the mock pool with a realistic, already-nonzero position from a
// third party (never Celengan itself), roughly matching the live testnet
// pool's ~1:2 USDC:XLM ratio.
fn seed_soroswap_pool(e: &Env, s: &Setup) {
    let lp_seeder = Address::generate(e);
    s.usdc_admin.mint(&lp_seeder, &10_000_0000000);
    s.xlm_admin.mint(&lp_seeder, &20_000_0000000);
    MockSoroswapRouterClient::new(e, &s.soroswap).seed_liquidity(
        &lp_seeder,
        &10_000_0000000,
        &20_000_0000000,
        &10_000_0000000,
    );
}

fn fund(s: &Setup, who: &Address, amount: i128) {
    s.usdc_admin.mint(who, &amount);
}

#[test]
fn constructor_stores_config() {
    let e = Env::default();
    let s = setup(&e);
    assert_eq!(s.client.usdc(), s.usdc.address);
    assert_eq!(s.client.vault(), s.vault);
    assert_eq!(s.client.blend_pool(), s.blend);
    assert_eq!(s.client.owner(), Some(s.owner.clone()));
    assert!(!s.client.paused());
}

#[test]
fn new_account_has_default_split_and_defindex_target() {
    let e = Env::default();
    let s = setup(&e);
    let user = Address::generate(&e);
    let acc = s.client.account_of(&user);
    assert_eq!(acc.split_bps, DEFAULT_SPLIT_BPS);
    assert_eq!(acc.spend, 0);
    assert_eq!(acc.shares, 0);
    assert_eq!(acc.lock_until, 0);
    assert_eq!(acc.yield_target, YieldTarget::Defindex);
}

#[test]
fn pay_splits_between_spend_and_vault() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 1_000_0000000);

    s.client.pay(&payer, &worker, &100_0000000);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 80_0000000);
    assert_eq!(acc.shares, 20_0000000);
    assert_eq!(s.usdc.balance(&s.client.address), 80_0000000);
    assert_eq!(s.usdc.balance(&s.vault), 20_0000000);
}

#[test]
fn pay_with_zero_split_keeps_all_spendable() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.set_split(&worker, &0);

    s.client.pay(&payer, &worker, &100);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 100);
    assert_eq!(acc.shares, 0);
}

#[test]
fn pay_with_full_split_saves_everything() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.set_split(&worker, &10_000);

    s.client.pay(&payer, &worker, &100);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 0);
    assert_eq!(acc.shares, 100);
}

#[test]
fn pay_rounds_savings_down() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 10);

    s.client.pay(&payer, &worker, &1);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 1);
    assert_eq!(acc.shares, 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn pay_rejects_zero_amount() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    s.client.pay(&payer, &worker, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn set_split_rejects_over_100_percent() {
    let e = Env::default();
    let s = setup(&e);
    let user = Address::generate(&e);
    s.client.set_split(&user, &10_001);
}

#[test]
fn withdraw_spend_transfers_to_user() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);

    s.client.withdraw_spend(&worker, &50);

    assert_eq!(s.usdc.balance(&worker), 50);
    assert_eq!(s.client.account_of(&worker).spend, 30);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn withdraw_spend_rejects_overdraw() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);
    s.client.withdraw_spend(&worker, &81);
}

#[test]
fn withdraw_savings_redeems_shares() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);

    let amount = s.client.withdraw_savings(&worker, &20);

    assert_eq!(amount, 20);
    assert_eq!(s.usdc.balance(&worker), 20);
    assert_eq!(s.client.account_of(&worker).shares, 0);
}

#[test]
fn withdraw_savings_receives_accrued_yield() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.pay(&payer, &worker, &100_0000000);
    fund(&s, &s.vault, 2_0000000); // simulates vault earnings
    MockVaultClient::new(&e, &s.vault).set_price_bps(&11_000);

    let amount = s.client.withdraw_savings(&worker, &20_0000000);

    assert_eq!(amount, 22_0000000);
    assert_eq!(s.usdc.balance(&worker), 22_0000000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn withdraw_savings_rejects_over_shares() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);
    s.client.withdraw_savings(&worker, &21);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn withdraw_savings_respects_lock() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);
    s.client.set_lock(&worker, &1_000);
    s.client.withdraw_savings(&worker, &20);
}

#[test]
fn withdraw_savings_allowed_after_lock_expires() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);
    s.client.set_lock(&worker, &1_000);
    e.ledger().set_timestamp(1_000);

    let amount = s.client.withdraw_savings(&worker, &20);
    assert_eq!(amount, 20);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn set_lock_can_only_extend() {
    let e = Env::default();
    let s = setup(&e);
    let user = Address::generate(&e);
    s.client.set_lock(&user, &1_000);
    s.client.set_lock(&user, &500);
}

#[test]
#[should_panic(expected = "Error(Contract, #1000)")]
fn pause_blocks_pay() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pause();
    s.client.pay(&payer, &worker, &100);
}

#[test]
fn unpause_restores_pay() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pause();
    s.client.unpause();
    s.client.pay(&payer, &worker, &100);
    assert_eq!(s.client.account_of(&worker).spend, 80);
}

#[test]
fn withdrawals_work_while_paused() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);
    s.client.pause();

    s.client.withdraw_spend(&worker, &80);
    let amount = s.client.withdraw_savings(&worker, &20);

    assert_eq!(amount, 20);
    assert_eq!(s.usdc.balance(&worker), 100);
}

#[test]
fn vault_failure_credits_savings_as_spend() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    MockVaultClient::new(&e, &s.vault).set_fail(&true);

    s.client.pay(&payer, &worker, &100);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 100);
    assert_eq!(acc.shares, 0);
    assert_eq!(s.usdc.balance(&s.client.address), 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn zero_value_withdrawal_reverts() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);
    MockVaultClient::new(&e, &s.vault).set_price_bps(&0);
    s.client.withdraw_savings(&worker, &20);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn set_lock_rejects_absurd_horizon() {
    let e = Env::default();
    let s = setup(&e);
    let user = Address::generate(&e);
    s.client.set_lock(&user, &(crate::MAX_LOCK_SECS + 1));
}

// -- Blend yield target --

#[test]
fn set_yield_target_switches_to_blend() {
    let e = Env::default();
    let s = setup(&e);
    let user = Address::generate(&e);
    s.client.set_yield_target(&user, &YieldTarget::Blend);
    assert_eq!(s.client.account_of(&user).yield_target, YieldTarget::Blend);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn set_yield_target_blocked_with_balance() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.pay(&payer, &worker, &100);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
}

#[test]
fn pay_routes_to_blend_when_selected() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);

    s.client.pay(&payer, &worker, &100);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 80);
    assert_eq!(acc.shares, 20); // 1:1 rate by default
    assert_eq!(s.usdc.balance(&s.blend), 20);
    assert_eq!(s.usdc.balance(&s.client.address), 80);
}

#[test]
fn blend_withdraw_savings_redeems_shares() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
    s.client.pay(&payer, &worker, &100);

    let amount = s.client.withdraw_savings(&worker, &20);

    assert_eq!(amount, 20);
    assert_eq!(s.usdc.balance(&worker), 20);
    assert_eq!(s.client.account_of(&worker).shares, 0);
}

#[test]
fn blend_withdraw_savings_receives_accrued_yield() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
    s.client.pay(&payer, &worker, &100_0000000);
    fund(&s, &s.blend, 2_0000000); // simulates pool interest accrual
    MockBlendPoolClient::new(&e, &s.blend).set_rate(&1_100_000_000_000); // 1.10x

    let amount = s.client.withdraw_savings(&worker, &20_0000000);

    assert_eq!(amount, 22_0000000);
    assert_eq!(s.usdc.balance(&worker), 22_0000000);
}

#[test]
fn blend_pay_shares_measured_as_positions_delta_at_accrued_rate() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
    MockBlendPoolClient::new(&e, &s.blend).set_rate(&1_250_000_000_000); // 1.25x already accrued

    s.client.pay(&payer, &worker, &100_0000000);

    // saved = 20_0000000 USDC; minted b-tokens = floor(saved * SCALE / rate)
    let acc = s.client.account_of(&worker);
    assert_eq!(acc.shares, 16_0000000);
}

#[test]
fn blend_failure_credits_savings_as_spend() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
    MockBlendPoolClient::new(&e, &s.blend).set_fail(&true);

    s.client.pay(&payer, &worker, &100);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 100);
    assert_eq!(acc.shares, 0);
    assert_eq!(s.usdc.balance(&s.client.address), 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn blend_withdraw_savings_rejects_over_shares() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
    s.client.pay(&payer, &worker, &100);
    s.client.withdraw_savings(&worker, &21);
}

#[test]
fn blend_withdraw_rounding_with_nonzero_remainder_zeroes_out_exactly() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 1_000_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
    s.client.set_split(&worker, &10_000); // save everything, exact share count
    // a rate with no clean relationship to the deposit forces a nonzero
    // floor remainder in redeem_blend's shares -> underlying conversion
    MockBlendPoolClient::new(&e, &s.blend).set_rate(&1_333_333_333_333);

    s.client.pay(&payer, &worker, &777_0000000);
    let shares = s.client.account_of(&worker).shares;
    assert!(shares > 0);

    s.client.withdraw_savings(&worker, &shares);

    // to_burn == shares exactly whenever b_rate >= SCALAR_12 (proved during
    // review), even though the double floor-rounding on the underlying
    // payout can leave up to 1 stroop of protocol-favoring dust at Blend
    // itself - that dust belongs to the pool, not to any Celengan user, and
    // never shows up as unaccounted value in this contract's own ledger
    assert_eq!(s.client.account_of(&worker).shares, 0);
    assert!(s.usdc.balance(&s.blend) <= 1);
    // switching now must succeed, proving no dust was left stranded at Blend
    s.client.set_yield_target(&worker, &YieldTarget::Defindex);
}

#[test]
fn blend_transfer_rolls_back_when_submit_fails_after_it() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
    MockBlendPoolClient::new(&e, &s.blend).set_fail_after_transfer(&true);

    s.client.pay(&payer, &worker, &100);

    // the mock's transfer-then-panic proves try_submit's failure unwinds the
    // whole sub-call, so the contract's own balance is exactly as if the
    // Blend attempt had never touched the token contract at all
    assert_eq!(s.usdc.balance(&s.client.address), 100);
    assert_eq!(s.usdc.balance(&s.blend), 0);
    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 100);
    assert_eq!(acc.shares, 0);
}

#[test]
fn blend_multiple_users_do_not_contaminate_each_others_shares() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    fund(&s, &payer, 1_000);
    s.client.set_yield_target(&alice, &YieldTarget::Blend);
    s.client.set_yield_target(&bob, &YieldTarget::Blend);

    s.client.pay(&payer, &alice, &100); // alice: 20 shares
    s.client.pay(&payer, &bob, &500); // bob: 100 shares

    assert_eq!(s.client.account_of(&alice).shares, 20);
    assert_eq!(s.client.account_of(&bob).shares, 100);

    let alice_amount = s.client.withdraw_savings(&alice, &20);
    assert_eq!(alice_amount, 20);
    assert_eq!(s.client.account_of(&alice).shares, 0);
    // bob's position is untouched by alice's withdrawal
    assert_eq!(s.client.account_of(&bob).shares, 100);

    let bob_amount = s.client.withdraw_savings(&bob, &100);
    assert_eq!(bob_amount, 100);
    assert_eq!(s.client.account_of(&bob).shares, 0);
}

#[test]
fn switching_target_after_full_withdrawal_is_allowed() {
    let e = Env::default();
    let s = setup(&e);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 200);
    s.client.pay(&payer, &worker, &100); // defindex, 20 shares

    s.client.withdraw_savings(&worker, &20);
    s.client.set_yield_target(&worker, &YieldTarget::Blend);
    s.client.pay(&payer, &worker, &100); // now routes to blend

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.yield_target, YieldTarget::Blend);
    assert_eq!(acc.shares, 20);
    assert_eq!(s.usdc.balance(&s.vault), 0);
    assert_eq!(s.usdc.balance(&s.blend), 20);
}

// -- Soroswap yield target --
//
// The exact numbers below come from the mock's constant-product formula
// (0.3% fee, matching Soroswap/Uniswap V2) against the pool seeded by
// seed_soroswap_pool (10,000 USDC : 20,000 XLM, the live testnet pool's own
// ratio), not arbitrary values - see the Python reference calculation used
// to derive them if these ever need to be recomputed after a mock change.

#[test]
fn set_yield_target_switches_to_soroswap() {
    let e = Env::default();
    let s = setup(&e);
    let user = Address::generate(&e);
    s.client.set_yield_target(&user, &YieldTarget::Soroswap);
    assert_eq!(s.client.account_of(&user).yield_target, YieldTarget::Soroswap);
}

#[test]
fn soroswap_pay_swaps_half_and_mints_lp_shares() {
    let e = Env::default();
    let s = setup(&e);
    seed_soroswap_pool(&e, &s);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Soroswap);

    s.client.pay(&payer, &worker, &100_0000000);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 80_0000000);
    assert_eq!(acc.shares, 99699999);
    // Celengan is the only depositor besides the pool seeder, so its shares
    // ledger must exactly match the LP balance the mock actually minted it.
    let lp = MockSoroswapRouterClient::new(&e, &s.soroswap).balance(&s.client.address);
    assert_eq!(acc.shares, lp);
    // add_liquidity auto-balances to the pool ratio and leaves a small
    // uncredited USDC remainder sitting in the contract as real token
    // balance (never lost, just not swept into anyone's shares or spend)
    assert_eq!(s.usdc.balance(&s.client.address), 80_0200301);
}

#[test]
fn soroswap_withdraw_savings_redeems_shares() {
    let e = Env::default();
    let s = setup(&e);
    seed_soroswap_pool(&e, &s);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Soroswap);
    s.client.pay(&payer, &worker, &100_0000000);
    let shares = s.client.account_of(&worker).shares;

    let amount = s.client.withdraw_savings(&worker, &shares);

    // two AMM legs (remove_liquidity's XLM leg swapped back to USDC) each
    // cost ~0.3%, so the round trip returns a bit less than the 20 USDC
    // saved, never more
    assert_eq!(amount, 19_9201191);
    assert_eq!(s.client.account_of(&worker).shares, 0);
    assert_eq!(s.usdc.balance(&worker), amount);
    let lp = MockSoroswapRouterClient::new(&e, &s.soroswap).balance(&s.client.address);
    assert_eq!(lp, 0);
    assert_eq!(s.xlm.balance(&s.client.address), 0);
}

#[test]
fn soroswap_swap_failure_credits_savings_as_spend() {
    let e = Env::default();
    let s = setup(&e);
    seed_soroswap_pool(&e, &s);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Soroswap);
    MockSoroswapRouterClient::new(&e, &s.soroswap).set_fail_swap(&true);

    s.client.pay(&payer, &worker, &100_0000000);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.spend, 100_0000000);
    assert_eq!(acc.shares, 0);
    assert_eq!(s.usdc.balance(&s.client.address), 100_0000000);
    assert_eq!(s.xlm.balance(&s.client.address), 0);
}

// The key adversarial case for the two-call swap-then-add-liquidity design:
// the first swap already landed XLM in the contract before add_liquidity
// fails. This proves the unwind swap fires, nothing is left stranded as
// XLM, and pay() credits exactly what was recovered (not the full amount
// originally intended to be saved, which would over-promise against the
// double-swap fee already paid).
#[test]
fn soroswap_add_liquidity_failure_unwinds_and_credits_actual_recovered_amount() {
    let e = Env::default();
    let s = setup(&e);
    seed_soroswap_pool(&e, &s);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Soroswap);
    MockSoroswapRouterClient::new(&e, &s.soroswap).set_fail_add_liquidity(&true);

    s.client.pay(&payer, &worker, &100_0000000);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.shares, 0);
    assert_eq!(acc.spend, 99_9401494);
    assert_eq!(s.xlm.balance(&s.client.address), 0);
    // full accounting: every unit of USDC the contract holds is exactly
    // what's credited to this account, nothing missing or double-counted
    assert_eq!(s.usdc.balance(&s.client.address), acc.spend);
}

// Sizing add_liquidity requires a get_reserves and a quote() read after the
// first swap has already landed XLM in the contract. Those reads have to
// degrade the same way every other step here does, not revert the whole
// payment - this proves the unwind fires and pay() still succeeds even
// when only those two read calls are unavailable.
#[test]
fn soroswap_reserve_read_failure_after_swap_unwinds_and_credits_actual_recovered_amount() {
    let e = Env::default();
    let s = setup(&e);
    seed_soroswap_pool(&e, &s);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Soroswap);
    MockSoroswapRouterClient::new(&e, &s.soroswap).set_fail_reads(&true);

    s.client.pay(&payer, &worker, &100_0000000);

    let acc = s.client.account_of(&worker);
    assert_eq!(acc.shares, 0);
    assert_eq!(acc.spend, 99_9401494);
    assert_eq!(s.xlm.balance(&s.client.address), 0);
    assert_eq!(s.usdc.balance(&s.client.address), acc.spend);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn soroswap_withdraw_savings_rejects_over_shares() {
    let e = Env::default();
    let s = setup(&e);
    seed_soroswap_pool(&e, &s);
    let payer = Address::generate(&e);
    let worker = Address::generate(&e);
    fund(&s, &payer, 100_0000000);
    s.client.set_yield_target(&worker, &YieldTarget::Soroswap);
    s.client.pay(&payer, &worker, &100_0000000);
    let shares = s.client.account_of(&worker).shares;
    s.client.withdraw_savings(&worker, &(shares + 1));
}

#[test]
fn soroswap_multiple_users_do_not_contaminate_each_others_shares() {
    let e = Env::default();
    let s = setup(&e);
    seed_soroswap_pool(&e, &s);
    let payer = Address::generate(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    fund(&s, &payer, 1_000_0000000);
    s.client.set_yield_target(&alice, &YieldTarget::Soroswap);
    s.client.set_yield_target(&bob, &YieldTarget::Soroswap);

    s.client.pay(&payer, &alice, &100_0000000);
    let alice_shares = s.client.account_of(&alice).shares;
    assert!(alice_shares > 0);

    s.client.pay(&payer, &bob, &500_0000000);
    let bob_shares = s.client.account_of(&bob).shares;
    assert!(bob_shares > 0);

    s.client.withdraw_savings(&alice, &alice_shares);
    assert_eq!(s.client.account_of(&alice).shares, 0);
    // bob's position is untouched by alice's withdrawal
    assert_eq!(s.client.account_of(&bob).shares, bob_shares);

    let bob_amount = s.client.withdraw_savings(&bob, &bob_shares);
    assert!(bob_amount > 0);
    assert_eq!(s.client.account_of(&bob).shares, 0);
}
