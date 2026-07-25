import { cn } from '@/lib/utils'

export type TokenSymbol = 'usdc' | 'eurc' | 'xlm'

type TokenIconProps = {
  token: TokenSymbol
  size?: number
  className?: string
}

export function TokenIcon({ token, size = 24, className }: TokenIconProps) {
  if (token === 'xlm') {
    // white disc keeps the black Stellar mark visible on dark backgrounds
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white',
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg
          width={Math.round(size * 0.84)}
          height={Math.round(size * 0.84)}
          viewBox="76 34 238 238"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="195.1" cy="153.1" r="118.9" fill="black" />
          <path
            fill="white"
            d="M164.1,92.3c22.9-11.7,50.4-9.5,71.1,5.6l-1.7,0.9l-11.1,5.7c-17.3-9.7-38.4-9.4-55.5,0.6c-17.1,10-27.6,28.3-27.6,48.2c0,2.4,0.2,4.9,0.5,7.3l93.9-47.8l19.4-9.9l22.8-11.6v13.9l-23,11.7l-11.1,5.7l-99,50.4l-5.5,2.8l-5.6,2.9l-17.3,8.8v-13.9l5.9-3c4.5-2.3,7.1-7,6.7-12c-0.1-1.7-0.2-3.5-0.2-5.2C126.9,127.5,141.3,104,164.1,92.3z"
          />
          <path
            fill="white"
            d="M275.9,119v13.9l-5.9,3c-4.5,2.3-7.1,7-6.7,12c0.1,1.7,0.2,3.5,0.2,5.2c0,25.7-14.4,49.2-37.3,60.8s-50.4,9.5-71.1-5.6l12.1-6.2l0.7-0.4c17.3,9.7,38.5,9.5,55.6-0.5c17.1-10,27.7-28.4,27.7-48.2c0-2.5-0.2-4.9-0.5-7.3l-94,47.9l-19.4,9.9l-22.7,11.6v-13.9l22.9-11.7l11.1-5.7L275.9,119z"
          />
        </svg>
      </span>
    )
  }
  const src = token === 'usdc' ? '/tokens/usdc.svg' : '/tokens/eurc.png'
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      // inline size wins over the preflight img { height: auto } rule
      style={{ width: size, height: size }}
      className={cn('shrink-0 overflow-hidden rounded-full', className)}
    />
  )
}
