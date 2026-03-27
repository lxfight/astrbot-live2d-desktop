import { ipcMain } from 'electron'
import { checkForAppUpdates, getUpdateState, getUpdaterSettings, quitAndInstallUpdate, updateUpdaterSettings } from '../utils/updater'

ipcMain.handle('update:getState', async () => {
  return getUpdateState()
})

ipcMain.handle('update:check', async () => {
  return checkForAppUpdates(true)
})

ipcMain.handle('update:quitAndInstall', async () => {
  return quitAndInstallUpdate()
})

ipcMain.handle('update:getSettings', async () => {
  return getUpdaterSettings()
})

ipcMain.handle('update:updateSettings', async (_event, settings) => {
  return updateUpdaterSettings(settings)
})
