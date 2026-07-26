import { rpc, scValToNative } from 'celengan'
import { CONTRACT_ID, RPC_URL } from '@/lib/config'

export type StatsKind = 'pay' | 'wd_spend' | 'wd_save' | 'split' | 'lock' | 'target'

export type StatsEvent = {
  id: string
  kind: StatsKind
  user: string
  at: Date
  txHash: string
  amount?: bigint
  saved?: bigint
}

export type ContractStats = {
  wallets: number
  payments: number
  interactions: number
  volume: bigint
  saved: bigint
  recent: StatsEvent[]
}

const KINDS: readonly StatsKind[] = ['pay', 'wd_spend', 'wd_save', 'split', 'lock', 'target']
const LOOKBACK_LEDGERS = 100_000
const PAGE_LIMIT = 200
const MAX_PAGES = 15
const RECENT_LIMIT = 25

function isKind(value: unknown): value is StatsKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
}

function cursorLedger(cursor: string): number {
  return Number(BigInt(cursor.split('-')[0]) >> 32n)
}

function toEvent(event: rpc.Api.EventResponse): StatsEvent | null {
  if (event.topic.length < 2) return null
  const kind: unknown = scValToNative(event.topic[0])
  if (!isKind(kind)) return null
  const user: unknown = scValToNative(event.topic[1])
  if (typeof user !== 'string') return null

  const base = { id: event.id, kind, user, at: new Date(event.ledgerClosedAt), txHash: event.txHash }
  const value: unknown = scValToNative(event.value)
  if (kind === 'pay') {
    const [, amount, saved] = value as [string, bigint, bigint]
    return { ...base, amount, saved }
  }
  if (kind === 'wd_spend') return { ...base, amount: value as bigint }
  if (kind === 'wd_save') {
    const [, amount] = value as [bigint, bigint]
    return { ...base, amount }
  }
  return base
}

// payer of a pay event also signed a transaction, so both sides count as wallets
function payerOf(event: rpc.Api.EventResponse): string | null {
  const value: unknown = scValToNative(event.value)
  if (!Array.isArray(value) || typeof value[0] !== 'string') return null
  return value[0]
}

// Aggregates every contract event in the rpc's retention window into headline
// numbers plus a recent-interactions feed. Rejects on rpc failure so callers
// can keep previously loaded data.
export async function fetchStats(): Promise<ContractStats> {
  const empty: ContractStats = {
    wallets: 0,
    payments: 0,
    interactions: 0,
    volume: 0n,
    saved: 0n,
    recent: [],
  }
  if (CONTRACT_ID === '') return empty

  const server = new rpc.Server(RPC_URL)
  const latest = await server.getLatestLedger()
  const startLedger = Math.max(latest.sequence - LOOKBACK_LEDGERS, 1)
  const filters: rpc.Api.EventFilter[] = [{ type: 'contract', contractIds: [CONTRACT_ID] }]

  const wallets = new Set<string>()
  const events: StatsEvent[] = []
  let payments = 0
  let volume = 0n
  let saved = 0n

  let page = await server.getEvents({ startLedger, filters, limit: PAGE_LIMIT })
  for (let i = 0; i < MAX_PAGES; i++) {
    for (const raw of page.events) {
      const event = toEvent(raw)
      if (!event) continue
      events.push(event)
      wallets.add(event.user)
      if (event.kind === 'pay') {
        payments += 1
        volume += event.amount ?? 0n
        saved += event.saved ?? 0n
        const payer = payerOf(raw)
        if (payer) wallets.add(payer)
      }
    }
    if (!page.cursor || cursorLedger(page.cursor) >= latest.sequence) break
    page = await server.getEvents({ filters, cursor: page.cursor, limit: PAGE_LIMIT })
  }

  events.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
  return {
    wallets: wallets.size,
    payments,
    interactions: events.length,
    volume,
    saved,
    recent: events.slice(0, RECENT_LIMIT),
  }
}
