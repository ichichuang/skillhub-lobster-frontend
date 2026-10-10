import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zh from './locales/zh.json'
import zhTw from './locales/zh-TW.json'
import { readParentLanguageCode } from '@/shared/lib/url-language'

/**
 * Initializes i18next with the parent platform's URL-selected locale (`?lang=0|1|2`, mirroring the
 * `?dark=` theme contract). Missing, duplicate, or invalid values fall back to Simplified Chinese.
 */
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zh },
      'zh-TW': { translation: zhTw },
    },
    lng: readParentLanguageCode(),
    fallbackLng: 'zh-CN',
    supportedLngs: ['zh-CN', 'zh-TW', 'en'],
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
