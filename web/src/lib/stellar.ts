import { Horizon } from '@stellar/stellar-sdk'
import { HORIZON_URL, FRIENDBOT_URL } from './constants'

export const server = new Horizon.Server(HORIZON_URL)

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  )
}

// Returns the native XLM balance, or '0' when the account is not yet funded.
export async function fetchXlmBalance(address: string): Promise<string> {
  try {
    const account = await server.loadAccount(address)
    const native = account.balances.find((b) => b.asset_type === 'native')
    return native ? native.balance : '0'
  } catch (error) {
    if (isNotFound(error)) return '0'
    throw error
  }
}

export async function accountExists(address: string): Promise<boolean> {
  try {
    await server.loadAccount(address)
    return true
  } catch (error) {
    if (isNotFound(error)) return false
    throw error
  }
}

// Funds an account with test XLM via friendbot (testnet only).
export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`)
  if (!res.ok) {
    throw new Error('Friendbot could not fund this account. Try again shortly.')
  }
}
