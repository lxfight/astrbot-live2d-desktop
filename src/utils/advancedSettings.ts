export const ADVANCED_SETTINGS_KEY = 'advancedSettings'
export const MAX_RECORDING_SECONDS_LIMIT = 60
const MIN_RECORDING_SECONDS_LIMIT = 1

export type AppLogLevel = 'info' | 'debug'

export interface AdvancedSettings {
  recordingShortcut: string
  autoConnect: boolean
  showBaseEventNotifications: boolean
  maxRecordingSeconds: number
  logLevel: AppLogLevel
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  recordingShortcut: 'Alt+R',
  autoConnect: true,
  showBaseEventNotifications: true,
  maxRecordingSeconds: 30,
  logLevel: 'info'
}

export function normalizeAppLogLevel(value: unknown): AppLogLevel {
  return value === 'debug' ? 'debug' : 'info'
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
    maxRecordingSeconds: clampMaxRecordingSeconds(raw.maxRecordingSeconds),
    logLevel: normalizeAppLogLevel(raw.logLevel)
  }
}

export function loadAdvancedSettings(): AdvancedSettings {
  const rawValue = localStorage.getItem(ADVANCED_SETTINGS_KEY)
  if (!rawValue) {
    return { ...DEFAULT_ADVANCED_SETTINGS }
  }

  try {
    const parsed = JSON.parse(rawValue)
    return normalizeAdvancedSettings(parsed)
  } catch (error) {
    console.error('[高级设置] 解析失败，使用默认配置:', error)
    return { ...DEFAULT_ADVANCED_SETTINGS }
  }
}

export function saveAdvancedSettings(settings: unknown): AdvancedSettings {
  const normalized = normalizeAdvancedSettings(settings)
  localStorage.setItem(ADVANCED_SETTINGS_KEY, JSON.stringify(normalized))
  return normalized
}
