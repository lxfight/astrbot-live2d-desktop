import { safeStorage } from 'electron'
import { getUserConfig, setUserConfig } from '../database/schema'
import { USER_CONFIG_KEYS } from '../../src/shared/metadata'
import {
  CONNECTION_SETTINGS_SCHEMA_VERSION,
  buildDefaultConnectionSettingsEditable,
  normalizeConnectionSettingsEditable,
  type ConnectionSettingsEditable,
  type ConnectionSettingsLoadResult,
  type ConnectionSettingsMigrateLegacyResult,
  type ConnectionSettingsPersistedV3,
  type ConnectionSettingsSavePayload,
  type ConnectionSettingsSaveResult,
} from '../../src/shared/connectionSettings'

const STORAGE_KEY = USER_CONFIG_KEYS.connectionSettingsV3
const LEGACY_ENVELOPE_DATA_KEY = 'data'

type StoredSecretMode = 'encrypted' | 'plain'

type StoredSecretValue = {
  mode: StoredSecretMode
  value: string
}

type StoredConnectionSettingsV3 = {
  serverUrl: string
  token: StoredSecretValue
  customResourceBaseUrl: string
  customResourcePath: string
  customResourceToken: StoredSecretValue
  revision: number
  updatedAt: number
}

type StoredConnectionSettingsEnvelope = {
  version: number
  data: StoredConnectionSettingsV3
}

type LegacyConnectionSettings = {
  serverUrl?: unknown
  token?: unknown
  encryptedToken?: unknown
  resourceOverrideBaseUrl?: unknown
  resourceOverridePath?: unknown
  resourceToken?: unknown
  encryptedResourceToken?: unknown
  customResourceBaseUrl?: unknown
  customResourcePath?: unknown
  customResourceToken?: unknown
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

function normalizeRevision(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  return fallback
}

function normalizeUpdatedAt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  return Date.now()
}

function encodeSecretValue(plainValue: string): StoredSecretValue {
  const normalizedValue = plainValue.trim()
  if (!normalizedValue) {
    return { mode: 'plain', value: '' }
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return { mode: 'plain', value: normalizedValue }
  }

  try {
    const encrypted = safeStorage.encryptString(normalizedValue).toString('base64')
    return { mode: 'encrypted', value: encrypted }
  } catch (error) {
    console.warn('[ConnectionSettingsService] 令牌加密失败，降级为明文存储:', error)
    return { mode: 'plain', value: normalizedValue }
  }
}

function decodeSecretValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (!isObject(value)) {
    return ''
  }

  const mode = value.mode
  const raw = typeof value.value === 'string' ? value.value.trim() : ''
  if (!raw) {
    return ''
  }

  if (mode !== 'encrypted') {
    return raw
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return raw
  }

  try {
    return safeStorage.decryptString(Buffer.from(raw, 'base64')).trim()
  } catch {
    return raw
  }
}

function buildDefaultPersistedSettings(): ConnectionSettingsPersistedV3 {
  const defaults = buildDefaultConnectionSettingsEditable()
  return {
    ...defaults,
    revision: 0,
    updatedAt: Date.now(),
  }
}

function toEditable(settings: ConnectionSettingsPersistedV3): ConnectionSettingsEditable {
  return {
    serverUrl: settings.serverUrl,
    token: settings.token,
    customResourceBaseUrl: settings.customResourceBaseUrl,
    customResourcePath: settings.customResourcePath,
    customResourceToken: settings.customResourceToken,
  }
}

function toStoredSettings(settings: ConnectionSettingsPersistedV3): StoredConnectionSettingsV3 {
  return {
    serverUrl: settings.serverUrl,
    token: encodeSecretValue(settings.token),
    customResourceBaseUrl: settings.customResourceBaseUrl,
    customResourcePath: settings.customResourcePath,
    customResourceToken: encodeSecretValue(settings.customResourceToken),
    revision: settings.revision,
    updatedAt: settings.updatedAt,
  }
}

