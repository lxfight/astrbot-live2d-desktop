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
export type RecordingMode = 'hold' | 'toggle'

/** 智能行为系统配置（随高级设置持久化） */
export interface SmartBehaviorSettings {
  /** 空闲随机动作是否启用 */
  idleRandomMotionEnabled: boolean
  /** 空闲随机动作最小间隔（秒） */
  idleRandomMotionIntervalMin: number
  /** 空闲随机动作最大间隔（秒） */
  idleRandomMotionIntervalMax: number
  /** 时间感知问候是否启用（早上/下午/晚上/深夜） */
  idleTimeAwarenessEnabled: boolean
  /** 健康提醒是否启用（久坐/喝水/护眼） */
  remindersEnabled: boolean
  /** 久坐提醒间隔（分钟） */
  reminderSittingIntervalMinutes: number
  /** 喝水提醒间隔（分钟） */
  reminderWaterIntervalMinutes: number
  /** 护眼提醒间隔（分钟） */
  reminderEyeIntervalMinutes: number
  /** 失焦省电是否启用 */
  focusPowerSaveEnabled: boolean
  /** 失焦多久后进入省电模式（秒） */
  focusPowerSaveDelaySeconds: number
  /** 省电模式帧率 */
  focusPowerSaveFps: number
}

export interface AdvancedSettings {
  recordingMode: RecordingMode
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
  smartBehavior: SmartBehaviorSettings
}

export const DEFAULT_SMART_BEHAVIOR_SETTINGS: SmartBehaviorSettings = {
  idleRandomMotionEnabled: true,
  idleRandomMotionIntervalMin: 30,
  idleRandomMotionIntervalMax: 90,
  idleTimeAwarenessEnabled: true,
  remindersEnabled: true,
  reminderSittingIntervalMinutes: 60,
  reminderWaterIntervalMinutes: 90,
  reminderEyeIntervalMinutes: 45,
  focusPowerSaveEnabled: true,
  focusPowerSaveDelaySeconds: 60,
  focusPowerSaveFps: 5
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  recordingMode: 'hold',
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
  logLevel: 'info',
  smartBehavior: { ...DEFAULT_SMART_BEHAVIOR_SETTINGS }
}

export function normalizeRecordingMode(value: unknown): RecordingMode {
  return value === 'toggle' ? 'toggle' : 'hold'
}

export function normalizeAppLogLevel(value: unknown): AppLogLevel {
  return value === 'debug' ? 'debug' : 'info'
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  round = true
): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  const clamped = Math.max(min, Math.min(max, numericValue))
  return round ? Math.round(clamped) : clamped
}

