import { rpc, TransactionBuilder } from 'celengan'
import { NETWORK_PASSPHRASE, RPC_URL } from '@/lib/config'
import type { WalletBridge } from '@/lib/wallet-bridge'

// Blend testnet faucet; issues the USDC the DeFindex vault is denominated in
// and includes the trustline, so one call fully prepares a demo wallet.
// Proxied (vite dev proxy / vercel rewrite) because the lambda sends no CORS headers.
const FAUCET_URL = '/faucet'
const FRIENDBOT_URL = 'https://friendbot.stellar.org/?addr='

export async function requestTestUsdc(bridge: WalletBridge): Promise<{ hash: string }> {
  await fetch(FRIENDBOT_URL + bridge.address).catch(() => undefined)

  const res = await fetch(`${FAUCET_URL}?userId=${bridge.address}`)
  if (!res.ok) throw new Error('faucet_unavailable')
  const xdr = (await res.text()).replaceAll('"', '')

  const { signedTxXdr } = await bridge.sign(xdr)
  const server = new rpc.Server(RPC_URL)
  const tx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  const sent = await server.sendTransaction(tx)
  if (sent.status === 'TRY_AGAIN_LATER') throw new Error('faucet_unavailable')
  if (sent.status === 'ERROR') {
    throw new Error('faucet_maybe_funded') // usually a duplicate claim on an already funded wallet
  }
  return { hash: sent.hash }
}
