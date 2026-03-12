import { defineStore } from 'pinia'
import { ref } from 'vue'

const DEFAULT_SERVER_URL = 'ws://127.0.0.1:9090/astrbot/live2d'
const CONNECTION_SETTINGS_KEY = 'connectionSettings'

function loadConnectionSettings(): { serverUrl: string; token: string; resourceBaseUrl: string; resourcePath: string } {
  try {
    const raw = localStorage.getItem(CONNECTION_SETTINGS_KEY)
    if (!raw) {
      return {
        serverUrl: DEFAULT_SERVER_URL,
        token: '',
        resourceBaseUrl: '',
        resourcePath: '/resources'
      }
    }

    const parsed = JSON.parse(raw) as {
      serverUrl?: unknown
      token?: unknown
      resourceBaseUrl?: unknown
      resourcePath?: unknown
    }
    const serverUrl = typeof parsed.serverUrl === 'string' && parsed.serverUrl.trim()
      ? parsed.serverUrl.trim()
      : DEFAULT_SERVER_URL
    const token = typeof parsed.token === 'string'
      ? parsed.token.trim()
      : ''
    const resourceBaseUrl = typeof parsed.resourceBaseUrl === 'string'
      ? parsed.resourceBaseUrl.trim()
      : ''
    const resourcePath = typeof parsed.resourcePath === 'string' && parsed.resourcePath.trim()
      ? parsed.resourcePath.trim()
      : '/resources'

    return { serverUrl, token, resourceBaseUrl, resourcePath }
  } catch (error) {
    console.warn('[ConnectionStore] 读取连接配置失败，使用默认值:', error)
    return {
      serverUrl: DEFAULT_SERVER_URL,
      token: '',
      resourceBaseUrl: '',
      resourcePath: '/resources'
    }
  }
}

function saveConnectionSettings(serverUrl: string, token: string, resourceBaseUrl: string, resourcePath: string) {
  try {
    localStorage.setItem(
      CONNECTION_SETTINGS_KEY,
      JSON.stringify({ serverUrl, token, resourceBaseUrl, resourcePath })
    )
  } catch (error) {
    console.warn('[ConnectionStore] 保存连接配置失败:', error)
  }
}

export const useConnectionStore = defineStore('connection', () => {
  const initialSettings = loadConnectionSettings()
  const isConnected = ref(false)
  const sessionId = ref('')
  const userId = ref('')
  const resourceBaseUrl = ref(initialSettings.resourceBaseUrl)
  const resourcePath = ref(initialSettings.resourcePath)
  const maxInlineBytes = ref<number | null>(null)
  const serverUrl = ref(initialSettings.serverUrl)
  const token = ref(initialSettings.token)

  function applySessionState(session: BridgeSessionState | null | undefined) {
    sessionId.value = session?.sessionId || ''
    userId.value = session?.userId || ''
    if (session?.config?.resourceBaseUrl) {
      resourceBaseUrl.value = session.config.resourceBaseUrl
    }
    if (session?.config?.resourcePath) {
      resourcePath.value = session.config.resourcePath
    }
    maxInlineBytes.value = typeof session?.config?.maxInlineBytes === 'number'
      ? session.config.maxInlineBytes
      : null
    saveConnectionSettings(serverUrl.value, token.value, resourceBaseUrl.value, resourcePath.value)
  }

  function resetSessionState() {
    isConnected.value = false
    sessionId.value = ''
    userId.value = ''
    maxInlineBytes.value = null
  }

  function setConnectionConfig(url: string, authToken: string) {
    const normalizedUrl = (url || '').trim() || DEFAULT_SERVER_URL
    const normalizedToken = (authToken || '').trim()
    serverUrl.value = normalizedUrl
    token.value = normalizedToken
    saveConnectionSettings(normalizedUrl, normalizedToken, resourceBaseUrl.value, resourcePath.value)
  }

  // 连接到服务器
  async function connect(url?: string, authToken?: string) {
    try {
      const targetUrl = (url || serverUrl.value || '').trim()
      const normalizedToken = (authToken ?? token.value ?? '').trim()

      if (!targetUrl) {
        return { success: false, error: '服务器地址不能为空' }
      }
      if (!/^wss?:\/\//i.test(targetUrl)) {
        return { success: false, error: '服务器地址必须以 ws:// 或 wss:// 开头' }
      }
      if (!normalizedToken) {
        return { success: false, error: '认证密钥不能为空，请在设置中填写后再连接' }
      }
      if (normalizedToken.length < 16) {
        return { success: false, error: '认证密钥长度至少 16 位' }
      }

      setConnectionConfig(targetUrl, normalizedToken)
      const result = await window.electron.bridge.connect(targetUrl, normalizedToken)

      if (result.success) {
        isConnected.value = true
        const session = await window.electron.bridge.getSession()
        applySessionState(session)
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // 断开连接
  async function disconnect() {
    try {
      await window.electron.bridge.disconnect()
      resetSessionState()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // 检查连接状态
  async function checkConnection() {
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

  // 发送消息
  async function sendMessage(content: any[], metadata: any) {
    return await window.electron.bridge.sendMessage({ content, metadata })
  }

  // 发送状态
  async function sendState(op: string, payload: any) {
    return await window.electron.bridge.sendState(op, payload)
  }

  return {
    isConnected,
    sessionId,
    userId,
    resourceBaseUrl,
    resourcePath,
    maxInlineBytes,
    serverUrl,
    token,
    applySessionState,
    resetSessionState,
    setConnectionConfig,
    connect,
    disconnect,
    checkConnection,
    sendMessage,
    sendState
  }
})
