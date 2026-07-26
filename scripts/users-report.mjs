#!/usr/bin/env node
// Builds docs/user-interactions.md: proof of real wallet interactions with the
// celengan contract. The public RPC only retains a bounded ledger window, so
// each run MERGES new events into docs/interactions-data.json and regenerates
// the markdown from the full accumulated set. Run it periodically while
// onboarding users. Usage: node scripts/users-report.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RPC_URL = 'https://soroban-testnet.stellar.org'
const CONTRACT_ID = JSON.parse(readFileSync(join(ROOT, 'deployments.json'), 'utf8')).testnet
  .celengan
const DATA_PATH = join(ROOT, 'docs', 'interactions-data.json')
const MD_PATH = join(ROOT, 'docs', 'user-interactions.md')
const LOOKBACK_LEDGERS = 100_000
const PAGE_LIMIT = 200
const MAX_PAGES = 25

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await res.json()
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`)
  return body.result
}

// topic[0] is a symbol scval: base64 xdr whose printable tail is the name
function topicSymbol(topicB64) {
  const raw = Buffer.from(topicB64, 'base64')
  let name = ''
  for (const byte of raw.subarray(8)) {
    if (byte >= 32 && byte < 127) name += String.fromCharCode(byte)
  }
  return name
}

// strkey encoding (SEP-23) without pulling in stellar-sdk: version byte +
// payload + CRC16-XMODEM checksum, base32 encoded
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function crc16(data) {
  let crc = 0
  for (const byte of data) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc
}

function base32Encode(data) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of data) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return out
}

function strkey(versionByte, payload) {
  const body = Buffer.concat([Buffer.from([versionByte]), payload])
  const checksum = crc16(body)
  return base32Encode(Buffer.concat([body, Buffer.from([checksum & 0xff, checksum >> 8])]))
}

// An address scval is 12 xdr header bytes (ScVal Address + address type
// discriminants) followed by the 32-byte key. Account -> G.., contract -> C..;
// anything else is refused rather than silently mislabeled.
function decodeAddressScVal(raw) {
  const key = raw.subarray(8, 8 + 4 + 32).subarray(4)
  const addressType = raw.readUInt32BE(4)
  if (addressType === 0) return strkey(6 << 3, key)
  if (addressType === 1) return strkey(2 << 3, key)
  throw new Error(`unsupported SCAddress discriminant ${addressType}`)
}

function walletKey(topicB64) {
  return decodeAddressScVal(Buffer.from(topicB64, 'base64'))
}

// A pay event's value is an ScVec [from, amount, saved]; the payer signed the
// transaction too, so they count as an interacting wallet. Layout: ScVal vec
// discriminant (4) + option flag (4) + length (4), then the first element,
// an address scval of 44 bytes.
function payerOf(valueB64) {
  const raw = Buffer.from(valueB64, 'base64')
  if (raw.length < 12 + 44 || raw.readUInt32BE(0) !== 16) return null
  return decodeAddressScVal(raw.subarray(12, 12 + 44))
}

async function main() {
  const latest = await rpc('getLatestLedger', {})
  const startLedger = Math.max(latest.sequence - LOOKBACK_LEDGERS, 1)
  const filters = [{ type: 'contract', contractIds: [CONTRACT_ID] }]

  // the rpc scans roughly 10k ledgers per call and may return an empty page
  // with a cursor, so keep paging until the cursor runs out or reaches latest
  const cursorLedger = (cursor) => Number(BigInt(cursor.split('-')[0]) >> 32n)
  const events = []
  let page = await rpc('getEvents', {
    startLedger,
    filters,
    pagination: { limit: PAGE_LIMIT },
  })
  for (let i = 0; i < MAX_PAGES; i++) {
    events.push(...(page.events ?? []))
    if (!page.cursor || cursorLedger(page.cursor) >= latest.sequence) break
    page = await rpc('getEvents', { filters, pagination: { cursor: page.cursor, limit: PAGE_LIMIT } })
  }

  const store = existsSync(DATA_PATH)
    ? JSON.parse(readFileSync(DATA_PATH, 'utf8'))
    : { contract: CONTRACT_ID, interactions: {} }

  if (store.contract !== CONTRACT_ID) {
    throw new Error(
      `interactions-data.json was built for ${store.contract}; deployments.json now says ${CONTRACT_ID}. ` +
        'Archive or delete the data file before mixing deployments.',
    )
  }

  let added = 0
  for (const event of events) {
    if (!event.topic || event.topic.length < 2) continue
    const id = event.id
    if (store.interactions[id]) continue
    const kind = topicSymbol(event.topic[0])
    store.interactions[id] = {
      kind,
      wallet: walletKey(event.topic[1]),
      payer: kind === 'pay' ? payerOf(event.value) : undefined,
      txHash: event.txHash,
      at: event.ledgerClosedAt,
      ledger: event.ledger,
    }
    added += 1
  }

  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2) + '\n')

  const all = Object.values(store.interactions).sort((a, b) => (a.at < b.at ? -1 : 1))
  const wallets = new Map()
  const track = (wallet, item, kind) => {
    if (!wallets.has(wallet)) wallets.set(wallet, [])
    wallets.get(wallet).push({ ...item, kind })
  }
  for (const item of all) {
    track(item.wallet, item, item.kind)
    if (item.payer && item.payer !== item.wallet) track(item.payer, item, 'pay (sender)')
  }

  const lines = []
  lines.push('# User wallet interactions')
  lines.push('')
  lines.push(
    `Proof of real wallet interactions with the celengan contract \`${CONTRACT_ID}\` on Stellar testnet.`,
  )
  lines.push(
    `Generated by \`scripts/users-report.mjs\` from on-chain contract events; every transaction below is independently verifiable on Stellar Expert.`,
  )
  lines.push('')
  lines.push(`- Unique interacting wallets: **${wallets.size}**`)
  lines.push(`- Total interactions: **${all.length}**`)
  lines.push(`- Window covered: ${all[0]?.at ?? '-'} to ${all[all.length - 1]?.at ?? '-'}`)
  lines.push('')
  lines.push('| # | Wallet | Interactions | Kinds | Latest tx |')
  lines.push('|---|---|---|---|---|')
  let n = 0
  for (const [wallet, items] of wallets) {
    n += 1
    const kinds = [...new Set(items.map((i) => i.kind))].join(', ')
    const last = items[items.length - 1]
    const short = `${wallet.slice(0, 6)}..${wallet.slice(-6)}`
    lines.push(
      `| ${n} | \`${short}\` | ${items.length} | ${kinds} | [${last.txHash.slice(0, 8)}..](https://stellar.expert/explorer/testnet/tx/${last.txHash}) |`,
    )
  }
  lines.push('')
  lines.push('## All transactions')
  lines.push('')
  lines.push('| Time (UTC) | Kind | Tx |')
  lines.push('|---|---|---|')
  for (const item of all) {
    lines.push(
      `| ${item.at} | ${item.kind} | [${item.txHash.slice(0, 8)}..](https://stellar.expert/explorer/testnet/tx/${item.txHash}) |`,
    )
  }
  lines.push('')

  writeFileSync(MD_PATH, lines.join('\n'))
  console.log(
    `merged ${added} new events; totals: ${wallets.size} wallets, ${all.length} interactions`,
  )
  console.log(`wrote ${MD_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
