const XLM_SCALE = 10_000_000n

// Parses a decimal XLM string into stroops (7-decimal fixed point).
export function parseXlm(input: string): bigint {
  const trimmed = input.trim()
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) throw new Error('Invalid amount')
  const [whole, frac = ''] = trimmed.split('.')
  return BigInt(whole) * XLM_SCALE + BigInt(frac.padEnd(7, '0'))
}

// Formats stroops as a trimmed decimal XLM string.
export function formatXlm(amount: bigint): string {
  const negative = amount < 0n
  const abs = negative ? -amount : amount
  const whole = abs / XLM_SCALE
  const frac = (abs % XLM_SCALE).toString().padStart(7, '0').replace(/0+$/, '')
  const body = frac === '' ? whole.toString() : `${whole}.${frac}`
  return negative ? `-${body}` : body
}

export function shortAddress(value: string): string {
  return value.length <= 10 ? value : `${value.slice(0, 4)}...${value.slice(-4)}`
}

export function shortHash(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`
}
