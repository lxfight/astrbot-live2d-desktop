import { ipcMain } from 'electron'
import { getBridgeClient } from '../main'
import type { InputMessagePayload } from '../protocol/types'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return String(error)
}

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase()
  return LOOPBACK_HOSTNAMES.has(normalizedHostname) || normalizedHostname.startsWith('127.')
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

  if (parsedUrl.protocol === 'ws:' && !isLoopbackHostname(parsedUrl.hostname)) {
    return '远程服务器请使用加密 WebSocket（wss），仅本机 localhost 或 127.0.0.1 允许使用非加密连接'
  }

  return null
}

function waitForBridgeReady(client: NonNullable<ReturnType<typeof getBridgeClient>>, timeoutMs: number = 8000): Promise<void> {
  if (client.isConnected()) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('连接已建立但握手未完成，请检查服务端状态与认证配置'))
    }, timeoutMs)

    const onConnected = () => {
      cleanup()
      resolve()
    }

    const onDisconnected = (info: any) => {
      cleanup()
      reject(new Error(`连接在握手阶段断开: ${info?.reason || info?.code || 'unknown'}`))
    }

    const onError = (error: unknown) => {
      cleanup()
      reject(new Error(toErrorMessage(error)))
    }

    const cleanup = () => {
      clearTimeout(timeout)
      client.off('connected', onConnected)
      client.off('disconnected', onDisconnected)
      client.off('error', onError)
    }

    client.on('connected', onConnected)
    client.on('disconnected', onDisconnected)
    client.on('error', onError)
  })
}

/**
 * 连接到服务器
 */
ipcMain.handle('bridge:connect', async (_event, url: string, token?: string) => {
  try {
    const client = getBridgeClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    const targetUrl = (url || '').trim()
    if (!targetUrl) {
      throw new Error('服务器地址不能为空')
    }

    const urlValidationError = getBridgeUrlValidationError(targetUrl)
    if (urlValidationError) {
      throw new Error(urlValidationError)
    }

    const authToken = (token || '').trim()
    if (!authToken) {
      throw new Error('认证密钥不能为空，请在设置中填写后再连接')
    }

    await client.connect(targetUrl, authToken)
    await waitForBridgeReady(client)
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 连接失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 断开连接
 */
ipcMain.handle('bridge:disconnect', async () => {
  try {
    const client = getBridgeClient()
    if (client) {
      client.disconnect()
    }
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 断开连接失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 获取连接状态
 */
ipcMain.handle('bridge:isConnected', async () => {
  const client = getBridgeClient()
  return client ? client.isConnected() : false
})

/**
 * 获取会话信息
 */
ipcMain.handle('bridge:getSession', async () => {
  const client = getBridgeClient()
  return client ? client.getSession() : null
})

/**
 * 发送消息
 */
ipcMain.handle('bridge:sendMessage', async (_event, payload: InputMessagePayload) => {
  try {
    const client = getBridgeClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    if (!client.isConnected()) {
      throw new Error('未连接到服务器')
    }

    const preparedContent = await client.sendMessage(payload)
    return { success: true, content: preparedContent }
  } catch (error: any) {
    console.error('[IPC] 发送消息失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 发送触摸事件
 */
ipcMain.handle('bridge:sendTouch', async (_event, x: number, y: number, action: string) => {
  try {
    const client = getBridgeClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    client.sendTouch(x, y, action)
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 发送触摸事件失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 发送状态
 */
ipcMain.handle('bridge:sendState', async (_event, op: string, payload: any) => {
  try {
    const client = getBridgeClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    client.sendState(op, payload)
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 发送状态失败:', error)
    return { success: false, error: error.message }
  }
})
