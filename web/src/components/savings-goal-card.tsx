import { useState } from 'react'
import type { FormEvent } from 'react'
import { TargetIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { CelenganAccount } from '@/lib/types'
import { usdcToNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useWallet } from '@/lib/wallet'

const GOAL_KEY_PREFIX = 'celengan:goal:'

function loadGoal(address: string): number | null {
  const raw = localStorage.getItem(GOAL_KEY_PREFIX + address)
  const value = raw === null ? NaN : Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

// Savings target progress. The goal is a personal, device-local setting (not
// on-chain state), so localStorage keyed by address is the right home for it.
export function SavingsGoalCard({ account }: { account: CelenganAccount }) {
  const { address } = useWallet()
  const t = useT()
  const [goal, setGoal] = useState<number | null>(() => (address ? loadGoal(address) : null))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!address) return null

  const saved = usdcToNumber(account.shares)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = Number(draft)
    if (!Number.isFinite(value) || value <= 0) return
    localStorage.setItem(GOAL_KEY_PREFIX + address, String(value))
    setGoal(value)
    setEditing(false)
    setDraft('')
  }

  if (goal === null || editing) {
    return (
      <Card className="rounded-2xl shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TargetIcon className="size-4 text-gold-ink" />
            {t('goal.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('goal.hint')}</p>
          <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('goal.placeholder')}
              inputMode="decimal"
              className="w-40"
              aria-label={t('goal.title')}
            />
            <Button type="submit" size="sm" disabled={!(Number(draft) > 0)}>
              {t('goal.save')}
            </Button>
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                {t('common.close')}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    )
  }

  const pct = Math.min(100, Math.round((saved / goal) * 100))
  const reached = saved >= goal

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <TargetIcon className="size-4 text-gold-ink" />
            {t('goal.title')}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {t('goal.change')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {reached
            ? t('goal.reached', { target: goal.toLocaleString() })
            : t('goal.progress', {
                pct,
                saved: saved.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                target: goal.toLocaleString(),
              })}
        </p>
      </CardContent>
    </Card>
  )
}
