import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  type xdr,
} from 'celengan'
// imported directly (not via 'celengan') because the bindings package's own generated
// `Account` contract-data interface shadows the sdk's `Account` class re-export
import { Account } from '@stellar/stellar-sdk'
import type { ActivityItem } from '@/lib/activity'
import {
  MAINNET_NETWORK_PASSPHRASE,
  MAINNET_RPC_URL,
  MAINNET_USDC_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  USDC_ID,
  VAULT_ID,
} from '@/lib/config'

export const DEFINDEX_SHARE_SCALE = 10_000_000n // dfToken and USDC both use 7 decimals on this vault
export const BLEND_RATE_SCALAR = 10_000_000_000_000n // Blend's b_rate fixed-point scalar (SCALAR_12), independent of asset decimals
const SCALAR_7 = 10_000_000n
const SCALAR_12 = BLEND_RATE_SCALAR
const UTIL_95 = 9_500_000n
const UTIL_TAIL = 500_000n // 1.0 - 0.95, the width of the third rate-curve tier

// The DeFindex vault's single strategy (CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY)
// lends into this Blend USDC pool. There is no public getter for it: it was found by reading the
// strategy contract's instance storage entry for its `Config.pool` field on testnet
// (stellar contract data read, DataKey::Config -> { pool: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF", ... }).
const BLEND_POOL_ID = 'CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF'

// Soroswap's testnet factory (CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY, from
// soroswap/core's public/testnet.contracts.json) resolves this address for get_pair(USDC_ID,
// native XLM SAC). Hardcoded here since a pair contract's address is immutable once created.
const SOROSWAP_USDC_XLM_PAIR_ID = 'CBR76WMT6J733CCVBP23M2EL5QGP5HXLPEFNFZGZ7IB6QHOJAHP7YM3V'

// Soroswap's real mainnet XLM/USDC pool (same asset pairing as Celengan's own testnet
// integration, picked over the higher-TVL USDC/EURC pool specifically for that comparability).
// Verified live: its WASM hash matches mainnet.contracts.json's published pair hash, and the
// mainnet SoroswapFactory's own get_pair(XLM, USDC) call resolves to this exact address.
const SOROSWAP_MAINNET_XLM_USDC_PAIR_ID = 'CAM7DY53G63XA4AJRS24Z6VFYAFSSF76C3RZ45BE5YU3FQS5255OOABP'

// DeFindex's real mainnet USDC vault ("Hana USDC", backing Hana Wallet's live "Hana Earn"
// product per news.hana.money) - split across two Blend pool strategies. Found via the
// DeFindex factory's own on-chain vault-creation events, not guessed.
const DEFINDEX_MAINNET_VAULT_ID = 'CBUJZL5QAD5TOPD7JMCBQ3RHR6RZWY34A4QF7UHILTDH2JF2Z3VJGY2Y'
const DEFINDEX_MAINNET_STRATEGY_POOLS: Record<string, string> = {
  CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP: 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
  CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL: 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS',
}

// A real, live Blend v2 mainnet pool with a USDC reserve (a "Fixed Income LATAM" pool holding
// CETES/USTRY/TESOURO alongside XLM and USDC) - found by reading the Blend v2 pool factory's own
// `deploy` events on stellar.expert and checking each resulting pool's reserves for a USDC-symbol
// asset whose issuer matches Circle's known mainnet USDC issuer (GA5ZSEJY...). This is NOT the
// pool Celengan's own contract integrates with (Celengan is testnet-only); it exists purely to
// show a clearly-labeled mainnet reference rate, since testnet borrowing activity is too thin to
// be representative on its own.
const BLEND_MAINNET_POOL_ID = 'CDMAVJPFXPADND3YRL4BSM3AKZWCTFMX27GLLXCML3PD62HEQS5FPVAI'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type Network = { rpcUrl: string; passphrase: string }
const TESTNET: Network = { rpcUrl: RPC_URL, passphrase: NETWORK_PASSPHRASE }
const MAINNET: Network = { rpcUrl: MAINNET_RPC_URL, passphrase: MAINNET_NETWORK_PASSPHRASE }

