import { describe, expect, it } from 'vitest'
import { errorKey } from './errors'

describe('errorKey', () => {
  it('maps soroban contract error codes to message keys', () => {
    expect(errorKey(new Error('HostError: Error(Contract, #1)'))).toBe('errors.invalidAmount')
    expect(errorKey(new Error('HostError: Error(Contract, #5)'))).toBe('errors.savingsLocked')
    expect(errorKey(new Error('HostError: Error(Contract, #1000)'))).toBe('errors.paused')
  })

  it('falls back to generic for unknown contract codes', () => {
    expect(errorKey(new Error('Error(Contract, #999)'))).toBe('errors.generic')
  })

  it('detects wallet cancellation from plain objects too', () => {
    expect(errorKey(new Error('User declined access'))).toBe('errors.walletCancelled')
    expect(errorKey({ code: -4, message: 'Request rejected' })).toBe('errors.walletCancelled')
  })

  it('maps faucet failures', () => {
    expect(errorKey(new Error('faucet_unavailable'))).toBe('errors.faucetUnavailable')
    expect(errorKey(new Error('faucet_maybe_funded'))).toBe('errors.faucetAlreadyFunded')
  })

  it('returns generic for anything else', () => {
    expect(errorKey(new Error('boom'))).toBe('errors.generic')
    expect(errorKey(undefined)).toBe('errors.generic')
  })
})
