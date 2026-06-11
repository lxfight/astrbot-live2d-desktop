import { ipcMain } from 'electron'
import { getMainWindow } from '../windows/mainWindow'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.modelPreview')

type PreviewMotionPayload = { group: string; index: number; priority?: number; loop?: boolean }
type PreviewExpressionPayload = {
  id: string
  fade?: number
  holdMs?: number
  resetPolicy?: 'previous' | 'neutral' | 'keep' | 'fadeOut' | 'default' | 'hold'
}

export function registerModelPreviewHandlers() {
  ipcMain.handle('model:previewMotion', async (_event, payload: PreviewMotionPayload) => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      return { success: false, error: 'main window not available' }
    }
    mainWindow.webContents.send('model:previewMotion', payload)
    logger.debug('preview.motion', payload)
    return { success: true }
  })

  ipcMain.handle('model:previewExpression', async (_event, payload: PreviewExpressionPayload) => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      return { success: false, error: 'main window not available' }
    }
    mainWindow.webContents.send('model:previewExpression', payload)
    logger.debug('preview.expression', payload)
    return { success: true }
  })

  ipcMain.handle('model:captureThumbnail', async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      return { success: false, error: 'main window not available' }
    }
    try {
      const image = await mainWindow.webContents.capturePage()
      const png = image.toPNG()
      const dataUrl = `data:image/png;base64,${png.toString('base64')}`
      return { success: true, dataUrl }
    } catch (error: any) {
      logger.error('preview.thumbnailFailed', error)
      return { success: false, error: error.message }
    }
  })
}
