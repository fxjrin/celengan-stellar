import {
  isConnected,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from '@stellar/freighter-api'
import { NETWORK_PASSPHRASE } from './constants'

// Thrown when the Freighter extension is not installed or not reachable, so the
// UI can point the user to install it instead of showing a generic failure.
export class FreighterMissingError extends Error {
  constructor() {
    super('Freighter wallet not found. Install it to continue.')
    this.name = 'FreighterMissingError'
  }
}

function errorText(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

export async function detectFreighter(): Promise<boolean> {
  const result = await isConnected()
  return 'isConnected' in result ? result.isConnected : false
}

// Prompts Freighter for access and returns the selected public key.
export async function connect(): Promise<string> {
  if (!(await detectFreighter())) {
    throw new FreighterMissingError()
  }
  const result = await requestAccess()
  if ('error' in result && result.error) {
    throw new Error(errorText(result.error))
  }
  return result.address
}

// Returns the already-authorized address without prompting, or null if the app
// has no standing access (used to restore a session on reload).
export async function getConnectedAddress(): Promise<string | null> {
  const result = await getAddress()
  if ('error' in result && result.error) return null
  return result.address || null
}

export async function getActiveNetwork(): Promise<string | null> {
  const result = await getNetwork()
  if ('error' in result && result.error) return null
  return result.network || null
}

// Signs a transaction XDR with the active Freighter account on testnet.
export async function signXdr(xdr: string, address: string): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  })
  if ('error' in result && result.error) {
    throw new Error(errorText(result.error) || 'Signing was rejected')
  }
  return result.signedTxXdr
}
