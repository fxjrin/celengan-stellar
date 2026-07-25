import { ChevronDownIcon, LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { errorKey } from '@/lib/errors'
import { useT } from '@/lib/i18n'
import { useWallet } from '@/lib/wallet'

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function ConnectButton() {
  const t = useT()
  const { address, connecting, connect, disconnect } = useWallet()

  const handleConnect = async () => {
    try {
      await connect()
    } catch (e) {
      const key = errorKey(e)
      if (key === 'errors.walletCancelled') return // user closed the modal on purpose
      toast.error(t(key))
    }
  }

  if (address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="tabular-nums">
            {shortAddress(address)}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-xs text-muted-foreground">{t('topbar.connected')}</span>
            <span className="font-mono text-xs">{shortAddress(address)}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void disconnect()}>
            <LogOutIcon />
            {t('topbar.disconnect')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Button onClick={() => void handleConnect()} disabled={connecting}>
      {connecting ? `${t('topbar.connecting')}...` : t('topbar.connect')}
    </Button>
  )
}