// simulateTransaction never reads or signs against the source account, so a throwaway
// keypair is enough to shape a valid read-only transaction envelope
async function simulateReadCall(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  network: Network = TESTNET,
): Promise<unknown> {
  const server = new rpc.Server(network.rpcUrl)
  const account = new Account(Keypair.random().publicKey(), '0')
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: network.passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error)
  if (!sim.result) throw new Error('yield: empty simulation result')
  return scValToNative(sim.result.retval)
}

/**
 * USDC value of one full vault share (7 decimals), read live from the vault.
 * Returns null if the read fails so the UI can degrade to a placeholder.
 */
export async function getSharePrice(): Promise<bigint | null> {
  try {
    // the vault currently holds a single asset (USDC), so the per-shares vector has one entry
    const result = await simulateReadCall(VAULT_ID, 'get_asset_amounts_per_shares', [
      nativeToScVal(DEFINDEX_SHARE_SCALE, { type: 'i128' }),
    ])
    const price = Array.isArray(result) ? result[0] : null
    return typeof price === 'bigint' ? price : null
  } catch {
    return null
  }
}

export type VaultStats = {
  totalSupply: bigint | null
  idle: bigint | null
  invested: bigint | null
}

/**
 * Vault-wide share supply and the idle/invested USDC split, read live from the vault.
 * Each field decodes independently and falls back to null on a shape mismatch or rpc failure.
 */
export async function getVaultStats(): Promise<VaultStats> {
  const [supplyResult, fundsResult] = await Promise.allSettled([
    simulateReadCall(VAULT_ID, 'total_supply', []),
    simulateReadCall(VAULT_ID, 'fetch_total_managed_funds', []),
  ])

  const totalSupply =
    supplyResult.status === 'fulfilled' && typeof supplyResult.value === 'bigint'
      ? supplyResult.value
      : null

  let idle: bigint | null = null
  let invested: bigint | null = null
  if (fundsResult.status === 'fulfilled' && Array.isArray(fundsResult.value)) {
    const usdcEntry = fundsResult.value.find((entry) => isRecord(entry) && entry.asset === USDC_ID)
    if (isRecord(usdcEntry)) {
      if (typeof usdcEntry.idle_amount === 'bigint') idle = usdcEntry.idle_amount
      if (typeof usdcEntry.invested_amount === 'bigint') invested = usdcEntry.invested_amount
    }
  }

  return { totalSupply, idle, invested }
}

type ReserveConfig = {
  util: number
  r_base: number
  r_one: number
  r_two: number
  r_three: number
}

type ReserveData = {
  b_rate: bigint
  b_supply: bigint
  d_rate: bigint
  d_supply: bigint
  ir_mod: bigint
}

function isReserveConfig(value: unknown): value is ReserveConfig {
  return (
    isRecord(value) &&
    typeof value.util === 'number' &&
    typeof value.r_base === 'number' &&
    typeof value.r_one === 'number' &&
    typeof value.r_two === 'number' &&
    typeof value.r_three === 'number'
  )
}

function isReserveData(value: unknown): value is ReserveData {
  return (
    isRecord(value) &&
    typeof value.b_rate === 'bigint' &&
    typeof value.b_supply === 'bigint' &&
    typeof value.d_rate === 'bigint' &&
    typeof value.d_supply === 'bigint' &&
    typeof value.ir_mod === 'bigint'
  )
}

function isReserve(value: unknown): value is { config: ReserveConfig; data: ReserveData } {
  return isRecord(value) && isReserveConfig(value.config) && isReserveData(value.data)
}

function isPoolConfig(value: unknown): value is { bstop_rate: number } {
  return isRecord(value) && typeof value.bstop_rate === 'number'
}

function fixedMulCeil(a: bigint, b: bigint, scalar: bigint): bigint {
  return (a * b + (scalar - 1n)) / scalar
}

function fixedMulFloor(a: bigint, b: bigint, scalar: bigint): bigint {
  return (a * b) / scalar
}

