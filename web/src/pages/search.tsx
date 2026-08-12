import { startTransition, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { SearchBar } from '@/features/search/search-bar'
import { SkillCard } from '@/features/skill/skill-card'
import { SkeletonList } from '@/shared/components/skeleton-loader'
import { EmptyState } from '@/shared/components/empty-state'
import { Pagination } from '@/shared/components/pagination'
import { useVisibleLabels } from '@/shared/hooks/use-label-queries'
import { useLocalPublishedCatalog, useLocalPublishedLabelMembership } from '@/shared/hooks/use-local-published-catalog'
import { toRouterPath } from '@/shared/lib/base-path'
import { createLocalPublishedSearchPage } from '@/shared/lib/local-published-catalog'
import { formatNamespaceSearchInput, normalizeSearchQuery, parseNamespaceSearchInput } from '@/shared/lib/search-query'
import { Button } from '@/shared/ui/button'
import { APP_SHELL_PAGE_CLASS_NAME } from '@/app/page-shell-style'

const PAGE_SIZE = 12
const ROUTER_COMPAT_SEARCH = { sort: 'newest', starredOnly: false } as const

function blurActiveElement() {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') {
    return
  }

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

function scrollToTopOnPageChange() {
  if (typeof window === 'undefined') {
    return () => {}
  }

  let secondFrame = 0
  const firstFrame = window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    secondFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' })
    })
  })

  return () => {
    window.cancelAnimationFrame(firstFrame)
    if (secondFrame) {
      window.cancelAnimationFrame(secondFrame)
    }
  }
}

/**
 * Local published skill discovery with synchronized URL state.
 *
 * Search text, namespace, category, and pagination are mirrored into router search params so the
 * page can be shared, restored, and revisited without losing state. The router still requires
 * legacy sort and starred-only fields, so SearchPage writes their inert defaults without exposing
 * the removed controls.
 */
