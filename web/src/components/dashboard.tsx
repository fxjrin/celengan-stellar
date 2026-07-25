import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { toast } from 'sonner'
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { deposit, getSavings, withdraw } from '@/lib/celengan'
import { fetchNativeBalance, fundWithFriendbot } from '@/lib/horizon'
import { formatXlm, parseXlm } from '@/lib/format'
import { classifyError } from '@/lib/errors'
import { explorerTxUrl } from '@/lib/config'

type Action = 'deposit' | 'withdraw'

function StatCard({
  icon,
  label,
  value,
  accent,
  children,
}: {
  icon: ReactNode
  label: string
  value: bigint | null
  accent?: boolean
  children?: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className={accent ? 'text-3xl font-semibold text-gold-ink' : 'text-3xl font-semibold'}>
            {value === null ? '--' : formatXlm(value)}
          </span>
          <span className="text-sm text-muted-foreground">XLM</span>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function AmountForm({
  id,
  cta,
  disabled,
  onSubmit,
}: {
  id: string
  cta: string
  disabled: boolean
  onSubmit: (raw: string, reset: () => void) => void
}) {
  const [value, setValue] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(value, () => setValue(''))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 pt-4">
      <div className="grid gap-2">
        <Label htmlFor={id}>Amount (XLM)</Label>
        <Input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1.5"
          inputMode="decimal"
          autoComplete="off"
        />
      </div>
      <Button type="submit" disabled={disabled}>
        {cta}
      </Button>
    </form>
  )
}

export function Dashboard({ address }: { address: string }) {
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null)
  const [savings, setSavings] = useState<bigint | null>(null)
  const [busy, setBusy] = useState(false)
  const [funding, setFunding] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [w, s] = await Promise.all([fetchNativeBalance(address), getSavings(address)])
      setWalletBalance(w)
      setSavings(s)
    } catch {
      // keep last-known values; a background refresh failure should stay quiet
    }
  }, [address])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const fund = useCallback(async () => {
    setFunding(true)
    try {
      await fundWithFriendbot(address)
      toast.success('Funded with testnet XLM')
      await refresh()
    } catch (e) {
      toast.error(classifyError(e).message)
    } finally {
      setFunding(false)
    }
  }, [address, refresh])

  const run = useCallback(
    async (action: Action, raw: string, reset: () => void) => {
      let amount: bigint
      try {
        amount = parseXlm(raw)
      } catch {
        toast.error('Enter a valid amount.')
        return
      }
      if (amount <= 0n) {
        toast.error('Enter an amount greater than 0.')
        return
      }

      setBusy(true)
      const pending = toast.loading(action === 'deposit' ? 'Depositing...' : 'Withdrawing...')
      try {
        const hash =
          action === 'deposit' ? await deposit(address, amount) : await withdraw(address, amount)
        toast.success(action === 'deposit' ? 'Deposit confirmed' : 'Withdrawal confirmed', {
          id: pending,
          description: hash ? 'View on Stellar Expert' : undefined,
          action: hash
            ? { label: 'Open', onClick: () => window.open(explorerTxUrl(hash), '_blank') }
            : undefined,
        })
        reset()
        await refresh()
      } catch (e) {
        toast.error(classifyError(e).message, { id: pending })
      } finally {
        setBusy(false)
      }
    },
    [address, refresh],
  )

  const walletEmpty = walletBalance !== null && walletBalance === 0n

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={<Wallet className="size-4" />} label="Wallet" value={walletBalance}>
          {walletEmpty && (
            <Button variant="secondary" size="sm" onClick={() => void fund()} disabled={funding}>
              {funding ? 'Requesting...' : 'Get testnet XLM'}
            </Button>
          )}
        </StatCard>
        <StatCard icon={<PiggyBank className="size-4" />} label="Saved in Celengan" value={savings} accent />
      </div>

      <Card>
        <CardContent>
          <Tabs defaultValue="deposit">
            <TabsList className="w-full">
              <TabsTrigger value="deposit">
                <ArrowDownToLine data-icon="inline-start" />
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw">
                <ArrowUpFromLine data-icon="inline-start" />
                Withdraw
              </TabsTrigger>
            </TabsList>
            <TabsContent value="deposit">
              <AmountForm
                id="deposit-amount"
                cta={busy ? 'Working...' : 'Deposit to savings'}
                disabled={busy}
                onSubmit={(raw, reset) => void run('deposit', raw, reset)}
              />
            </TabsContent>
            <TabsContent value="withdraw">
              <AmountForm
                id="withdraw-amount"
                cta={busy ? 'Working...' : 'Withdraw from savings'}
                disabled={busy}
                onSubmit={(raw, reset) => void run('withdraw', raw, reset)}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