function fixedDivCeil(a: bigint, b: bigint, scalar: bigint): bigint {
  return (a * scalar + (b - 1n)) / b
}

// utilization = liabilities / supply, capped at 100%; mirrors Reserve::utilization in
// blend-contracts-v2 pool/src/pool/reserve.rs (liabilities == 0 short-circuits to 0 so a
// pool with target_util == 0 never divides by zero below)
function reserveUtilization(data: ReserveData): bigint {
  const totalLiabilities = fixedMulCeil(data.d_supply, data.d_rate, SCALAR_12)
  const totalSupply = fixedMulFloor(data.b_supply, data.b_rate, SCALAR_12)
  if (totalLiabilities === 0n) return 0n
  if (totalLiabilities >= totalSupply) return SCALAR_7
  return fixedDivCeil(totalLiabilities, totalSupply, SCALAR_7)
}

// three-tier borrow rate curve read off the reserve's live ir_mod modifier; mirrors
// calc_accrual's rate formula in blend-contracts-v2 pool/src/pool/interest.rs (the ir_mod
// update itself is skipped since we read the already-current modifier from chain)
function currentBorrowApr(config: ReserveConfig, data: ReserveData, curUtil: bigint): bigint {
  const targetUtil = BigInt(config.util)
  const rBase = BigInt(config.r_base)
  const rOne = BigInt(config.r_one)
  const rTwo = BigInt(config.r_two)
  const rThree = BigInt(config.r_three)
  const irMod = data.ir_mod

  if (curUtil <= targetUtil) {
    const utilScalar = fixedDivCeil(curUtil, targetUtil, SCALAR_7)
    const baseRate = fixedMulCeil(utilScalar, rOne, SCALAR_7) + rBase
    return fixedMulCeil(baseRate, irMod, SCALAR_7)
  }
  if (curUtil <= UTIL_95) {
    const utilScalar = fixedDivCeil(curUtil - targetUtil, UTIL_95 - targetUtil, SCALAR_7)
    const baseRate = fixedMulCeil(utilScalar, rTwo, SCALAR_7) + rOne + rBase
    return fixedMulCeil(baseRate, irMod, SCALAR_7)
  }
  const utilScalar = fixedDivCeil(curUtil - UTIL_95, UTIL_TAIL, SCALAR_7)
  const extraRate = fixedMulCeil(utilScalar, rThree, SCALAR_7)
  const intersection = fixedMulCeil(irMod, rTwo + rOne + rBase, SCALAR_7)
  return extraRate + intersection
}

export type BlendPoolInfo = {
  apy: number | null
  bRate: bigint | null
  tvl: bigint | null
}

// Shared by both the testnet pool Celengan actually integrates with and the mainnet reference
// pool: supply APR = borrow APR x utilization x (1 - backstop take rate), compounded continuously.
function computeBlendSupplyApy(
  reserve: { config: ReserveConfig; data: ReserveData },
  bstopRate: number,
): number {
  const curUtil = reserveUtilization(reserve.data)
  if (curUtil === 0n) return 0 // nothing borrowed, so suppliers earn nothing right now
  const borrowApr = currentBorrowApr(reserve.config, reserve.data, curUtil)
  const util = Number(curUtil) / 1e7
  const bstop = bstopRate / 1e7
  const supplyApr = (Number(borrowApr) / 1e7) * util * (1 - bstop)
  return Math.exp(supplyApr) - 1
}

/**
 * Live stats for the Blend USDC pool the vault's strategy lends into: effective supplier APY
 * (supply APR = borrow APR x utilization x (1 - backstop take rate), compounded continuously),
 * the reserve's current b_rate (the fixed-point index that converts a Celengan account's
 * b-token shares to a USDC value when its yield source is Blend directly, see BLEND_RATE_SCALAR),
 * and tvl (total USDC currently supplied to the reserve by all suppliers, b_supply * b_rate).
 * Each field falls back to null if the pool or reserve cannot be read.
 */
