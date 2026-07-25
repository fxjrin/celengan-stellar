import type { TxState } from '@/hooks/useSend'
import { explorerTxUrl } from '@/lib/constants'

export function TxResult({ tx, onDismiss }: { tx: TxState; onDismiss: () => void }) {
  if (tx.status === 'idle') return null

  if (tx.status === 'pending') {
    return (
      <div className="tx tx-pending">
        <span className="spinner" aria-hidden="true" />
        <span>Submitting transaction to testnet...</span>
      </div>
    )
  }

  if (tx.status === 'success' && tx.hash) {
    return (
      <div className="tx tx-success">
        <div className="tx-head">
          <strong>Transaction successful</strong>
          <button className="btn btn-ghost" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
        {tx.createdAccount && (
          <p className="tx-note">The destination was new, so it was created and funded.</p>
        )}
        <p className="tx-hash">
          <span>Hash</span>
          <code>{tx.hash}</code>
        </p>
        <a className="link" href={explorerTxUrl(tx.hash)} target="_blank" rel="noreferrer">
          View on Stellar Expert
        </a>
      </div>
    )
  }

  return (
    <div className="tx tx-error">
      <div className="tx-head">
        <strong>Transaction failed</strong>
        <button className="btn btn-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <p>{tx.message}</p>
    </div>
  )
}
