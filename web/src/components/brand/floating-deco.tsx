import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

type DecoProps = { uid: string }

const SHADOW = { x: '-40%', y: '-40%', width: '180%', height: '180%' }

// the three APAC hackathon countries this app targets: Indonesia, Vietnam, Philippines
const APAC_CURRENCY_SYMBOLS = ['Rp', '₫', '₱']
const CURRENCY_CYCLE_MS = 3200
const CURRENCY_FLIP_MS = 420

function RpCoin({ uid }: DecoProps) {
  const rim = `${uid}-rim`
  const face = `${uid}-face`
  const sh = `${uid}-sh`
  const [symbolIndex, setSymbolIndex] = useState(0)
  const [edgeOn, setEdgeOn] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cycle = setInterval(() => {
      setEdgeOn(true)
      const swap = setTimeout(() => {
        setSymbolIndex((i) => (i + 1) % APAC_CURRENCY_SYMBOLS.length)
        setEdgeOn(false)
      }, CURRENCY_FLIP_MS / 2)
      return () => clearTimeout(swap)
    }, CURRENCY_CYCLE_MS)
    return () => clearInterval(cycle)
  }, [])

  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        <radialGradient id={rim} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffe9b8" />
          <stop offset="55%" stopColor="#d9a441" />
          <stop offset="100%" stopColor="#a9761f" />
        </radialGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#f3d27e" />
          <stop offset="100%" stopColor="#cf9832" />
        </linearGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#7a5410" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter={`url(#${sh})`}>
        <circle cx="32" cy="32" r="27" fill={`url(#${rim})`} />
        <circle cx="32" cy="32" r="21" fill={`url(#${face})`} />
        <circle cx="32" cy="32" r="21" fill="none" stroke="#b07f22" strokeWidth="1.2" opacity="0.5" />
        {/* squashed to edge-on then un-squashed on the other side of the symbol swap,
            like a coin flipping over to reveal its next face - swap itself is invisible
            since it happens at the point the text is scaled to a hairline */}
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="'Geist Variable', system-ui, sans-serif"
          fontSize="20"
          fontWeight="700"
          fill="#8f6414"
          style={{
            transformOrigin: '32px 34px',
            transform: edgeOn ? 'scaleX(0.04)' : 'scaleX(1)',
            transition: `transform ${CURRENCY_FLIP_MS / 2}ms ease-in-out`,
          }}
        >
          {APAC_CURRENCY_SYMBOLS[symbolIndex]}
        </text>
        <ellipse cx="22" cy="16" rx="9" ry="4.2" fill="#fff" opacity="0.55" transform="rotate(-28 22 16)" />
      </g>
    </svg>
  )
}

function DollarCoin({ uid }: DecoProps) {
  const rim = `${uid}-rim`
  const face = `${uid}-face`
  const sh = `${uid}-sh`
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        <radialGradient id={rim} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ecf6d8" />
          <stop offset="55%" stopColor="#a8c377" />
          <stop offset="100%" stopColor="#5e7f3d" />
        </radialGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#d9e9b4" />
          <stop offset="100%" stopColor="#8fb05c" />
        </linearGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#425f2b" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter={`url(#${sh})`}>
        <circle cx="32" cy="32" r="27" fill={`url(#${rim})`} />
        <circle cx="32" cy="32" r="21" fill={`url(#${face})`} />
        <circle cx="32" cy="32" r="21" fill="none" stroke="#6d8c44" strokeWidth="1.2" opacity="0.5" />
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="'Geist Variable', system-ui, sans-serif"
          fontSize="22"
          fontWeight="700"
          fill="#4c672c"
        >
          $
        </text>
        <ellipse cx="22" cy="16" rx="9" ry="4.2" fill="#fff" opacity="0.55" transform="rotate(-28 22 16)" />
      </g>
    </svg>
  )
}

