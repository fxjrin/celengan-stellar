export type AppErrorKind = 'wallet' | 'rejected' | 'insufficient' | 'unknown'

export interface AppError {
  kind: AppErrorKind
  message: string
}

// Maps raw wallet/RPC/contract failures to the three error classes the flow
// cares about (missing wallet, user rejection, insufficient funds), so the UI
// can show one clear message instead of a raw stack.
export function classifyError(error: unknown): AppError {
  const raw = error instanceof Error ? error.message : String(error)
  const text = raw.toLowerCase()

  if (text.includes('not connected') || text.includes('no wallet') || text.includes('wallet not')) {
    return { kind: 'wallet', message: 'Connect a wallet first.' }
  }
  if (
    text.includes('declined') ||
    text.includes('rejected') ||
    text.includes('denied') ||
    text.includes('cancel')
  ) {
    return { kind: 'rejected', message: 'You rejected the request in your wallet.' }
  }
  if (
    text.includes('insufficient') ||
    text.includes('underfunded') ||
    text.includes('insufficientbalance') ||
    text.includes('error(contract, #2)')
  ) {
    return { kind: 'insufficient', message: 'Insufficient balance for this amount.' }
  }
  return { kind: 'unknown', message: raw }
}
