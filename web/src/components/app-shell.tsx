import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusEvent, PointerEvent as ReactPointerEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  ActivityIcon,
  ArrowUpRightIcon,
  CoinsIcon,
  ExternalLinkIcon,
  LandmarkIcon,
  Link2Icon,
  Loader2Icon,
  LogOutIcon,
  MoonIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SunIcon,
  TrendingUpIcon,
  WalletIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { AddressAvatar } from '@/components/brand/address-avatar'
import { FloatingDeco } from '@/components/brand/floating-deco'
import { LogoMark } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { EXPLORER_CONTRACT_URL } from '@/lib/config'
import { errorKey } from '@/lib/errors'
import { useT, type MessageKey } from '@/lib/i18n'
import { useFaucet } from '@/lib/use-faucet'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { cn } from '@/lib/utils'
import { useWallet } from '@/lib/wallet'

const ITEM =
  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
const ITEM_IDLE = 'text-muted-foreground hover:bg-muted hover:text-foreground'
const ITEM_ACTIVE = 'bg-primary/10 text-primary-ink'

type SidebarZone = 'hidden' | 'peek' | 'full'

const ZONE_RANK: Record<SidebarZone, number> = { hidden: 0, peek: 1, full: 2 }

// long enough to cross gaps between zones without the panel flickering shut
const CLOSE_DELAY_MS = 200
// hysteresis past the eighth boundary so full<->peek does not jitter on it
const FULL_EXIT_SLACK_PX = 24

const PANEL_OPEN_MS = 320
const PANEL_CLOSE_MS = 260
// fast start, long soft landing (Apple sheet curve)
const PANEL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function greetingKey(hour: number): MessageKey {
  if (hour >= 5 && hour < 12) return 'greeting.morning'
  if (hour >= 12 && hour < 17) return 'greeting.afternoon'
  if (hour >= 17 && hour < 21) return 'greeting.evening'
  return 'greeting.night'
}

function labelClass(rail: boolean): string {
  return cn(
    'whitespace-nowrap transition-[opacity,translate] duration-[180ms] ease-out motion-reduce:transition-none',
    // collapse fades with no delay so text never outlives the shrinking panel
    rail ? '-translate-x-1 opacity-0' : 'translate-x-0 opacity-100 delay-[90ms]',
  )
}

function SectionLabel({ rail, children }: { rail: boolean; children: string }) {
  return (
    <p
      className={cn(
        'px-3 pt-5 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase',
        labelClass(rail),
      )}
    >
      {children}
    </p>
  )
}

type SidebarContentProps = {
  rail?: boolean
  onNavigate?: () => void
}