function XlmCoin({ uid }: DecoProps) {
  const rim = `${uid}-rim`
  const face = `${uid}-face`
  const sh = `${uid}-sh`
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        <radialGradient id={rim} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#7a8089" />
          <stop offset="55%" stopColor="#4a4f55" />
          <stop offset="100%" stopColor="#23262a" />
        </radialGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#565c63" />
          <stop offset="100%" stopColor="#2b2f34" />
        </linearGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#0c0e10" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${sh})`}>
        <circle cx="32" cy="32" r="27" fill={`url(#${rim})`} />
        <circle cx="32" cy="32" r="21" fill={`url(#${face})`} />
        <circle cx="32" cy="32" r="21" fill="none" stroke="#171a1d" strokeWidth="1.2" opacity="0.5" />
        {/* official lumen mark: its 237.8-wide box (center 195.1,153.1) scaled to 30px on the r-21 face */}
        <g transform="translate(7.3869 12.6854) scale(0.126156)">
          <path
            fill="white"
            d="M164.1,92.3c22.9-11.7,50.4-9.5,71.1,5.6l-1.7,0.9l-11.1,5.7c-17.3-9.7-38.4-9.4-55.5,0.6c-17.1,10-27.6,28.3-27.6,48.2c0,2.4,0.2,4.9,0.5,7.3l93.9-47.8l19.4-9.9l22.8-11.6v13.9l-23,11.7l-11.1,5.7l-99,50.4l-5.5,2.8l-5.6,2.9l-17.3,8.8v-13.9l5.9-3c4.5-2.3,7.1-7,6.7-12c-0.1-1.7-0.2-3.5-0.2-5.2C126.9,127.5,141.3,104,164.1,92.3z"
          />
          <path
            fill="white"
            d="M275.9,119v13.9l-5.9,3c-4.5,2.3-7.1,7-6.7,12c0.1,1.7,0.2,3.5,0.2,5.2c0,25.7-14.4,49.2-37.3,60.8s-50.4,9.5-71.1-5.6l12.1-6.2l0.7-0.4c17.3,9.7,38.5,9.5,55.6-0.5c17.1-10,27.7-28.4,27.7-48.2c0-2.5-0.2-4.9-0.5-7.3l-94,47.9l-19.4,9.9l-22.7,11.6v-13.9l22.9-11.7l11.1-5.7L275.9,119z"
          />
        </g>
        <ellipse cx="22" cy="16" rx="9" ry="4.2" fill="#fff" opacity="0.45" transform="rotate(-28 22 16)" />
      </g>
    </svg>
  )
}

function UsdcCoin({ uid }: DecoProps) {
  const rim = `${uid}-rim`
  const face = `${uid}-face`
  const sh = `${uid}-sh`
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        <radialGradient id={rim} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#5aa9e6" />
          <stop offset="55%" stopColor="#2775ca" />
          <stop offset="100%" stopColor="#17559c" />
        </radialGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#4d9ede" />
          <stop offset="100%" stopColor="#1f65b3" />
        </linearGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#123f74" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter={`url(#${sh})`}>
        <circle cx="32" cy="32" r="27" fill={`url(#${rim})`} />
        <circle cx="32" cy="32" r="21" fill={`url(#${face})`} />
        <circle cx="32" cy="32" r="21" fill="none" stroke="#144a87" strokeWidth="1.2" opacity="0.5" />
        {/* official USDC mark: its 192-wide box (center 97,97) scaled to 30px on the r-21 face */}
        <g transform="translate(16.8438 16.8438) scale(0.15625)">
          <path
            fill="white"
            d="M114.28 27.0996V39.4596C138.94 46.8996 157 69.8196 157 96.9996C157 124.18 138.94 147.1 114.28 154.54V166.9C145.72 159.22 169 130.84 169 96.9996C169 63.1596 145.72 34.7796 114.28 27.0996Z"
          />
          <path
            fill="white"
            d="M37 96.9996C37 69.8196 55.06 46.8996 79.72 39.4596V27.0996C48.28 34.7796 25 63.1596 25 96.9996C25 130.84 48.28 159.22 79.72 166.9V154.54C55.06 147.16 37 124.18 37 96.9996Z"
          />
          <path
            fill="white"
            d="M122.8 110.38C122.8 85.84 84.3402 95.92 84.3402 82.36C84.3402 77.5 88.2402 74.38 95.6802 74.38C104.56 74.38 107.62 78.7 108.58 84.52H120.82C119.728 73.5976 113.459 66.7012 103 64.6468V55H91.0002V64.3024C79.542 65.7616 72.3402 72.4342 72.3402 82.36C72.3402 107.02 110.86 97.78 110.86 111.1C110.86 116.14 106 119.5 97.7802 119.5C87.0402 119.5 83.5002 114.76 82.1802 108.22H70.2402C71.0136 120.183 78.3906 127.671 91.0002 129.539V139H103V129.665C115.307 128.075 122.8 120.916 122.8 110.38Z"
          />
        </g>
        <ellipse cx="22" cy="16" rx="9" ry="4.2" fill="#fff" opacity="0.55" transform="rotate(-28 22 16)" />
      </g>
    </svg>
  )
}

