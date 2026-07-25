import { describe, expect, it } from 'vitest'
import { parseUsdc, usdcToInput, usdcToNumber, shortHex } from './format'

describe('parseUsdc', () => {
  it('parses whole and fractional amounts into 7-decimal stroops', () => {
    expect(parseUsdc('1')).toBe(10_000_000n)
    expect(parseUsdc('0.5')).toBe(5_000_000n)
    expect(parseUsdc('12.3456789')).toBe(123_456_789n)
  })

  it('rejects malformed input', () => {
    expect(() => parseUsdc('')).toThrow()
    expect(() => parseUsdc('1.23456789')).toThrow()
    expect(() => parseUsdc('-1')).toThrow()
    expect(() => parseUsdc('1,5')).toThrow()
  })
})

describe('usdcToInput', () => {
  it('round-trips through parseUsdc', () => {
    for (const value of ['1', '0.5', '12.3456789', '0.0000001']) {
      expect(usdcToInput(parseUsdc(value))).toBe(value)
    }
  })

  it('trims trailing zeros', () => {
    expect(usdcToInput(15_000_000n)).toBe('1.5')
    expect(usdcToInput(10_000_000n)).toBe('1')
  })
})

describe('usdcToNumber', () => {
  it('converts stroops to a display number', () => {
    expect(usdcToNumber(15_000_000n)).toBe(1.5)
  })
})

describe('shortHex', () => {
  it('truncates long values and keeps short ones', () => {
    expect(shortHex('abcdef123456abcdef123456')).toBe('abcdef...123456')
    expect(shortHex('abc123')).toBe('abc123')
  })
})