/** 归一化智能行为配置，缺失字段回退默认值 */
export function normalizeSmartBehaviorSettings(value: unknown): SmartBehaviorSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const defaults = DEFAULT_SMART_BEHAVIOR_SETTINGS

  return {
    idleRandomMotionEnabled:
      typeof raw.idleRandomMotionEnabled === 'boolean'
        ? raw.idleRandomMotionEnabled
        : defaults.idleRandomMotionEnabled,
    idleRandomMotionIntervalMin: clampNumber(
      raw.idleRandomMotionIntervalMin,
      defaults.idleRandomMotionIntervalMin,
      10,
      300
    ),
    idleRandomMotionIntervalMax: clampNumber(
      raw.idleRandomMotionIntervalMax,
      defaults.idleRandomMotionIntervalMax,
      20,
      600
    ),
    idleTimeAwarenessEnabled:
      typeof raw.idleTimeAwarenessEnabled === 'boolean'
        ? raw.idleTimeAwarenessEnabled
        : defaults.idleTimeAwarenessEnabled,
    remindersEnabled:
      typeof raw.remindersEnabled === 'boolean' ? raw.remindersEnabled : defaults.remindersEnabled,
    reminderSittingIntervalMinutes: clampNumber(
      raw.reminderSittingIntervalMinutes,
      defaults.reminderSittingIntervalMinutes,
      15,
      240
    ),
    reminderWaterIntervalMinutes: clampNumber(
      raw.reminderWaterIntervalMinutes,
      defaults.reminderWaterIntervalMinutes,
      15,
      240
    ),
    reminderEyeIntervalMinutes: clampNumber(
      raw.reminderEyeIntervalMinutes,
      defaults.reminderEyeIntervalMinutes,
      10,
      240
    ),
    focusPowerSaveEnabled:
      typeof raw.focusPowerSaveEnabled === 'boolean'
        ? raw.focusPowerSaveEnabled
        : defaults.focusPowerSaveEnabled,
    focusPowerSaveDelaySeconds: clampNumber(
      raw.focusPowerSaveDelaySeconds,
      defaults.focusPowerSaveDelaySeconds,
      10,
      600
    ),
    focusPowerSaveFps: clampNumber(raw.focusPowerSaveFps, defaults.focusPowerSaveFps, 2, 30)
  }
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
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    recordingMode: normalizeRecordingMode(raw.recordingMode),
    recordingShortcut:
      typeof raw.recordingShortcut === 'string'
        ? raw.recordingShortcut
        : DEFAULT_ADVANCED_SETTINGS.recordingShortcut,
    autoLoadLastModel:
      typeof raw.autoLoadLastModel === 'boolean'
        ? raw.autoLoadLastModel
        : DEFAULT_ADVANCED_SETTINGS.autoLoadLastModel,
    themeFollowModel:
      typeof raw.themeFollowModel === 'boolean'
        ? raw.themeFollowModel
        : DEFAULT_ADVANCED_SETTINGS.themeFollowModel,
    silenceDetectionEnabled:
      typeof raw.silenceDetectionEnabled === 'boolean'
        ? raw.silenceDetectionEnabled
        : DEFAULT_ADVANCED_SETTINGS.silenceDetectionEnabled,
    showBaseEventNotifications:
      typeof raw.showBaseEventNotifications === 'boolean'
        ? raw.showBaseEventNotifications
        : DEFAULT_ADVANCED_SETTINGS.showBaseEventNotifications,
    maxRecordingSeconds: clampMaxRecordingSeconds(raw.maxRecordingSeconds),
    bubbleStackMax: clampBubbleStackMax(raw.bubbleStackMax),
    bubbleFollowUpWindowMs: clampBubbleFollowUpWindowMs(raw.bubbleFollowUpWindowMs),
    imageInlineThresholdKb: clampImageInlineThresholdKb(raw.imageInlineThresholdKb),
    imageMaxSizeMb: clampImageMaxSizeMb(raw.imageMaxSizeMb),
    logLevel: normalizeAppLogLevel(raw.logLevel),
    smartBehavior: normalizeSmartBehaviorSettings(raw.smartBehavior)
  }
}

export function clampBubbleStackMax(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ADVANCED_SETTINGS.bubbleStackMax
  }

  return Math.max(
    MIN_BUBBLE_STACK_LIMIT,
    Math.min(MAX_BUBBLE_STACK_LIMIT, Math.round(numericValue))
  )
}

export function clampBubbleFollowUpWindowMs(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ADVANCED_SETTINGS.bubbleFollowUpWindowMs
  }

  return Math.max(
    MIN_FOLLOW_UP_WINDOW_MS,
    Math.min(MAX_FOLLOW_UP_WINDOW_MS, Math.round(numericValue))
  )
}

export function clampImageInlineThresholdKb(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ADVANCED_SETTINGS.imageInlineThresholdKb
  }

  return Math.max(
    MIN_IMAGE_INLINE_THRESHOLD_KB,
    Math.min(MAX_IMAGE_INLINE_THRESHOLD_KB, Math.round(numericValue))
  )
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
      onError: error => {
        console.error('[高级设置] 解析失败，使用默认配置:', error)
      }
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
