import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
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
        return '正在建立连接'
      case 'handshaking':
        return '正在握手'
      case 'connected':
        return '在线'
      case 'waiting_retry':
        return connectionStore.nextRetryAt
          ? `等待重试（第 ${connectionStore.reconnectAttempt} 次）`
          : '等待重试'
      case 'suspended':
        return '系统挂起中'
      case 'error':
        return connectionStore.lastError?.message || '连接失败'
      default:
        return '离线'
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
      { label: '连接状态', value: connectionStatusText.value },
      { label: '期望状态', value: connectionStore.desiredState === 'connected' ? '保持连接' : '保持断开' },
      { label: '用户 ID', value: userId.value || '尚未分配' },
      { label: '会话 ID', value: sessionId.value || '尚未建立' },
      { label: '资源地址', value: resourceBaseUrl.value || '自动跟随' },
      { label: '资源路径', value: resourcePath.value || '/resources' },
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
      throw error instanceof Error ? error : new Error('连接配置初始化失败')
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
        error: '连接配置已被其他窗口更新，当前表单已刷新为最新值，请确认后重试保存',
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
        message.success('连接配置已保存')
        return
      }

      message.error(`保存失败: ${saveResult.error}`)
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
      message.error(`连接失败: ${saveResult.error}`)
      return
    }

    const result = await window.electron.bridgeLifecycle.connect()
    if (result.success) {
      message.success('连接请求已提交')
      await connectionStore.refreshLifecycleSnapshot()
      return
    }

    message.error(`连接失败: ${result.message}`)
  }

  async function handleDisconnect() {
    const result = await window.electron.bridgeLifecycle.disconnect()
    if (result.success) {
      message.success('已断开连接')
      await connectionStore.refreshLifecycleSnapshot()
      return
    }

    message.error(`断开失败: ${result.message}`)
  }

  async function handleExternalSettingsChanged() {
    await connectionStore.reloadPersistedSettings()
    if (hasUnsavedConnectionSettings.value) {
      message.warning('检测到其他窗口更新了连接配置，请先保存或放弃当前修改后再同步')
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
      throw new Error(`连接配置重置失败: ${result.error}`)
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