function toPersistedSettings(value: {
  serverUrl?: unknown
  token?: unknown
  customResourceBaseUrl?: unknown
  customResourcePath?: unknown
  customResourceToken?: unknown
  revision?: unknown
  updatedAt?: unknown
}): ConnectionSettingsPersistedV3 {
  const editable = normalizeConnectionSettingsEditable({
    serverUrl: typeof value.serverUrl === 'string' ? value.serverUrl : undefined,
    token: typeof value.token === 'string' ? value.token : undefined,
    customResourceBaseUrl: typeof value.customResourceBaseUrl === 'string' ? value.customResourceBaseUrl : undefined,
    customResourcePath: typeof value.customResourcePath === 'string' ? value.customResourcePath : undefined,
    customResourceToken: typeof value.customResourceToken === 'string' ? value.customResourceToken : undefined,
  })
  return {
    ...editable,
    revision: normalizeRevision(value.revision, 0),
    updatedAt: normalizeUpdatedAt(value.updatedAt),
  }
}

function parseStoredSettings(raw: unknown): ConnectionSettingsPersistedV3 | null {
  if (!isObject(raw)) {
    return null
  }

  const envelope = raw as Partial<StoredConnectionSettingsEnvelope>
  const data = envelope.version === CONNECTION_SETTINGS_SCHEMA_VERSION && isObject(envelope.data)
    ? envelope.data as Record<string, unknown>
    : raw

  if (!isObject(data)) {
    return null
  }

  return toPersistedSettings({
    serverUrl: data.serverUrl,
    token: decodeSecretValue(data.token),
    customResourceBaseUrl: data.customResourceBaseUrl,
    customResourcePath: data.customResourcePath,
    customResourceToken: decodeSecretValue(data.customResourceToken),
    revision: data.revision,
    updatedAt: data.updatedAt,
  })
}

function readPersistedSettings(): ConnectionSettingsPersistedV3 | null {
  const storedValue = getUserConfig(STORAGE_KEY)
  if (!storedValue) {
    return null
  }

  try {
    const parsed = JSON.parse(storedValue)
    return parseStoredSettings(parsed)
  } catch (error) {
    console.warn('[ConnectionSettingsService] 读取配置 JSON 失败，已忽略旧值:', error)
    return null
  }
}

function writePersistedSettings(settings: ConnectionSettingsPersistedV3): void {
  const envelope: StoredConnectionSettingsEnvelope = {
    version: CONNECTION_SETTINGS_SCHEMA_VERSION,
    data: toStoredSettings(settings),
  }

  setUserConfig(STORAGE_KEY, JSON.stringify(envelope))
}

function validateSavePayload(payload: ConnectionSettingsSavePayload): string | null {
  if (!isObject(payload)) {
    return '请求体必须是对象'
  }

  if (!isObject(payload.data)) {
    return 'data 字段必须是对象'
  }

  if (typeof payload.expectedRevision !== 'number' || !Number.isFinite(payload.expectedRevision) || payload.expectedRevision < 0) {
    return 'expectedRevision 必须是非负整数'
  }

  return null
}

function extractLegacySettings(raw: unknown): LegacyConnectionSettings | null {
  if (!isObject(raw)) {
    return null
  }

  const envelopeData = raw[LEGACY_ENVELOPE_DATA_KEY]
  if (isObject(envelopeData)) {
    return envelopeData as LegacyConnectionSettings
  }

  return raw as LegacyConnectionSettings
}

function tryDecryptLegacyEncryptedToken(rawEncrypted: unknown): string | null {
  if (typeof rawEncrypted !== 'string') {
    return null
  }

  const encryptedValue = rawEncrypted.trim()
  if (!encryptedValue || !safeStorage.isEncryptionAvailable()) {
    return null
  }

  try {
    return safeStorage.decryptString(Buffer.from(encryptedValue, 'base64')).trim()
  } catch {
    return null
  }
}

function normalizeLegacyToken(rawEncrypted: unknown, rawPlain: unknown): string {
  const decryptedValue = tryDecryptLegacyEncryptedToken(rawEncrypted)
  if (decryptedValue !== null) {
    return decryptedValue
  }

  if (typeof rawPlain === 'string') {
    return rawPlain.trim()
  }

  return ''
}

