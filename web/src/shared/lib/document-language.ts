/**
 * Keep <html lang> aligned with the in-app i18n locale and discourage Chrome /
 * Google automatic translation from rewriting #root (React insertBefore crashes).
 */
export function syncDocumentLanguage(language: string) {
  if (typeof document === 'undefined') {
    return
  }

  const [primary, region] = language.toLowerCase().split('-')
  const lang = primary === 'zh'
    ? (region === 'tw' || region === 'hant' || region === 'hk' || region === 'mo' ? 'zh-TW' : 'zh-CN')
    : (primary || 'en')
  const html = document.documentElement

  if (html.lang !== lang) {
    html.lang = lang
  }

  html.setAttribute('translate', 'no')
  html.classList.add('notranslate')

  const root = document.getElementById('root')
  if (root) {
    root.setAttribute('translate', 'no')
    root.classList.add('notranslate')
  }
}
