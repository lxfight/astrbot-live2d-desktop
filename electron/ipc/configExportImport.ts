import { BrowserWindow, dialog, ipcMain } from 'electron'
import { createScopedLogger } from '../utils/logger'
import { loadConnectionSettings } from '../services/connectionSettingsService'
import { loadConnectionBehaviorSettings } from '../services/connectionBehaviorSettingsService'
import { getUserConfig, setUserConfig } from '../database/schema'
import { saveConnectionSettings } from '../services/connectionSettingsService'
import { saveConnectionBehaviorSettings } from '../services/connectionBehaviorSettingsService'
import fs from 'fs'

const logger = createScopedLogger('ipc.configExportImport')

interface ExportedConfig {
  version: number
  exportedAt: string
  connectionSettings?: any
  connectionBehaviorSettings?: any
  userConfig?: Record<string, string>
  localStorage?: Record<string, string>
}

// 获取所有用户配置的辅助函数
function getAllUserConfigEntries(): Record<string, string> {
  const knownKeys = [
    'user_name',
    'app_auto_update_enabled',
    'desktop_capture_default_target',
    'desktop_capture_quality',
    'desktop_capture_max_width',
    'connection_settings_v3',
    'connection_behavior_settings_v1',
    'tray_always_on_top',
    'tray_pass_through_mode',
    'desktop_dynamic_pass_through',
    'tray_game_mode'
  ]

  const result: Record<string, string> = {}
  for (const key of knownKeys) {
    const value = getUserConfig(key)
    if (value !== null) {
      result[key] = value
    }
  }
  return result
}

function getSourceWindowId(event: Electron.IpcMainInvokeEvent): number | undefined {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  if (!senderWindow || senderWindow.isDestroyed()) {
    return undefined
  }
  return senderWindow.id
}

// 导出配置
ipcMain.handle('config:export', async event => {
  const timer = logger.timer('export', { sourceWindowId: getSourceWindowId(event) })

  try {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender)
    if (!sourceWindow || sourceWindow.isDestroyed()) {
      throw new Error('Source window not found')
    }

    // 收集配置数据
    const connectionSettings = loadConnectionSettings()
    const connectionBehaviorSettings = loadConnectionBehaviorSettings()
    const userConfig = getAllUserConfigEntries()

    // 获取 localStorage（从渲染进程）
    const localStorage = await sourceWindow.webContents.executeJavaScript(`
      (() => {
        const data = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) data[key] = window.localStorage.getItem(key);
        }
        return data;
      })()
    `)

    // 排除敏感信息
    const sanitizedUserConfig = { ...userConfig }
    delete sanitizedUserConfig.user_id // 保持设备绑定

    // 排除加密的 token（如果存在）
    if (connectionSettings.success && connectionSettings.data.token) {
      connectionSettings.data.token = '<REDACTED>' // 标记为已删除
    }

    const exportData: ExportedConfig = {
      version: 1,
      exportedAt: new Date().toISOString(),
      connectionSettings: connectionSettings.success ? connectionSettings.data : undefined,
      connectionBehaviorSettings: connectionBehaviorSettings.success
        ? connectionBehaviorSettings.data
        : undefined,
      userConfig: sanitizedUserConfig,
      localStorage
    }

    // 显示保存对话框
    const result = await dialog.showSaveDialog(sourceWindow, {
      title: '导出配置',
      defaultPath: `astrbot-config-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) {
      timer.done({ canceled: true })
      return { success: false, canceled: true }
    }

    // 写入文件
    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf8')

    timer.done({ filePath: result.filePath })
    return { success: true, filePath: result.filePath }
  } catch (error) {
    logger.error('export.failed', error)
    timer.fail(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

// 导入配置
ipcMain.handle('config:import', async event => {
  const timer = logger.timer('import', { sourceWindowId: getSourceWindowId(event) })

  try {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender)
    if (!sourceWindow || sourceWindow.isDestroyed()) {
      throw new Error('Source window not found')
    }

    // 显示打开对话框
    const result = await dialog.showOpenDialog(sourceWindow, {
      title: '导入配置',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths[0]) {
      timer.done({ canceled: true })
      return { success: false, canceled: true }
    }

    const filePath = result.filePaths[0]
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const importData: ExportedConfig = JSON.parse(fileContent)

    // 验证版本
    if (!importData.version || importData.version !== 1) {
      throw new Error('Unsupported config version')
    }

    // 返回预览数据供用户确认
    timer.done({ filePath, preview: true })
    return {
      success: true,
      preview: {
        exportedAt: importData.exportedAt,
        hasConnectionSettings: !!importData.connectionSettings,
        hasConnectionBehaviorSettings: !!importData.connectionBehaviorSettings,
        userConfigKeys: Object.keys(importData.userConfig || {}),
        localStorageKeys: Object.keys(importData.localStorage || {})
      },
      data: importData
    }
  } catch (error) {
    logger.error('import.failed', error)
    timer.fail(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

// 应用导入的配置
ipcMain.handle('config:applyImport', async (event, importData: ExportedConfig) => {
  const timer = logger.timer('applyImport', { sourceWindowId: getSourceWindowId(event) })

  try {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender)
    if (!sourceWindow || sourceWindow.isDestroyed()) {
      throw new Error('Source window not found')
    }

    // 应用连接设置
    if (importData.connectionSettings) {
      // 如果 token 被标记为已删除，提示用户重新输入
      if (importData.connectionSettings.token === '<REDACTED>') {
        importData.connectionSettings.token = ''
      }
      // 不指定 expectedRevision，允许覆盖
      const currentSettings = loadConnectionSettings()
      const revision = currentSettings.success ? currentSettings.data.revision : 0
      await saveConnectionSettings({
        data: importData.connectionSettings,
        expectedRevision: revision
      })
    }

    // 应用连接行为设置
    if (importData.connectionBehaviorSettings) {
      await saveConnectionBehaviorSettings({ data: importData.connectionBehaviorSettings })
    }

    // 应用用户配置
    if (importData.userConfig) {
      for (const [key, value] of Object.entries(importData.userConfig)) {
        setUserConfig(key, value)
      }
    }

    // 应用 localStorage
    if (importData.localStorage) {
      await sourceWindow.webContents.executeJavaScript(`
        (() => {
          const data = ${JSON.stringify(importData.localStorage)};
          for (const [key, value] of Object.entries(data)) {
            window.localStorage.setItem(key, value);
          }
        })()
      `)
    }

    timer.done({ success: true })
    return { success: true }
  } catch (error) {
    logger.error('applyImport.failed', error)
    timer.fail(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})
