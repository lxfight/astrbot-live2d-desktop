import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@/stores/connection'
import {
  buildDefaultConnectionSettingsEditable,
  normalizeConnectionSettingsEditable,
  type ConnectionSettingsEditable,
} from '@/shared/connectionSettings'
import { validateBridgeEndpointDraft } from '@/shared/bridgeConnectionValidation'

export interface ConnectionSettingsDomain {
  canConnect: ComputedRef<boolean>
  canDisconnect: ComputedRef<boolean>
  connectionStatusText: ComputedRef<string>
  ensureReady: (force?: boolean) => Promise<void>
  handleConnect: () => Promise<void>
  handleDisconnect: () => Promise<void>
  handleExternalSettingsChanged: () => Promise<void>
  handleSaveConnectionSettings: () => Promise<void>
  hasUnsavedConnectionSettings: ComputedRef<boolean>
  isConnected: ComputedRef<boolean>
  refreshConnectionState: (force?: boolean) => Promise<void>
  resetToDefaults: () => Promise<void>
  resourceBaseUrl: ComputedRef<string>
  resourcePath: ComputedRef<string>
  resourceServerPath: Ref<string>
  resourceServerUrl: Ref<string>
  resourceAccessToken: Ref<string>
  savingConnectionSettings: Ref<boolean>
  serverUrl: Ref<string>
  sessionId: ComputedRef<string>
  status: Ref<'idle' | 'loading' | 'ready' | 'error'>
  token: Ref<string>
  userId: ComputedRef<string>
  workspaceRows: ComputedRef<Array<{ label: string; value: string }>>
}

export const connectionSettingsDomainKey: InjectionKey<ConnectionSettingsDomain> = Symbol('connection-settings-domain')

export function useConnectionSettingsDomain() {
  const domain = inject(connectionSettingsDomainKey)
  if (!domain) {
    throw new Error('ConnectionSettingsDomain 未注入')
  }

  return domain
}

type MessageApi = ReturnType<typeof useMessage>

function isSameEditableSettings(a: ConnectionSettingsEditable, b: ConnectionSettingsEditable): boolean {
  return a.serverUrl === b.serverUrl
    && a.token === b.token
    && a.customResourceBaseUrl === b.customResourceBaseUrl
    && a.customResourcePath === b.customResourcePath
    && a.customResourceToken === b.customResourceToken
}

