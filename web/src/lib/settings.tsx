import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Locale = 'en' | 'id' | 'vi' | 'fil'
export type PrimaryCurrency = 'idr' | 'usdc' | 'vnd' | 'php'

type SettingsContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  primaryCurrency: PrimaryCurrency
  setPrimaryCurrency: (currency: PrimaryCurrency) => void
}

const LOCALE_KEY = 'celengan:locale'
const CURRENCY_KEY = 'celengan:currency'

const SettingsContext = createContext<SettingsContextValue | null>(null)

function initialLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY)
  if (stored === 'en' || stored === 'id' || stored === 'vi' || stored === 'fil') return stored
  return 'en'
}

// the fiat shown alongside a USDC-primary display follows the chosen
// language, so a Vietnamese speaker sees VND rather than defaulting to IDR
export function secondaryCurrencyFor(primary: PrimaryCurrency, locale: Locale): PrimaryCurrency {
  if (primary !== 'usdc') return 'usdc'
  if (locale === 'vi') return 'vnd'
  if (locale === 'fil') return 'php'
  return 'idr'
}

function initialCurrency(): PrimaryCurrency {
  const stored = localStorage.getItem(CURRENCY_KEY)
  if (stored === 'idr' || stored === 'usdc' || stored === 'vnd' || stored === 'php') return stored
  return 'usdc'
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [primaryCurrency, setCurrencyState] = useState<PrimaryCurrency>(initialCurrency)

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(LOCALE_KEY, next)
    setLocaleState(next)
  }, [])

  const setPrimaryCurrency = useCallback((next: PrimaryCurrency) => {
    localStorage.setItem(CURRENCY_KEY, next)
    setCurrencyState(next)
  }, [])

  const value = useMemo(
    () => ({ locale, setLocale, primaryCurrency, setPrimaryCurrency }),
    [locale, setLocale, primaryCurrency, setPrimaryCurrency],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
