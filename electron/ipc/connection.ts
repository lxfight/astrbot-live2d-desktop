import { ipcMain } from 'electron'
import type { InputMessagePayload } from '../protocol/types'
import { getBridgeConnectionController } from '../main'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return String(error)
}

ipcMain.handle('bridge:getSession', async () => {
  const controller = getBridgeConnectionController()
  return controller ? controller.getSession() : null
})

ipcMain.handle('bridge:sendMessage', async (_event, payload: InputMessagePayload) => {
  try {
    const controller = getBridgeConnectionController()
    if (!controller) {
      throw new Error('连接控制器未初始化')
    }

    const preparedContent = await controller.sendMessage(payload)
    return { success: true, content: preparedContent }
  } catch (error) {
    console.error('[IPC] 发送消息失败:', error)
    return { success: false, error: toErrorMessage(error) }
  }
})

ipcMain.handle('bridge:sendTouch', async (_event, x: number, y: number, action: string) => {
  try {
    const controller = getBridgeConnectionController()
    if (!controller) {
      throw new Error('连接控制器未初始化')
    }

    controller.sendTouch(x, y, action)
    return { success: true }
  } catch (error) {
    console.error('[IPC] 发送触摸事件失败:', error)
    return { success: false, error: toErrorMessage(error) }
  }
})

ipcMain.handle('bridge:sendState', async (_event, op: string, payload: any) => {
  try {
    const controller = getBridgeConnectionController()
    if (!controller) {
      throw new Error('连接控制器未初始化')
    }

    controller.sendState(op, payload)
    return { success: true }
  } catch (error) {
    console.error('[IPC] 发送状态失败:', error)
    return { success: false, error: toErrorMessage(error) }
  }
})
