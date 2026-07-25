export type FxRates = { idr: number; vnd: number; php: number }

export const FALLBACK_RATES: FxRates = { idr: 16300, vnd: 25400, php: 57 }

let cached: Promise<FxRates> | null = null

function pick(rates: Record<string, number> | undefined, code: string, fallback: number): number {
  const value = rates?.[code]
  return typeof value === 'number' && value > 0 ? value : fallback
}

async function fetchRates(): Promise<FxRates> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD')
  if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`)
  const data = (await res.json()) as { rates?: Record<string, number> }
  return {
    idr: pick(data.rates, 'IDR', FALLBACK_RATES.idr),
    vnd: pick(data.rates, 'VND', FALLBACK_RATES.vnd),
    php: pick(data.rates, 'PHP', FALLBACK_RATES.php),
  }
}

export function getFxRates(): Promise<FxRates> {
  cached ??= fetchRates().catch(() => FALLBACK_RATES)
  return cached
}
