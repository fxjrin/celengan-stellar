import { Networks } from '@stellar/stellar-sdk'

export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const FRIENDBOT_URL = 'https://friendbot.stellar.org'
export const NETWORK_PASSPHRASE = Networks.TESTNET
export const NETWORK_NAME = 'TESTNET'

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`
}

export function explorerAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/testnet/account/${address}`
}
