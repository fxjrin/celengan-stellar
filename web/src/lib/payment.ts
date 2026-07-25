import {
  Asset,
  BASE_FEE,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { NETWORK_PASSPHRASE } from './constants'
import { server, accountExists } from './stellar'
import { signXdr } from './freighter'

export function isValidAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address)
}

export interface SendResult {
  hash: string
  createdAccount: boolean
}

// Sends `amount` XLM from `from` to `to` on testnet. If the destination is not
// yet funded, it is created via createAccount so sending to a fresh address
// still works; Horizon result codes are surfaced as readable errors.
export async function sendXlm(
  from: string,
  to: string,
  amount: string,
): Promise<SendResult> {
  const createdAccount = !(await accountExists(to))
  if (createdAccount && Number(amount) < 1) {
    throw new Error('Destination is a new account; send at least 1 XLM to create it.')
  }

  const source = await server.loadAccount(from)
  const operation = createdAccount
    ? Operation.createAccount({ destination: to, startingBalance: amount })
    : Operation.payment({ destination: to, asset: Asset.native(), amount })

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(180)
    .build()

  const signedXdr = await signXdr(tx.toXDR(), from)
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)

  try {
    const result = await server.submitTransaction(signedTx)
    return { hash: result.hash, createdAccount }
  } catch (error) {
    throw new Error(extractHorizonError(error))
  }
}

function extractHorizonError(error: unknown): string {
  const codes = resultCodes(error)
  if (codes?.operations?.length) return codes.operations.join(', ')
  if (codes?.transaction) return codes.transaction
  if (error instanceof Error) return error.message
  return 'Transaction submission failed'
}

function resultCodes(
  error: unknown,
): { transaction?: string; operations?: string[] } | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) return null
  const data = (error as { response?: { data?: { extras?: { result_codes?: unknown } } } })
    .response?.data?.extras?.result_codes
  return (data as { transaction?: string; operations?: string[] }) ?? null
}
