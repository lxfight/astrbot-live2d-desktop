import { ipcMain } from 'electron'
import type { InputMessagePayload } from '../protocol/types'
import { getBridgeConnectionController } from '../main'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.connection')

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
  const session = controller ? controller.getSession() : null
  logger.debug('bridge_get_session', {
    hasController: Boolean(controller),
    hasSession: Boolean(session),
    sessionId: session?.sessionId,
  })
  return session
})

ipcMain.handle('bridge:sendMessage', async (_event, payload: InputMessagePayload) => {
  const timer = logger.timer('bridge_send_message', {
    contentCount: Array.isArray(payload?.content) ? payload.content.length : 0,
  })
  try {
    const controller = getBridgeConnectionController()
    if (!controller) {
      throw new Error('连接控制器未初始化')
    }

    const preparedContent = await controller.sendMessage(payload)
    timer.done({ preparedContentCount: preparedContent.length })
    return { success: true, content: preparedContent }
  } catch (error) {
    console.error('[IPC] 发送消息失败:', error)
    timer.fail(error)
    return { success: false, error: toErrorMessage(error) }
  }
})

ipcMain.handle('bridge:sendTouch', async (_event, x: number, y: number, action: string) => {
  const timer = logger.timer('bridge_send_touch', { x, y, action })
  try {
    const controller = getBridgeConnectionController()
    if (!controller) {
      throw new Error('连接控制器未初始化')
    }

    controller.sendTouch(x, y, action)
    timer.done()
    return { success: true }
  } catch (error) {
    console.error('[IPC] 发送触摸事件失败:', error)
    timer.fail(error)
    return { success: false, error: toErrorMessage(error) }
  }
})

ipcMain.handle('bridge:sendState', async (_event, op: string, payload: any) => {
  const timer = logger.timer('bridge_send_state', { op, payload })
  try {
    const controller = getBridgeConnectionController()
    if (!controller) {
      throw new Error('连接控制器未初始化')
    }

    controller.sendState(op, payload)
    timer.done()
    return { success: true }
  } catch (error) {
    console.error('[IPC] 发送状态失败:', error)
    timer.fail(error)
    return { success: false, error: toErrorMessage(error) }
  }
})
