/**
 * Helpers for constructing and validating navigation state around skill-detail pages.
 */
export function getSkillSquareSearch() {
  return {
    q: '',
    sort: 'relevance' as const,
    page: 0,
    starredOnly: false,
  }
}

/** Search params for browsing skills that share a given label (from detail chips). */
export function getSkillLabelSearch(label: string) {
  return {
    q: '',
    label,
    sort: 'newest' as const,
    page: 0,
    starredOnly: false,
  }
}

export function normalizeSkillDetailReturnTo(returnTo?: string) {
  return returnTo && returnTo.startsWith('/') ? returnTo : undefined
}

/**
 * Converts a returnTo URL into router navigation options. The query string must be passed
 * through `search`, not embedded in `to`, or the router corrupts retained params (e.g.
 * `?embed=true?embed=true`). Globally retained keys (ROOT_RETAINED_SEARCH_KEYS in
 * src/app/router.tsx) are omitted so the router's retainSearchParams middleware re-adds
 * them with their parsed types; explicit string values would fail root validation.
 */
const GLOBALLY_RETAINED_SEARCH_KEYS = ['embed', 'dark', 'showHeader'] as const

export function buildReturnToNavigation(returnTo: string): {
  to: string
  search?: Record<string, string>
} {
  const [path, query] = returnTo.split('?')
  const search = Object.fromEntries(new URLSearchParams(query))
  for (const key of GLOBALLY_RETAINED_SEARCH_KEYS) {
    delete search[key]
  }
  return {
    to: path,
    search: Object.keys(search).length > 0 ? search : undefined,
  }
}
