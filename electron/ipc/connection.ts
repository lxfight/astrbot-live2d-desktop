import { ipcMain } from 'electron'
import { getBridgeClient } from '../main'
import type { InputMessagePayload } from '../protocol/types'

/**
 * 连接到服务器
 */
ipcMain.handle('bridge:connect', async (_event, url: string, token?: string) => {
  try {
    const client = getBridgeClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    await client.connect(url, token)
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

    client.sendMessage(payload)
    return { success: true }
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
