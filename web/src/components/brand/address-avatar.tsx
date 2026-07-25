import { useMemo } from 'react'
import createStellarIdenticon from 'stellar-identicon-js'
import { cn } from '@/lib/utils'

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/

// module-level cache keeps the dataURL identical across re-renders and remounts
const identiconCache = new Map<string, string | null>()

function identiconDataUrl(address: string): string | null {
  const hit = identiconCache.get(address)
  if (hit !== undefined) return hit
  let url: string | null = null
  // document guard: the generator builds an offscreen canvas, browser only
  if (typeof document !== 'undefined' && STELLAR_ADDRESS.test(address)) {
    try {
      url = createStellarIdenticon(address).toDataURL()
    } catch {
      url = null
    }
  }
  identiconCache.set(address, url)
  return url
}

type AddressAvatarProps = {
  address: string
  size?: number
  className?: string
}

export function AddressAvatar({ address, size = 40, className }: AddressAvatarProps) {
  const dataUrl = useMemo(() => identiconDataUrl(address), [address])
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/60',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt=""
          className="h-full w-full p-[15%]"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <span aria-hidden="true" className="size-1/3 rounded-full bg-muted-foreground/25" />
      )}
    </span>
  )
}
