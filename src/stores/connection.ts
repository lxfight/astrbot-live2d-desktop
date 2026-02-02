import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConnectionStore = defineStore('connection', () => {
  const isConnected = ref(false)
  const sessionId = ref('')
  const userId = ref('')
  const serverUrl = ref('ws://127.0.0.1:9090/astrbot/live2d')
  const token = ref('')

  // 连接到服务器
  async function connect(url?: string, authToken?: string) {
    try {
      const targetUrl = url || serverUrl.value
      const result = await window.electron.bridge.connect(targetUrl, authToken || token.value)

      if (result.success) {
        serverUrl.value = targetUrl
        if (authToken) token.value = authToken
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

  return {
    isConnected,
    sessionId,
    userId,
    serverUrl,
    token,
    connect,
    disconnect,
    checkConnection,
    sendMessage
  }
})