export function SearchPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const searchParams = useSearch({ from: '/search' })

  const q = normalizeSearchQuery(searchParams.q || '')
  const namespace = (searchParams.namespace || '').replace(/^@/, '')
  const selectedLabel = searchParams.label || ''
  const page = searchParams.page ?? 0
  const [queryInput, setQueryInput] = useState(formatNamespaceSearchInput(namespace, q))
  const previousPageRef = useRef(page)

  useEffect(() => {
    setQueryInput(formatNamespaceSearchInput(namespace, q))
  }, [namespace, q])

  useEffect(() => {
    if (previousPageRef.current !== page) {
      blurActiveElement()
      const cleanupScroll = scrollToTopOnPageChange()

      previousPageRef.current = page
      return () => {
        cleanupScroll()
      }
    }

    previousPageRef.current = page
  }, [page])

  const catalogQuery = useLocalPublishedCatalog()
  const labelMembershipQuery = useLocalPublishedLabelMembership(selectedLabel || undefined)
  const { data: labels } = useVisibleLabels()

  const hasRequiredLabelMembership = !selectedLabel || labelMembershipQuery.data !== undefined
  const data = hasRequiredLabelMembership
    ? createLocalPublishedSearchPage(catalogQuery.data ?? [], {
        q: q || undefined,
        namespace: namespace || undefined,
        labelMembership: selectedLabel ? labelMembershipQuery.data : undefined,
        page,
        size: PAGE_SIZE,
      })
    : { items: [], total: 0, page, size: PAGE_SIZE }

  useEffect(() => {
    // Debounce URL updates while the user is typing so query state stays shareable without
    // triggering a navigation on every keystroke.
    const parsedInput = parseNamespaceSearchInput(queryInput)
    if (parsedInput.query === q && parsedInput.namespace === namespace) {
      return
    }

    if (!parsedInput.query && !parsedInput.namespace) {
      startTransition(() => {
        navigate({
          to: '/search',
          search: { q: '', namespace: undefined, label: selectedLabel || undefined, page: 0, ...ROUTER_COMPAT_SEARCH },
          replace: page === 0,
        })
      })
      return
    }

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        navigate({
          to: '/search',
          search: {
            q: parsedInput.query,
            namespace: parsedInput.namespace || undefined,
            label: selectedLabel || undefined,
            page: 0,
            ...ROUTER_COMPAT_SEARCH,
          },
          replace: true,
        })
      })
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [navigate, namespace, page, q, queryInput, selectedLabel])

  const handleSearch = (query: string) => {
    const parsedInput = parseNamespaceSearchInput(query)
    setQueryInput(query)
    startTransition(() => {
      navigate({
        to: '/search',
        search: {
          q: parsedInput.query,
          namespace: parsedInput.namespace || undefined,
          label: selectedLabel || undefined,
          page: 0,
          ...ROUTER_COMPAT_SEARCH,
        },
        replace: true,
      })
    })
  }

  const handlePageChange = (newPage: number) => {
    blurActiveElement()
    navigate({
      to: '/search',
      search: { q, namespace: namespace || undefined, label: selectedLabel || undefined, page: newPage, ...ROUTER_COMPAT_SEARCH },
    })
  }

  const handleLabelChange = (label?: string) => {
    navigate({
      to: '/search',
      search: { q, namespace: namespace || undefined, label, page: 0, ...ROUTER_COMPAT_SEARCH },
    })
  }

  const handleNamespaceClear = () => {
    navigate({
      to: '/search',
      search: { q, namespace: undefined, label: selectedLabel || undefined, page: 0, ...ROUTER_COMPAT_SEARCH },
    })
  }

  const handleSkillClick = (namespace: string, slug: string) => {
    navigate({
      to: `/space/${namespace}/${encodeURIComponent(slug)}`,
      search: { returnTo: toRouterPath(window.location.pathname, window.location.search) },
    })
  }

  const totalPages = data && data.size > 0 ? Math.ceil(data.total / data.size) : 0
  const displayItems = data?.items ?? []
  const isPageLoading = catalogQuery.isLoading || Boolean(selectedLabel && labelMembershipQuery.isLoading)
  const isPageError = catalogQuery.isError || Boolean(selectedLabel && labelMembershipQuery.isError)
  const isUpdatingResults = (
    catalogQuery.isFetching || Boolean(selectedLabel && labelMembershipQuery.isFetching)
  ) && !isPageLoading
  const resultCount = data?.total ?? 0

  return (
    <div className={APP_SHELL_PAGE_CLASS_NAME}>
      {/* Search Bar */}
      <div className="max-w-3xl mx-auto">
        <SearchBar
          value={queryInput}
          isSearching={isUpdatingResults}
          onChange={setQueryInput}
          onSearch={handleSearch}
        />
      </div>

      {/* Category filter */}
      <section className="flex flex-wrap items-center gap-2" aria-labelledby="search-category-filter">
        <h2 id="search-category-filter" className="mr-1 text-sm font-medium text-muted-foreground">
          {t('search.filters.category')}
        </h2>
        <Button
          variant={selectedLabel ? 'outline' : 'default'}
          size="sm"
          onClick={() => handleLabelChange(undefined)}
        >
          {t('search.filters.all')}
        </Button>
        {labels?.map((label) => (
          <Button
            key={label.slug}
            variant={selectedLabel === label.slug ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleLabelChange(label.slug)}
          >
            {label.displayName}
          </Button>
        ))}
      </section>

      {/* Result context */}
      <div className="space-y-4">
        {(namespace || resultCount > 0) && (
          <div className="flex flex-wrap items-center gap-4">
            {namespace ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleNamespaceClear}
              >
                {t('search.namespaceFilter', { namespace })}
              </Button>
            ) : null}
            {resultCount > 0 && (
              <div className="ml-auto text-sm text-muted-foreground">
                {t('search.results', { count: resultCount })}
              </div>
            )}
          </div>
        )}

        {isUpdatingResults ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('search.loadingMore')}</span>
          </div>
        ) : null}
      </div>

      {/* Results */}
      {isPageLoading ? (
        <SkeletonList count={PAGE_SIZE} />
      ) : isPageError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-sm text-destructive"
        >
          {t('search.loadError')}
        </div>
      ) : displayItems.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayItems.map((skill, idx) => (
              <div key={skill.id} className={`h-full animate-fade-up delay-${Math.min(idx % 6 + 1, 6)}`}>
                <SkillCard
                  skill={skill}
                  highlightStarred
                  onClick={() => handleSkillClick(skill.namespace, skill.slug)}
                />
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              page={data?.page ?? page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      ) : (
        <EmptyState
          title={t('search.noResults')}
          description={q ? t('search.noResultsFor', { q }) : undefined}
        />
      )}
    </div>
  )
}
