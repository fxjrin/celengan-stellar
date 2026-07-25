import { Button } from '@/components/ui/button'
import { useWallet } from '@/lib/wallet'
import { shortAddress } from '@/lib/format'
import { NETWORK_NAME } from '@/lib/config'

export function ConnectButton() {
  const { address, connecting, connect, disconnect } = useWallet()

  if (!address) {
    return (
      <Button onClick={() => void connect()} disabled={connecting}>
        {connecting ? 'Connecting...' : 'Connect wallet'}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden rounded-full bg-growth/15 px-2 py-0.5 text-xs font-medium text-growth-ink sm:inline">
        {NETWORK_NAME}
      </span>
      <span className="font-mono text-sm text-muted-foreground">{shortAddress(address)}</span>
      <Button variant="outline" size="sm" onClick={disconnect}>
        Disconnect
      </Button>
    </div>
  )
}
