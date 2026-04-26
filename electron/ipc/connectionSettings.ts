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
import { getBridgeConnectionController } from '../main'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.connectionSettings')

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
  logger.info('broadcast.changed', {
    sourceWindowId,
    windowCount: BrowserWindow.getAllWindows().length,
    revision: settings.revision,
    serverUrl: settings.serverUrl,
    hasToken: Boolean(settings.token.trim()),
  })
}

ipcMain.handle('connectionSettings:load', async () => {
  const result = loadConnectionSettings()
  logger.debug('load', {
    success: result.success,
    revision: result.success ? result.data.revision : undefined,
    code: result.success ? undefined : result.code,
  })
  return result
})

ipcMain.handle('connectionSettings:save', async (event, payload: ConnectionSettingsSavePayload) => {
  const timer = logger.timer('save', { sourceWindowId: getSourceWindowId(event), payload })
  const result = saveConnectionSettings(payload)
  if (result.success) {
    await getBridgeConnectionController()?.handleConnectionSettingsUpdated(result.data)
    broadcastSettingsChanged(result.data, getSourceWindowId(event))
  }
  timer.done({
    success: result.success,
    revision: result.success ? result.data.revision : undefined,
    code: result.success ? undefined : result.code,
  })
  return result
})

ipcMain.handle('connectionSettings:migrateLegacy', async (event, rawLegacyJson: string) => {
  const timer = logger.timer('migrate_legacy', {
    sourceWindowId: getSourceWindowId(event),
    rawLength: rawLegacyJson.length,
  })
  const result = migrateLegacyConnectionSettings(rawLegacyJson)
  if (result.success) {
    await getBridgeConnectionController()?.handleConnectionSettingsUpdated(result.data)
    broadcastSettingsChanged(result.data, getSourceWindowId(event))
  }
  timer.done({
    success: result.success,
    revision: result.success ? result.data.revision : undefined,
    code: result.success ? undefined : result.code,
  })
  return result
})
