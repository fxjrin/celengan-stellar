import { RefreshCwIcon } from 'lucide-react'
import { ConnectPrompt } from '@/components/connect-prompt'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { YieldPositionCard } from '@/components/yield-position-card'
import { YieldSourcesCard } from '@/components/yield-sources-card'
import { useAppState } from '@/lib/app-state'
import { useT } from '@/lib/i18n'
import { useYieldData } from '@/lib/use-yield-data'
import { useWallet } from '@/lib/wallet'

export function YieldPage() {
  const { address } = useWallet()
  const { account, accountStatus, activity, rates } = useAppState()
  const { data, loading, refresh } = useYieldData()
  const t = useT()

  if (!address) return <ConnectPrompt />

  const tvl =
    data.vaultStats.idle !== null && data.vaultStats.invested !== null
      ? data.vaultStats.idle + data.vaultStats.invested
      : null

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title={t('nav.yield')} caption={t('page.yieldCaption')} />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t('yield.refresh')}
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>
      <YieldPositionCard
        account={account}
        activity={activity}
        sharePrice={data.sharePrice}
        blendBRate={data.blendBRate}
        soroswapPool={{
          reserveUsdc: data.soroswapStats.reserveUsdc,
          totalSupply: data.soroswapStats.totalSupply,
        }}
        loading={accountStatus === 'loading'}
        rates={rates}
      />
      <YieldSourcesCard
        blendApy={data.blendApy}
        tvl={tvl}
        blendTvl={data.blendTvl}
        soroswapApy={data.soroswapStats.apy}
        soroswapTvl={data.soroswapStats.tvl}
        mainnetApy={data.mainnetApy}
        loading={loading}
        rates={rates}
        selectedTarget={account?.yieldTarget}
      />
    </section>
  )
}
