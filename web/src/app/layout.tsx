import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/use-auth'
import { UserMenu } from '@/shared/components/user-menu'
import { NotificationBell } from '@/features/notification/notification-bell'
import { dismissOpenOverlays } from '@/shared/lib/dismiss-open-overlays'
import { syncDocumentLanguage } from '@/shared/lib/document-language'
import { getAppHeaderClassName } from './layout-header-style'
import { getAppMainContentLayout, resolveAppMainContentPathname } from './layout-main-content'

export const APP_SHELL_CLASS_NAME = 'relative flex min-h-screen flex-col bg-background'
export const APP_FOOTER_CLASS_NAME = 'relative z-10 mt-auto rounded-t-2xl border-t border-border bg-card'
export const APP_ACTIVE_NAV_CLASS_NAME =
  'rounded-full bg-primary px-4 py-1.5 text-primary-foreground shadow-sm'
export const APP_SHELL_GLOW_STYLE = {
  background: 'radial-gradient(ellipse at 70% 20%, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary) / 0.08) 40%, transparent 70%)',
  filter: 'blur(60px)',
} as const

/**
 * Application shell shared by all routed pages.
 *
 * It owns the global header, footer, auth-aware navigation, and suspense
 * fallback used while lazy route modules are loading.
 */
export function Layout() {
  const { t, i18n } = useTranslation()
  const { pathname, resolvedPathname, isEmbedded } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      resolvedPathname: s.resolvedLocation?.pathname,
      isEmbedded: s.matches[0]?.search.embed === true,
    }),
  })
  const { user, isLoading } = useAuth()
  const [isHeaderElevated, setIsHeaderElevated] = useState(false)
  const previousPathnameRef = useRef(pathname)
  const contentLayoutPathname = resolveAppMainContentPathname(pathname, resolvedPathname)
  const mainContentLayout = getAppMainContentLayout(contentLayoutPathname)

  useEffect(() => {
    syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
  }, [i18n.language, i18n.resolvedLanguage])

  useEffect(() => {
    const updateHeaderElevation = () => {
      setIsHeaderElevated(window.scrollY > 0)
    }

    updateHeaderElevation()
    window.addEventListener('scroll', updateHeaderElevation, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateHeaderElevation)
    }
  }, [])

  // Pathname-only: search debounce on /search must not dismiss overlays mid-typing.
  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return
    }
    previousPathnameRef.current = pathname
    dismissOpenOverlays()
  }, [pathname])

  const navItems: Array<{
    label: string
    to: string
    exact?: boolean
    auth?: boolean
    hideWhenEmbedded?: boolean
  }> = [
    { label: t('nav.landing'), to: '/', exact: true },
    { label: t('nav.publish'), to: '/dashboard/publish', auth: true },
    { label: t('nav.search'), to: '/search' },
    { label: t('nav.dashboard'), to: '/dashboard', auth: true, hideWhenEmbedded: true },
    { label: t('nav.mySkills'), to: '/dashboard/skills', auth: true },
  ]

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return pathname === to
    // Keep matching strict so parent dashboard paths do not highlight unrelated child links.
    return pathname === to
  }

  return (
    <div className={APP_SHELL_CLASS_NAME}>
      {/* Clip only the decorative layer so in-tree Select/Dropdown are not cropped. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-x-clip" aria-hidden>
        <div
          className="absolute top-0 right-0 w-[600px] h-[500px] rounded-full opacity-90"
          style={APP_SHELL_GLOW_STYLE}
        />
      </div>

      {/* Header */}
      <header
        className={`${getAppHeaderClassName(isHeaderElevated)} !px-4 sm:!px-6 md:!px-8`}
      >
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-2 sm:gap-6">
          <Link to="/" className="text-xl font-bold tracking-[0.02em] text-foreground">
            技能中心
          </Link>

          <nav className="hidden items-center gap-8 text-[15px] font-normal text-foreground-secondary md:flex">
            {navItems.map((item) => {
              if (item.auth && !user) return null
              if (item.hideWhenEmbedded && isEmbedded) return null
              const active = isActive(item.to, item.exact)

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    active
                      ? APP_ACTIVE_NAV_CLASS_NAME
                      : 'hover:opacity-80 transition-opacity duration-150'
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-4 text-[15px] font-normal text-foreground-secondary sm:gap-6">
            {user && !isEmbedded && <NotificationBell />}
            {isLoading ? null : user ? (
              !isEmbedded && <UserMenu user={user} />
            ) : (
              <Link
                to="/login"
                search={{ returnTo: '' }}
                className="hover:opacity-80 transition-opacity"
              >
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={mainContentLayout.mainClassName}>
        <Suspense
          fallback={
            <div className="space-y-4 animate-fade-up">
              <div className="h-10 w-48 animate-shimmer rounded-lg" />
              <div className="h-5 w-72 animate-shimmer rounded-md" />
              <div className="h-64 animate-shimmer rounded-xl" />
            </div>
          }
        >
          <div className={mainContentLayout.contentClassName}>
            <Outlet />
          </div>
        </Suspense>
      </main>

      {/* Footer */}
      <footer className={APP_FOOTER_CLASS_NAME}>
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 md:gap-12">
            <div className="flex-shrink-0">
              <div className="mb-3">
                <span className="text-lg font-bold text-foreground">技能中心</span>
              </div>
              <p className="max-w-xs text-sm text-foreground-secondary">
                {t('layout.footerDescription')}
              </p>
            </div>
            <div className="flex flex-wrap gap-12 md:gap-16">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-foreground">
                  {t('nav.home')}
                </h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/" className="text-foreground-secondary transition-opacity hover:opacity-80">
                      {t('nav.home')}
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/search"
                      search={{ q: '', sort: 'relevance', page: 0, starredOnly: false }}
                      className="text-foreground-secondary transition-opacity hover:opacity-80"
                    >
                      {t('nav.search')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/dashboard" className="text-foreground-secondary transition-opacity hover:opacity-80">
                      {t('nav.dashboard')}
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold text-foreground">
                  {t('footer.resources')}
                </h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="#" className="text-foreground-secondary transition-opacity hover:opacity-80">
                      {t('footer.docs')}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-foreground-secondary transition-opacity hover:opacity-80">
                      {t('footer.api')}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-foreground-secondary transition-opacity hover:opacity-80">
                      {t('footer.community')}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div
            className="mt-10 flex flex-col gap-4 border-t border-divider pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{t('footer.copyright')}</span>
            <div className="flex items-center gap-2">
              <Link to="/privacy" className="hover:opacity-80 transition-opacity">
                {t('footer.privacy')}
              </Link>
              <span>|</span>
              <Link to="/terms" className="hover:opacity-80 transition-opacity">
                {t('footer.terms')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
