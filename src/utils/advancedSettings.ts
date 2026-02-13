export const ADVANCED_SETTINGS_KEY = 'advancedSettings'
export const MAX_RECORDING_SECONDS_LIMIT = 60
const MIN_RECORDING_SECONDS_LIMIT = 1

export interface AdvancedSettings {
  recordingShortcut: string
  autoConnect: boolean
  showBaseEventNotifications: boolean
  wakeWordEnabled: boolean
  wakeKeywords: string[]
  maxRecordingSeconds: number
}

export interface LoadAdvancedSettingsOptions {
  forceWakeWordDisabled?: boolean
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  recordingShortcut: 'Alt+R',
  autoConnect: true,
  showBaseEventNotifications: true,
  wakeWordEnabled: false,
  wakeKeywords: ['小助手'],
  maxRecordingSeconds: 30
}

export function normalizeWakeKeywords(value: unknown): string[] {
  const rawKeywords = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，\n]/)
      : []

  const normalized: string[] = []

  for (const item of rawKeywords) {
    if (typeof item !== 'string') {
      continue
    }

    const keyword = item.trim()
    if (!keyword || normalized.includes(keyword)) {
      continue
    }

    normalized.push(keyword)
    if (normalized.length >= 10) {
      break
    }
  }

  return normalized
}

export function clampMaxRecordingSeconds(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ADVANCED_SETTINGS.maxRecordingSeconds
  }

  return Math.max(
    MIN_RECORDING_SECONDS_LIMIT,
    Math.min(MAX_RECORDING_SECONDS_LIMIT, Math.round(numericValue))
  )
}

export function normalizeAdvancedSettings(value: unknown): AdvancedSettings {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}

  const wakeKeywords = normalizeWakeKeywords(raw.wakeKeywords)

  return {
    recordingShortcut: typeof raw.recordingShortcut === 'string'
      ? raw.recordingShortcut
      : DEFAULT_ADVANCED_SETTINGS.recordingShortcut,
    autoConnect: typeof raw.autoConnect === 'boolean'
      ? raw.autoConnect
      : DEFAULT_ADVANCED_SETTINGS.autoConnect,
    showBaseEventNotifications: typeof raw.showBaseEventNotifications === 'boolean'
      ? raw.showBaseEventNotifications
      : DEFAULT_ADVANCED_SETTINGS.showBaseEventNotifications,
    wakeWordEnabled: typeof raw.wakeWordEnabled === 'boolean'
      ? raw.wakeWordEnabled
      : DEFAULT_ADVANCED_SETTINGS.wakeWordEnabled,
    wakeKeywords: wakeKeywords.length > 0
      ? wakeKeywords
      : [...DEFAULT_ADVANCED_SETTINGS.wakeKeywords],
    maxRecordingSeconds: clampMaxRecordingSeconds(raw.maxRecordingSeconds)
  }
}

export function loadAdvancedSettings(options: LoadAdvancedSettingsOptions = {}): AdvancedSettings {
  const applyStartupRules = (settings: AdvancedSettings): AdvancedSettings => {
    if (!options.forceWakeWordDisabled) {
      return settings
    }

    return {
      ...settings,
      wakeWordEnabled: false
    }
  }

  const rawValue = localStorage.getItem(ADVANCED_SETTINGS_KEY)
  if (!rawValue) {
    return applyStartupRules({
      ...DEFAULT_ADVANCED_SETTINGS,
      wakeKeywords: [...DEFAULT_ADVANCED_SETTINGS.wakeKeywords]
    })
  }

  try {
    const parsed = JSON.parse(rawValue)
    return applyStartupRules(normalizeAdvancedSettings(parsed))
  } catch (error) {
    console.error('[高级设置] 解析失败，使用默认配置:', error)
    return applyStartupRules({
      ...DEFAULT_ADVANCED_SETTINGS,
      wakeKeywords: [...DEFAULT_ADVANCED_SETTINGS.wakeKeywords]
    })
  }
}

export function saveAdvancedSettings(settings: unknown): AdvancedSettings {
  const normalized = normalizeAdvancedSettings(settings)
  localStorage.setItem(ADVANCED_SETTINGS_KEY, JSON.stringify(normalized))
  return normalized
}
