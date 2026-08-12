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