export async function getBlendPoolInfo(): Promise<BlendPoolInfo> {
  try {
    const [reserveRaw, poolConfigRaw] = await Promise.all([
      simulateReadCall(BLEND_POOL_ID, 'get_reserve', [Address.fromString(USDC_ID).toScVal()]),
      simulateReadCall(BLEND_POOL_ID, 'get_config', []),
    ])
    if (!isReserve(reserveRaw)) return { apy: null, bRate: null, tvl: null }
    const bRate = reserveRaw.data.b_rate
    const tvl = fixedMulFloor(reserveRaw.data.b_supply, bRate, SCALAR_12)

    if (!isPoolConfig(poolConfigRaw)) return { apy: null, bRate, tvl }
    return { apy: computeBlendSupplyApy(reserveRaw, poolConfigRaw.bstop_rate), bRate, tvl }
  } catch {
    return { apy: null, bRate: null, tvl: null }
  }
}

/**
 * Reference-only supplier APY read from a real, live Blend v2 mainnet USDC pool (see
 * BLEND_MAINNET_POOL_ID) - NOT the pool Celengan's contract actually integrates with. Exists
 * purely to give an honest sense of what Blend yields look like where there's real borrowing
 * demand, since the testnet pool's own rate is often near-zero from thin testnet activity. The
 * caller is responsible for labeling this clearly as a mainnet reference, never as the user's
 * own position's rate.
 */
export async function getBlendMainnetReferenceApy(): Promise<number | null> {
  try {
    const [reserveRaw, poolConfigRaw] = await Promise.all([
      simulateReadCall(
        BLEND_MAINNET_POOL_ID,
        'get_reserve',
        [Address.fromString(MAINNET_USDC_ID).toScVal()],
        MAINNET,
      ),
      simulateReadCall(BLEND_MAINNET_POOL_ID, 'get_config', [], MAINNET),
    ])
    if (!isReserve(reserveRaw) || !isPoolConfig(poolConfigRaw)) return null
    return computeBlendSupplyApy(reserveRaw, poolConfigRaw.bstop_rate)
  } catch {
    return null
  }
}

type StrategyAllocation = { amount: bigint; strategy_address: string }
type ManagedFundsEntry = { asset: string; strategy_allocations: StrategyAllocation[] }

function isStrategyAllocation(value: unknown): value is StrategyAllocation {
  return isRecord(value) && typeof value.amount === 'bigint' && typeof value.strategy_address === 'string'
}

function isManagedFundsEntry(value: unknown): value is ManagedFundsEntry {
  return (
    isRecord(value) &&
    typeof value.asset === 'string' &&
    Array.isArray(value.strategy_allocations) &&
    value.strategy_allocations.every(isStrategyAllocation)
  )
}

/**
 * Reference-only supplier APY for DeFindex: a real weighted average of the live supply APY of
 * each Blend pool the mainnet "Hana USDC" vault (DEFINDEX_MAINNET_VAULT_ID) currently allocates
 * into, weighted by its own real-time fetch_total_managed_funds() amounts - not a single
 * hardcoded pool, since a vault can (and does) shift allocation between strategies; live-checked
 * and currently 100% in the first strategy, with the second paused at zero allocation. NOT the
 * pool Celengan's own testnet integration uses - see getBlendMainnetReferenceApy for why a
 * mainnet reference exists at all.
 */
