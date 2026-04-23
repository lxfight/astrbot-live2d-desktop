import { ipcMain } from 'electron'
import { buildDefaultBridgeLifecycleSnapshot } from '../../src/shared/bridgeLifecycle'
import { getBridgeConnectionController } from '../main'

ipcMain.handle('bridgeLifecycle:getSnapshot', async () => {
  const controller = getBridgeConnectionController()
  return controller ? controller.getSnapshot() : buildDefaultBridgeLifecycleSnapshot()
})

ipcMain.handle('bridgeLifecycle:connect', async () => {
  const controller = getBridgeConnectionController()
  if (!controller) {
    return {
      success: false,
      code: 'CLIENT_UNAVAILABLE' as const,
      message: '连接控制器未初始化',
      snapshot: buildDefaultBridgeLifecycleSnapshot(),
    }
  }

  return await controller.connect()
})

ipcMain.handle('bridgeLifecycle:disconnect', async () => {
  const controller = getBridgeConnectionController()
  if (!controller) {
    return {
      success: false,
      code: 'CLIENT_UNAVAILABLE' as const,
      message: '连接控制器未初始化',
      snapshot: buildDefaultBridgeLifecycleSnapshot(),
    }
  }

  return await controller.disconnect()
})
