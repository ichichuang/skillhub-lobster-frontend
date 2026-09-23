import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'

/**
 * Initializes i18next with the Chinese-only product policy.
 *
 * The product language is fixed to the canonical upstream `zh`: it never
 * depends on navigator.language, localStorage selections, or route parameters,
 * so browser locales cannot switch the UI to English or Russian. English and
 * Russian bundles stay registered for upstream parity and future maintenance,
 * but only `zh` is a supported/resolvable language. The browser language
 * detector is intentionally removed from the active plugin chain — there is
 * nothing for it to detect under this policy.
 */
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      zh: { translation: zh },
    },
    lng: 'zh',
    fallbackLng: 'zh',
    supportedLngs: ['zh'],
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
