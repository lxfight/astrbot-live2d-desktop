export const CONNECTION_SETTINGS_SCHEMA_VERSION = 3
export const DEFAULT_CONNECTION_RESOURCE_PATH = '/resources'
export const DEFAULT_CONNECTION_SERVER_URL = 'ws://127.0.0.1:9090/astrbot/live2d'

export type ConnectionSettingsErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ENCRYPTION_UNAVAILABLE'
  | 'PERSIST_FAILED'
  | 'CONFLICT_REVISION'
  | 'MIGRATION_FAILED'
  | 'UNKNOWN'

export interface ConnectionSettingsPersistedV3 {
  serverUrl: string
  token: string
  customResourceBaseUrl: string
  customResourcePath: string
  customResourceToken: string
  revision: number
  updatedAt: number
}

export type ConnectionSettingsEditable = Omit<ConnectionSettingsPersistedV3, 'revision' | 'updatedAt'>

export interface ConnectionSettingsSavePayload {
  data: ConnectionSettingsEditable
  expectedRevision: number
}

export interface ConnectionSettingsChangedEvent {
  settings: ConnectionSettingsPersistedV3
  revision: number
  sourceWindowId?: number
}

export type ConnectionSettingsLoadResult =
  | {
      success: true
      data: ConnectionSettingsPersistedV3
    }
  | {
      success: false
      code: ConnectionSettingsErrorCode
      message: string
    }

export type ConnectionSettingsSaveResult =
  | {
      success: true
      data: ConnectionSettingsPersistedV3
    }
  | {
      success: false
      code: ConnectionSettingsErrorCode
      message: string
    }

export type ConnectionSettingsMigrateLegacyResult =
  | {
      success: true
      data: ConnectionSettingsPersistedV3
    }
  | {
      success: false
      code: ConnectionSettingsErrorCode
      message: string
    }

export function buildDefaultConnectionSettingsEditable(): ConnectionSettingsEditable {
  return {
    serverUrl: DEFAULT_CONNECTION_SERVER_URL,
    token: '',
    customResourceBaseUrl: '',
    customResourcePath: '',
    customResourceToken: '',
  }
}

export function normalizeConnectionSettingsEditable(
  value: Partial<ConnectionSettingsEditable> | null | undefined,
): ConnectionSettingsEditable {
  const defaults = buildDefaultConnectionSettingsEditable()
  const source = value || {}

  return {
    serverUrl: typeof source.serverUrl === 'string' && source.serverUrl.trim()
      ? source.serverUrl.trim()
      : defaults.serverUrl,
    token: typeof source.token === 'string'
      ? source.token.trim()
      : defaults.token,
    customResourceBaseUrl: typeof source.customResourceBaseUrl === 'string'
      ? source.customResourceBaseUrl.trim()
      : defaults.customResourceBaseUrl,
    customResourcePath: typeof source.customResourcePath === 'string'
      ? source.customResourcePath.trim()
      : defaults.customResourcePath,
    customResourceToken: typeof source.customResourceToken === 'string'
      ? source.customResourceToken.trim()
      : defaults.customResourceToken,
  }
}

