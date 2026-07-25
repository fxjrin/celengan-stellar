import { rpc, scValToNative } from 'celengan'
import { CONTRACT_ID, RPC_URL } from '@/lib/config'

export type ActivityItem = {
  id: string
  kind: 'pay' | 'wd_spend' | 'wd_save' | 'split' | 'lock'
  at: Date
  txHash: string
  from?: string
  amount?: bigint
  saved?: bigint
  shares?: bigint
  bps?: number
  until?: bigint
}

type Kind = ActivityItem['kind']

const KINDS: readonly Kind[] = ['pay', 'wd_spend', 'wd_save', 'split', 'lock']
const LOOKBACK_LEDGERS = 100_000
const PAGE_LIMIT = 200
// the rpc scans roughly 10k ledgers per getEvents call, so a full lookback needs several pages
const MAX_PAGES = 15

function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
}

// event cursors and ids start with (ledger << 32 | txOrder) as a decimal string
function cursorLedger(cursor: string): number {
  return Number(BigInt(cursor.split('-')[0]) >> 32n)
}

function toItem(event: rpc.Api.EventResponse, user: string): ActivityItem | null {
  if (event.topic.length < 2) return null
  const kind: unknown = scValToNative(event.topic[0])
  if (!isKind(kind)) return null
  if (scValToNative(event.topic[1]) !== user) return null

  const base = { id: event.id, at: new Date(event.ledgerClosedAt), txHash: event.txHash }
  const value: unknown = scValToNative(event.value)
  switch (kind) {
    case 'pay': {
      const [from, amount, saved] = value as [string, bigint, bigint]
      return { ...base, kind, from, amount, saved }
    }
    case 'wd_spend':
      return { ...base, kind, amount: value as bigint }
    case 'wd_save': {
      const [shares, amount] = value as [bigint, bigint]
      return { ...base, kind, shares, amount }
    }
    case 'split':
      return { ...base, kind, bps: Number(value) }
    case 'lock':
      return { ...base, kind, until: BigInt(value as bigint | number) }
  }
}

// rejects on rpc failure so callers can keep previously loaded items
export async function fetchActivity(user: string): Promise<ActivityItem[]> {
  if (CONTRACT_ID === '') return []
  const server = new rpc.Server(RPC_URL)
  const latest = await server.getLatestLedger()
  const startLedger = Math.max(latest.sequence - LOOKBACK_LEDGERS, 1)
  const filters: rpc.Api.EventFilter[] = [
    { type: 'contract', contractIds: [CONTRACT_ID] },
  ]

  const items: ActivityItem[] = []
  let page = await server.getEvents({ startLedger, filters, limit: PAGE_LIMIT })
  for (let i = 0; i < MAX_PAGES; i++) {
    for (const event of page.events) {
      const item = toItem(event, user)
      if (item) items.push(item)
    }
    if (!page.cursor || cursorLedger(page.cursor) >= latest.sequence) break
    page = await server.getEvents({ filters, cursor: page.cursor, limit: PAGE_LIMIT })
  }
  return items.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}
