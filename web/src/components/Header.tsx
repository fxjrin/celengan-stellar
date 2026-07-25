import { Logo } from './Logo'
import { WalletButton } from './WalletButton'
import type { WalletState } from '@/hooks/useWallet'

export function Header({ wallet }: { wallet: WalletState }) {
  return (
    <header className="header">
      <Logo />
      <WalletButton wallet={wallet} />
    </header>
  )
}
