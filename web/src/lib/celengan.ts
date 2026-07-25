import { Client } from 'celengan-client'
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '@/lib/config'
import { requireWalletBridge } from '@/lib/wallet-bridge'

function reader(): Client {
  return new Client({
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
  })
}

function signer(): Client {
  const { address, sign } = requireWalletBridge()
  return new Client({
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: address,
    signTransaction: (xdr: string) => sign(xdr),
  })
}

// signAndSend resolves once the network has accepted the transaction (status
// PENDING), so sendTransactionResponse.hash is populated by the time we read it.
function hashOf(sent: { sendTransactionResponse?: { hash: string } }): string {
  return sent.sendTransactionResponse?.hash ?? ''
}

export async function getSavings(user: string): Promise<bigint> {
  const tx = await reader().balance({ user })
  return tx.result
}

export async function deposit(from: string, amount: bigint): Promise<string> {
  const tx = await signer().deposit({ from, amount })
  return hashOf(await tx.signAndSend())
}

export async function withdraw(to: string, amount: bigint): Promise<string> {
  const tx = await signer().withdraw({ to, amount })
  return hashOf(await tx.signAndSend())
}
