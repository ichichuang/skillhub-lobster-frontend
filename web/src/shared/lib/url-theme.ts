import type { ThemeMode } from '@/shared/theme/theme-types'

export type ParentDarkValue = '0' | '1'

export type ParentUrlTheme = {
  readonly dark?: ParentDarkValue
}

function parseDarkValue(value: unknown): ParentDarkValue | undefined {
  return value === '0' || value === '1' ? value : undefined
}

export function parseParentUrlTheme(search: string): ParentUrlTheme {
  const values = new URLSearchParams(search).getAll('dark')
  const dark = values.length === 1 ? parseDarkValue(values[0]) : undefined
  return dark === undefined ? {} : { dark }
}

export function parseParentThemeRecord(search: Readonly<Record<string, unknown>>): ParentUrlTheme {
  const dark = parseDarkValue(search.dark)
  return dark === undefined ? {} : { dark }
}

export const PARENT_THEME_MESSAGE_TYPE = 'skillhub:theme'

/**
 * Parses the parent platform's runtime theme message
 * (`{ type: 'skillhub:theme', dark: '0' | '1' }`); returns undefined for anything else.
 */
export function parseParentThemeMessage(data: unknown): ParentUrlTheme | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined
  }
  const record = data as Record<string, unknown>
  if (record.type !== PARENT_THEME_MESSAGE_TYPE) {
    return undefined
  }
  const theme = parseParentThemeRecord(record)
  return theme.dark === undefined ? undefined : theme
}

/**
 * Rewrites `?dark=` in place so a later reload of this document keeps the theme the parent
 * switched to at runtime. Router state in `history.state` is preserved for TanStack Router.
 */
export function syncThemeUrlParam(dark: ParentDarkValue): void {
  const url = new URL(window.location.href)
  url.searchParams.set('dark', dark)
  window.history.replaceState(window.history.state, '', url)
}

export function resolveParentThemeMode(theme: ParentUrlTheme): ThemeMode {
  return theme.dark === '0' ? 'dark' : 'light'
}

export function applyThemeMode(
  mode: ThemeMode,
  root: HTMLElement = document.documentElement,
): void {
  root.classList.toggle('dark', mode === 'dark')
  root.style.colorScheme = mode
}
