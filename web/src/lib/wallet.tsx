import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'
import { NETWORK_PASSPHRASE } from '@/lib/config'
import { setWalletBridge } from '@/lib/wallet-bridge'

const ADDRESS_KEY = 'celengan:address'

let initialized = false

function ensureInit(): void {
  if (initialized) return
  StellarWalletsKit.init({ modules: defaultModules(), network: Networks.TESTNET })
  initialized = true
}

interface WalletContextValue {
  address: string | null
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const bind = useCallback((addr: string) => {
    setAddress(addr)
    setWalletBridge({
      address: addr,
      sign: (xdr) =>
        StellarWalletsKit.signTransaction(xdr, {
          networkPassphrase: NETWORK_PASSPHRASE,
          address: addr,
        }),
    })
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      ensureInit()
      const { address: addr } = await StellarWalletsKit.authModal()
      localStorage.setItem(ADDRESS_KEY, addr)
      bind(addr)
    } finally {
      setConnecting(false)
    }
  }, [bind])

  const disconnect = useCallback(() => {
    localStorage.removeItem(ADDRESS_KEY)
    setAddress(null)
    setWalletBridge(null)
    void StellarWalletsKit.disconnect().catch(() => undefined)
  }, [])

  // Restore a prior session; the kit persists the selected wallet, so signing
  // keeps working after a reload without reopening the modal.
  useEffect(() => {
    const stored = localStorage.getItem(ADDRESS_KEY)
    if (!stored) return
    ensureInit()
    bind(stored)
  }, [bind])

  const value = useMemo(
    () => ({ address, connecting, connect, disconnect }),
    [address, connecting, connect, disconnect],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
