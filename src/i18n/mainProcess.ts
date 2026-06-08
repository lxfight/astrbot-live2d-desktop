import zhCN from './locales/zh-CN'
import en from './locales/en'
import type { I18nMessageSchema } from './types'

type SupportedLocale = 'zh-CN' | 'en'

const messages: Record<SupportedLocale, I18nMessageSchema> = {
  'zh-CN': zhCN,
  en
}

let currentLocale: SupportedLocale = 'zh-CN'

export function setMainLocale(locale: SupportedLocale): void {
  currentLocale = locale
}

export function getMainLocale(): SupportedLocale {
  return currentLocale
}

export function t(key: keyof I18nMessageSchema, params?: Record<string, string | number>): string {
  let template: string = messages[currentLocale]?.[key] ?? messages['zh-CN'][key] ?? String(key)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return template
}