function normalizeLegacyEditable(value: LegacyConnectionSettings): ConnectionSettingsEditable {
  return normalizeConnectionSettingsEditable({
    serverUrl: typeof value.serverUrl === 'string' ? value.serverUrl : undefined,
    token: normalizeLegacyToken(value.encryptedToken, value.token),
    customResourceBaseUrl: typeof value.customResourceBaseUrl === 'string'
      ? value.customResourceBaseUrl
      : (typeof value.resourceOverrideBaseUrl === 'string' ? value.resourceOverrideBaseUrl : ''),
    customResourcePath: typeof value.customResourcePath === 'string'
      ? value.customResourcePath
      : (typeof value.resourceOverridePath === 'string' ? value.resourceOverridePath : ''),
    customResourceToken: normalizeLegacyToken(value.encryptedResourceToken, value.customResourceToken ?? value.resourceToken),
  })
}

export function loadConnectionSettings(): ConnectionSettingsLoadResult {
  try {
    const persisted = readPersistedSettings() ?? buildDefaultPersistedSettings()
    return {
      success: true,
      data: persisted,
    }
  } catch (error) {
    return {
      success: false,
      code: 'PERSIST_FAILED',
      message: `读取连接配置失败: ${toErrorMessage(error)}`,
    }
  }
}

export function saveConnectionSettings(payload: ConnectionSettingsSavePayload): ConnectionSettingsSaveResult {
  const payloadError = validateSavePayload(payload)
  if (payloadError) {
    return {
      success: false,
      code: 'INVALID_PAYLOAD',
      message: payloadError,
    }
  }

  try {
    const current = readPersistedSettings() ?? buildDefaultPersistedSettings()
    const expectedRevision = Math.floor(payload.expectedRevision)

    if (expectedRevision !== current.revision) {
      return {
        success: false,
        code: 'CONFLICT_REVISION',
        message: `配置已更新到 revision=${current.revision}，请刷新后重试`,
      }
    }

    const normalizedEditable = normalizeConnectionSettingsEditable(payload.data)
    const next: ConnectionSettingsPersistedV3 = {
      ...normalizedEditable,
      revision: current.revision + 1,
      updatedAt: Date.now(),
    }

    writePersistedSettings(next)

    return {
      success: true,
      data: next,
    }
  } catch (error) {
    return {
      success: false,
      code: 'PERSIST_FAILED',
      message: `保存连接配置失败: ${toErrorMessage(error)}`,
    }
  }
}

export function migrateLegacyConnectionSettings(rawLegacyJson: string): ConnectionSettingsMigrateLegacyResult {
  if (typeof rawLegacyJson !== 'string' || !rawLegacyJson.trim()) {
    return {
      success: false,
      code: 'INVALID_PAYLOAD',
      message: '缺少旧版连接配置内容',
    }
  }

  try {
    const existing = readPersistedSettings()
    if (existing) {
      return {
        success: true,
        data: existing,
      }
    }

    const parsedLegacy = JSON.parse(rawLegacyJson)
    const legacy = extractLegacySettings(parsedLegacy)
    if (!legacy) {
      return {
        success: false,
        code: 'MIGRATION_FAILED',
        message: '旧版连接配置格式无效',
      }
    }

    const normalizedEditable = normalizeLegacyEditable(legacy)
    const migrated: ConnectionSettingsPersistedV3 = {
      ...normalizedEditable,
      revision: 1,
      updatedAt: Date.now(),
    }

    writePersistedSettings(migrated)

    return {
      success: true,
      data: migrated,
    }
  } catch (error) {
    return {
      success: false,
      code: 'MIGRATION_FAILED',
      message: `迁移旧版连接配置失败: ${toErrorMessage(error)}`,
    }
  }
}

export function buildDefaultConnectionSettingsSnapshot(): ConnectionSettingsPersistedV3 {
  const defaults = buildDefaultPersistedSettings()
  return {
    ...toEditable(defaults),
    revision: defaults.revision,
    updatedAt: defaults.updatedAt,
  }
}
