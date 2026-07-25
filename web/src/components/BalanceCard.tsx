import type { WalletState } from '@/hooks/useWallet'
import { formatXlm } from '@/lib/format'
import { explorerAccountUrl } from '@/lib/constants'

export function BalanceCard({ wallet }: { wallet: WalletState }) {
  const isEmpty = wallet.balance !== null && Number(wallet.balance) === 0

  return (
    <section className="card">
      <div className="card-head">
        <h2>Balance</h2>
        <button
          className="btn btn-ghost"
          onClick={() => void wallet.refreshBalance()}
          disabled={wallet.balanceLoading}
        >
          {wallet.balanceLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="balance">
        <span className="balance-amount">
          {wallet.balance === null ? '--' : formatXlm(wallet.balance)}
        </span>
        <span className="balance-unit">XLM</span>
      </div>

      {isEmpty && (
        <button className="btn btn-secondary" onClick={() => void wallet.fund()} disabled={wallet.funding}>
          {wallet.funding ? 'Requesting...' : 'Get testnet XLM'}
        </button>
      )}

      {wallet.address && (
        <a
          className="link"
          href={explorerAccountUrl(wallet.address)}
          target="_blank"
          rel="noreferrer"
        >
          View account on explorer
        </a>
      )}
    </section>
  )
}
