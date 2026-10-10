/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { syncDocumentLanguage } from './document-language'

describe('syncDocumentLanguage', () => {
  afterEach(() => {
    document.documentElement.lang = ''
    document.documentElement.removeAttribute('translate')
    document.documentElement.classList.remove('notranslate')
    document.body.innerHTML = ''
  })

  it('maps zh* to zh-CN and marks html/root as notranslate', () => {
    document.body.innerHTML = '<div id="root"></div>'
    syncDocumentLanguage('zh')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(document.documentElement.getAttribute('translate')).toBe('no')
    expect(document.documentElement.classList.contains('notranslate')).toBe(true)
    expect(document.getElementById('root')?.getAttribute('translate')).toBe('no')
  })

  it('keeps Traditional Chinese regions on zh-TW', () => {
    document.body.innerHTML = '<div id="root"></div>'
    for (const language of ['zh-TW', 'zh-tw', 'zh-Hant']) {
      syncDocumentLanguage(language)
      expect(document.documentElement.lang).toBe('zh-TW')
    }
    syncDocumentLanguage('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('uses the primary subtag for other locales', () => {
    document.body.innerHTML = '<div id="root"></div>'
    syncDocumentLanguage('ru-RU')
    expect(document.documentElement.lang).toBe('ru')
  })
})
