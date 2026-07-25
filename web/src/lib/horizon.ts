import { Horizon } from '@stellar/stellar-sdk'
import { HORIZON_URL, FRIENDBOT_URL } from '@/lib/config'
import { parseXlm } from '@/lib/format'

const server = new Horizon.Server(HORIZON_URL)

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  )
}

// Returns the account's native XLM balance in stroops, or 0 if unfunded.
export async function fetchNativeBalance(address: string): Promise<bigint> {
  try {
    const account = await server.loadAccount(address)
    const native = account.balances.find((b) => b.asset_type === 'native')
    return native ? parseXlm(native.balance) : 0n
  } catch (error) {
    if (isNotFound(error)) return 0n
    throw error
  }
}

export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`)
  if (!res.ok) {
    throw new Error('Friendbot could not fund this account. Try again shortly.')
  }
}
