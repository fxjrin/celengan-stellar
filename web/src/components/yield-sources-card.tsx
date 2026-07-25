import { ExternalLinkIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney, intlLocale, useT, type MessageKey } from '@/lib/i18n'
import type { YieldTarget } from '@/lib/types'
import type { FxRates } from '@/lib/rates'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

type YieldSourcesCardProps = {
  blendApy: number | null
  tvl: bigint | null
  blendTvl: bigint | null
  soroswapApy: number | null
  soroswapTvl: bigint | null
  mainnetApy: { defindex: number | null; blend: number | null; soroswap: number | null }
  loading: boolean
  rates: FxRates
  selectedTarget?: YieldTarget
}

type SourceRow = {
  key: string
  logo: string
  // set only for logos that are a transparent, single-color glyph with no
  // background of their own (Soroswap's icon); real backgrounded marks
  // (DeFindex, Blend) fill the circle edge-to-edge instead
  logoBackdrop?: string
  website: string
  name: MessageKey
  route: MessageKey
  badge: 'active' | 'soon'
  target: YieldTarget | null
  apy: number | null
  tvl: bigint | null
  // A real rate from a live mainnet pool, purely for context on what real
  // borrowing/trading demand looks like - never the user's own position.
  mainnetApy: number | null
}

function formatApy(value: number | null, locale: string): string {
  if (value === null) return '-'
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function ProtocolLogo({ source }: { source: SourceRow }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted"
      style={source.logoBackdrop ? { backgroundColor: source.logoBackdrop } : undefined}
    >
      <img
        src={source.logo}
        alt=""
        className={
          source.logoBackdrop ? 'h-[58%] w-[58%] object-contain' : 'h-full w-full object-cover'
        }
      />
    </span>
  )
}

export function YieldSourcesCard({
  blendApy,
  tvl,
  blendTvl,
  soroswapApy,
  soroswapTvl,
  mainnetApy,
  loading,
  rates,
  selectedTarget,
}: YieldSourcesCardProps) {
  const t = useT()
  const { locale, primaryCurrency } = useSettings()
  const intl = intlLocale(locale)

  const sources: SourceRow[] = [
    {
      key: 'defindex',
      logo: '/logos/defindex-icon.webp',
      website: 'https://defindex.io',
      name: 'yield.sourceDefindexName',
      route: 'yield.sourceDefindexRoute',
      badge: 'active',
      target: 'defindex',
      apy: blendApy,
      tvl,
      mainnetApy: mainnetApy.defindex,
    },
    {
      key: 'blend',
      logo: '/logos/blend.svg',
      website: 'https://blend.capital',
      name: 'yield.sourceBlendName',
      route: 'yield.sourceBlendRoute',
      badge: 'active',
      target: 'blend',
      apy: blendApy,
      tvl: blendTvl,
      mainnetApy: mainnetApy.blend,
    },
    {
      key: 'soroswap',
      logo: '/logos/soroswap-icon.svg',
      logoBackdrop: '#8866dd',
      website: 'https://soroswap.finance',
      name: 'yield.sourceSoroswapName',
      route: 'yield.sourceSoroswapRoute',
      badge: 'active',
      target: 'soroswap',
      apy: soroswapApy,
      tvl: soroswapTvl,
      mainnetApy: mainnetApy.soroswap,
    },
  ]

  const bestApy = sources.reduce<number | null>(
    (best, source) => (source.apy !== null && (best === null || source.apy > best) ? source.apy : best),
    null,
  )

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <CardTitle>{t('yield.sourcesTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            <Skeleton className="h-40 w-64 shrink-0 rounded-2xl" />
            <Skeleton className="h-40 w-64 shrink-0 rounded-2xl" />
            <Skeleton className="h-40 w-64 shrink-0 rounded-2xl" />
          </div>
        ) : (
          <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
            {sources.map((source) => {
              const isBest = bestApy !== null && source.apy === bestApy
              const isSelected = source.target !== null && source.target === selectedTarget
              return (
                <a
                  key={source.key}
                  href={source.website}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'group flex w-64 shrink-0 snap-start flex-col gap-3 rounded-2xl border bg-card p-4 outline-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                    isSelected && 'border-gold/50',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <ProtocolLogo source={source} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-sm font-medium">
                        <span className="truncate">{t(source.name)}</span>
                        <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{t(source.route)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {isSelected ? (
                      <Badge variant="secondary" className="bg-gold/15 text-[10px] text-gold-ink">
                        {t('yield.badgeSelected')}
                      </Badge>
                    ) : (
                      <Badge
                        variant={source.badge === 'active' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {t(source.badge === 'active' ? 'yield.badgeActive' : 'yield.badgeSoon')}
                      </Badge>
                    )}
                    {isBest && (
                      <Badge variant="secondary" className="bg-gold/15 text-[10px] text-gold-ink">
                        {t('yield.bestYield')}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">
                      {formatApy(source.apy, intl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('yield.apyLabel')}
                      {source.tvl !== null && (
                        <>
                          {' - '}
                          {formatMoney(source.tvl, primaryCurrency, rates, locale)} {t('yield.tvlLabel')}
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('yield.mainnetRefLabel')}{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatApy(source.mainnetApy, intl)}
                    </span>
                  </p>
                </a>
              )
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t('yield.sourcesCaption')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('yield.mainnetRefCaption')}</p>
      </CardContent>
    </Card>
  )
}
