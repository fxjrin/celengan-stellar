import { useT, type MessageKey } from '@/lib/i18n'
import type { YieldTarget } from '@/lib/types'
import { cn } from '@/lib/utils'

const SOURCE_LOGO: Record<YieldTarget, string> = {
  defindex: '/logos/defindex-icon.webp',
  blend: '/logos/blend.svg',
  soroswap: '/logos/soroswap-icon.svg',
}

const SOURCE_NAME_KEY: Record<YieldTarget, MessageKey> = {
  defindex: 'rules.yieldSourceDefindexName',
  blend: 'rules.yieldSourceBlendName',
  soroswap: 'rules.yieldSourceSoroswapName',
}

type YieldRouteBadgeProps = {
  target: YieldTarget
  className?: string
}

// Shows the account's current yield source. Deliberately shows the CURRENT target only,
// never a per-transaction historical one: pay/wd_save events don't carry which protocol
// was active at the time, and set_yield_target only allows switching at a zero balance -
// fabricating a per-row protocol would be a guess dressed up as data.
export function YieldRouteBadge({ target, className }: YieldRouteBadgeProps) {
  const t = useT()
  const name = t(SOURCE_NAME_KEY[target])
  return (
    <div
      className={cn(
        'flex w-fit max-w-full items-center gap-2 rounded-full border bg-muted/40 py-1 pr-3 pl-1',
        className,
      )}
    >
      <span
        className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card ring-1 ring-border"
        style={target === 'soroswap' ? { backgroundColor: '#8866dd' } : undefined}
      >
        <img
          src={SOURCE_LOGO[target]}
          alt=""
          className={target === 'soroswap' ? 'h-[58%] w-[58%] object-contain' : 'h-full w-full object-cover'}
        />
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {t('yield.statusLabel')} <span className="font-medium text-foreground">{name}</span>
      </span>
    </div>
  )
}
