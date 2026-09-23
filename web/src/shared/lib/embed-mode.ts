/**
 * Integration-query contract for the embedded shell.
 *
 * These three keys are owned by the host integration, not by individual routes:
 * they are validated once at the root route and retained across internal
 * navigation via the router's retainSearchParams middleware. Nested `returnTo`
 * strings must strip them (see buildReturnToNavigation in skill-navigation.ts)
 * so the router never receives them twice.
 */
export const GLOBALLY_RETAINED_SEARCH_KEYS = ['embed', 'dark', 'showHeader'] as const

/**
 * Deterministic embed detection, independent from React.
 *
 * Accepts either the raw URL representation (URLSearchParams) or the
 * router-parsed record (TanStack Router parses values as JSON, so
 * `?embed=true` arrives as the boolean `true` and duplicates arrive as
 * arrays). Embedded mode activates only for exactly one strict `true`
 * value: duplicates, conflicts, and malformed/array-like values never
 * silently activate it.
 */
export function isEmbeddedMode(search: URLSearchParams | Readonly<Record<string, unknown>>): boolean {
  if (search instanceof URLSearchParams) {
    const values = search.getAll('embed')
    return values.length === 1 && values[0] === 'true'
  }
  return search.embed === true
}