export async function getDefindexMainnetReferenceApy(): Promise<number | null> {
  try {
    const fundsRaw = await simulateReadCall(
      DEFINDEX_MAINNET_VAULT_ID,
      'fetch_total_managed_funds',
      [],
      MAINNET,
    )
    if (!Array.isArray(fundsRaw)) return null
    const usdcEntry = fundsRaw.find((entry) => isManagedFundsEntry(entry) && entry.asset === MAINNET_USDC_ID)
    if (!isManagedFundsEntry(usdcEntry)) return null

    const weighted = await Promise.all(
      usdcEntry.strategy_allocations
        .filter((allocation) => allocation.amount > 0n)
        .map(async (allocation) => {
          const poolId = DEFINDEX_MAINNET_STRATEGY_POOLS[allocation.strategy_address]
          if (!poolId) return null
          const [reserveRaw, poolConfigRaw] = await Promise.all([
            simulateReadCall(poolId, 'get_reserve', [Address.fromString(MAINNET_USDC_ID).toScVal()], MAINNET),
            simulateReadCall(poolId, 'get_config', [], MAINNET),
          ])
          if (!isReserve(reserveRaw) || !isPoolConfig(poolConfigRaw)) return null
          return { apy: computeBlendSupplyApy(reserveRaw, poolConfigRaw.bstop_rate), weight: allocation.amount }
        }),
    )
    const valid = weighted.filter((w): w is { apy: number; weight: bigint } => w !== null)
    const totalWeight = valid.reduce((sum, w) => sum + w.weight, 0n)
    if (valid.length === 0 || totalWeight === 0n) return null
    return valid.reduce((sum, w) => sum + w.apy * (Number(w.weight) / Number(totalWeight)), 0)
  } catch {
    return null
  }
}

export type SoroswapStats = {
  apy: number | null
  tvl: bigint | null
  reserveUsdc: bigint | null
  totalSupply: bigint | null
}

function isReserveTuple(value: unknown): value is [bigint, bigint] {
  return Array.isArray(value) && typeof value[0] === 'bigint' && typeof value[1] === 'bigint'
}

/**
 * Live stats for the Soroswap testnet USDC/XLM pool.
 *
 * tvl is the USDC-side reserve alone, not doubled: a constant-product pool's two sides are
 * only worth the same in USD if priced at a real market rate, and this app has no XLM/USD
 * oracle to confirm that holds for this testnet pool, so doubling would be a guess dressed up
 * as data. apy is always null: the pair contract keeps no cumulative volume or price history
 * (no Uniswap-V2-style TWAP accumulator - checked its storage), and Soroswap's hosted API
 * /pools response (checked live against its OpenAPI schema) has no apr/apy field either. LP
 * yield without real fee-accrual history isn't a number this app can source honestly.
 *
 * reserveUsdc and totalSupply are exposed separately (not folded into tvl) so a held LP
 * position can still be priced: valueOfShares uses the pool's own internal ratio rather than
 * an external oracle, which is a different, self-consistent use of the same reserve read.
 */
export async function getSoroswapStats(): Promise<SoroswapStats> {
  try {
    const [token0Raw, reservesRaw, totalSupplyRaw] = await Promise.all([
      simulateReadCall(SOROSWAP_USDC_XLM_PAIR_ID, 'token_0', []),
      simulateReadCall(SOROSWAP_USDC_XLM_PAIR_ID, 'get_reserves', []),
      simulateReadCall(SOROSWAP_USDC_XLM_PAIR_ID, 'total_supply', []),
    ])
    if (!isReserveTuple(reservesRaw)) return { apy: null, tvl: null, reserveUsdc: null, totalSupply: null }
    const reserveUsdc = token0Raw === USDC_ID ? reservesRaw[0] : reservesRaw[1]
    const totalSupply = typeof totalSupplyRaw === 'bigint' ? totalSupplyRaw : null
    return { apy: null, tvl: reserveUsdc, reserveUsdc, totalSupply }
  } catch {
    return { apy: null, tvl: null, reserveUsdc: null, totalSupply: null }
  }
}

const SOROSWAP_FEE_BPS = 30n // 0.3%, the same convention Soroswap/Uniswap V2 both use
const SOROSWAP_EVENTS_LOOKBACK_LEDGERS = 17_280 // ~24h at 5s/ledger
const SOROSWAP_EVENTS_WINDOW_SECS = 24 * 60 * 60
const SOROSWAP_EVENTS_PAGE_LIMIT = 200
const SOROSWAP_EVENTS_MAX_PAGES = 4 // a 24h window needs far fewer pages than activity.ts's own multi-day scan

type SwapEventValue = { amount_0_in: bigint; amount_1_in: bigint }

