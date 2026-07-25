import { useEffect, useRef } from 'react'
import { TokenIcon } from '@/components/brand/token-icon'

function LogoBadge({ src, backdrop, padded }: { src: string; backdrop?: string; padded?: boolean }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden rounded-full shadow-lg ring-1 ring-black/5"
      style={{ backgroundColor: backdrop ?? 'var(--card)' }}
    >
      <img
        src={src}
        alt=""
        className={padded ? 'h-[60%] w-[60%] object-contain' : 'h-full w-full object-cover'}
      />
    </div>
  )
}

type Item = {
  render: () => React.ReactNode
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

const ITEMS: Item[] = [
  {
    render: () => <LogoBadge src="/logos/defindex-icon.webp" />,
    side: 'left',
    top: '14%',
    left: '8%',
    size: 68,
    rotate: -8,
    depth: 20,
    duration: 6.5,
    delay: 0,
  },
  {
    render: () => <LogoBadge src="/logos/blend.svg" />,
    side: 'right',
    top: '18%',
    right: '10%',
    size: 62,
    rotate: 10,
    depth: 24,
    duration: 7.2,
    delay: 0.5,
  },
  {
    render: () => <LogoBadge src="/logos/soroswap-icon.svg" backdrop="#8866dd" padded />,
    side: 'left',
    top: '58%',
    left: '5%',
    size: 56,
    rotate: -6,
    depth: 16,
    duration: 6,
    delay: 0.9,
  },
  {
    render: () => <TokenIcon token="xlm" size={48} />,
    side: 'right',
    top: '64%',
    right: '6%',
    size: 48,
    rotate: 6,
    depth: 26,
    duration: 6.8,
    delay: 0.3,
  },
  {
    render: () => <TokenIcon token="usdc" size={44} />,
    side: 'left',
    top: '86%',
    left: '14%',
    size: 44,
    rotate: -10,
    depth: 18,
    duration: 5.6,
    delay: 1.1,
  },
]

const LERP = 0.08

// Same drift + mouse-parallax engine as brand/floating-deco.tsx, kept as its own
// small copy rather than a shared abstraction: this scatters real logo art in
// plain badges, not the hand-illustrated coin SVGs the hero deco renders.
export function LandingProtocolDeco() {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const depths = ITEMS.map((item) => item.depth)
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
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden select-none overflow-hidden md:block"
    >
      <style>{`
        @keyframes cel-proto-deco-drift {
          from { transform: translateY(-6px); }
          to { transform: translateY(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cel-proto-deco-drift { animation: none !important; }
        }
      `}</style>
      {ITEMS.map((item, i) => (
        <div
          key={i}
          ref={(el) => {
            itemRefs.current[i] = el
          }}
          className="absolute will-change-transform"
          style={{ top: item.top, left: item.left, right: item.right, width: item.size, height: item.size }}
        >
          <div
            className="cel-proto-deco-drift h-full w-full"
            style={{ animation: `cel-proto-deco-drift ${item.duration}s ease-in-out ${item.delay}s infinite alternate` }}
          >
            <div className="h-full w-full" style={{ transform: `rotate(${item.rotate}deg)` }}>
              <div className="pointer-events-auto h-full w-full transition-transform duration-300 ease-out hover:scale-110">
                {item.render()}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
