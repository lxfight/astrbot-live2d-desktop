import { defineStore } from 'pinia'
import { ref } from 'vue'

const DEFAULT_SERVER_URL = 'ws://127.0.0.1:9090/astrbot/live2d'
const CONNECTION_SETTINGS_KEY = 'connectionSettings'

function loadConnectionSettings(): { serverUrl: string; token: string } {
  try {
    const raw = localStorage.getItem(CONNECTION_SETTINGS_KEY)
    if (!raw) {
      return {
        serverUrl: DEFAULT_SERVER_URL,
        token: ''
      }
    }

    const parsed = JSON.parse(raw) as { serverUrl?: unknown; token?: unknown }
    const serverUrl = typeof parsed.serverUrl === 'string' && parsed.serverUrl.trim()
      ? parsed.serverUrl.trim()
      : DEFAULT_SERVER_URL
    const token = typeof parsed.token === 'string'
      ? parsed.token.trim()
      : ''

    return { serverUrl, token }
  } catch (error) {
    console.warn('[ConnectionStore] 读取连接配置失败，使用默认值:', error)
    return {
      serverUrl: DEFAULT_SERVER_URL,
      token: ''
    }
  }
}

function saveConnectionSettings(serverUrl: string, token: string) {
  try {
    localStorage.setItem(
      CONNECTION_SETTINGS_KEY,
      JSON.stringify({ serverUrl, token })
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
  const serverUrl = ref(initialSettings.serverUrl)
  const token = ref(initialSettings.token)

  function setConnectionConfig(url: string, authToken: string) {
    const normalizedUrl = (url || '').trim() || DEFAULT_SERVER_URL
    const normalizedToken = (authToken || '').trim()
    serverUrl.value = normalizedUrl
    token.value = normalizedToken
    saveConnectionSettings(normalizedUrl, normalizedToken)
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
      isConnected.value = false
      sessionId.value = ''
      userId.value = ''
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
      if (session) {
        sessionId.value = session.sessionId || ''
        userId.value = session.userId || ''
      }
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
    serverUrl,
    token,
    setConnectionConfig,
    connect,
    disconnect,
    checkConnection,
    sendMessage,
    sendState
  }
})
