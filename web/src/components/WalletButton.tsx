import type { WalletState } from '@/hooks/useWallet'
import { shortAddress } from '@/lib/format'

export function WalletButton({ wallet }: { wallet: WalletState }) {
  if (!wallet.address) {
    return (
      <button className="btn btn-primary" onClick={wallet.connect} disabled={wallet.connecting}>
        {wallet.connecting ? 'Connecting...' : 'Connect Freighter'}
      </button>
    )
  }

  return (
    <div className="wallet-chip">
      <span className={wallet.onTestnet ? 'net-badge net-ok' : 'net-badge net-warn'}>
        {wallet.network ?? 'unknown'}
      </span>
      <span className="wallet-addr" title={wallet.address}>
        {shortAddress(wallet.address)}
      </span>
      <button className="btn btn-ghost" onClick={wallet.disconnect}>
        Disconnect
      </button>
    </div>
  )
}
