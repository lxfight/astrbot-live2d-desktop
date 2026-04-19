import { BrowserWindow, ipcMain } from 'electron'
import type {
  ConnectionSettingsChangedEvent,
  ConnectionSettingsSavePayload,
} from '../../src/shared/connectionSettings'
import {
  loadConnectionSettings,
  migrateLegacyConnectionSettings,
  saveConnectionSettings,
} from '../services/connectionSettingsService'

function getSourceWindowId(event: Electron.IpcMainInvokeEvent): number | undefined {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  if (!senderWindow || senderWindow.isDestroyed()) {
    return undefined
  }
  return senderWindow.id
}

function broadcastSettingsChanged(
  settings: ConnectionSettingsChangedEvent['settings'],
  sourceWindowId?: number,
): void {
  const payload: ConnectionSettingsChangedEvent = {
    settings,
    revision: settings.revision,
    sourceWindowId,
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('connectionSettings:changed', payload)
    }
  }
}

ipcMain.handle('connectionSettings:load', async () => {
  return loadConnectionSettings()
})

ipcMain.handle('connectionSettings:save', async (event, payload: ConnectionSettingsSavePayload) => {
  const result = saveConnectionSettings(payload)
  if (result.success) {
    broadcastSettingsChanged(result.data, getSourceWindowId(event))
  }
  return result
})

ipcMain.handle('connectionSettings:migrateLegacy', async (event, rawLegacyJson: string) => {
  const result = migrateLegacyConnectionSettings(rawLegacyJson)
  if (result.success) {
    broadcastSettingsChanged(result.data, getSourceWindowId(event))
  }
  return result
})

