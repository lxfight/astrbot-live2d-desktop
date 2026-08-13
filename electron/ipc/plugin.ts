/**
 * 插件系统 IPC 处理器
 * 渲染进程（设置窗口）通过 window.electron.plugins 调用。
 * 业务逻辑在 PluginManager / PluginHost（已单测），本层只做装配与错误兜底。
 */

import { ipcMain, dialog } from 'electron'
import path from 'node:path'
import { getPluginManager, getPluginHost } from '../plugins'
import { getSettingsWindow } from '../windows/settingsWindow'
import { refreshTrayMenu } from '../utils/tray'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.plugin')

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 选择插件目录（用于安装） */
ipcMain.handle('plugin:selectFolder', async () => {
  try {
    const settingsWindow = getSettingsWindow()
    const options = {
      title: '选择插件文件夹',
      properties: ['openDirectory'] as Array<'openDirectory'>
    }
    const result = settingsWindow
      ? await dialog.showOpenDialog(settingsWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, folderPath: result.filePaths[0] }
  } catch (error) {
    logger.error('select_folder.failed', error)
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('plugin:list', async () => {
  try {
    return { success: true, plugins: getPluginManager().listPlugins() }
  } catch (error) {
    logger.error('list.failed', error)
    return { success: false, plugins: [], error: errorMessage(error) }
  }
})

ipcMain.handle('plugin:install', async (_event, sourceDirectory: string) => {
  try {
    return getPluginManager().installPluginFromDirectory(sourceDirectory)
  } catch (error) {
    logger.error('install.failed', error)
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('plugin:uninstall', async (_event, pluginId: string) => {
  try {
    getPluginHost().stopPlugin(pluginId)
    const result = getPluginManager().uninstallPlugin(pluginId)
    refreshTrayMenu()
    return result
  } catch (error) {
    logger.error('uninstall.failed', error)
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('plugin:enable', async (_event, pluginId: string) => {
  try {
    const manager = getPluginManager()
    const info = manager.getPlugin(pluginId)
    const result = manager.enablePlugin(pluginId)
    if (!result.success) {
      return result
    }
    // 启用后拉起进程（manifest 已由 getPlugin 校验过）
    if (info) {
      getPluginHost().startPlugin(
        pluginId,
        path.join(manager.pluginsRootDirectory, pluginId),
        info.manifest
      )
      refreshTrayMenu()
    }
    return result
  } catch (error) {
    logger.error('enable.failed', error)
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('plugin:disable', async (_event, pluginId: string) => {
  try {
    getPluginHost().stopPlugin(pluginId)
    const result = getPluginManager().disablePlugin(pluginId)
    refreshTrayMenu()
    return result
  } catch (error) {
    logger.error('disable.failed', error)
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('plugin:getSettings', async (_event, pluginId: string) => {
  try {
    return { success: true, settings: getPluginManager().getPluginSettings(pluginId) }
  } catch (error) {
    logger.error('get_settings.failed', error)
    return { success: false, settings: null, error: errorMessage(error) }
  }
})

ipcMain.handle('plugin:setSettings', async (_event, pluginId: string, patch: unknown) => {
  try {
    return getPluginManager().updatePluginSettings(
      pluginId,
      (patch ?? {}) as Record<string, unknown>
    )
  } catch (error) {
    logger.error('set_settings.failed', error)
    return { success: false, error: errorMessage(error) }
  }
})
