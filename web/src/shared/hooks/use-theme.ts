import { useCallback, useState } from 'react'
import {
  applyTheme,
  resolveEffectiveTheme,
  saveTheme,
  type Theme,
} from '@/shared/lib/theme'

export function useTheme() {
  // Reflect the effective rendered theme: a parent-host URL override wins for
  // the current URL, otherwise the persisted ThemeToggle preference applies.
  const [theme, setThemeState] = useState<Theme>(() => resolveEffectiveTheme())

  const setTheme = useCallback((nextTheme: Theme) => {
    // The user's persisted preference updates through the official toggle
    // semantics, but a still-present parent-host URL override remains
    // authoritative for the rendered DOM: re-resolve the effective theme
    // (URL precedence) instead of applying the raw toggle target.
    saveTheme(nextTheme)
    const effective = resolveEffectiveTheme()
    applyTheme(effective)
    setThemeState(effective)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [setTheme, theme])

  return { theme, setTheme, toggleTheme }
}
