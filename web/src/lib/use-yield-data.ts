import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getBlendMainnetReferenceApy,
  getBlendPoolInfo,
  getDefindexMainnetReferenceApy,
  getSharePrice,
  getSoroswapMainnetReferenceApy,
  getSoroswapStats,
  getVaultStats,
  type SoroswapStats,
  type VaultStats,
} from '@/lib/yield'

// Mainnet numbers exist purely as a clearly-labeled reference point (real yield where there's
// real borrowing/trading demand) - never the user's own position, which always lives on testnet.
type MainnetReferenceApy = {
  defindex: number | null
  blend: number | null
  soroswap: number | null
}

type YieldData = {
  sharePrice: bigint | null
  vaultStats: VaultStats
  blendApy: number | null
  blendBRate: bigint | null
  blendTvl: bigint | null
  soroswapStats: SoroswapStats
  mainnetApy: MainnetReferenceApy
}

const EMPTY_STATS: VaultStats = { totalSupply: null, idle: null, invested: null }
const EMPTY_SOROSWAP_STATS: SoroswapStats = { apy: null, tvl: null, reserveUsdc: null, totalSupply: null }
const EMPTY_MAINNET_APY: MainnetReferenceApy = { defindex: null, blend: null, soroswap: null }

export function useYieldData() {
  const [data, setData] = useState<YieldData>({
    sharePrice: null,
    vaultStats: EMPTY_STATS,
    blendApy: null,
    blendBRate: null,
    blendTvl: null,
    soroswapStats: EMPTY_SOROSWAP_STATS,
    mainnetApy: EMPTY_MAINNET_APY,
  })
  const [loading, setLoading] = useState(true)
  // guards against an in-flight refresh overwriting a newer one's result
  const runId = useRef(0)

  const load = useCallback(async () => {
    const id = ++runId.current
    setLoading(true)
    const [
      sharePrice,
      vaultStats,
      blendPoolInfo,
      soroswapStats,
      defindexMainnetApy,
      blendMainnetApy,
      soroswapMainnetApy,
    ] = await Promise.all([
      getSharePrice(),
      getVaultStats(),
      getBlendPoolInfo(),
      getSoroswapStats(),
      getDefindexMainnetReferenceApy(),
      getBlendMainnetReferenceApy(),
      getSoroswapMainnetReferenceApy(),
    ])
    if (runId.current !== id) return
    setData({
      sharePrice,
      vaultStats,
      blendApy: blendPoolInfo.apy,
      blendBRate: blendPoolInfo.bRate,
      blendTvl: blendPoolInfo.tvl,
      soroswapStats,
      mainnetApy: { defindex: defindexMainnetApy, blend: blendMainnetApy, soroswap: soroswapMainnetApy },
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, refresh: load }
}
