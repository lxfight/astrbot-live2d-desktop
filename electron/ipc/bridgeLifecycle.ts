import { ipcMain } from 'electron'
import { buildDefaultBridgeLifecycleSnapshot } from '../../src/shared/bridgeLifecycle'
import { getBridgeConnectionController } from '../main'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.bridgeLifecycle')

ipcMain.handle('bridgeLifecycle:getSnapshot', async () => {
  const controller = getBridgeConnectionController()
  const snapshot = controller ? controller.getSnapshot() : buildDefaultBridgeLifecycleSnapshot()
  logger.debug('get_snapshot', { hasController: Boolean(controller), snapshot })
  return snapshot
})

ipcMain.handle('bridgeLifecycle:connect', async () => {
  const timer = logger.timer('connect')
  const controller = getBridgeConnectionController()
  if (!controller) {
    timer.done({ success: false, code: 'CLIENT_UNAVAILABLE' })
    return {
      success: false,
      code: 'CLIENT_UNAVAILABLE' as const,
      message: '连接控制器未初始化',
      snapshot: buildDefaultBridgeLifecycleSnapshot(),
    }
  }

  const result = await controller.connect()
  timer.done({ success: result.success, code: result.success ? undefined : result.code, snapshot: result.snapshot })
  return result
})

ipcMain.handle('bridgeLifecycle:disconnect', async () => {
  const timer = logger.timer('disconnect')
  const controller = getBridgeConnectionController()
  if (!controller) {
    timer.done({ success: false, code: 'CLIENT_UNAVAILABLE' })
    return {
      success: false,
      code: 'CLIENT_UNAVAILABLE' as const,
      message: '连接控制器未初始化',
      snapshot: buildDefaultBridgeLifecycleSnapshot(),
    }
  }

  const result = await controller.disconnect()
  timer.done({ success: result.success, code: result.success ? undefined : result.code, snapshot: result.snapshot })
  return result
})
