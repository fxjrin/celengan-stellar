import { Client, type YieldTarget as ContractYieldTarget } from 'celengan'
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '@/lib/config'
import type { CelenganAccount, CelenganService, YieldTarget } from '@/lib/types'
import { requireWalletBridge } from '@/lib/wallet-bridge'

// signAndSend() only resolves once sendTransaction itself has succeeded (status PENDING),
// so sendTransactionResponse.hash is always populated by the time we get here
function hashOf(sent: { sendTransactionResponse?: { hash: string } }): string {
  return sent.sendTransactionResponse?.hash ?? ''
}

function toYieldTarget(target: ContractYieldTarget): YieldTarget {
  if (target.tag === 'Blend') return 'blend'
  if (target.tag === 'Soroswap') return 'soroswap'
  return 'defindex'
}

function fromYieldTarget(target: YieldTarget): ContractYieldTarget {
  if (target === 'blend') return { tag: 'Blend', values: undefined }
  if (target === 'soroswap') return { tag: 'Soroswap', values: undefined }
  return { tag: 'Defindex', values: undefined }
}

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

export const celenganReal: CelenganService = {
  async getAccount(user: string): Promise<CelenganAccount> {
    const tx = await reader().account_of({ user })
    const acc = tx.result
    return {
      splitBps: acc.split_bps,
      spend: acc.spend,
      shares: acc.shares,
      lockUntil: acc.lock_until,
      yieldTarget: toYieldTarget(acc.yield_target),
    }
  },

  async pay(from: string, to: string, amount: bigint) {
    const tx = await signer().pay({ from, to, amount })
    const sent = await tx.signAndSend()
    return { hash: hashOf(sent) }
  },

  async withdrawSpend(user: string, amount: bigint) {
    const tx = await signer().withdraw_spend({ user, amount })
    const sent = await tx.signAndSend()
    return { hash: hashOf(sent) }
  },

  async withdrawSavings(user: string, shares: bigint) {
    const tx = await signer().withdraw_savings({ user, shares })
    const sent = await tx.signAndSend()
    return { amount: sent.result, hash: hashOf(sent) }
  },

  async setSplit(user: string, bps: number) {
    const tx = await signer().set_split({ user, bps })
    const sent = await tx.signAndSend()
    return { hash: hashOf(sent) }
  },

  async setLock(user: string, until: bigint) {
    const tx = await signer().set_lock({ user, until })
    const sent = await tx.signAndSend()
    return { hash: hashOf(sent) }
  },

  async setYieldTarget(user: string, target: YieldTarget) {
    const tx = await signer().set_yield_target({ user, target: fromYieldTarget(target) })
    const sent = await tx.signAndSend()
    return { hash: hashOf(sent) }
  },
}
