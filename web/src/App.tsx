import { ThemeProvider } from 'next-themes'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { NotFoundContent } from '@/components/not-found-content'
import { Toaster } from '@/components/ui/sonner'
import { AppStateProvider } from '@/lib/app-state'
import { SettingsProvider } from '@/lib/settings'
import { WalletProvider } from '@/lib/wallet'
import { ActivityPage } from '@/pages/activity'
import { Dashboard } from '@/pages/dashboard'
import { Landing } from '@/pages/landing'
import { NotFoundPage } from '@/pages/not-found'
import { PayPage } from '@/pages/pay'
import { PaymentLinkPage } from '@/pages/payment-link'
import { RulesPage } from '@/pages/rules'
import { SettingsPage } from '@/pages/settings'
import { WithdrawPage } from '@/pages/withdraw'
import { YieldPage } from '@/pages/yield'

export function App() {
  return (
    <ThemeProvider
      attribute="class"
      storageKey="celengan:theme"
      defaultTheme="light"
      disableTransitionOnChange
    >
      <SettingsProvider>
        <WalletProvider>
          <AppStateProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/pay/:address" element={<PayPage />} />
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route path="yield" element={<YieldPage />} />
                  <Route path="withdraw" element={<WithdrawPage />} />
                  <Route path="rules" element={<RulesPage />} />
                  <Route path="link" element={<PaymentLinkPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundContent />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
            <Toaster />
          </AppStateProvider>
        </WalletProvider>
      </SettingsProvider>
    </ThemeProvider>
  )
}
