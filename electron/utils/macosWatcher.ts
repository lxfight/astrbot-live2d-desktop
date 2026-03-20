/**
 * macOS 平台原生窗口事件监听器
 * 
 * 使用 NSWorkspace 通知和 AppleScript 实现事件驱动的窗口监听
 */

import { screen } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { 
  PlatformWatcher, 
  WindowInfo, 
  WindowEvent
} from './windowWatcher'
import { isWindowFullscreen } from './windowWatcher'

const execAsync = promisify(exec)

// 缓存窗口信息
const windowCache = new Map<string, WindowInfo>()

// 上一个活跃窗口
let previousActiveWindow: WindowInfo | null = null

// 回调函数
let eventCallback: ((event: WindowEvent) => void) | null = null

// 轮询定时器（macOS 没有完美的原生事件方案）
let pollTimer: NodeJS.Timeout | null = null

// 轮询间隔
const POLL_INTERVAL = 500  // 500ms

/**
 * 通过 AppleScript 获取当前活跃窗口信息
 */
async function getActiveWindowViaAppleScript(): Promise<WindowInfo | null> {
  try {
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        set frontAppPath to POSIX path of (file of process frontApp as alias)
        set windowTitle to ""
        set windowBounds to {0, 0, 0, 0}
        
        try
          tell process frontApp
            if (count of windows) > 0 then
              set windowTitle to name of window 1
              set {x, y} to position of window 1
              set {w, h} to size of window 1
              set windowBounds to {x, y, w, h}
            end if
          end tell
        end try
        
        return frontApp & "|||" & frontAppPath & "|||" & windowTitle & "|||" & (item 1 of windowBounds) & "," & (item 2 of windowBounds) & "," & (item 3 of windowBounds) & "," & (item 4 of windowBounds)
      end tell
    `
    
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`)
    const result = stdout.trim()
    
    if (!result) return null
    
    const parts = result.split('|||')
    if (parts.length < 4) return null
    
    const [appName, appPath, title, boundsStr] = parts
    const [x, y, width, height] = boundsStr.split(',').map(Number)
    
    // 获取屏幕尺寸
    const primaryDisplay = screen.getPrimaryDisplay()
    const screenWidth = primaryDisplay.bounds.width
    const screenHeight = primaryDisplay.bounds.height
    
    const bounds = { x, y, width, height }
    const isFullscreen = isWindowFullscreen(bounds, screenWidth, screenHeight)
    
    // 生成唯一 ID
    const id = `${appName}-${title}`.replace(/[^a-zA-Z0-9-]/g, '_')
    
    return {
      id,
      title: title || appName,
      processName: appName,
      processPath: appPath,
      processId: 0,  // AppleScript 不直接提供 PID
      bounds,
      isFullscreen,
      isMinimized: false,
      isMaximized: false,
    }
  } catch (error) {
    // AppleScript 可能会失败，静默处理
    return null
  }
}

/**
 * 使用 node-os-utils 获取更详细的窗口信息
 */
async function getActiveWindowViaNode(): Promise<WindowInfo | null> {
  try {
    // 尝试使用 active-win
    const activeWin = require('active-win')
    const result = await activeWin()
    
    if (!result) return null
    
    const { title, owner, bounds, id } = result
    const { name, path: processPath, processId } = owner
    
    // 获取屏幕尺寸
    const primaryDisplay = screen.getPrimaryDisplay()
    const screenWidth = primaryDisplay.bounds.width
    const screenHeight = primaryDisplay.bounds.height
    
    const isFullscreen = isWindowFullscreen(bounds, screenWidth, screenHeight)
    
    return {
      id: String(id || `${name}-${title}`),
      title: title || name,
      processName: name,
      processPath: processPath || '',
      processId: processId || 0,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
      isFullscreen,
      isMinimized: false,
      isMaximized: false,
    }
  } catch {
    return null
  }
}

/**
 * 获取当前活跃窗口信息
 */
async function getActiveWindow(): Promise<WindowInfo | null> {
  // 优先使用 active-win
  const nodeResult = await getActiveWindowViaNode()
  if (nodeResult) return nodeResult
  
  // 回退到 AppleScript
  return getActiveWindowViaAppleScript()
}

/**
 * 检查窗口变化并触发事件
 */
async function checkWindowChange(): Promise<void> {
  if (!eventCallback) return
  
  const currentWindow = await getActiveWindow()
  
  if (!currentWindow) {
    // 没有活跃窗口
    if (previousActiveWindow) {
      eventCallback({
        type: 'blur',
        timestamp: Date.now(),
        window: previousActiveWindow,
      })
      previousActiveWindow = null
    }
    return
  }
  
  // 更新缓存
  windowCache.set(currentWindow.id, currentWindow)
  
  // 检查是否窗口切换
  if (!previousActiveWindow || previousActiveWindow.id !== currentWindow.id) {
    // 窗口切换
    eventCallback({
      type: 'focus',
      timestamp: Date.now(),
      window: currentWindow,
      previousWindow: previousActiveWindow || undefined,
    })
    previousActiveWindow = currentWindow
  } else if (previousActiveWindow.id === currentWindow.id) {
    // 同一窗口，检查是否有变化
    const prev = previousActiveWindow
    const curr = currentWindow
    
    // 检查大小变化
    if (prev.bounds.width !== curr.bounds.width || 
        prev.bounds.height !== curr.bounds.height) {
      eventCallback({
        type: 'resize',
        timestamp: Date.now(),
        window: currentWindow,
      })
    }
    
    // 检查位置变化
    if (prev.bounds.x !== curr.bounds.x || 
        prev.bounds.y !== curr.bounds.y) {
      eventCallback({
        type: 'move',
        timestamp: Date.now(),
        window: currentWindow,
      })
    }
    
    // 检查全屏状态变化
    if (prev.isFullscreen !== curr.isFullscreen) {
      eventCallback({
        type: curr.isFullscreen ? 'maximize' : 'restore',
        timestamp: Date.now(),
        window: currentWindow,
      })
    }
    
    previousActiveWindow = currentWindow
  }
}

/**
 * macOS 平台监听器实现
 */
export class MacOSWatcher implements PlatformWatcher {
  private isRunning = false
  
  start(callback: (rawEvent: any) => void): void {
    if (this.isRunning) {
      console.warn('[窗口监听] macOS 监听器已在运行')
      return
    }
    
    eventCallback = callback
    
    // 启动轮询
    pollTimer = setInterval(() => {
      checkWindowChange().catch(error => {
        console.warn('[窗口监听] 检查窗口变化失败:', error)
      })
    }, POLL_INTERVAL)
    
    // 立即检查一次
    checkWindowChange().catch(() => {})
    
    this.isRunning = true
    console.log('[窗口监听] macOS 事件监听已启动')
  }
  
  stop(): void {
    if (!this.isRunning) return
    
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    
    this.isRunning = false
    eventCallback = null
    
    console.log('[窗口监听] macOS 事件监听已停止')
  }
  
  getActiveWindow(): WindowInfo | null {
    // 同步版本，返回缓存
    return previousActiveWindow
  }
  
  getAllWindows(): WindowInfo[] {
    return Array.from(windowCache.values())
  }
}
