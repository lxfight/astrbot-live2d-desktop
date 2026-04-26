import { ipcMain, globalShortcut } from 'electron'
import { getMainWindow } from '../windows/mainWindow'
import { createScopedLogger } from '../utils/logger'

let currentShortcut: string | null = null
let isRecording = false
const logger = createScopedLogger('ipc.shortcut')

/**
 * 注册全局快捷键
 */
ipcMain.handle('shortcut:register', async (_event, accelerator: string) => {
  const timer = logger.timer('register', { accelerator, previousShortcut: currentShortcut })
  try {
    // 取消注册旧的快捷键
    if (currentShortcut) {
      globalShortcut.unregister(currentShortcut)
      console.log('[快捷键] 取消注册:', currentShortcut)
      logger.info('unregister_previous', { accelerator: currentShortcut })
    }

    // 注册新的快捷键
    const success = globalShortcut.register(accelerator, () => {
      handleShortcutPressed()
    })

    if (success) {
      currentShortcut = accelerator
      console.log('[快捷键] 注册成功:', accelerator)
      timer.done({ success: true })
      return { success: true }
    } else {
      console.error('[快捷键] 注册失败:', accelerator)
      timer.done({ success: false, reason: 'occupied_or_invalid' })
      return { success: false, error: '快捷键已被占用或无效' }
    }
  } catch (error: any) {
    console.error('[快捷键] 注册失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 取消注册快捷键
 */
ipcMain.handle('shortcut:unregister', async () => {
  const timer = logger.timer('unregister', { currentShortcut })
  try {
    if (currentShortcut) {
      globalShortcut.unregister(currentShortcut)
      console.log('[快捷键] 取消注册:', currentShortcut)
      logger.info('unregister_current', { accelerator: currentShortcut })
      currentShortcut = null
    }
    isRecording = false
    timer.done({ success: true })
    return { success: true }
  } catch (error: any) {
    console.error('[快捷键] 取消注册失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 检查快捷键是否已注册
 */
ipcMain.handle('shortcut:isRegistered', async (_event, accelerator: string) => {
  const registered = globalShortcut.isRegistered(accelerator)
  logger.debug('is_registered', { accelerator, registered })
  return registered
})

ipcMain.handle('shortcut:setRecordingState', async (_event, recording: boolean) => {
  const previous = isRecording
  isRecording = Boolean(recording)
  logger.info('set_recording_state', { previous, next: isRecording })
  return { success: true, isRecording }
})

/**
 * 处理快捷键按下（切换模式）
 */
function handleShortcutPressed() {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) {
    logger.warn('pressed.ignored', { reason: 'main_window_unavailable' })
    return
  }

  if (!isRecording) {
    // 开始录音
    isRecording = true
    console.log('[快捷键] 开始录音')
    logger.info('pressed.start_recording', { windowId: mainWindow.id })
    mainWindow.webContents.send('shortcut:recording-start')
  } else {
    // 停止录音
    isRecording = false
    console.log('[快捷键] 停止录音')
    logger.info('pressed.stop_recording', { windowId: mainWindow.id })
    mainWindow.webContents.send('shortcut:recording-stop')
  }
}

/**
 * 应用退出时清理
 */
export function cleanupShortcuts() {
  logger.info('cleanup', { currentShortcut, isRecording })
  globalShortcut.unregisterAll()
  currentShortcut = null
  isRecording = false
  console.log('[快捷键] 已清理所有快捷键')
}
