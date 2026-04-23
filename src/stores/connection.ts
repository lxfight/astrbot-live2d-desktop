import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { InputMessagePayload, MessageContent } from '@/types/protocol'
import { LOCAL_STORAGE_METADATA } from '@/shared/metadata'
import {
  buildDefaultBridgeLifecycleSnapshot,
  type BridgeLifecycleSnapshot,
} from '@/shared/bridgeLifecycle'
import {
  buildDefaultConnectionSettingsEditable,
  normalizeConnectionSettingsEditable,
  type ConnectionSettingsEditable,
  type ConnectionSettingsPersistedV3,
} from '@/shared/connectionSettings'
import { deriveHttpBaseUrlFromWsUrl } from '@/utils/urlNormalize'
import { ADVANCED_SETTINGS_KEY } from '@/utils/advancedSettings'

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

function buildDefaultPersistedSettings(): ConnectionSettingsPersistedV3 {
  const defaults = buildDefaultConnectionSettingsEditable()
  return {
    ...defaults,
    revision: 0,
    updatedAt: Date.now(),
  }
}

export const useConnectionStore = defineStore('connection', () => {
  const persistedSettings = ref<ConnectionSettingsPersistedV3>(buildDefaultPersistedSettings())
  const lifecycleSnapshot = ref<BridgeLifecycleSnapshot>(buildDefaultBridgeLifecycleSnapshot())

  let initialized = false
  let initializePromise: Promise<void> | null = null
  let syncBound = false
  let lifecycleSnapshotHydrated = false
  let settingsDisposer: Unsubscribe | null = null
  let lifecycleDisposer: Unsubscribe | null = null

  const serverUrl = computed(() => persistedSettings.value.serverUrl)
  const token = computed(() => persistedSettings.value.token)
  const customResourceBaseUrl = computed(() => persistedSettings.value.customResourceBaseUrl)
  const customResourcePath = computed(() => persistedSettings.value.customResourcePath)
  const customResourceToken = computed(() => persistedSettings.value.customResourceToken)
  const persistedRevision = computed(() => persistedSettings.value.revision)
  const persistedUpdatedAt = computed(() => persistedSettings.value.updatedAt)

  const lifecycleStatus = computed(() => lifecycleSnapshot.value.status)
  const desiredState = computed(() => lifecycleSnapshot.value.desiredState)
  const isConnected = computed(() => lifecycleSnapshot.value.status === 'connected')
  const sessionId = computed(() => lifecycleSnapshot.value.session?.sessionId || '')
  const userId = computed(() => lifecycleSnapshot.value.session?.userId || '')
  const maxInlineBytes = computed(() => {
    const value = lifecycleSnapshot.value.session?.config?.maxInlineBytes
    return typeof value === 'number' ? value : null
  })
  const nextRetryAt = computed(() => lifecycleSnapshot.value.nextRetryAt)
  const reconnectAttempt = computed(() => lifecycleSnapshot.value.reconnectAttempt)
  const lastError = computed(() => lifecycleSnapshot.value.lastError)

  const resourceBaseUrl = computed(() => {
    const overrideValue = persistedSettings.value.customResourceBaseUrl.trim()
    if (overrideValue) {
      return overrideValue
    }

    const sessionValue = lifecycleSnapshot.value.session?.config?.resourceBaseUrl?.trim() || ''
    if (sessionValue) {
      return sessionValue
    }

    return deriveHttpBaseUrlFromWsUrl(persistedSettings.value.serverUrl)
  })

  const resourcePath = computed(() => {
    const overrideValue = persistedSettings.value.customResourcePath.trim()
    if (overrideValue) {
      return overrideValue
    }

    const sessionValue = lifecycleSnapshot.value.session?.config?.resourcePath?.trim() || ''
    return sessionValue || DEFAULT_RESOURCE_PATH
  })

  const resourceToken = computed(() => {
    const overrideValue = persistedSettings.value.customResourceToken.trim()
    if (overrideValue) {
      return overrideValue
    }

    return persistedSettings.value.token.trim()
  })

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

    persistedSettings.value = {
      ...editable,
      revision: settings.revision,
      updatedAt: settings.updatedAt,
    }
  }

  function applyLifecycleSnapshot(snapshot: BridgeLifecycleSnapshot | null | undefined) {
    if (!snapshot) {
      return
    }

    if (lifecycleSnapshotHydrated && snapshot.updatedAt < lifecycleSnapshot.value.updatedAt) {
      return
    }

    lifecycleSnapshot.value = snapshot
    lifecycleSnapshotHydrated = true
  }

  async function migrateLegacyConnectionSettingsIfNeeded() {
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

  async function migrateLegacyBehaviorSettingsIfNeeded() {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const legacyRaw = localStorage.getItem(ADVANCED_SETTINGS_KEY) || ''
      const migrateResult = await window.electron.connectionBehaviorSettings.migrateLegacy(legacyRaw)
      if (!migrateResult.success) {
        console.warn('[ConnectionStore] 迁移旧连接行为配置失败:', migrateResult.code, migrateResult.message)
      }
    } catch (error) {
      console.warn('[ConnectionStore] 迁移旧连接行为配置异常:', error)
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

  async function refreshLifecycleSnapshot() {
    const snapshot = await window.electron.bridgeLifecycle.getSnapshot()
    applyLifecycleSnapshot(snapshot)
    return snapshot
  }

  function startSync() {
    if (
      syncBound
      || typeof window === 'undefined'
      || !window.electron?.connectionSettings
      || !window.electron?.bridgeLifecycle
    ) {
      return
    }

    settingsDisposer = window.electron.connectionSettings.onChanged((event) => {
      if (!event?.settings) {
        return
      }
      applyPersistedSettings(event.settings)
    })

    lifecycleDisposer = window.electron.bridgeLifecycle.onStateChanged((snapshot) => {
      applyLifecycleSnapshot(snapshot)
    })

    syncBound = true
  }

  function stopSync() {
    if (!syncBound) {
      return
    }

    settingsDisposer?.()
    lifecycleDisposer?.()
    settingsDisposer = null
    lifecycleDisposer = null
    syncBound = false
  }

  async function ensureInitialized() {
    if (initialized) {
      return
    }

    if (initializePromise) {
      return initializePromise
    }

    initializePromise = (async () => {
      startSync()
      await migrateLegacyConnectionSettingsIfNeeded()
      await migrateLegacyBehaviorSettingsIfNeeded()
      await Promise.all([
        reloadPersistedSettings(),
        refreshLifecycleSnapshot(),
      ])
      initialized = true
    })().finally(() => {
      initializePromise = null
    })

    return initializePromise
  }

  async function sendMessage(content: MessageContent[], metadata: InputMessagePayload['metadata']) {
    return await window.electron.bridge.sendMessage({ content, metadata })
  }

  async function sendState(op: string, payload: unknown) {
    return await window.electron.bridge.sendState(op, payload)
  }

  return {
    customResourceBaseUrl,
    customResourcePath,
    customResourceToken,
    desiredState,
    ensureInitialized,
    isConnected,
    lastError,
    lifecycleSnapshot,
    lifecycleStatus,
    maxInlineBytes,
    nextRetryAt,
    persistedRevision,
    persistedSettings,
    persistedUpdatedAt,
    reconnectAttempt,
    refreshLifecycleSnapshot,
    reloadPersistedSettings,
    resourceBaseUrl,
    resourcePath,
    resourceToken,
    sendMessage,
    sendState,
    serverUrl,
    sessionId,
    startSync,
    stopSync,
    token,
    userId,
  }
})
