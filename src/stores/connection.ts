import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { InputMessagePayload, MessageContent } from '@/types/protocol'
import { LOCAL_STORAGE_METADATA } from '@/shared/metadata'
import {
  buildDefaultConnectionSettingsEditable,
  normalizeConnectionSettingsEditable,
  type ConnectionSettingsEditable,
  type ConnectionSettingsPersistedV3,
} from '@/shared/connectionSettings'
import { deriveHttpBaseUrlFromWsUrl } from '@/utils/urlNormalize'

const DEFAULT_RESOURCE_PATH = '/resources'
const LEGACY_CONNECTION_SETTINGS_KEY = LOCAL_STORAGE_METADATA.connectionSettings.key

function readEnvString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildRendererPreferredDefaults(): ConnectionSettingsEditable {
  const defaults = buildDefaultConnectionSettingsEditable()
  const envServerUrl = readEnvString(import.meta.env?.VITE_DEFAULT_SERVER_URL)
  const envToken = readEnvString(import.meta.env?.VITE_DEFAULT_TOKEN)

  if (envServerUrl) {
    defaults.serverUrl = envServerUrl
  }
  if (envToken) {
    defaults.token = envToken
  }

  return defaults
}

function getBridgeUrlValidationError(rawUrl: string): string | null {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return '服务器地址格式无效，请填写完整的 WebSocket 地址'
  }

  if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') {
    return '服务器地址必须使用 ws 或 wss 协议'
  }

  return null
}

function buildDefaultPersistedSettings(): ConnectionSettingsPersistedV3 {
  const defaults = buildDefaultConnectionSettingsEditable()
  return {
    ...defaults,
    revision: 0,
    updatedAt: Date.now(),
  }
}

function toPersistPayload(data: ConnectionSettingsEditable, expectedRevision: number) {
  return {
    data: normalizeConnectionSettingsEditable(data),
    expectedRevision,
  }
}

function isSameEditableSettings(a: ConnectionSettingsEditable, b: ConnectionSettingsEditable): boolean {
  return a.serverUrl === b.serverUrl
    && a.token === b.token
    && a.customResourceBaseUrl === b.customResourceBaseUrl
    && a.customResourcePath === b.customResourcePath
    && a.customResourceToken === b.customResourceToken
}

