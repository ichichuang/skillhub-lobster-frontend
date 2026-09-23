import type { Theme } from './theme'

/**
 * Parent-host URL theme contract.
 *
 * The embedding host communicates the effective theme with a single `dark`
 * query parameter: `dark=0` renders the dark theme, `dark=1` renders the light
 * theme. Anything else — duplicates, conflicts, unsupported strings, arrays —
 * is not an override and falls back to the official persisted preference.
 *
 * The override is ephemeral by design: it is never written to the official
 * `skillhub-theme` storage key, so the user's own ThemeToggle preference
 * survives underneath it and becomes effective again once the parameter is
 * removed.
 */
export type ParentDarkValue = '0' | '1'

export type ParentUrlTheme = {
  readonly dark?: ParentDarkValue
}

function parseDarkValue(value: unknown): ParentDarkValue | undefined {
  // Hosts send the string form ('0'/'1'); the router's JSON search parsing can
  // additionally surface the numeric form (0/1). Both mean the same thing.
  if (value === '0' || value === 0) return '0'
  if (value === '1' || value === 1) return '1'
  return undefined
}

/** Parses the raw URL query string (used by the startup path). */
export function parseParentUrlTheme(search: string): ParentUrlTheme {
  const values = new URLSearchParams(search).getAll('dark')
  const dark = values.length === 1 ? parseDarkValue(values[0]) : undefined
  return dark === undefined ? {} : { dark }
}

/** Parses the router-parsed search record (strict single primitive values). */
export function parseParentThemeRecord(search: Readonly<Record<string, unknown>>): ParentUrlTheme {
  const dark = parseDarkValue(search.dark)
  return dark === undefined ? {} : { dark }
}

/** Maps the parsed override onto the official theme; undefined when absent. */
export function resolveParentThemeMode(theme: ParentUrlTheme): Theme | undefined {
  if (theme.dark === undefined) return undefined
  return theme.dark === '0' ? 'dark' : 'light'
}
