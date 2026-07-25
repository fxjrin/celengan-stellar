import { useCallback, useState } from 'react'
import { sendXlm } from '@/lib/payment'

export type TxStatus = 'idle' | 'pending' | 'success' | 'error'

export interface TxState {
  status: TxStatus
  hash: string | null
  message: string | null
  createdAccount: boolean
}

const initial: TxState = {
  status: 'idle',
  hash: null,
  message: null,
  createdAccount: false,
}

export interface SendController {
  tx: TxState
  send: (from: string, to: string, amount: string) => Promise<void>
  reset: () => void
}

export function useSend(onSuccess: () => void): SendController {
  const [tx, setTx] = useState<TxState>(initial)

  const send = useCallback(
    async (from: string, to: string, amount: string) => {
      setTx({ status: 'pending', hash: null, message: null, createdAccount: false })
      try {
        const result = await sendXlm(from, to, amount)
        setTx({
          status: 'success',
          hash: result.hash,
          message: null,
          createdAccount: result.createdAccount,
        })
        onSuccess()
      } catch (e) {
        setTx({
          status: 'error',
          hash: null,
          message: friendlyError(e),
          createdAccount: false,
        })
      }
    },
    [onSuccess],
  )

  const reset = useCallback(() => setTx(initial), [])

  return { tx, send, reset }
}

function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Transaction failed'
  const text = raw.toLowerCase()
  if (text.includes('op_underfunded') || text.includes('tx_insufficient_balance')) {
    return 'Insufficient balance for this amount plus the network fee.'
  }
  if (text.includes('declined') || text.includes('rejected') || text.includes('denied')) {
    return 'You rejected the request in Freighter.'
  }
  if (text.includes('op_no_destination')) {
    return 'Destination account does not exist on testnet.'
  }
  return raw
}
