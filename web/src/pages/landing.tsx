import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LandingQuickStartSection } from '@/shared/components/landing-quick-start'
import { SkillCard } from '@/features/skill/skill-card'
import { SkeletonList } from '@/shared/components/skeleton-loader'
import { useVisibleLabels } from '@/shared/hooks/use-label-queries'
import { useLocalPublishedCatalog } from '@/shared/hooks/use-local-published-catalog'
import { useInView } from '@/shared/hooks/use-in-view'
import { createLandingCatalogSections } from '@/shared/lib/local-published-catalog'
import { normalizeSearchQuery } from '@/shared/lib/search-query'
import { Button } from '@/shared/ui/button'

/**
 * Public landing page backed by the complete local published catalog.
 *
 * The hero and discovery sections are presentation owners only; search, navigation, and skill
 * data continue to use the application's existing routes and TanStack Query hooks.
 */
export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: labels } = useVisibleLabels()
  const catalogQuery = useLocalPublishedCatalog()
  const catalogSections = createLandingCatalogSections(catalogQuery.data ?? [], 6)

  const heroView = useInView()
  const popularView = useInView()
  const latestView = useInView()

  const handleSearch = (query: string) => {
    navigate({
      to: '/search',
      search: {
        q: normalizeSearchQuery(query),
        sort: 'relevance',
        page: 0,
        starredOnly: false,
      },
    })
  }

  const handleSkillClick = (namespace: string, slug: string) => {
    navigate({ to: `/space/${namespace}/${encodeURIComponent(slug)}` })
  }

  const handleCategoryClick = (label: string) => {
    navigate({
      to: '/search',
      search: {
        q: '',
        label,
        sort: 'newest',
        page: 0,
        starredOnly: false,
      },
    })
  }

  return (
    <>
      <main
        ref={heroView.ref}
        className={`relative z-10 overflow-hidden px-4 pb-12 pt-16 scroll-fade-up md:px-6 md:pb-14 md:pt-24${heroView.inView ? ' in-view' : ''}`}
      >
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:gap-14">
          <div className="relative">
            <div
              className="absolute -left-8 top-0 h-24 w-24 rounded-full blur-3xl"
              aria-hidden="true"
              style={{ background: 'hsl(var(--primary) / 0.16)' }}
            />
            <div
              className="mb-5 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: 'hsl(var(--primary-subtle))', color: 'hsl(var(--primary))' }}
            >
              {t('landing.hero.eyebrow')}
            </div>
            <h1 className="mb-5 text-[52px] font-bold leading-[0.94] tracking-[-0.04em] text-brand-gradient sm:text-[64px] md:text-[76px]">
              技能中心
            </h1>
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight md:text-[2rem]">
              {t('landing.hero.title')}
            </h2>
            <p
              className="mt-5 max-w-2xl text-lg leading-8 md:text-[1.4rem]"
              style={{ color: 'hsl(var(--text-secondary))' }}
            >
              {t('landing.hero.subtitle')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
              <span>{t('landing.hero.versioned')}</span>
              <span
                className="h-1.5 w-1.5 rounded-full"
                aria-hidden="true"
                style={{ background: 'hsl(var(--primary) / 0.55)' }}
              />
              <span>{t('landing.hero.oneFlow')}</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/search"
                search={{ q: '', sort: 'relevance', page: 0, starredOnly: false }}
                className="rounded-xl bg-primary px-8 py-3.5 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
              >
                {t('landing.hero.exploreSkills')}
              </Link>
              <Link
                to="/dashboard/publish"
                className="rounded-xl border bg-background/85 px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {t('landing.hero.publishSkill')}
              </Link>
            </div>
          </div>

          <LandingQuickStartSection onSearch={handleSearch} />
        </div>
      </main>

      {(labels?.length ?? 0) > 0 && (
        <section
          className="relative z-10 w-full border-y border-border/60 bg-background px-6 py-8"
          aria-labelledby="landing-categories-title"
        >
          <div className="mx-auto flex max-w-[1200px] flex-col gap-4 sm:flex-row sm:items-center">
            <h2 id="landing-categories-title" className="shrink-0 text-base font-semibold text-foreground">
              {t('landing.categories.title')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {labels!.map((label) => (
                <Button
                  key={label.slug}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => handleCategoryClick(label.slug)}
                >
                  {label.displayName}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section
        ref={popularView.ref}
        className={`relative z-10 w-full bg-background px-6 py-12 scroll-fade-up md:py-14${popularView.inView ? ' in-view' : ''}`}
      >
        <div className="mx-auto max-w-[1200px] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mb-2 text-3xl font-bold tracking-tight">{t('home.popularTitle')}</h2>
              <p style={{ color: 'hsl(var(--text-secondary))' }}>{t('home.popularDescription')}</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate({ to: '/search', search: { q: '', sort: 'downloads', page: 0, starredOnly: false } })}
            >
              {t('home.viewAll')}
            </Button>
          </div>
          {catalogQuery.isLoading ? (
            <SkeletonList count={6} />
          ) : catalogQuery.isError ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-sm text-destructive"
            >
              {t('landing.catalogLoadError')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {catalogSections.popular.map((skill, idx) => (
                <div key={skill.id} className={`animate-fade-up delay-${Math.min(idx + 1, 6)}`}>
                  <SkillCard skill={skill} onClick={() => handleSkillClick(skill.namespace, skill.slug)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        ref={latestView.ref}
        className={`relative z-10 w-full bg-background px-6 pb-14 pt-8 scroll-fade-up md:pb-16 md:pt-10${latestView.inView ? ' in-view' : ''}`}
      >
        <div className="mx-auto max-w-[1200px] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mb-2 text-3xl font-bold tracking-tight">{t('home.latestTitle')}</h2>
              <p style={{ color: 'hsl(var(--text-secondary))' }}>{t('home.latestDescription')}</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate({ to: '/search', search: { q: '', sort: 'newest', page: 0, starredOnly: false } })}
            >
              {t('home.viewAll')}
            </Button>
          </div>
          {catalogQuery.isLoading ? (
            <SkeletonList count={6} />
          ) : catalogQuery.isError ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-sm text-destructive"
            >
              {t('landing.catalogLoadError')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {catalogSections.latest.map((skill, idx) => (
                <div key={skill.id} className={`animate-fade-up delay-${Math.min(idx + 1, 6)}`}>
                  <SkillCard skill={skill} onClick={() => handleSkillClick(skill.namespace, skill.slug)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
