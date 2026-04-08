import { BrowserWindow, ipcMain } from 'electron'
import { getDesktopBehaviorCoordinator } from '../desktopBehavior/coordinator'
import type { DesktopRevealReason } from '../desktopBehavior/types'

let snapshotBroadcastRegistered = false
const REVEAL_REASONS = new Set<DesktopRevealReason>(['tray', 'restore', 'manual'])

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
    coordinator.onSnapshotChanged((snapshot) => {
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
  return getCoordinator().getPreferences()
})

ipcMain.handle('desktopBehavior:updatePreferences', async (_event, patch) => {
  return getCoordinator().updatePreferences(patch)
})

ipcMain.handle('desktopBehavior:getSnapshot', async () => {
  return getCoordinator().getSnapshot()
})

ipcMain.handle('desktopBehavior:setMousePassthrough', async (_event, ignoreMouseEvents: boolean) => {
  return getCoordinator().setMousePassthrough(Boolean(ignoreMouseEvents))
})

ipcMain.handle('desktopBehavior:setModelReady', async (_event, ready: boolean) => {
  return getCoordinator().setModelReady(Boolean(ready))
})

ipcMain.handle('desktopBehavior:requestReveal', async (_event, reason: unknown) => {
  return getCoordinator().requestReveal(parseRevealReason(reason))
})
