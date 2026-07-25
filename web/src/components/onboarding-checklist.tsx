import type { ReactNode } from 'react'
import { CircleCheckIcon, CircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConnectButton } from '@/components/connect-button'
import { useT } from '@/lib/i18n'

type OnboardingChecklistProps = {
  connected: boolean
  funded: boolean
  received: boolean
  faucetBusy: boolean
  onFaucet: () => void
  onGoToPaymentLink: () => void
}

type StepProps = {
  done: boolean
  title: string
  caption: string
  doneLabel: string
  action?: ReactNode
}

function Step({ done, title, caption, doneLabel, action }: StepProps) {
  return (
    <li className="flex items-center gap-3">
      {done ? (
        <CircleCheckIcon aria-label={doneLabel} className="size-5 shrink-0 text-primary-ink" />
      ) : (
        <CircleIcon aria-hidden className="size-5 shrink-0 text-muted-foreground/40" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
      {!done && action}
    </li>
  )
}

export function OnboardingChecklist({
  connected,
  funded,
  received,
  faucetBusy,
  onFaucet,
  onGoToPaymentLink,
}: OnboardingChecklistProps) {
  const t = useT()

  if (connected && funded && received) return null

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <CardTitle>{t('onboarding.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          <Step
            done={connected}
            title={t('onboarding.step1Title')}
            caption={t('onboarding.step1Caption')}
            doneLabel={t('onboarding.done')}
            action={<ConnectButton />}
          />
          <Step
            done={funded}
            title={t('onboarding.step2Title')}
            caption={t('onboarding.step2Caption')}
            doneLabel={t('onboarding.done')}
            action={
              <Button variant="outline" size="sm" disabled={faucetBusy} onClick={onFaucet}>
                {faucetBusy ? `${t('common.loading')}...` : t('faucet.button')}
              </Button>
            }
          />
          <Step
            done={received}
            title={t('onboarding.step3Title')}
            caption={t('onboarding.step3Caption')}
            doneLabel={t('onboarding.done')}
            action={
              <Button variant="outline" size="sm" onClick={onGoToPaymentLink}>
                {t('nav.paymentLink')}
              </Button>
            }
          />
        </ul>
      </CardContent>
    </Card>
  )
}