function isSwapEventValue(value: unknown): value is SwapEventValue {
  return isRecord(value) && typeof value.amount_0_in === 'bigint' && typeof value.amount_1_in === 'bigint'
}

// event cursors and ids start with (ledger << 32 | txOrder) as a decimal string - same helper
// activity.ts uses for its own cursor pagination
function cursorLedger(cursor: string): number {
  return Number(BigInt(cursor.split('-')[0]) >> 32n)
}

/**
 * Reference-only supplier APY for Soroswap, computed by actually indexing real swap events on a
 * live mainnet XLM/USDC pool (SOROSWAP_MAINNET_XLM_USDC_PAIR_ID) over the last ~24h and
 * annualizing the realized 0.3% fee revenue against current TVL - a genuinely realized rate from
 * real trading, not a formula guess, since Soroswap itself exposes no APY anywhere (checked its
 * API, its own frontend, and its analytics site - none compute one either). Uses a 24h window
 * rather than the RPC's full ~7-day retention window purely for load speed; a live-verified
 * sample showed ~170 swaps in the first 15h of that window alone, so 24h is plenty for a
 * meaningful (if noisy) number. Mirrors activity.ts's own event-cursor-pagination pattern,
 * applied to a real mainnet pool instead of Celengan's own contract. Unlike testnet - confirmed
 * live to have zero organic trading within its entire retained event history - mainnet has real
 * volume to index.
 */
export async function getSoroswapMainnetReferenceApy(): Promise<number | null> {
  try {
    const server = new rpc.Server(MAINNET_RPC_URL)
    const [latest, reservesRaw] = await Promise.all([
      server.getLatestLedger(),
      simulateReadCall(SOROSWAP_MAINNET_XLM_USDC_PAIR_ID, 'get_reserves', [], MAINNET),
    ])
    if (!isReserveTuple(reservesRaw)) return null
    const [reserveXlm, reserveUsdc] = reservesRaw // token_0 = XLM, token_1 = USDC on this pool (verified live)
    if (reserveUsdc <= 0n || reserveXlm <= 0n) return null

    const startLedger = Math.max(latest.sequence - SOROSWAP_EVENTS_LOOKBACK_LEDGERS, 1)
    const filters: rpc.Api.EventFilter[] = [
      { type: 'contract', contractIds: [SOROSWAP_MAINNET_XLM_USDC_PAIR_ID] },
    ]
    let feeXlm = 0n
    let feeUsdc = 0n
    let page = await server.getEvents({ startLedger, filters, limit: SOROSWAP_EVENTS_PAGE_LIMIT })
    for (let i = 0; i < SOROSWAP_EVENTS_MAX_PAGES; i++) {
      for (const event of page.events) {
        if (event.topic.length < 2) continue
        if (scValToNative(event.topic[0]) !== 'SoroswapPair') continue
        if (scValToNative(event.topic[1]) !== 'swap') continue
        const value: unknown = scValToNative(event.value)
        if (!isSwapEventValue(value)) continue
        feeXlm += (value.amount_0_in * SOROSWAP_FEE_BPS) / 10_000n
        feeUsdc += (value.amount_1_in * SOROSWAP_FEE_BPS) / 10_000n
      }
      if (!page.cursor || cursorLedger(page.cursor) >= latest.sequence) break
      page = await server.getEvents({ filters, cursor: page.cursor, limit: SOROSWAP_EVENTS_PAGE_LIMIT })
    }

    // the XLM-denominated leg of fee revenue is converted to USDC at the pool's own current
    // price - the same reserve-ratio trick valueOfShares uses, not an external oracle
    const feeXlmInUsdc = (feeXlm * reserveUsdc) / reserveXlm
    const totalFeeUsdc = feeUsdc + feeXlmInUsdc
    const tvlUsdc = 2n * reserveUsdc // both sides worth the same at the pool's own price, by definition
    if (tvlUsdc <= 0n) return null

    const periodReturn = Number(totalFeeUsdc) / Number(tvlUsdc)
    return periodReturn * ((365 * 24 * 60 * 60) / SOROSWAP_EVENTS_WINDOW_SECS)
  } catch {
    return null
  }
}

