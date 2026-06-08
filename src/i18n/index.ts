import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'
import type { I18nMessageSchema } from './types'

export type SupportedLocale = 'zh-CN' | 'en'

export const i18n = createI18n<[I18nMessageSchema], SupportedLocale>({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en
  }
})
