import { readJsonStorage, writeJsonStorage } from './storage'
import { LOCAL_STORAGE_METADATA } from '@/shared/metadata'

export const ADVANCED_SETTINGS_KEY = LOCAL_STORAGE_METADATA.advancedSettings.key
const ADVANCED_SETTINGS_VERSION = LOCAL_STORAGE_METADATA.advancedSettings.version
export const MAX_RECORDING_SECONDS_LIMIT = 60
const MIN_RECORDING_SECONDS_LIMIT = 1
const MIN_BUBBLE_STACK_LIMIT = 1
const MAX_BUBBLE_STACK_LIMIT = 10
const MIN_FOLLOW_UP_WINDOW_MS = 500
const MAX_FOLLOW_UP_WINDOW_MS = 15000
const MIN_IMAGE_INLINE_THRESHOLD_KB = 64
const MAX_IMAGE_INLINE_THRESHOLD_KB = 2048
const MIN_IMAGE_MAX_SIZE_MB = 1
const MAX_IMAGE_MAX_SIZE_MB = 50

export type AppLogLevel = 'info' | 'debug'

export interface AdvancedSettings {
  recordingShortcut: string
  autoLoadLastModel: boolean
  themeFollowModel: boolean
  silenceDetectionEnabled: boolean
  showBaseEventNotifications: boolean
  maxRecordingSeconds: number
  bubbleStackMax: number
  bubbleFollowUpWindowMs: number
  imageInlineThresholdKb: number
  imageMaxSizeMb: number
  logLevel: AppLogLevel
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  recordingShortcut: 'Alt+R',
  autoLoadLastModel: true,
  themeFollowModel: true,
  silenceDetectionEnabled: false,
  showBaseEventNotifications: true,
  maxRecordingSeconds: 30,
  bubbleStackMax: 3,
  bubbleFollowUpWindowMs: 4000,
  imageInlineThresholdKb: 256,
  imageMaxSizeMb: 10,
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
    autoLoadLastModel: typeof raw.autoLoadLastModel === 'boolean'
      ? raw.autoLoadLastModel
      : DEFAULT_ADVANCED_SETTINGS.autoLoadLastModel,
    themeFollowModel: typeof raw.themeFollowModel === 'boolean'
      ? raw.themeFollowModel
      : DEFAULT_ADVANCED_SETTINGS.themeFollowModel,
    silenceDetectionEnabled: typeof raw.silenceDetectionEnabled === 'boolean'
      ? raw.silenceDetectionEnabled
      : DEFAULT_ADVANCED_SETTINGS.silenceDetectionEnabled,
    showBaseEventNotifications: typeof raw.showBaseEventNotifications === 'boolean'
      ? raw.showBaseEventNotifications
      : DEFAULT_ADVANCED_SETTINGS.showBaseEventNotifications,
    maxRecordingSeconds: clampMaxRecordingSeconds(raw.maxRecordingSeconds),
    bubbleStackMax: clampBubbleStackMax(raw.bubbleStackMax),
    bubbleFollowUpWindowMs: clampBubbleFollowUpWindowMs(raw.bubbleFollowUpWindowMs),
    imageInlineThresholdKb: clampImageInlineThresholdKb(raw.imageInlineThresholdKb),
    imageMaxSizeMb: clampImageMaxSizeMb(raw.imageMaxSizeMb),
    logLevel: normalizeAppLogLevel(raw.logLevel)
  }
}

export function clampBubbleStackMax(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ADVANCED_SETTINGS.bubbleStackMax
  }

  return Math.max(MIN_BUBBLE_STACK_LIMIT, Math.min(MAX_BUBBLE_STACK_LIMIT, Math.round(numericValue)))
}

export function clampBubbleFollowUpWindowMs(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ADVANCED_SETTINGS.bubbleFollowUpWindowMs
  }

  return Math.max(MIN_FOLLOW_UP_WINDOW_MS, Math.min(MAX_FOLLOW_UP_WINDOW_MS, Math.round(numericValue)))
}

export function clampImageInlineThresholdKb(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ADVANCED_SETTINGS.imageInlineThresholdKb
  }

  return Math.max(MIN_IMAGE_INLINE_THRESHOLD_KB, Math.min(MAX_IMAGE_INLINE_THRESHOLD_KB, Math.round(numericValue)))
}

export function clampImageMaxSizeMb(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ADVANCED_SETTINGS.imageMaxSizeMb
  }

  return Math.max(MIN_IMAGE_MAX_SIZE_MB, Math.min(MAX_IMAGE_MAX_SIZE_MB, Math.round(numericValue)))
}

export function loadAdvancedSettings(): AdvancedSettings {
  try {
    return readJsonStorage(ADVANCED_SETTINGS_KEY, {
      fallback: { ...DEFAULT_ADVANCED_SETTINGS },
      normalize: normalizeAdvancedSettings,
      version: ADVANCED_SETTINGS_VERSION,
      onError: (error) => {
        console.error('[高级设置] 解析失败，使用默认配置:', error)
      },
    })
  } catch (error) {
    console.error('[高级设置] 解析失败，使用默认配置:', error)
    return { ...DEFAULT_ADVANCED_SETTINGS }
  }
}

export function saveAdvancedSettings(settings: unknown): AdvancedSettings {
  const normalized = normalizeAdvancedSettings(settings)
  writeJsonStorage(ADVANCED_SETTINGS_KEY, normalized, { version: ADVANCED_SETTINGS_VERSION })
  return normalized
}