function CoinStack({ uid }: DecoProps) {
  const side = `${uid}-side`
  const top = `${uid}-top`
  const sh = `${uid}-sh`
  const coin = (cx: number, topY: number) => (
    <g key={topY}>
      <ellipse cx={cx} cy={topY + 5} rx="20" ry="7.5" fill={`url(#${side})`} />
      <rect x={cx - 20} y={topY} width="40" height="5" fill={`url(#${side})`} />
      <ellipse cx={cx} cy={topY} rx="20" ry="7.5" fill={`url(#${top})`} />
      <ellipse cx={cx} cy={topY} rx="14" ry="4.8" fill="none" stroke="#c9992e" strokeWidth="1" opacity="0.6" />
    </g>
  )
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        <linearGradient id={side} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b9861f" />
          <stop offset="100%" stopColor="#8f6414" />
        </linearGradient>
        <linearGradient id={top} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#f7dc94" />
          <stop offset="100%" stopColor="#d9a441" />
        </linearGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#7a5410" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter={`url(#${sh})`}>
        {coin(32, 42)}
        {coin(30, 33)}
        {coin(33, 24)}
        <ellipse cx="27" cy="21.5" rx="8" ry="2.8" fill="#fff" opacity="0.6" transform="rotate(-8 27 21.5)" />
      </g>
    </svg>
  )
}

function LoopBlob({ uid }: DecoProps) {
  const body = `${uid}-body`
  const sh = `${uid}-sh`
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe98a" />
          <stop offset="55%" stopColor="#f4c81c" />
          <stop offset="100%" stopColor="#c79400" />
        </linearGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#8a6c00" floodOpacity="0.32" />
        </filter>
      </defs>
      {/* the brand mark's twin arcs, rescaled from the 48-box logo to this 64-box deco */}
      <g
        filter={`url(#${sh})`}
        fill="none"
        stroke={`url(#${body})`}
        strokeWidth="8.7"
        strokeLinecap="round"
      >
        <path d="M16,28 A13.33,13.33 0 0 1 42.67,28" />
        <path d="M21.33,36 A13.33,13.33 0 0 0 48,36" />
      </g>
      <ellipse cx="18" cy="14" rx="9" ry="4.2" fill="#fff" opacity="0.45" transform="rotate(-30 18 14)" />
    </svg>
  )
}

function Sparkle({ uid }: DecoProps) {
  const body = `${uid}-body`
  const sh = `${uid}-sh`
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        <radialGradient id={body} cx="40%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#e6f6fb" />
          <stop offset="55%" stopColor="#7fcbe3" />
          <stop offset="100%" stopColor="#38a3c8" />
        </radialGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1c688a" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter={`url(#${sh})`}>
        <path
          d="M32 5C34.5 23 41 29.5 59 32 41 34.5 34.5 41 32 59 29.5 41 23 34.5 5 32 23 29.5 29.5 23 32 5Z"
          fill={`url(#${body})`}
        />
        <ellipse cx="27" cy="22" rx="4.5" ry="2.4" fill="#fff" opacity="0.7" transform="rotate(-35 27 22)" />
      </g>
    </svg>
  )
}