export const useConnectionStore = defineStore('connection', () => {
  const defaults = buildRendererPreferredDefaults()

  const isConnected = ref(false)
  const sessionId = ref('')
  const userId = ref('')
  const sessionResourceBaseUrl = ref('')
  const sessionResourcePath = ref('')
  const maxInlineBytes = ref<number | null>(null)

  const serverUrl = ref(defaults.serverUrl)
  const token = ref(defaults.token)
  const customResourceBaseUrl = ref(defaults.customResourceBaseUrl)
  const customResourcePath = ref(defaults.customResourcePath)
  const customResourceToken = ref(defaults.customResourceToken)
  const persistedSnapshot = ref<ConnectionSettingsEditable>(normalizeConnectionSettingsEditable(defaults))

  const persistedRevision = ref(0)
  const persistedUpdatedAt = ref(0)

  let initialized = false
  let initializePromise: Promise<void> | null = null
  let settingsSyncBound = false
  let settingsSyncDisposer: Unsubscribe | null = null

  const resourceBaseUrl = computed(() => {
    const overrideValue = customResourceBaseUrl.value.trim()
    if (overrideValue) {
      return overrideValue
    }

    const sessionValue = sessionResourceBaseUrl.value.trim()
    if (sessionValue) {
      return sessionValue
    }

    return deriveHttpBaseUrlFromWsUrl(serverUrl.value)
  })

  const resourcePath = computed(() => {
    const overrideValue = customResourcePath.value.trim()
    if (overrideValue) {
      return overrideValue
    }

    const sessionValue = sessionResourcePath.value.trim()
    return sessionValue || DEFAULT_RESOURCE_PATH
  })

  const resourceToken = computed(() => {
    const overrideValue = customResourceToken.value.trim()
    if (overrideValue) {
      return overrideValue
    }

    return token.value.trim()
  })

  const hasUnsavedChanges = computed(() => {
    return !isSameEditableSettings(collectEditableSettings(), persistedSnapshot.value)
  })

  function collectEditableSettings(): ConnectionSettingsEditable {
    return normalizeConnectionSettingsEditable({
      serverUrl: serverUrl.value,
      token: token.value,
      customResourceBaseUrl: customResourceBaseUrl.value,
      customResourcePath: customResourcePath.value,
      customResourceToken: customResourceToken.value,
    })
  }

  function applyPersistedSettings(settings: ConnectionSettingsPersistedV3) {
    const baselineDefaults = buildDefaultConnectionSettingsEditable()
    const rendererDefaults = buildRendererPreferredDefaults()
    const baseEditable = normalizeConnectionSettingsEditable(settings)
    const editable = settings.revision === 0
      ? normalizeConnectionSettingsEditable({
          ...baseEditable,
          serverUrl: baseEditable.serverUrl === baselineDefaults.serverUrl
            ? rendererDefaults.serverUrl
            : baseEditable.serverUrl,
          token: baseEditable.token || rendererDefaults.token,
        })
      : baseEditable

    serverUrl.value = editable.serverUrl
    token.value = editable.token
    customResourceBaseUrl.value = editable.customResourceBaseUrl
    customResourcePath.value = editable.customResourcePath
    customResourceToken.value = editable.customResourceToken
    persistedSnapshot.value = editable
    persistedRevision.value = settings.revision
    persistedUpdatedAt.value = settings.updatedAt
  }

  async function migrateLegacySettingsIfNeeded() {
    if (typeof window === 'undefined') {
      return
    }

    const legacyRaw = localStorage.getItem(LEGACY_CONNECTION_SETTINGS_KEY)
    if (!legacyRaw) {
      return
    }

    try {
      const migrateResult = await window.electron.connectionSettings.migrateLegacy(legacyRaw)
      if (migrateResult.success) {
        localStorage.removeItem(LEGACY_CONNECTION_SETTINGS_KEY)
        applyPersistedSettings(migrateResult.data)
        return
      }

      console.warn('[ConnectionStore] 迁移旧连接配置失败:', migrateResult.code, migrateResult.message)
    } catch (error) {
      console.warn('[ConnectionStore] 迁移旧连接配置异常:', error)
    }
  }

  async function reloadPersistedSettings() {
    const loadResult = await window.electron.connectionSettings.load()
    if (loadResult.success) {
      applyPersistedSettings(loadResult.data)
      return { success: true as const }
    }

    console.warn('[ConnectionStore] 读取连接配置失败:', loadResult.code, loadResult.message)
    applyPersistedSettings(buildDefaultPersistedSettings())
    return { success: false as const, code: loadResult.code, error: loadResult.message }
  }

  async function ensureInitialized() {
    if (initialized) {
      return
    }

    if (initializePromise) {
      return initializePromise
    }

    initializePromise = (async () => {
      await migrateLegacySettingsIfNeeded()
      await reloadPersistedSettings()
      initialized = true
    })().finally(() => {
      initializePromise = null
    })

    return initializePromise
  }

  function applySessionState(session: BridgeSessionState | null | undefined) {
    sessionId.value = session?.sessionId || ''
    userId.value = session?.userId || ''

    if (session?.config?.resourceBaseUrl) {
      sessionResourceBaseUrl.value = session.config.resourceBaseUrl
    } else if (!session) {
      sessionResourceBaseUrl.value = ''
    }

    if (session?.config?.resourcePath) {
      sessionResourcePath.value = session.config.resourcePath
    } else if (!session) {
      sessionResourcePath.value = ''
    }

    maxInlineBytes.value = typeof session?.config?.maxInlineBytes === 'number'
      ? session.config.maxInlineBytes
      : null
  }

  function resetSessionState() {
    isConnected.value = false
    sessionId.value = ''
    userId.value = ''
    sessionResourceBaseUrl.value = ''
    sessionResourcePath.value = ''
    maxInlineBytes.value = null
  }

  function setConnectionConfig(url: string, authToken: string) {
    serverUrl.value = (url || '').trim() || defaults.serverUrl
    token.value = (authToken || '').trim()
  }

  function setResourceConfig(baseUrl: string, path: string, accessToken: string) {
    customResourceBaseUrl.value = (baseUrl || '').trim()
    customResourcePath.value = (path || '').trim()
    customResourceToken.value = (accessToken || '').trim()
  }

  async function savePersistedSettings() {
    await ensureInitialized()
    const saveResult = await window.electron.connectionSettings.save(
      toPersistPayload(collectEditableSettings(), persistedRevision.value),
    )

    if (saveResult.success) {
      applyPersistedSettings(saveResult.data)
      return { success: true as const }
    }

    if (saveResult.code === 'CONFLICT_REVISION') {
      await reloadPersistedSettings()
      return {
        success: false as const,
        code: saveResult.code,
        error: '连接配置已被其他窗口更新，当前表单已刷新为最新值，请确认后重试保存',
      }
    }

    return {
      success: false as const,
      code: saveResult.code,
      error: saveResult.message,
    }
  }

  async function connect(url?: string, authToken?: string) {
    await ensureInitialized()

    try {
      const targetUrl = (url || serverUrl.value || '').trim()
      const normalizedToken = (authToken ?? token.value ?? '').trim()

      if (!targetUrl) {
        return { success: false, error: '服务器地址不能为空' }
      }

      const urlValidationError = getBridgeUrlValidationError(targetUrl)
      if (urlValidationError) {
        return { success: false, error: urlValidationError }
      }

      if (!normalizedToken) {
        return { success: false, error: '认证密钥不能为空，请在设置中填写后再连接' }
      }
      if (normalizedToken.length < 16) {
        return { success: false, error: '认证密钥长度至少 16 位' }
      }

      setConnectionConfig(targetUrl, normalizedToken)
      const saveResult = await savePersistedSettings()
      if (!saveResult.success) {
        return { success: false, error: saveResult.error }
      }

      const result = await window.electron.bridge.connect(targetUrl, normalizedToken)
      if (result.success) {
        isConnected.value = true
        const session = await window.electron.bridge.getSession()
        applySessionState(session)
        return { success: true }
      }

      return { success: false, error: result.error }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async function disconnect() {
    try {
      await window.electron.bridge.disconnect()
      resetSessionState()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async function checkConnection() {
    await ensureInitialized()

    const connected = await window.electron.bridge.isConnected()
    isConnected.value = connected

    if (connected) {
      const session = await window.electron.bridge.getSession()
      applySessionState(session)
    } else {
      applySessionState(null)
    }

    return connected
  }

  function handleConnected(session: BridgeSessionState | null | undefined) {
    isConnected.value = true
    applySessionState(session)
  }

  function handleDisconnected() {
    resetSessionState()
  }

  function startStorageSync() {
    if (settingsSyncBound) {
      return
    }

    settingsSyncDisposer = window.electron.connectionSettings.onChanged((event) => {
      if (!event?.settings) {
        return
      }
      applyPersistedSettings(event.settings)
    })

    settingsSyncBound = true
  }

  function stopStorageSync() {
    if (!settingsSyncBound) {
      return
    }

    settingsSyncDisposer?.()
    settingsSyncDisposer = null
    settingsSyncBound = false
  }

  async function sendMessage(content: MessageContent[], metadata: InputMessagePayload['metadata']) {
    return await window.electron.bridge.sendMessage({ content, metadata })
  }

  async function sendState(op: string, payload: unknown) {
    return await window.electron.bridge.sendState(op, payload)
  }

  return {
    isConnected,
    sessionId,
    userId,
    resourceBaseUrl,
    resourcePath,
    resourceToken,
    maxInlineBytes,
    serverUrl,
    token,
    customResourceBaseUrl,
    customResourcePath,
    customResourceToken,
    hasUnsavedChanges,
    persistedRevision,
    persistedUpdatedAt,
    applySessionState,
    resetSessionState,
    setConnectionConfig,
    setResourceConfig,
    savePersistedSettings,
    reloadPersistedSettings,
    startStorageSync,
    stopStorageSync,
    handleConnected,
    handleDisconnected,
    connect,
    disconnect,
    checkConnection,
    sendMessage,
    sendState,
    ensureInitialized,
  }
})
