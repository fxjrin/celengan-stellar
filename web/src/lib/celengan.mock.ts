import type { CelenganAccount, CelenganService } from '@/lib/types'

const LATENCY_MS = 800
const DEFAULT_SPLIT_BPS = 2000
const BPS_DENOMINATOR = 10_000n

const accounts = new Map<string, CelenganAccount>()

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
}

function account(user: string): CelenganAccount {
  let acc = accounts.get(user)
  if (!acc) {
    acc = { splitBps: DEFAULT_SPLIT_BPS, spend: 0n, shares: 0n, lockUntil: 0n, yieldTarget: 'defindex' }
    accounts.set(user, acc)
  }
  return acc
}

function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000))
}

// looks like a real 32-byte Stellar tx hash so the confirmation UI has something to show
function mockHash(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export const celenganMock: CelenganService = {
  async getAccount(user) {
    await delay()
    return { ...account(user) }
  },

  async pay(_from, to, amount) {
    await delay()
    const acc = account(to)
    const saved = (amount * BigInt(acc.splitBps)) / BPS_DENOMINATOR
    acc.shares += saved // mock vault mints shares 1:1 with deposited USDC
    acc.spend += amount - saved
    return { hash: mockHash() }
  },

  async withdrawSpend(user, amount) {
    await delay()
    const acc = account(user)
    // same format the SDK surfaces for real contract failures, so errorKey maps it
    if (amount > acc.spend) throw new Error('Error(Contract, #3)')
    acc.spend -= amount
    return { hash: mockHash() }
  },

  async withdrawSavings(user, shares) {
    await delay()
    const acc = account(user)
    if (acc.lockUntil > nowSeconds()) throw new Error('Error(Contract, #5)')
    if (shares > acc.shares) throw new Error('Error(Contract, #4)')
    acc.shares -= shares
    return { amount: shares, hash: mockHash() } // 1:1 redemption in mock
  },

  async setSplit(user, bps) {
    await delay()
    account(user).splitBps = bps
    return { hash: mockHash() }
  },

  async setLock(user, until) {
    await delay()
    account(user).lockUntil = until
    return { hash: mockHash() }
  },

  async setYieldTarget(user, target) {
    await delay()
    const acc = account(user)
    if (acc.shares > 0n) throw new Error('Error(Contract, #9)')
    acc.yieldTarget = target
    return { hash: mockHash() }
  },
}
