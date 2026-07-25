export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
export const NETWORK_NAME = 'TESTNET'
export const RPC_URL = 'https://soroban-testnet.stellar.org'
export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const FRIENDBOT_URL = 'https://friendbot.stellar.org'

// The deployed celengan contract on testnet; override with VITE_CELENGAN_ID.
export const CONTRACT_ID: string =
  import.meta.env.VITE_CELENGAN_ID ?? 'CD265PMPW2K2RKGW2XXZBZAUB7R5JNJKKDAZ7YK4TG7GVW6FQBB63NYF'

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`
}

export function explorerAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/testnet/account/${address}`
}

export function explorerContractUrl(): string {
  return `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`
}