function SoftArrow({ uid }: DecoProps) {
  const body = `${uid}-body`
  const sh = `${uid}-sh`
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        {/* sky-teal balances a page that now leans heavily gold */}
        <linearGradient id={body} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#a9def0" />
          <stop offset="55%" stopColor="#4fb0d3" />
          <stop offset="100%" stopColor="#1f7fa3" />
        </linearGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#175f7d" floodOpacity="0.32" />
        </filter>
      </defs>
      <g
        filter={`url(#${sh})`}
        fill="none"
        stroke={`url(#${body})`}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 47 44 20" />
        <path d="M29 20h15v15" />
      </g>
      <ellipse cx="25" cy="37" rx="7" ry="2.2" fill="#fff" opacity="0.5" transform="rotate(-45 25 37)" />
    </svg>
  )
}

function HeartBlob({ uid }: DecoProps) {
  const body = `${uid}-body`
  const sh = `${uid}-sh`
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" overflow="visible" aria-hidden="true">
      <defs>
        <radialGradient id={body} cx="35%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#ffdbe3" />
          <stop offset="55%" stopColor="#ee8aa3" />
          <stop offset="100%" stopColor="#c2557a" />
        </radialGradient>
        <filter id={sh} {...SHADOW}>
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#8c3355" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter={`url(#${sh})`}>
        <path
          d="M32 55C13 42 7 28 15 19 21 12.5 30 14.5 32 21 34 14.5 43 12.5 49 19 57 28 51 42 32 55Z"
          fill={`url(#${body})`}
        />
        <ellipse cx="22" cy="24" rx="6" ry="3" fill="#fff" opacity="0.55" transform="rotate(-30 22 24)" />
      </g>
    </svg>
  )
}

type Placement = {
  obj: ComponentType<DecoProps>
  side: 'left' | 'right'
  top: string
  left?: string
  right?: string
  size: number
  rotate: number
  depth: number
  duration: number
  delay: number
}

const PLACEMENTS: Placement[] = [
  { obj: RpCoin, side: 'left', top: '12%', left: '6%', size: 96, rotate: -12, depth: 22, duration: 7, delay: 0 },
  { obj: Sparkle, side: 'left', top: '34%', left: '14%', size: 44, rotate: 8, depth: 28, duration: 5.5, delay: 0.8 },
  { obj: LoopBlob, side: 'left', top: '52%', left: '4%', size: 110, rotate: 6, depth: 12, duration: 8, delay: 0.4 },
  { obj: CoinStack, side: 'left', top: '76%', left: '12%', size: 76, rotate: -8, depth: 18, duration: 6.5, delay: 1.2 },
  { obj: UsdcCoin, side: 'left', top: '90%', left: '5%', size: 46, rotate: 10, depth: 24, duration: 6.2, delay: 0.7 },
  { obj: HeartBlob, side: 'right', top: '10%', right: '10%', size: 72, rotate: 10, depth: 20, duration: 7.5, delay: 0.6 },
  { obj: XlmCoin, side: 'right', top: '24%', right: '18%', size: 50, rotate: -8, depth: 16, duration: 7.2, delay: 0.9 },
  { obj: SoftArrow, side: 'right', top: '36%', right: '4%', size: 88, rotate: 4, depth: 10, duration: 8.5, delay: 0.2 },
  { obj: DollarCoin, side: 'right', top: '60%', right: '14%', size: 52, rotate: 14, depth: 26, duration: 5, delay: 1 },
  { obj: Sparkle, side: 'right', top: '80%', right: '7%', size: 40, rotate: -10, depth: 24, duration: 6, delay: 0.3 },
]

