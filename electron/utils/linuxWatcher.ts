/**
 * Linux 平台原生窗口事件监听器
 * 
 * 使用 X11 事件或 xdotool 实现事件驱动的窗口监听
 * 支持 X11 会话，Wayland 回退到轮询
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

/**
 * 校验 X11 窗口 ID（必须为纯数字）
 */
function isValidWindowId(id: string): boolean {
  return /^\d+$/.test(id)
}

/**
 * 校验进程 ID（必须为正整数）
 */
function isValidPid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 0
}

// 缓存窗口信息
const windowCache = new Map<string, WindowInfo>()

// 上一个活跃窗口
let previousActiveWindow: WindowInfo | null = null

// 回调函数
let eventCallback: ((event: WindowEvent) => void) | null = null

// 轮询定时器
let pollTimer: NodeJS.Timeout | null = null

// X11 事件监听进程
let x11ListenerProcess: any = null

// 轮询间隔
const POLL_INTERVAL = 500  // 500ms

/**
 * 检查是否为 X11 会话
 */
function isX11Session(): boolean {
  const sessionType = process.env.XDG_SESSION_TYPE
  return sessionType === 'x11' || !!process.env.DISPLAY
}

/**
 * 检查是否为 Wayland 会话
 */
function isWaylandSession(): boolean {
  const sessionType = process.env.XDG_SESSION_TYPE
  return sessionType === 'wayland' || !!process.env.WAYLAND_DISPLAY
}

/**
 * 通过 xdotool 获取当前活跃窗口信息
 */
async function getActiveWindowViaXdotool(): Promise<WindowInfo | null> {
  try {
    // 获取活跃窗口 ID
    const { stdout: windowId } = await execAsync('xdotool getactivewindow')
    const id = windowId.trim()

    if (!id || !isValidWindowId(id)) return null
    
    // 获取窗口标题
    let title = ''
    try {
      const { stdout } = await execAsync(`xdotool getwindowname ${id}`)
      title = stdout.trim()
    } catch {}
    
    // 获取窗口位置和大小
    let bounds = { x: 0, y: 0, width: 0, height: 0 }
    try {
      const { stdout } = await execAsync(`xdotool getwindowgeometry --shell ${id}`)
      const lines = stdout.trim().split('\n')
      const values: Record<string, number> = {}
      
      for (const line of lines) {
        const [key, value] = line.split('=')
        if (key && value) {
          values[key] = parseInt(value, 10)
        }
      }
      
      bounds = {
        x: values.X || 0,
        y: values.Y || 0,
        width: values.WIDTH || 0,
        height: values.HEIGHT || 0,
      }
    } catch {}
    
    // 获取窗口 PID
    let processId = 0
    try {
      const { stdout } = await execAsync(`xdotool getwindowpid ${id}`)
      processId = parseInt(stdout.trim(), 10) || 0
    } catch {}

    // 获取进程名
    let processName = ''
    let processPath = ''
    if (isValidPid(processId)) {
      try {
        const { stdout } = await execAsync(`ps -p ${processId} -o comm=`)
        processName = stdout.trim()

        const { stdout: exePath } = await execAsync(`readlink -f /proc/${processId}/exe`)
        processPath = exePath.trim()
      } catch {}
    }
    
    // 获取屏幕尺寸
    const primaryDisplay = screen.getPrimaryDisplay()
    const screenWidth = primaryDisplay.bounds.width
    const screenHeight = primaryDisplay.bounds.height
    
    const isFullscreen = isWindowFullscreen(bounds, screenWidth, screenHeight)
    
    return {
      id,
      title: title || processName,
      processName,
      processPath,
      processId,
      bounds,
      isFullscreen,
      isMinimized: false,
      isMaximized: false,
    }
  } catch {
    return null
  }
}

/**
 * 通过 xprop 获取窗口属性
 */
async function getWindowPropertiesViaXprop(windowId: string): Promise<Partial<WindowInfo>> {
  if (!isValidWindowId(windowId)) return {}
  try {
    const { stdout } = await execAsync(`xprop -id ${windowId}`)
    const lines = stdout.trim().split('\n')
    
    const properties: Record<string, string> = {}
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        properties[key.trim()] = valueParts.join('=').trim()
      }
    }
    
    // 解析窗口标题
    let title = ''
    if (properties['_NET_WM_NAME']) {
      title = properties['_NET_WM_NAME'].replace(/^"|"$/g, '')
    } else if (properties['WM_NAME']) {
      title = properties['WM_NAME'].replace(/^"|"$/g, '')
    }
    
    // 解析窗口状态
    let isMinimized = false
    let isMaximized = false
    
    if (properties['WM_STATE']) {
      const state = properties['WM_STATE']
      isMinimized = state.includes('Iconic')
    }
    
    if (properties['_NET_WM_STATE']) {
      const state = properties['_NET_WM_STATE']
      isMaximized = state.includes('_NET_WM_STATE_MAXIMIZED_VERT') && 
                    state.includes('_NET_WM_STATE_MAXIMIZED_HORZ')
    }
    
    return {
      title,
      isMinimized,
      isMaximized,
    }
  } catch {
    return {}
  }
}