function SidebarContent({ rail = false, onNavigate }: SidebarContentProps) {
  const t = useT()
  const { address, connecting, connect, disconnect } = useWallet()
  const { faucetBusy, anyBusy, runFaucet } = useFaucet()
  const label = labelClass(rail)

  const handleConnect = async () => {
    try {
      await connect()
    } catch (e) {
      const key = errorKey(e)
      if (key === 'errors.walletCancelled') return // user closed the modal on purpose
      toast.error(t(key))
    }
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(ITEM, isActive ? ITEM_ACTIVE : ITEM_IDLE)

  return (
    <div className="flex h-full flex-col p-4">
      {/* px tuned so the mark sits centered in the 40px rail column */}
      <div className="flex items-center gap-2 px-[9px] pt-1 pb-2">
        <LogoMark size={22} />
        <span className={cn('text-lg font-semibold tracking-tight', label)}>Celengan</span>
      </div>
      <nav className="no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <SectionLabel rail={rail}>{t('nav.menu')}</SectionLabel>
        <NavLink to="/app" end onClick={onNavigate} className={navClass}>
          <LandmarkIcon className="size-[18px] shrink-0" />
          <span className={label}>{t('nav.dashboard')}</span>
        </NavLink>
        <NavLink to="/app/activity" onClick={onNavigate} className={navClass}>
          <ActivityIcon className="size-[18px] shrink-0" />
          <span className={label}>{t('nav.activity')}</span>
        </NavLink>
        <NavLink to="/app/yield" onClick={onNavigate} className={navClass}>
          <TrendingUpIcon className="size-[18px] shrink-0" />
          <span className={label}>{t('nav.yield')}</span>
        </NavLink>
        <SectionLabel rail={rail}>{t('nav.action')}</SectionLabel>
        <NavLink to="/app/withdraw" onClick={onNavigate} className={navClass}>
          <ArrowUpRightIcon className="size-[18px] shrink-0" />
          <span className={label}>{t('nav.withdraw')}</span>
        </NavLink>
        <NavLink to="/app/rules" onClick={onNavigate} className={navClass}>
          <SlidersHorizontalIcon className="size-[18px] shrink-0" />
          <span className={label}>{t('nav.rules')}</span>
        </NavLink>
        <NavLink to="/app/link" onClick={onNavigate} className={navClass}>
          <Link2Icon className="size-[18px] shrink-0" />
          <span className={label}>{t('nav.paymentLink')}</span>
        </NavLink>
        <button
          type="button"
          className={cn(ITEM, ITEM_IDLE, 'disabled:pointer-events-none disabled:opacity-50')}
          disabled={anyBusy}
          onClick={() => void runFaucet()}
        >
          {faucetBusy ? (
            <Loader2Icon className="size-[18px] shrink-0 animate-spin" />
          ) : (
            <CoinsIcon className="size-[18px] shrink-0" />
          )}
          <span className={label}>
            {faucetBusy ? `${t('common.loading')}...` : t('nav.faucet')}
          </span>
        </button>
        <SectionLabel rail={rail}>{t('nav.protocol')}</SectionLabel>
        <NavLink to="/app/settings" onClick={onNavigate} className={navClass}>
          <SettingsIcon className="size-[18px] shrink-0" />
          <span className={label}>{t('settings.title')}</span>
        </NavLink>
        <a
          href={EXPLORER_CONTRACT_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(ITEM, ITEM_IDLE)}
        >
          <ExternalLinkIcon className="size-[18px] shrink-0" />
          <span className={label}>{t('nav.viewContract')}</span>
        </a>
      </nav>
      <div className="mt-2 border-t pt-2">
        {address ? (
          <button
            type="button"
            className={cn(ITEM, 'text-destructive hover:bg-destructive/10 hover:text-destructive')}
            onClick={() => void disconnect()}
          >
            <LogOutIcon className="size-[18px] shrink-0" />
            <span className={label}>{t('nav.disconnect')}</span>
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              ITEM,
              'text-primary-ink hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50',
            )}
            disabled={connecting}
            onClick={() => void handleConnect()}
          >
            <WalletIcon className="size-[18px] shrink-0" />
            <span className={label}>
              {connecting ? `${t('topbar.connecting')}...` : t('topbar.connect')}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

function ThemeToggle() {
  const t = useT()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('shell.theme')}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  )
}

function AddressChip({ address }: { address: string }) {
  const t = useT()

  const copy = async () => {
    await navigator.clipboard.writeText(address)
    toast.success(t('settings.copied'))
  }

  return (
    <button
      type="button"
      aria-label={t('shell.copyAddress')}
      className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 font-mono text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={() => void copy()}
    >
      <AddressAvatar address={address} size={24} className="rounded-full" />
      {shortAddress(address)}
    </button>
  )
}

function isDesktop(): boolean {
  return window.matchMedia('(min-width: 768px)').matches
}

// inline transition-duration on the aside beats any motion-reduce: class, so query directly
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function AppShell() {
  const t = useT()
  const { address } = useWallet()
  const [zone, setZone] = useState<SidebarZone>('hidden')
  const [panelMs, setPanelMs] = useState<number>(PANEL_OPEN_MS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const zoneRef = useRef<SidebarZone>('hidden')
  const closeTimer = useRef<number | null>(null)
  const overSidebar = useRef(false)
  const focusInSidebar = useRef(false)
  const lastPointerX = useRef(Number.POSITIVE_INFINITY)
  const asideRef = useRef<HTMLElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useScrollLock()

  // the scroll container outlives route swaps, so reset it like a page load would
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  const commitZone = useCallback((next: SidebarZone) => {
    // upgrades get the longer glide, downgrades settle a touch quicker
    setPanelMs(ZONE_RANK[next] > ZONE_RANK[zoneRef.current] ? PANEL_OPEN_MS : PANEL_CLOSE_MS)
    zoneRef.current = next
    setZone(next)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const requestZone = useCallback(
    (raw: SidebarZone) => {
      const target = overSidebar.current || focusInSidebar.current ? 'full' : raw
      const current = zoneRef.current
      if (target === current) {
        cancelClose() // back in the current zone, drop any pending downgrade
        return
      }
      if (ZONE_RANK[target] > ZONE_RANK[current]) {
        cancelClose()
        commitZone(target)
        return
      }
      // downgrades are debounced so brief cursor exits do not flicker the panel
      cancelClose()
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = null
        commitZone(target)
      }, CLOSE_DELAY_MS)
    },
    [cancelClose, commitZone],
  )

  const zoneFromX = useCallback((x: number): SidebarZone => {
    const width = window.innerWidth
    if (x < width / 8) return 'full'
    if (zoneRef.current === 'full' && x < width / 8 + FULL_EXIT_SLACK_PX) return 'full'
    if (x < width / 4) return 'peek'
    return 'hidden'
  }, [])

  useEffect(() => {
    let raf = 0
    const onPointerMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== 'mouse' || !isDesktop()) return
      lastPointerX.current = e.clientX
      if (raf !== 0) return
      raf = requestAnimationFrame(() => {
        raf = 0
        requestZone(zoneFromX(lastPointerX.current))
      })
    }
    window.addEventListener('pointermove', onPointerMove)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [requestZone, zoneFromX])

  useEffect(() => cancelClose, [cancelClose])

  useEffect(() => {
    if (zone === 'hidden') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const hadFocus = asideRef.current?.contains(document.activeElement) ?? false
      focusInSidebar.current = false
      overSidebar.current = false
      cancelClose()
      commitZone('hidden')
      if (hadFocus) skipRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [zone, cancelClose, commitZone])

  const openFromKeyboard = () => {
    cancelClose()
    commitZone('full')
    // wait a frame so the aside is no longer inert before moving focus into it
    requestAnimationFrame(() => {
      asideRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    })
  }

  const handleAsideEnter = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    overSidebar.current = true
    requestZone('full')
  }

  const handleAsideLeave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    overSidebar.current = false
    requestZone(zoneFromX(e.clientX))
  }

  const handleAsideFocus = () => {
    focusInSidebar.current = true
    requestZone('full')
  }

  const handleAsideBlur = (e: FocusEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    focusInSidebar.current = false
    requestZone(zoneFromX(lastPointerX.current))
  }

  return (
    <div className="relative h-svh">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <FloatingDeco side="both" className="opacity-40" />
      </div>
      <div className="hidden md:block">
        <button
          ref={skipRef}
          type="button"
          aria-controls="app-sidebar"
          aria-expanded={zone === 'full'}
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={openFromKeyboard}
        >
          {t('shell.openMenu')}
        </button>
      </div>
      <aside
        ref={asideRef}
        id="app-sidebar"
        inert={zone === 'hidden'}
        className={cn(
          // v4 translate utilities emit the translate property, so transition that, not transform
          'fixed top-4 bottom-4 left-4 z-40 hidden flex-col overflow-hidden rounded-2xl border bg-card shadow-lg shadow-stone-950/10 transition-[width,translate] md:flex',
          zone === 'full' ? 'w-[264px]' : 'w-[72px]',
          // translate past the 16px inset minus a 6px sliver kept as affordance
          zone === 'hidden' ? '-translate-x-[calc(100%+10px)]' : 'translate-x-0',
        )}
        style={{
          transitionTimingFunction: PANEL_EASE,
          transitionDuration: reducedMotion ? '0ms' : `${panelMs}ms`,
        }}
        onPointerEnter={handleAsideEnter}
        onPointerLeave={handleAsideLeave}
        onFocus={handleAsideFocus}
        onBlur={handleAsideBlur}
      >
        <SidebarContent rail={zone !== 'full'} />
      </aside>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="w-72"
          closeLabel={t('common.close')}
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">{t('nav.menu')}</SheetTitle>
          <SidebarContent onNavigate={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
      <div ref={scrollRef} className="no-scrollbar relative z-10 h-full overflow-y-auto">
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-12 md:pt-16">
          {/* touch tablets pass md: but never fire mouse hot zones, so keep the sheet toggle */}
          <div className="mb-4 flex md:pointer-fine:hidden">
            <button
              type="button"
              aria-label={t('shell.openMenu')}
              aria-haspopup="dialog"
              className="flex size-10 items-center justify-center rounded-xl border bg-card shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => setSheetOpen(true)}
            >
              <LogoMark size={22} />
            </button>
          </div>
          <div className="mb-8 flex items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {t(greetingKey(new Date().getHours()))}
            </h1>
            <div className="flex items-center gap-2">
              {address && <AddressChip address={address} />}
              <ThemeToggle />
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
