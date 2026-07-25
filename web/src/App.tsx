import { Toaster } from 'sonner'
import { WalletProvider, useWallet } from '@/lib/wallet'
import { Logo } from '@/components/brand/logo'
import { ConnectButton } from '@/components/connect-button'
import { Dashboard } from '@/components/dashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { explorerContractUrl } from '@/lib/config'

function Shell() {
  const { address, connect, connecting } = useWallet()

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <ConnectButton />
      </header>

      <main className="flex flex-1 flex-col gap-6 py-4">
        <section>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Your on-chain piggy bank
          </h1>
          <p className="mt-1 max-w-prose text-muted-foreground">
            Deposit and withdraw XLM through the Celengan smart contract on Stellar testnet.
          </p>
        </section>

        {address ? (
          <Dashboard address={address} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Connect to start saving</CardTitle>
              <CardDescription>
                Use Freighter, xBull, Albedo or any supported Stellar wallet on testnet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => void connect()} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect wallet'}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="flex items-center justify-between py-6 text-xs text-muted-foreground">
        <span>Celengan - on-chain savings on Stellar</span>
        <a
          className="text-primary-ink hover:underline"
          href={explorerContractUrl()}
          target="_blank"
          rel="noreferrer"
        >
          Contract
        </a>
      </footer>
    </div>
  )
}

export function App() {
  return (
    <WalletProvider>
      <Shell />
      <Toaster position="top-center" richColors />
    </WalletProvider>
  )
}
