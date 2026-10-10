export type ParentLangValue = '0' | '1' | '2'

export type ParentUrlLanguage = {
  readonly lang?: ParentLangValue
}

export const DEFAULT_LANGUAGE_CODE = 'zh-CN'

/** Fixed parent-platform mapping: 0 = Simplified Chinese, 1 = English, 2 = Traditional Chinese. */
const PARENT_LANGUAGE_CODES: Record<ParentLangValue, string> = {
  '0': 'zh-CN',
  '1': 'en',
  '2': 'zh-TW',
}

function parseLangValue(value: unknown): ParentLangValue | undefined {
  return value === '0' || value === '1' || value === '2' ? value : undefined
}

export function parseParentUrlLanguage(search: string): ParentUrlLanguage {
  const values = new URLSearchParams(search).getAll('lang')
  const lang = values.length === 1 ? parseLangValue(values[0]) : undefined
  return lang === undefined ? {} : { lang }
}

export function parseParentLanguageRecord(search: Readonly<Record<string, unknown>>): ParentUrlLanguage {
  const lang = parseLangValue(search.lang)
  return lang === undefined ? {} : { lang }
}

export function resolveParentLanguageCode(language: ParentUrlLanguage): string {
  return language.lang === undefined ? DEFAULT_LANGUAGE_CODE : PARENT_LANGUAGE_CODES[language.lang]
}

/**
 * Reads the parent platform's `?lang=` parameter from the live document URL; falls back to
 * Simplified Chinese outside a browser (tests) or for any missing, duplicate, or invalid value.
 */
export function readParentLanguageCode(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE_CODE
  }
  return resolveParentLanguageCode(parseParentUrlLanguage(window.location.search))
}
