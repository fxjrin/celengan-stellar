import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Brand mark: two mirrored arcs forming a linked loop on a glossy
 * Stellar-yellow tile, standing for the app's core split: every payment
 * divides into a spending pocket and a savings pocket.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  // strip useId wrapper chars; they break url(#...) gradient references
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const tile = `cel-logo-tile-${uid}`
  const depth = `cel-logo-depth-${uid}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={tile} gradientUnits="userSpaceOnUse" cx="13" cy="10" r="56">
          <stop offset="0%" stopColor="#ffe98a" />
          <stop offset="48%" stopColor="#fdda24" />
          <stop offset="100%" stopColor="#d9a900" />
        </radialGradient>
        <linearGradient id={depth} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="70%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${tile})`} />
      <rect width="48" height="48" rx="14" fill={`url(#${depth})`} />
      <ellipse
        cx="14"
        cy="10"
        rx="8.5"
        ry="4"
        fill="#fff"
        opacity="0.5"
        transform="rotate(-28 14 10)"
      />
      {/* two arcs, exact 180-degree rotations of each other about the tile center */}
      <g fill="none" stroke="#26201a" strokeWidth="6.5" strokeLinecap="round">
        <path d="M12,21 A10,10 0 0 1 32,21" />
        <path d="M16,27 A10,10 0 0 0 36,27" />
      </g>
    </svg>
  )
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={22} />
      <span className="text-lg font-semibold tracking-tight">Celengan</span>
    </span>
  )
}
