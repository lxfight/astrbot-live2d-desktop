import { ipcMain } from 'electron'
import { checkForAppUpdates, getUpdateState, quitAndInstallUpdate } from '../utils/updater'

ipcMain.handle('update:getState', async () => {
  return getUpdateState()
})

ipcMain.handle('update:check', async () => {
  return checkForAppUpdates(true)
})

ipcMain.handle('update:quitAndInstall', async () => {
  return quitAndInstallUpdate()
})
