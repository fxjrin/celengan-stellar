export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
export const RPC_URL = 'https://soroban-testnet.stellar.org'

// Testnet deployment defaults; set VITE_CELENGAN_ID="" to use the mock service.
export const CONTRACT_ID: string =
  import.meta.env.VITE_CELENGAN_ID ?? 'CAFTAGQPSJIO5VSDFL6LS5NL4UDS7OQ2D22US4QTVHJJW6Y7YLWCPZ33'
export const USDC_ID: string =
  import.meta.env.VITE_USDC_ID ?? 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU'
// classic Stellar issuer behind the USDC_ID SAC above - Blend's own testnet USDC, not Circle's
// (Circle's testnet USDC is GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5, a different
// asset entirely; DeFindex's vault and Blend's pool are both configured against this one)
export const USDC_ISSUER: string =
  import.meta.env.VITE_USDC_ISSUER ?? 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56'
export const VAULT_ID: string =
  import.meta.env.VITE_VAULT_ID ?? 'CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN'
export const HORIZON_URL = 'https://horizon-testnet.stellar.org'

// Read-only lookups against real mainnet pools, purely to show a clearly-labeled
// "mainnet reference" yield figure alongside the testnet number the app actually
// integrates with - never used for signing or holding funds.
export const MAINNET_RPC_URL = 'https://mainnet.sorobanrpc.com'
export const MAINNET_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
export const MAINNET_USDC_ID = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'

export const EXPLORER_CONTRACT_URL = `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`
}
