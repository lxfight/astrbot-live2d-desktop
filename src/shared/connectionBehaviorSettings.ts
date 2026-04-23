export const CONNECTION_BEHAVIOR_SETTINGS_SCHEMA_VERSION = 1

export type ConnectionBehaviorSettingsErrorCode =
  | 'INVALID_PAYLOAD'
  | 'PERSIST_FAILED'
  | 'MIGRATION_FAILED'
  | 'UNKNOWN'

export interface ConnectionBehaviorSettingsPersistedV1 {
  autoConnectOnAppLaunch: boolean
  resumeDesiredConnectionOnWake: boolean
  retryEnabled: boolean
  retryBaseDelayMs: number
  retryMaxDelayMs: number
  retryMaxAttempts: number | null
  handshakeTimeoutMs: number
}

export interface ConnectionBehaviorSettingsChangedEvent {
  settings: ConnectionBehaviorSettingsPersistedV1
  sourceWindowId?: number
}

export interface ConnectionBehaviorSettingsSavePayload {
  data: ConnectionBehaviorSettingsPersistedV1
}

export type ConnectionBehaviorSettingsLoadResult =
  | {
      success: true
      data: ConnectionBehaviorSettingsPersistedV1
    }
  | {
      success: false
      code: ConnectionBehaviorSettingsErrorCode
      message: string
    }

export type ConnectionBehaviorSettingsSaveResult =
  | {
      success: true
      data: ConnectionBehaviorSettingsPersistedV1
    }
  | {
      success: false
      code: ConnectionBehaviorSettingsErrorCode
      message: string
    }

export type ConnectionBehaviorSettingsMigrateLegacyResult =
  | {
      success: true
      data: ConnectionBehaviorSettingsPersistedV1
    }
  | {
      success: false
      code: ConnectionBehaviorSettingsErrorCode
      message: string
    }

const MIN_RETRY_DELAY_MS = 250
const MAX_RETRY_DELAY_MS = 300000
const MIN_RETRY_ATTEMPTS = 1
const MAX_RETRY_ATTEMPTS = 1000
const MIN_HANDSHAKE_TIMEOUT_MS = 1000
const MAX_HANDSHAKE_TIMEOUT_MS = 60000

export function buildDefaultConnectionBehaviorSettings(): ConnectionBehaviorSettingsPersistedV1 {
  return {
    autoConnectOnAppLaunch: true,
    resumeDesiredConnectionOnWake: true,
    retryEnabled: true,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 30000,
    retryMaxAttempts: null,
    handshakeTimeoutMs: 8000,
  }
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeRetryDelay(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(MIN_RETRY_DELAY_MS, Math.min(MAX_RETRY_DELAY_MS, Math.round(numeric)))
}

function normalizeRetryAttempts(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null
  }

  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.max(MIN_RETRY_ATTEMPTS, Math.min(MAX_RETRY_ATTEMPTS, Math.round(numeric)))
}

function normalizeHandshakeTimeout(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(MIN_HANDSHAKE_TIMEOUT_MS, Math.min(MAX_HANDSHAKE_TIMEOUT_MS, Math.round(numeric)))
}

export function normalizeConnectionBehaviorSettings(
  value: Partial<ConnectionBehaviorSettingsPersistedV1> | null | undefined,
): ConnectionBehaviorSettingsPersistedV1 {
  const defaults = buildDefaultConnectionBehaviorSettings()
  const source = value || {}

  const retryBaseDelayMs = normalizeRetryDelay(source.retryBaseDelayMs, defaults.retryBaseDelayMs)
  const retryMaxDelayMs = Math.max(
    retryBaseDelayMs,
    normalizeRetryDelay(source.retryMaxDelayMs, defaults.retryMaxDelayMs),
  )

  return {
    autoConnectOnAppLaunch: normalizeBoolean(source.autoConnectOnAppLaunch, defaults.autoConnectOnAppLaunch),
    resumeDesiredConnectionOnWake: normalizeBoolean(
      source.resumeDesiredConnectionOnWake,
      defaults.resumeDesiredConnectionOnWake,
    ),
    retryEnabled: normalizeBoolean(source.retryEnabled, defaults.retryEnabled),
    retryBaseDelayMs,
    retryMaxDelayMs,
    retryMaxAttempts: normalizeRetryAttempts(source.retryMaxAttempts, defaults.retryMaxAttempts),
    handshakeTimeoutMs: normalizeHandshakeTimeout(source.handshakeTimeoutMs, defaults.handshakeTimeoutMs),
  }
}