export function createConnectionSettingsDomain(message: MessageApi): ConnectionSettingsDomain {
  const { t } = useI18n()
  const connectionStore = useConnectionStore()

  const serverUrl = ref('')
  const token = ref('')
  const resourceServerUrl = ref('')
  const resourceServerPath = ref('')
  const resourceAccessToken = ref('')
  const draftInitialized = ref(false)

  const savingConnectionSettings = ref(false)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const resourceBaseUrl = computed(() => connectionStore.resourceBaseUrl)
  const resourcePath = computed(() => connectionStore.resourcePath)
  const isConnected = computed(() => connectionStore.isConnected)
  const sessionId = computed(() => connectionStore.sessionId)
  const userId = computed(() => connectionStore.userId)

  const hasUnsavedConnectionSettings = computed(() => {
    if (!draftInitialized.value) {
      return false
    }

    return !isSameEditableSettings(collectEditableSettings(), normalizeConnectionSettingsEditable(connectionStore.persistedSettings))
  })

  const connectionStatusText = computed(() => {
    switch (connectionStore.lifecycleStatus) {
      case 'connecting':
        return t('settings.connection.status.connecting')
      case 'handshaking':
        return t('settings.connection.status.handshaking')
      case 'connected':
        return t('settings.connection.status.online')
      case 'waiting_retry':
        return connectionStore.nextRetryAt
          ? t('settings.connection.status.waitingRetry', { attempt: connectionStore.reconnectAttempt })
          : t('settings.connection.status.waiting')
      case 'suspended':
        return t('settings.connection.status.suspended')
      case 'error':
        return connectionStore.lastError?.message || t('settings.connection.status.connectionFailed')
      default:
        return t('settings.connection.status.offline')
    }
  })

  const canConnect = computed(() => {
    return connectionStore.lifecycleStatus !== 'connecting'
      && connectionStore.lifecycleStatus !== 'handshaking'
      && connectionStore.lifecycleStatus !== 'connected'
  })

  const canDisconnect = computed(() => {
    return connectionStore.lifecycleStatus !== 'idle' || connectionStore.desiredState === 'connected'
  })

  const workspaceRows = computed(() => {
    return [
      { label: t('settings.connection.workspace.connectionStatus'), value: connectionStatusText.value },
      { label: t('settings.connection.workspace.desiredState'), value: connectionStore.desiredState === 'connected' ? t('settings.connection.workspace.keepConnected') : t('settings.connection.workspace.keepDisconnected') },
      { label: t('settings.connection.workspace.userId'), value: userId.value || t('settings.connection.workspace.notAssigned') },
      { label: t('settings.connection.workspace.sessionId'), value: sessionId.value || t('settings.connection.workspace.notEstablished') },
      { label: t('settings.connection.workspace.resourceBaseUrl'), value: resourceBaseUrl.value || t('settings.connection.workspace.autoFollow') },
      { label: t('settings.connection.workspace.resourcePath'), value: resourcePath.value || '/resources' },
    ]
  })

  function collectEditableSettings(): ConnectionSettingsEditable {
    return normalizeConnectionSettingsEditable({
      serverUrl: serverUrl.value,
      token: token.value,
      customResourceBaseUrl: resourceServerUrl.value,
      customResourcePath: resourceServerPath.value,
      customResourceToken: resourceAccessToken.value,
    })
  }

  function syncDraftFromStore() {
    const persisted = connectionStore.persistedSettings
    serverUrl.value = persisted.serverUrl
    token.value = persisted.token
    resourceServerUrl.value = persisted.customResourceBaseUrl
    resourceServerPath.value = persisted.customResourcePath
    resourceAccessToken.value = persisted.customResourceToken
    draftInitialized.value = true
  }

  async function ensureReady(force = false) {
    if (status.value === 'ready' && !force) {
      return
    }

    status.value = 'loading'

    try {
      await connectionStore.ensureInitialized()
      if (force) {
        await Promise.all([
          connectionStore.reloadPersistedSettings(),
          connectionStore.refreshLifecycleSnapshot(),
        ])
      }
      if (force || !hasUnsavedConnectionSettings.value) {
        syncDraftFromStore()
      }
      status.value = 'ready'
    } catch (error) {
      status.value = 'error'
      throw error instanceof Error ? error : new Error(t('settings.connection.initFailed'))
    }
  }

  async function refreshConnectionState(force = false) {
    await ensureReady(force)
    if (!force) {
      await connectionStore.refreshLifecycleSnapshot()
    }
  }

  async function persistDraft() {
    const result = await window.electron.connectionSettings.save({
      data: collectEditableSettings(),
      expectedRevision: connectionStore.persistedRevision,
    })

    if (result.success) {
      await connectionStore.reloadPersistedSettings()
      syncDraftFromStore()
      return { success: true as const }
    }

    if (result.code === 'CONFLICT_REVISION') {
      await connectionStore.reloadPersistedSettings()
      syncDraftFromStore()
      return {
        success: false as const,
        error: t('settings.connection.settingsStaleWarning'),
      }
    }

    return {
      success: false as const,
      error: result.message,
    }
  }

  async function handleSaveConnectionSettings() {
    if (savingConnectionSettings.value) {
      return
    }

    savingConnectionSettings.value = true
    try {
      const saveResult = await persistDraft()
      if (saveResult.success) {
        message.success(t('toast.connectionSaved'))
        return
      }

      message.error(t('toast.connectionSaveFailed', { error: saveResult.error }))
    } finally {
      savingConnectionSettings.value = false
    }
  }

  async function handleConnect() {
    const draft = collectEditableSettings()
    const validationResult = validateBridgeEndpointDraft({
      serverUrl: draft.serverUrl,
      token: draft.token,
    })

    if (!validationResult.valid) {
      message.error(validationResult.message)
      return
    }

    const saveResult = await persistDraft()
    if (!saveResult.success) {
      message.error(t('toast.connectFailed', { error: saveResult.error }))
      return
    }

    const result = await window.electron.bridgeLifecycle.connect()
    if (result.success) {
      message.success(t('toast.connectRequested'))
      await connectionStore.refreshLifecycleSnapshot()
      return
    }

    message.error(t('toast.connectFailed', { error: result.message }))
  }

  async function handleDisconnect() {
    const result = await window.electron.bridgeLifecycle.disconnect()
    if (result.success) {
      message.success(t('toast.disconnected'))
      await connectionStore.refreshLifecycleSnapshot()
      return
    }

    message.error(t('toast.disconnectFailed', { error: result.message }))
  }

  async function handleExternalSettingsChanged() {
    await connectionStore.reloadPersistedSettings()
    if (hasUnsavedConnectionSettings.value) {
      message.warning(t('settings.connection.settingsStaleWarning'))
      return
    }

    syncDraftFromStore()
  }

  async function resetToDefaults() {
    const defaults = buildDefaultConnectionSettingsEditable()
    serverUrl.value = defaults.serverUrl
    token.value = defaults.token
    resourceServerUrl.value = defaults.customResourceBaseUrl
    resourceServerPath.value = defaults.customResourcePath
    resourceAccessToken.value = defaults.customResourceToken

    const result = await persistDraft()
    if (!result.success) {
      throw new Error(t('settings.connection.resetFailed', { error: result.error }))
    }

    await refreshConnectionState(true)
  }

  return {
    canConnect,
    canDisconnect,
    connectionStatusText,
    ensureReady,
    handleConnect,
    handleDisconnect,
    handleExternalSettingsChanged,
    handleSaveConnectionSettings,
    hasUnsavedConnectionSettings,
    isConnected,
    refreshConnectionState,
    resetToDefaults,
    resourceAccessToken,
    resourceBaseUrl,
    resourcePath,
    resourceServerPath,
    resourceServerUrl,
    savingConnectionSettings,
    serverUrl,
    sessionId,
    status,
    token,
    userId,
    workspaceRows,
  }
}
