import { BrowserWindow, ipcMain } from 'electron'
import type {
  ConnectionBehaviorSettingsChangedEvent,
  ConnectionBehaviorSettingsSavePayload,
} from '../../src/shared/connectionBehaviorSettings'
import {
  loadConnectionBehaviorSettings,
  migrateLegacyConnectionBehaviorSettings,
  saveConnectionBehaviorSettings,
} from '../services/connectionBehaviorSettingsService'
import { getBridgeConnectionController } from '../main'

function getSourceWindowId(event: Electron.IpcMainInvokeEvent): number | undefined {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  if (!senderWindow || senderWindow.isDestroyed()) {
    return undefined
  }
  return senderWindow.id
}

function broadcastBehaviorSettingsChanged(
  settings: ConnectionBehaviorSettingsChangedEvent['settings'],
  sourceWindowId?: number,
): void {
  const payload: ConnectionBehaviorSettingsChangedEvent = {
    settings,
    sourceWindowId,
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('connectionBehaviorSettings:changed', payload)
    }
  }
}

ipcMain.handle('connectionBehaviorSettings:load', async () => {
  return loadConnectionBehaviorSettings()
})

ipcMain.handle('connectionBehaviorSettings:save', async (event, payload: ConnectionBehaviorSettingsSavePayload) => {
  const result = saveConnectionBehaviorSettings(payload)
  if (result.success) {
    await getBridgeConnectionController()?.handleBehaviorSettingsUpdated(result.data)
    broadcastBehaviorSettingsChanged(result.data, getSourceWindowId(event))
  }
  return result
})

ipcMain.handle('connectionBehaviorSettings:migrateLegacy', async (event, rawLegacyJson: string) => {
  const result = migrateLegacyConnectionBehaviorSettings(rawLegacyJson)
  if (result.success) {
    await getBridgeConnectionController()?.handleBehaviorSettingsUpdated(result.data, {
      resolveStartupDecision: true,
    })
    broadcastBehaviorSettingsChanged(result.data, getSourceWindowId(event))
  }
  return result
})
