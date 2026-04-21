import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'
import { useConnectionStore } from '@/stores/connection'
import { buildDefaultConnectionSettingsEditable } from '@/shared/connectionSettings'

export interface ConnectionSettingsDomain {
  ensureReady: (force?: boolean) => Promise<void>
  handleConnect: () => Promise<void>
  handleDisconnect: () => Promise<void>
  handleSaveConnectionSettings: () => Promise<void>
  hasUnsavedConnectionSettings: Ref<boolean>
  isConnected: Ref<boolean>
  refreshConnectionState: (force?: boolean) => Promise<void>
  resetToDefaults: () => Promise<void>
  resourceBaseUrl: Ref<string>
  resourcePath: Ref<string>
  resourceServerPath: Ref<string>
  resourceServerUrl: Ref<string>
  resourceAccessToken: Ref<string>
  savingConnectionSettings: Ref<boolean>
  serverUrl: Ref<string>
  sessionId: Ref<string>
  status: Ref<'idle' | 'loading' | 'ready' | 'error'>
  token: Ref<string>
  userId: Ref<string>
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

export function createConnectionSettingsDomain(message: MessageApi): ConnectionSettingsDomain {
  const connectionStore = useConnectionStore()
  const {
    customResourceBaseUrl: resourceServerUrl,
    customResourcePath: resourceServerPath,
    customResourceToken: resourceAccessToken,
    hasUnsavedChanges: hasUnsavedConnectionSettings,
    isConnected,
    resourceBaseUrl,
    resourcePath,
    serverUrl,
    sessionId,
    token,
    userId,
  } = storeToRefs(connectionStore)

  const savingConnectionSettings = ref(false)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const workspaceRows = computed(() => {
    return [
      { label: '连接状态', value: isConnected.value ? '在线' : '离线' },
      { label: '用户 ID', value: userId.value || '尚未分配' },
      { label: '会话 ID', value: sessionId.value || '尚未建立' },
      { label: '资源地址', value: resourceBaseUrl.value || '自动跟随' },
      { label: '资源路径', value: resourcePath.value || '/resources' },
    ]
  })

  async function ensureReady(force = false) {
    if (status.value === 'ready' && !force) {
      return
    }

    status.value = 'loading'

    try {
      await connectionStore.ensureInitialized()
      if (force) {
        await connectionStore.reloadPersistedSettings()
      }
      status.value = 'ready'
    } catch {
      status.value = 'error'
      throw new Error('连接配置初始化失败')
    }
  }

  async function refreshConnectionState(force = false) {
    await ensureReady(force)
    await connectionStore.checkConnection()
  }

  async function handleSaveConnectionSettings() {
    if (savingConnectionSettings.value) {
      return
    }

    savingConnectionSettings.value = true

    try {
      const saveResult = await connectionStore.savePersistedSettings()
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
    const targetUrl = serverUrl.value.trim()
    const authToken = token.value.trim()

    if (!authToken) {
      message.error('请先填写认证密钥')
      return
    }

    if (authToken.length < 16) {
      message.error('认证密钥长度至少 16 位')
      return
    }

    serverUrl.value = targetUrl
    token.value = authToken
    resourceServerUrl.value = resourceServerUrl.value.trim()
    resourceServerPath.value = resourceServerPath.value.trim()
    resourceAccessToken.value = resourceAccessToken.value.trim()

    const result = await connectionStore.connect(targetUrl, authToken)
    if (result.success) {
      message.success('连接成功')
      return
    }

    message.error(`连接失败: ${result.error}`)
  }

  async function handleDisconnect() {
    const result = await connectionStore.disconnect()
    if (result.success) {
      message.success('已断开连接')
      return
    }

    message.error(`断开失败: ${result.error}`)
  }

  async function resetToDefaults() {
    const defaults = buildDefaultConnectionSettingsEditable()
    serverUrl.value = defaults.serverUrl
    token.value = defaults.token
    resourceServerUrl.value = defaults.customResourceBaseUrl
    resourceServerPath.value = defaults.customResourcePath
    resourceAccessToken.value = defaults.customResourceToken

    const result = await connectionStore.savePersistedSettings()
    if (!result.success) {
      throw new Error(`连接配置重置失败: ${result.error}`)
    }

    await refreshConnectionState()
  }

  return {
    ensureReady,
    handleConnect,
    handleDisconnect,
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
