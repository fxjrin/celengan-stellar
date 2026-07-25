import { HORIZON_URL, USDC_ISSUER } from '@/lib/config'

export type UsdcStatus = {
  hasTrustline: boolean
  balance: number
}

type HorizonBalance = {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  balance: string
}

/**
 * Checks whether an account holds the specific classic USDC this demo actually uses
 * (see USDC_ISSUER) and has a nonzero balance of it. A brand-new account that doesn't
 * exist on-chain yet has neither, which is treated the same as missing the trustline.
 */
export async function getUsdcStatus(address: string): Promise<UsdcStatus> {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${address}`)
    if (!res.ok) return { hasTrustline: false, balance: 0 }
    const data = (await res.json()) as { balances?: HorizonBalance[] }
    const entry = (data.balances ?? []).find(
      (b) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER,
    )
    return { hasTrustline: entry !== undefined, balance: entry ? Number(entry.balance) : 0 }
  } catch {
    return { hasTrustline: false, balance: 0 }
  }
}
