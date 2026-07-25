import { useCallback, useEffect, useState } from 'react'
import {
  connect as freighterConnect,
  getActiveNetwork,
  getConnectedAddress,
} from '@/lib/freighter'
import { fetchXlmBalance, fundWithFriendbot } from '@/lib/stellar'
import { NETWORK_NAME } from '@/lib/constants'

const STORAGE_KEY = 'celengan.connected'

export interface WalletState {
  address: string | null
  network: string | null
  balance: string | null
  balanceLoading: boolean
  connecting: boolean
  funding: boolean
  error: string | null
  onTestnet: boolean
  connect: () => Promise<void>
  disconnect: () => void
  refreshBalance: () => Promise<void>
  fund: () => Promise<void>
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [funding, setFunding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBalance = useCallback(async (addr: string) => {
    setBalanceLoading(true)
    try {
      setBalance(await fetchXlmBalance(addr))
    } catch {
      setBalance(null)
    } finally {
      setBalanceLoading(false)
    }
  }, [])

  const applyConnection = useCallback(
    async (addr: string) => {
      setAddress(addr)
      setNetwork(await getActiveNetwork())
      localStorage.setItem(STORAGE_KEY, '1')
      await loadBalance(addr)
    },
    [loadBalance],
  )

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      await applyConnection(await freighterConnect())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }, [applyConnection])

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setAddress(null)
    setNetwork(null)
    setBalance(null)
    setError(null)
  }, [])

  const refreshBalance = useCallback(async () => {
    if (address) await loadBalance(address)
  }, [address, loadBalance])

  const fund = useCallback(async () => {
    if (!address) return
    setFunding(true)
    setError(null)
    try {
      await fundWithFriendbot(address)
      await loadBalance(address)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Funding failed')
    } finally {
      setFunding(false)
    }
  }, [address, loadBalance])

  // Restore a prior session silently if Freighter still grants access.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== '1') return
    void (async () => {
      const addr = await getConnectedAddress()
      if (addr) await applyConnection(addr)
      else localStorage.removeItem(STORAGE_KEY)
    })()
  }, [applyConnection])

  return {
    address,
    network,
    balance,
    balanceLoading,
    connecting,
    funding,
    error,
    onTestnet: network === NETWORK_NAME,
    connect,
    disconnect,
    refreshBalance,
    fund,
  }
}
