import { ipcMain, globalShortcut, BrowserWindow } from 'electron'

let currentShortcut: string | null = null
let isRecording = false

/**
 * 注册全局快捷键
 */
ipcMain.handle('shortcut:register', async (event, accelerator: string) => {
  try {
    // 取消注册旧的快捷键
    if (currentShortcut) {
      globalShortcut.unregister(currentShortcut)
      console.log('[快捷键] 取消注册:', currentShortcut)
    }

    // 注册新的快捷键
    const success = globalShortcut.register(accelerator, () => {
      handleShortcutPressed()
    })

    if (success) {
      currentShortcut = accelerator
      console.log('[快捷键] 注册成功:', accelerator)
      return { success: true }
    } else {
      console.error('[快捷键] 注册失败:', accelerator)
      return { success: false, error: '快捷键已被占用或无效' }
    }
  } catch (error: any) {
    console.error('[快捷键] 注册失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 取消注册快捷键
 */
ipcMain.handle('shortcut:unregister', async () => {
  try {
    if (currentShortcut) {
      globalShortcut.unregister(currentShortcut)
      console.log('[快捷键] 取消注册:', currentShortcut)
      currentShortcut = null
    }
    return { success: true }
  } catch (error: any) {
    console.error('[快捷键] 取消注册失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 检查快捷键是否已注册
 */
ipcMain.handle('shortcut:isRegistered', async (event, accelerator: string) => {
  return globalShortcut.isRegistered(accelerator)
})

/**
 * 处理快捷键按下（切换模式）
 */
function handleShortcutPressed() {
  const mainWindow = BrowserWindow.getAllWindows().find(win => !win.isDestroyed())
  if (!mainWindow) return

  if (!isRecording) {
    // 开始录音
    isRecording = true
    console.log('[快捷键] 开始录音')
    mainWindow.webContents.send('shortcut:recording-start')
  } else {
    // 停止录音
    isRecording = false
    console.log('[快捷键] 停止录音')
    mainWindow.webContents.send('shortcut:recording-stop')
  }
}

/**
 * 应用退出时清理
 */
export function cleanupShortcuts() {
  globalShortcut.unregisterAll()
  console.log('[快捷键] 已清理所有快捷键')
}
