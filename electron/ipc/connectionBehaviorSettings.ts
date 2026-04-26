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
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.connectionBehaviorSettings')

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
  logger.info('broadcast.changed', {
    sourceWindowId,
    windowCount: BrowserWindow.getAllWindows().length,
    autoConnectOnAppLaunch: settings.autoConnectOnAppLaunch,
    retryEnabled: settings.retryEnabled,
    resumeDesiredConnectionOnWake: settings.resumeDesiredConnectionOnWake,
  })
}

ipcMain.handle('connectionBehaviorSettings:load', async () => {
  const result = loadConnectionBehaviorSettings()
  logger.debug('load', {
    success: result.success,
    code: result.success ? undefined : result.code,
  })
  return result
})

ipcMain.handle('connectionBehaviorSettings:save', async (event, payload: ConnectionBehaviorSettingsSavePayload) => {
  const timer = logger.timer('save', { sourceWindowId: getSourceWindowId(event), payload })
  const result = saveConnectionBehaviorSettings(payload)
  if (result.success) {
    await getBridgeConnectionController()?.handleBehaviorSettingsUpdated(result.data)
    broadcastBehaviorSettingsChanged(result.data, getSourceWindowId(event))
  }
  timer.done({
    success: result.success,
    code: result.success ? undefined : result.code,
  })
  return result
})

ipcMain.handle('connectionBehaviorSettings:migrateLegacy', async (event, rawLegacyJson: string) => {
  const timer = logger.timer('migrate_legacy', {
    sourceWindowId: getSourceWindowId(event),
    rawLength: rawLegacyJson.length,
  })
  const result = migrateLegacyConnectionBehaviorSettings(rawLegacyJson)
  if (result.success) {
    await getBridgeConnectionController()?.handleBehaviorSettingsUpdated(result.data, {
      resolveStartupDecision: true,
    })
    broadcastBehaviorSettingsChanged(result.data, getSourceWindowId(event))
  }
  timer.done({
    success: result.success,
    code: result.success ? undefined : result.code,
  })
  return result
})