/**
 * 获取当前活跃窗口信息（X11）
 */
async function getActiveWindowX11(): Promise<WindowInfo | null> {
  // 先用 xdotool 获取基础信息
  const window = await getActiveWindowViaXdotool()
  if (!window) return null
  
  // 用 xprop 获取更详细的信息
  const props = await getWindowPropertiesViaXprop(window.id)
  
  return {
    ...window,
    ...props,
  }
}

/**
 * 获取当前活跃窗口信息（Wayland）
 */
async function getActiveWindowWayland(): Promise<WindowInfo | null> {
  try {
    // Wayland 没有标准的方式来获取活跃窗口
    // 尝试使用 swaymsg（如果使用 Sway）
    if (process.env.SWAYSOCK) {
      const { stdout } = await execAsync('swaymsg -t get_tree')
      const tree = JSON.parse(stdout)
      
      // 递归查找焦点窗口
      function findFocused(node: any): any {
        if (node.focused) return node
        for (const child of node.nodes || []) {
          const found = findFocused(child)
          if (found) return found
        }
        return null
      }
      
      const focused = findFocused(tree)
      if (focused) {
        const primaryDisplay = screen.getPrimaryDisplay()
        const screenWidth = primaryDisplay.bounds.width
        const screenHeight = primaryDisplay.bounds.height
        
        const bounds = {
          x: focused.rect?.x || 0,
          y: focused.rect?.y || 0,
          width: focused.rect?.width || 0,
          height: focused.rect?.height || 0,
        }
        
        return {
          id: String(focused.id || ''),
          title: focused.name || focused.app_id || '',
          processName: focused.app_id || '',
          processPath: '',
          processId: focused.pid || 0,
          bounds,
          isFullscreen: isWindowFullscreen(bounds, screenWidth, screenHeight),
          isMinimized: false,
          isMaximized: focused.type === 'floating_con',
        }
      }
    }
  } catch {}
  
  return null
}

/**
 * 获取当前活跃窗口信息
 */
async function getActiveWindow(): Promise<WindowInfo | null> {
  if (isX11Session()) {
    return getActiveWindowX11()
  } else if (isWaylandSession()) {
    return getActiveWindowWayland()
  }
  
  return null
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
 * 启动 X11 原生事件监听
 */
function startX11NativeListener(): boolean {
  try {
    const { spawn } = require('child_process')
    
    // 使用 xprop 监听窗口变化
    // 这需要 xprop 工具
    const xprop = spawn('xprop', ['-root', '-spy'])
    
    xprop.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      
      // 检查是否是活跃窗口变化
      if (output.includes('_NET_ACTIVE_WINDOW')) {
        checkWindowChange().catch(() => {})
      }
    })
    
    xprop.on('error', () => {
      console.log('[窗口监听] xprop 不可用，回退到轮询模式')
    })
    
    x11ListenerProcess = xprop
    return true
  } catch {
    return false
  }
}

/**
 * Linux 平台监听器实现
 */
export class LinuxWatcher implements PlatformWatcher {
  private isRunning = false
  private useNativeListener = false
  
  start(callback: (rawEvent: any) => void): void {
    if (this.isRunning) {
      console.warn('[窗口监听] Linux 监听器已在运行')
      return
    }
    
    eventCallback = callback
    
    // 尝试使用原生事件监听
    if (isX11Session()) {
      this.useNativeListener = startX11NativeListener()
    }
    
    // 如果原生监听不可用，使用轮询
    if (!this.useNativeListener) {
      console.log('[窗口监听] 使用轮询模式（500ms 间隔）')
      pollTimer = setInterval(() => {
        checkWindowChange().catch(error => {
          console.warn('[窗口监听] 检查窗口变化失败:', error)
        })
      }, POLL_INTERVAL)
    }
    
    // 立即检查一次
    checkWindowChange().catch(() => {})
    
    this.isRunning = true
    console.log(`[窗口监听] Linux 事件监听已启动（${this.useNativeListener ? '原生' : '轮询'}模式）`)
  }
  
  stop(): void {
    if (!this.isRunning) return
    
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    
    if (x11ListenerProcess) {
      x11ListenerProcess.kill()
      x11ListenerProcess = null
    }
    
    this.isRunning = false
    eventCallback = null
    
    console.log('[窗口监听] Linux 事件监听已停止')
  }
  
  getActiveWindow(): WindowInfo | null {
    // 同步版本，返回缓存
    return previousActiveWindow
  }
  
  getAllWindows(): WindowInfo[] {
    return Array.from(windowCache.values())
  }
}
