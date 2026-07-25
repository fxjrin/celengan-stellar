import { useWallet } from '@/hooks/useWallet'
import { useSend } from '@/hooks/useSend'
import { Header } from '@/components/Header'
import { BalanceCard } from '@/components/BalanceCard'
import { SendForm } from '@/components/SendForm'
import { TxResult } from '@/components/TxResult'

export function App() {
  const wallet = useWallet()
  const { tx, send, reset } = useSend(() => void wallet.refreshBalance())

  return (
    <div className="app">
      <Header wallet={wallet} />

      <main className="main">
        <section className="hero">
          <h1>Save and send XLM on Stellar testnet</h1>
          <p>
            Connect Freighter, check your balance, and make your first testnet
            payment. Celengan is your on-chain piggy bank starter.
          </p>
        </section>

        {wallet.error && <div className="banner banner-error">{wallet.error}</div>}

        {!wallet.address ? (
          <section className="card connect-card">
            <p>Connect your Freighter wallet to get started.</p>
            <button className="btn btn-primary" onClick={wallet.connect} disabled={wallet.connecting}>
              {wallet.connecting ? 'Connecting...' : 'Connect Freighter'}
            </button>
            <a className="link" href="https://www.freighter.app/" target="_blank" rel="noreferrer">
              Do not have Freighter? Install it
            </a>
          </section>
        ) : (
          <div className="grid">
            <BalanceCard wallet={wallet} />
            <SendForm
              wallet={wallet}
              pending={tx.status === 'pending'}
              onSend={(to, amount) => {
                if (wallet.address) void send(wallet.address, to, amount)
              }}
            />
          </div>
        )}

        <TxResult tx={tx} onDismiss={reset} />
      </main>

      <footer className="footer">
        <span>Celengan - on-chain savings on Stellar</span>
        <span>Testnet</span>
      </footer>
    </div>
  )
}
