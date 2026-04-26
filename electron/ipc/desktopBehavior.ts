import { BrowserWindow, ipcMain } from 'electron'
import { getDesktopBehaviorCoordinator } from '../desktopBehavior/coordinator'
import type { DesktopRevealReason } from '../desktopBehavior/types'
import { createScopedLogger } from '../utils/logger'

let snapshotBroadcastRegistered = false
const REVEAL_REASONS = new Set<DesktopRevealReason>(['tray', 'restore', 'manual'])
const logger = createScopedLogger('ipc.desktopBehavior')

function parseRevealReason(reason: unknown): DesktopRevealReason {
  if (reason === undefined || reason === null) {
    return 'manual'
  }

  if (typeof reason !== 'string' || !REVEAL_REASONS.has(reason as DesktopRevealReason)) {
    throw new Error('desktopBehavior:requestReveal 参数非法')
  }

  return reason as DesktopRevealReason
}

function getCoordinator() {
  const coordinator = getDesktopBehaviorCoordinator()

  if (!snapshotBroadcastRegistered) {
    snapshotBroadcastRegistered = true
    logger.info('snapshot_broadcast.register')
    coordinator.onSnapshotChanged((snapshot) => {
      logger.debug('snapshot_broadcast.send', {
        windowCount: BrowserWindow.getAllWindows().length,
        snapshot,
      })
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('desktopBehavior:snapshotChanged', snapshot)
        }
      }
    })
  }

  return coordinator
}

ipcMain.handle('desktopBehavior:getPreferences', async () => {
  const preferences = getCoordinator().getPreferences()
  logger.debug('get_preferences', { preferences })
  return preferences
})

ipcMain.handle('desktopBehavior:updatePreferences', async (_event, patch) => {
  logger.info('update_preferences', { patch })
  const preferences = getCoordinator().updatePreferences(patch)
  logger.info('update_preferences.success', { preferences })
  return preferences
})

ipcMain.handle('desktopBehavior:getSnapshot', async () => {
  const snapshot = getCoordinator().getSnapshot()
  logger.debug('get_snapshot', { snapshot })
  return snapshot
})

ipcMain.handle('desktopBehavior:setMousePassthrough', async (_event, ignoreMouseEvents: boolean) => {
  const enabled = getCoordinator().setMousePassthrough(Boolean(ignoreMouseEvents))
  logger.info('set_mouse_passthrough', { requested: Boolean(ignoreMouseEvents), enabled })
  return enabled
})

ipcMain.handle('desktopBehavior:setModelReady', async (_event, ready: boolean) => {
  const snapshot = getCoordinator().setModelReady(Boolean(ready))
  logger.info('set_model_ready', { ready: Boolean(ready), snapshot })
  return snapshot
})

ipcMain.handle('desktopBehavior:requestReveal', async (_event, reason: unknown) => {
  const parsedReason = parseRevealReason(reason)
  const snapshot = getCoordinator().requestReveal(parsedReason)
  logger.info('request_reveal', { reason: parsedReason, snapshot })
  return snapshot
})
