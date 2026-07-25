import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WalletState } from '@/hooks/useWallet'
import { isValidAddress } from '@/lib/payment'

export function SendForm({
  wallet,
  pending,
  onSend,
}: {
  wallet: WalletState
  pending: boolean
  onSend: (to: string, amount: string) => void
}) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!isValidAddress(to.trim())) {
      setFormError('Enter a valid Stellar address (starts with G).')
      return
    }
    if (!(Number(amount) > 0)) {
      setFormError('Enter an amount greater than 0.')
      return
    }
    onSend(to.trim(), amount.trim())
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Send XLM</h2>
      </div>

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Destination address</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="G..."
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Amount (XLM)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.5"
            inputMode="decimal"
          />
        </label>

        {formError && <p className="form-error">{formError}</p>}
        {!wallet.onTestnet && (
          <p className="form-error">Switch Freighter to the Testnet network to send.</p>
        )}

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={pending || !wallet.onTestnet}
        >
          {pending ? 'Sending...' : 'Send on testnet'}
        </button>
      </form>
    </section>
  )
}
