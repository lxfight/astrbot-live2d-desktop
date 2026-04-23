import { getUserConfig, setUserConfig } from '../database/schema'
import { USER_CONFIG_KEYS } from '../../src/shared/metadata'
import {
  CONNECTION_BEHAVIOR_SETTINGS_SCHEMA_VERSION,
  buildDefaultConnectionBehaviorSettings,
  normalizeConnectionBehaviorSettings,
  type ConnectionBehaviorSettingsLoadResult,
  type ConnectionBehaviorSettingsMigrateLegacyResult,
  type ConnectionBehaviorSettingsPersistedV1,
  type ConnectionBehaviorSettingsSavePayload,
  type ConnectionBehaviorSettingsSaveResult,
} from '../../src/shared/connectionBehaviorSettings'

const STORAGE_KEY = USER_CONFIG_KEYS.connectionBehaviorSettingsV1

type StoredConnectionBehaviorSettingsEnvelope = {
  version: number
  data: ConnectionBehaviorSettingsPersistedV1
}

type LegacyAdvancedSettings = {
  autoConnect?: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return String(error)
}

function readPersistedEnvelope(): StoredConnectionBehaviorSettingsEnvelope | null {
  const storedValue = getUserConfig(STORAGE_KEY)
  if (!storedValue) {
    return null
  }

  const parsed = JSON.parse(storedValue)
  if (!isObject(parsed)) {
    return null
  }

  return parsed as StoredConnectionBehaviorSettingsEnvelope
}

function readPersistedSettingsRecord(): {
  exists: boolean
  settings: ConnectionBehaviorSettingsPersistedV1
} {
  try {
    const envelope = readPersistedEnvelope()
    if (!envelope || envelope.version !== CONNECTION_BEHAVIOR_SETTINGS_SCHEMA_VERSION || !isObject(envelope.data)) {
      return {
        exists: false,
        settings: buildDefaultConnectionBehaviorSettings(),
      }
    }

    return {
      exists: true,
      settings: normalizeConnectionBehaviorSettings(envelope.data),
    }
  } catch (error) {
    console.error('[ConnectionBehaviorSettingsService] 读取连接行为配置失败:', error)
    return {
      exists: false,
      settings: buildDefaultConnectionBehaviorSettings(),
    }
  }
}

function writePersistedSettings(settings: ConnectionBehaviorSettingsPersistedV1): void {
  const envelope: StoredConnectionBehaviorSettingsEnvelope = {
    version: CONNECTION_BEHAVIOR_SETTINGS_SCHEMA_VERSION,
    data: normalizeConnectionBehaviorSettings(settings),
  }
  setUserConfig(STORAGE_KEY, JSON.stringify(envelope))
}

function extractLegacyAutoConnect(rawLegacyJson: string): boolean {
  if (!rawLegacyJson.trim()) {
    return buildDefaultConnectionBehaviorSettings().autoConnectOnAppLaunch
  }

  try {
    const parsed = JSON.parse(rawLegacyJson)
    if (!isObject(parsed)) {
      return buildDefaultConnectionBehaviorSettings().autoConnectOnAppLaunch
    }

    const legacy = parsed as LegacyAdvancedSettings
    return typeof legacy.autoConnect === 'boolean'
      ? legacy.autoConnect
      : buildDefaultConnectionBehaviorSettings().autoConnectOnAppLaunch
  } catch (error) {
    console.error('[ConnectionBehaviorSettingsService] 解析旧版高级设置失败:', error)
    return buildDefaultConnectionBehaviorSettings().autoConnectOnAppLaunch
  }
}

export function loadConnectionBehaviorSettingsRecord(): {
  exists: boolean
  settings: ConnectionBehaviorSettingsPersistedV1
} {
  return readPersistedSettingsRecord()
}

export function loadConnectionBehaviorSettings(): ConnectionBehaviorSettingsLoadResult {
  try {
    const record = readPersistedSettingsRecord()
    return {
      success: true,
      data: record.settings,
    }
  } catch (error) {
    return {
      success: false,
      code: 'PERSIST_FAILED',
      message: `读取连接行为配置失败: ${toErrorMessage(error)}`,
    }
  }
}

export function saveConnectionBehaviorSettings(payload: ConnectionBehaviorSettingsSavePayload): ConnectionBehaviorSettingsSaveResult {
  if (!isObject(payload) || !isObject(payload.data)) {
    return {
      success: false,
      code: 'INVALID_PAYLOAD',
      message: '连接行为配置请求体无效',
    }
  }

  try {
    const nextSettings = normalizeConnectionBehaviorSettings(payload.data)
    writePersistedSettings(nextSettings)
    return {
      success: true,
      data: nextSettings,
    }
  } catch (error) {
    return {
      success: false,
      code: 'PERSIST_FAILED',
      message: `保存连接行为配置失败: ${toErrorMessage(error)}`,
    }
  }
}

export function migrateLegacyConnectionBehaviorSettings(rawLegacyJson: string): ConnectionBehaviorSettingsMigrateLegacyResult {
  try {
    const existing = readPersistedSettingsRecord()
    if (existing.exists) {
      return {
        success: true,
        data: existing.settings,
      }
    }

    const defaults = buildDefaultConnectionBehaviorSettings()
    const migrated = normalizeConnectionBehaviorSettings({
      ...defaults,
      autoConnectOnAppLaunch: extractLegacyAutoConnect(rawLegacyJson),
    })
    writePersistedSettings(migrated)

    return {
      success: true,
      data: migrated,
    }
  } catch (error) {
    return {
      success: false,
      code: 'MIGRATION_FAILED',
      message: `迁移旧版连接行为配置失败: ${toErrorMessage(error)}`,
    }
  }
}