/**
 * USDC value of an account's savings shares, priced by its own yield target: DeFindex shares
 * at the vault's dfToken share price, Blend shares (b-tokens) at the pool reserve's b_rate,
 * Soroswap LP shares at (shares / pool total supply) x 2x the USDC-side reserve - both sides
 * of a constant-product pool are worth the same at the pool's own current price by definition,
 * so this needs no external XLM/USD oracle, unlike getSoroswapStats' deliberately-undoubled
 * tvl figure (that one is about not asserting an external market price; this one only ever
 * uses the pool's own internal ratio). The three scales differ, which is why this can't be a
 * single shared conversion. Returns null if the relevant rate has not loaded yet.
 */
export function valueOfShares(
  shares: bigint,
  target: 'defindex' | 'blend' | 'soroswap',
  sharePrice: bigint | null,
  blendBRate: bigint | null,
  soroswapPool?: { reserveUsdc: bigint | null; totalSupply: bigint | null },
): bigint | null {
  if (target === 'blend') {
    if (blendBRate === null) return null
    return (shares * blendBRate) / BLEND_RATE_SCALAR
  }
  if (target === 'soroswap') {
    const reserveUsdc = soroswapPool?.reserveUsdc ?? null
    const totalSupply = soroswapPool?.totalSupply ?? null
    if (reserveUsdc === null || totalSupply === null || totalSupply === 0n) return null
    return (shares * 2n * reserveUsdc) / totalSupply
  }
  if (sharePrice === null) return null
  return (shares * sharePrice) / DEFINDEX_SHARE_SCALE
}

export type SavingsPosition = {
  principal: bigint
  currentValue: bigint | null
  earnings: bigint | null
}

/**
 * Cost basis of the savings pocket, replayed from event history, paired with its live value.
 *
 * MVP simplification: pay events carry the saved USDC amount but not the shares minted, so
 * this assumes shares mint 1:1 with the amount saved (true for every pay on this testnet vault
 * so far, since the share price has stayed at 1.0). wd_save events carry exact shares withdrawn,
 * so those reduce cost basis proportionally rather than by assumption. The UI marks this an
 * estimate. Basis tracking is target-agnostic: switching yield source is only allowed at a
 * zero balance, so a single running total stays correct across a switch.
 */
export type SavingsHistoryPoint = {
  at: Date
  principal: bigint
}

function replaySavingsBasis(activity: ActivityItem[]): SavingsHistoryPoint[] {
  const oldestFirst = [...activity].reverse()
  let runningShares = 0n
  let basis = 0n
  const points: SavingsHistoryPoint[] = []
  for (const item of oldestFirst) {
    if (item.kind === 'pay' && item.saved !== undefined) {
      runningShares += item.saved
      basis += item.saved
      points.push({ at: item.at, principal: basis })
    } else if (item.kind === 'wd_save' && item.shares !== undefined) {
      if (runningShares > 0n) basis -= (basis * item.shares) / runningShares
      runningShares -= item.shares
      if (runningShares < 0n) runningShares = 0n
      points.push({ at: item.at, principal: basis })
    }
  }
  return points
}

export function computeSavingsPosition(
  activity: ActivityItem[],
  currentValue: bigint | null,
): SavingsPosition {
  const points = replaySavingsBasis(activity)
  const basis = points.length > 0 ? points[points.length - 1].principal : 0n
  return {
    principal: basis,
    currentValue,
    earnings: currentValue !== null ? currentValue - basis : null,
  }
}

/**
 * Principal contributed over time, replayed from the same pay/wd_save events as
 * computeSavingsPosition, for charting the savings trajectory. Real deposit/withdrawal
 * points only - never a fabricated price-style trend, since no such history exists on-chain.
 */
export function savingsHistory(activity: ActivityItem[]): SavingsHistoryPoint[] {
  return replaySavingsBasis(activity)
}
