import { Link } from 'react-router-dom'
import { FloatingDeco } from '@/components/brand/floating-deco'
import { LogoWordmark } from '@/components/brand/logo'
import { LandingComparison } from '@/components/landing-comparison'
import { LandingFooter } from '@/components/landing-footer'
import { LandingHeroDemo } from '@/components/landing-hero-demo'
import { LandingHowItWorks } from '@/components/landing-how-it-works'
import { LandingProtocols } from '@/components/landing-protocols'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

export function Landing() {
  const t = useT()

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <LogoWordmark />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <a href="#how" className="hover:text-foreground">
            {t('landing.navHow')}
          </a>
          <a href="#protocols" className="hover:text-foreground">
            {t('landing.navProtocols')}
          </a>
          <a href="#compare" className="hover:text-foreground">
            {t('landing.navCompare')}
          </a>
        </nav>
        {/* outline keeps the badge neutral now that secondary is the teal spending tone */}
        <Badge variant="outline" className="text-muted-foreground">
          {t('topbar.testnet')}
        </Badge>
      </header>
      <main className="relative z-10 flex-1">
        <section className="relative flex min-h-svh items-center overflow-hidden px-6 py-16">
          <FloatingDeco side="both" />
          <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:justify-between">
            <div className="max-w-xl text-center lg:text-left">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                {t('landing.heroTitle')}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">{t('landing.heroSubtitle')}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button asChild size="lg" className="px-6">
                  <Link to="/app">{t('landing.cta')}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="px-6">
                  <a href="#how">{t('landing.navHow')}</a>
                </Button>
              </div>
            </div>
            <LandingHeroDemo />
          </div>
        </section>
        <LandingHowItWorks />
        <LandingProtocols />
        <LandingComparison />
        <section className="relative flex min-h-svh items-center overflow-hidden px-6 py-24">
          <FloatingDeco side="both" variant="alt" />
          <div className="relative mx-auto w-full max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t('landing.finalCtaTitle')}
            </h2>
            <p className="mt-3 text-muted-foreground">{t('landing.finalCtaBody')}</p>
            <Button asChild size="lg" className="mt-8 px-6">
              <Link to="/app">{t('landing.cta')}</Link>
            </Button>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
