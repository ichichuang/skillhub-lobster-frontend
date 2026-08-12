/** @vitest-environment jsdom */

// @ts-expect-error Vitest runs in Node; the production tsconfig intentionally omits Node globals.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  applyThemeMode,
  parseParentThemeRecord,
  parseParentUrlTheme,
  resolveParentThemeMode,
} from './url-theme'

// @ts-expect-error Vitest's jsdom URL is HTTP-based; resolve the fixture from its web cwd.
const indexHtml = readFileSync(`${process.cwd()}/index.html`, 'utf8')
const prepaintSource = indexHtml.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1]

function runPrepaint(search: string) {
  if (!prepaintSource) throw new Error('Missing index.html prepaint script')
  window.history.replaceState(null, '', `/${search}`)
  document.documentElement.className = 'notranslate'
  document.documentElement.removeAttribute('style')
  window.eval(prepaintSource)

  const root = document.documentElement
  return {
    isDark: root.classList.contains('dark'),
    colorScheme: root.style.colorScheme,
    backgroundColor: root.style.backgroundColor,
    primaryAnchor: root.style.getPropertyValue('--theme-primary-anchor'),
    pageAnchor: root.style.getPropertyValue('--theme-page-anchor'),
    surfaceAnchor: root.style.getPropertyValue('--theme-surface-anchor'),
    background: root.style.getPropertyValue('--background'),
    primary: root.style.getPropertyValue('--primary'),
  }
}

describe('fixed parent URL theme-mode contract', () => {
  it.each([
    ['dark=0', '?dark=0', { dark: '0' }, 'dark'],
    ['dark=1', '?dark=1', { dark: '1' }, 'light'],
    ['missing dark', '', {}, 'light'],
  ] as const)('maps %s exactly', (_caseName, search, parsed, mode) => {
    const parentTheme = parseParentUrlTheme(search)

    expect(parentTheme).toEqual(parsed)
    expect(resolveParentThemeMode(parentTheme)).toBe(mode)
  })

  it.each([
    '',
    'true',
    'false',
    'yes',
    '01',
    '2',
    'LIGHT',
    '-0',
    ' 0',
  ])('defaults unsupported dark value %j to light', (value) => {
    const parsed = parseParentUrlTheme(`?dark=${encodeURIComponent(value)}`)

    expect(parsed).toEqual({})
    expect(resolveParentThemeMode(parsed)).toBe('light')
  })

  it.each([
    'dark=0&dark=0',
    'dark=1&dark=1',
    'dark=0&dark=1',
    'dark=1&dark=0',
  ])('defaults duplicate or conflicting values %j to light', (search) => {
    const parsed = parseParentUrlTheme(`?${search}`)

    expect(parsed).toEqual({})
    expect(resolveParentThemeMode(parsed)).toBe('light')
  })

  it('ignores every retired theme parameter instead of using it as a fallback', () => {
    const retired = 'theme=dark&color=%23ff0000&bg=%23000000&surface=%23111111'

    expect(parseParentUrlTheme(`?${retired}`)).toEqual({})
    expect(resolveParentThemeMode(parseParentUrlTheme(`?${retired}`))).toBe('light')
    expect(parseParentUrlTheme(`?dark=0&${retired}`)).toEqual({ dark: '0' })
    expect(resolveParentThemeMode(parseParentUrlTheme(`?dark=0&${retired}`))).toBe('dark')
  })

  it('parses router records without accepting arrays, numbers, or retired keys', () => {
    expect(parseParentThemeRecord({
      embed: true,
      dark: '0',
      theme: 'light',
      color: '#ff0000',
      bg: '#ffffff',
      surface: '#ffffff',
    })).toEqual({ dark: '0' })
    expect(parseParentThemeRecord({ dark: '1' })).toEqual({ dark: '1' })
    expect(parseParentThemeRecord({ dark: ['0', '0'] })).toEqual({})
    expect(parseParentThemeRecord({ dark: ['0', '1'] })).toEqual({})
    expect(parseParentThemeRecord({ dark: 0 })).toEqual({})
  })
})

describe('applyThemeMode', () => {
  it('changes only the root class and color-scheme', () => {
    const root = document.createElement('html')
    root.style.setProperty('--background', 'do-not-touch')

    applyThemeMode('dark', root)
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.style.colorScheme).toBe('dark')
    expect(root.style.getPropertyValue('--background')).toBe('do-not-touch')
    expect(root.style.getPropertyValue('--primary')).toBe('')

    applyThemeMode('light', root)
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.style.colorScheme).toBe('light')
    expect(root.style.getPropertyValue('--background')).toBe('do-not-touch')
    expect(root.style.getPropertyValue('--primary')).toBe('')
  })
})

describe('index.html prepaint', () => {
  it.each([
    ['dark=0', '?dark=0', true, 'dark'],
    ['dark=1', '?dark=1', false, 'light'],
    ['missing dark', '', false, 'light'],
    ['invalid dark', '?dark=true', false, 'light'],
    ['duplicate dark', '?dark=0&dark=0', false, 'light'],
    ['conflicting dark', '?dark=0&dark=1', false, 'light'],
    [
      'retired theme parameters',
      '?theme=dark&color=%23ff0000&bg=%23000000&surface=%23111111',
      false,
      'light',
    ],
  ] as const)('uses the fixed mapping for %s without writing colors', (
    _caseName,
    search,
    isDark,
    colorScheme,
  ) => {
    expect(runPrepaint(search)).toEqual({
      isDark,
      colorScheme,
      backgroundColor: '',
      primaryAnchor: '',
      pageAnchor: '',
      surfaceAnchor: '',
      background: '',
      primary: '',
    })
  })
})
