import { useCallback, useEffect, useState } from 'react'
import { ExternalLinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { explorerTxUrl } from '@/lib/config'
import { usdcToNumber, shortHex } from '@/lib/format'
import { useT, type MessageKey } from '@/lib/i18n'
import { fetchStats, type ContractStats, type StatsKind } from '@/lib/stats'

const KIND_LABELS: Record<StatsKind, MessageKey> = {
  pay: 'stats.kindPay',
  wd_spend: 'stats.kindWdSpend',
  wd_save: 'stats.kindWdSave',
  split: 'stats.kindSplit',
  lock: 'stats.kindLock',
  target: 'stats.kindTarget',
}

function usdc(amount: bigint): string {
  return usdcToNumber(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

export function StatsPage() {
  const t = useT()
  const [stats, setStats] = useState<ContractStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setStats(await fetchStats())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t('stats.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('stats.subtitle')}</p>
      </div>

      {failed ? (
        <Card className="rounded-2xl shadow-none">
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">{t('stats.error')}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('stats.wallets')} value={String(stats.wallets)} />
            <StatCard label={t('stats.payments')} value={String(stats.payments)} />
            <StatCard label={t('stats.volume')} value={`${usdc(stats.volume)} USDC`} />
            <StatCard
              label={t('stats.saved')}
              value={`${usdc(stats.saved)} USDC`}
              hint={t('stats.interactionsHint', { count: stats.interactions })}
            />
          </div>

          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{t('stats.recent')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('stats.empty')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.recent.map((event) => (
                    <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-ink">
                        {t(KIND_LABELS[event.kind])}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {shortHex(event.user)}
                      </span>
                      {event.amount !== undefined && (
                        <span className="text-sm tabular-nums">{usdc(event.amount)} USDC</span>
                      )}
                      <span className="ml-auto flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {event.at.toLocaleString()}
                        </span>
                        <a
                          href={explorerTxUrl(event.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-ink hover:opacity-80"
                          aria-label={t('activity.viewOnExplorer')}
                        >
                          <ExternalLinkIcon className="size-3.5" />
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">{t('stats.windowNote')}</p>
        </>
      )}

    </section>
  )
}
