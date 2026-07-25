export type SignResult = { signedTxXdr: string; signerAddress?: string }

export type WalletBridge = {
  address: string
  sign: (xdr: string) => Promise<SignResult>
}

let current: WalletBridge | null = null

export function setWalletBridge(bridge: WalletBridge | null): void {
  current = bridge
}

export function requireWalletBridge(): WalletBridge {
  if (!current) throw new Error('Wallet not connected')
  return current
}