// a second composition (different positions, sizes, and left/right swaps of the same
// coins) so a page that shows the deco twice - e.g. hero and closing CTA - doesn't just
// repeat the identical layout
const PLACEMENTS_ALT: Placement[] = [
  { obj: CoinStack, side: 'left', top: '6%', left: '17%', size: 60, rotate: 7, depth: 14, duration: 7.6, delay: 0.3 },
  { obj: LoopBlob, side: 'left', top: '18%', left: '8%', size: 84, rotate: 15, depth: 18, duration: 6.8, delay: 0.1 },
  { obj: DollarCoin, side: 'left', top: '42%', left: '4%', size: 58, rotate: -10, depth: 26, duration: 5.8, delay: 0.9 },
  { obj: Sparkle, side: 'left', top: '66%', left: '15%', size: 40, rotate: -6, depth: 22, duration: 5, delay: 0.5 },
  { obj: UsdcCoin, side: 'left', top: '88%', left: '9%', size: 52, rotate: 12, depth: 16, duration: 7.4, delay: 1.1 },
  { obj: RpCoin, side: 'right', top: '14%', right: '8%', size: 88, rotate: -14, depth: 20, duration: 7, delay: 0.4 },
  { obj: SoftArrow, side: 'right', top: '38%', right: '17%', size: 72, rotate: -6, depth: 12, duration: 8, delay: 0 },
  { obj: HeartBlob, side: 'right', top: '58%', right: '5%', size: 64, rotate: 8, depth: 24, duration: 6.3, delay: 1 },
  { obj: XlmCoin, side: 'right', top: '80%', right: '15%', size: 46, rotate: 10, depth: 28, duration: 6.6, delay: 0.6 },
  { obj: Sparkle, side: 'right', top: '93%', right: '22%', size: 36, rotate: -12, depth: 30, duration: 5.4, delay: 0.7 },
]

const LERP = 0.08

export function FloatingDeco({
  side,
  variant = 'default',
  className,
}: {
  side: 'both' | 'left' | 'right'
  variant?: 'default' | 'alt'
  className?: string
}) {
  const allPlacements = variant === 'alt' ? PLACEMENTS_ALT : PLACEMENTS
  const items = side === 'both' ? allPlacements : allPlacements.filter((p) => p.side === side)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const depths = (side === 'both' ? allPlacements : allPlacements.filter((p) => p.side === side)).map(
      (p) => p.depth,
    )
    let raf = 0
    let running = false
    let targetX = 0
    let targetY = 0
    let curX = 0
    let curY = 0
    const tick = () => {
      curX += (targetX - curX) * LERP
      curY += (targetY - curY) * LERP
      for (let i = 0; i < depths.length; i++) {
        const el = itemRefs.current[i]
        if (!el) continue
        el.style.transform = `translate3d(${(curX * depths[i]).toFixed(2)}px, ${(curY * depths[i]).toFixed(2)}px, 0)`
      }
      if (Math.abs(targetX - curX) + Math.abs(targetY - curY) > 0.002) {
        raf = requestAnimationFrame(tick)
      } else {
        running = false
      }
    }
    const onMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1
      targetY = (e.clientY / window.innerHeight) * 2 - 1
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [side, allPlacements])

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 hidden select-none overflow-hidden md:block',
        className,
      )}
    >
      <style>{`
        @keyframes cel-deco-drift {
          from { transform: translateY(-7px); }
          to { transform: translateY(7px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cel-deco-drift { animation: none !important; }
        }
      `}</style>
      {items.map((item, i) => {
        const Obj = item.obj
        return (
          <div
            key={`${item.side}-${i}`}
            ref={(el) => {
              itemRefs.current[i] = el
            }}
            className="absolute will-change-transform"
            style={{
              top: item.top,
              left: item.left,
              right: item.right,
              width: item.size,
              height: item.size,
            }}
          >
            <div
              className="cel-deco-drift h-full w-full"
              style={{
                animation: `cel-deco-drift ${item.duration}s ease-in-out ${item.delay}s infinite alternate`,
              }}
            >
              <div className="h-full w-full" style={{ transform: `rotate(${item.rotate}deg)` }}>
                <div className="pointer-events-auto h-full w-full transition-transform duration-300 ease-out hover:scale-110">
                  <Obj uid={`cel-${item.side}-${i}`} />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
