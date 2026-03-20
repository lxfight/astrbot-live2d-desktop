/**
 * 窗口事件类型
 */
export type WindowEventType = 
  | 'focus'      // 窗口获得焦点
  | 'blur'       // 窗口失去焦点
  | 'create'     // 窗口创建
  | 'destroy'    // 窗口销毁
  | 'resize'     // 窗口大小变化
  | 'move'       // 窗口位置变化
  | 'minimize'   // 窗口最小化
  | 'maximize'   // 窗口最大化
  | 'restore'    // 窗口恢复
  | 'fullscreen' // 窗口进入全屏
  | 'windowed'   // 窗口退出全屏

/**
 * 窗口信息
 */
export interface WindowInfo {
  id: string              // 窗口唯一标识（HWND 或其他）
  title: string           // 窗口标题
  processName: string     // 进程名（如 chrome.exe）
  processPath: string     // 进程路径
  processId: number       // 进程 ID
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  isFullscreen: boolean
  isMinimized: boolean
  isMaximized: boolean
  url?: string            // 浏览器窗口的 URL
  className?: string      // 窗口类名（Windows）
}

/**
 * 窗口事件
 */
export interface WindowEvent {
  type: WindowEventType
  timestamp: number
  window: WindowInfo
  previousWindow?: WindowInfo  // 上一个活跃窗口（仅 focus 事件）
}

/**
 * 窗口事件监听器回调
 */
export type WindowEventCallback = (event: WindowEvent) => void

/**
 * 平台特定的窗口监听器接口
 */
export interface PlatformWatcher {
  start(callback: (rawEvent: any) => void): void
  stop(): void
  getActiveWindow(): WindowInfo | null
  getAllWindows(): WindowInfo[]
}

/**
 * 窗口监听器配置
 */
export interface WindowWatcherConfig {
  // 是否启用
  enabled: boolean
  
  // 检测间隔（仅用于 fallback 轮询模式）
  pollInterval?: number
  
  // 忽略的窗口标题关键词
  ignoreTitleKeywords?: string[]
  
  // 忽略的进程名
  ignoreProcessNames?: string[]
  
  // 是否检测浏览器 URL
  detectBrowserUrl?: boolean
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: WindowWatcherConfig = {
  enabled: true,
  pollInterval: 1000,  // 1 秒（仅 fallback 模式使用）
  ignoreTitleKeywords: [
    'Program Manager',
    'Windows Shell Experience Host',
    'LockApp',
    'Lock Screen',
    '锁屏',
  ],
  ignoreProcessNames: [
    'dwm.exe',           // Desktop Window Manager
    'csrss.exe',         // Client Server Runtime Process
  ],
  detectBrowserUrl: true,
}

/**
 * 检查窗口是否全屏
 */
export function isWindowFullscreen(
  bounds: { x: number; y: number; width: number; height: number },
  screenWidth: number,
  screenHeight: number
): boolean {
  const tolerance = 20  // 允许的误差像素
  return (
    bounds.width >= screenWidth - tolerance &&
    bounds.height >= screenHeight - tolerance &&
    Math.abs(bounds.x) <= tolerance &&
    Math.abs(bounds.y) <= tolerance
  )
}

/**
 * 检查窗口是否应该被忽略
 */
export function shouldIgnoreWindow(
  window: WindowInfo,
  config: WindowWatcherConfig
): boolean {
  // 检查进程名
  if (config.ignoreProcessNames?.includes(window.processName)) {
    return true
  }
  
  // 检查标题关键词
  const lowerTitle = window.title.toLowerCase()
  if (config.ignoreTitleKeywords?.some(keyword => 
    lowerTitle.includes(keyword.toLowerCase())
  )) {
    return true
  }
  
  // 忽略空标题
  if (!window.title.trim()) {
    return true
  }
  
  return false
}

/**
 * 窗口监听器管理器
 * 
 * 统一管理各平台的窗口事件监听，提供以下功能：
 * 1. 自动选择平台特定的监听器
 * 2. 事件过滤和转换
 * 3. 状态缓存和查询
 * 4. AI 上下文构建
 */
export class WindowWatcherManager {
  private platformWatcher: PlatformWatcher | null = null
  private listeners: Set<WindowEventCallback> = new Set()
  private config: WindowWatcherConfig
  private isRunning = false
  
  // 状态
  private currentWindow: WindowInfo | null = null
  private previousWindow: WindowInfo | null = null
  private windowHistory: Array<{ window: WindowInfo; timestamp: number }> = []
  
  constructor(config: Partial<WindowWatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.platformWatcher = this.createPlatformWatcher()
  }
  
  /**
   * 创建平台特定的监听器
   */
  private createPlatformWatcher(): PlatformWatcher | null {
    try {
      switch (process.platform) {
        case 'win32': {
          const { WindowsWatcher } = require('./windowsWatcher')
          return new WindowsWatcher()
        }
        case 'darwin': {
          const { MacOSWatcher } = require('./macosWatcher')
          return new MacOSWatcher()
        }
        case 'linux': {
          const { LinuxWatcher } = require('./linuxWatcher')
          return new LinuxWatcher()
        }
        default:
          console.warn(`[窗口监听] 不支持的平台: ${process.platform}`)
          return null
      }
    } catch (error) {
      console.error('[窗口监听] 创建平台监听器失败:', error)
      return null
    }
  }
  
  /**
   * 启动监听
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[窗口监听] 监听器已在运行')
      return
    }
    
    if (!this.platformWatcher) {
      console.error('[窗口监听] 平台监听器不可用')
      return
    }
    
    if (!this.config.enabled) {
      console.log('[窗口监听] 监听器已禁用')
      return
    }
    
    // 启动平台监听器
    this.platformWatcher.start((event: WindowEvent) => {
      this.handleWindowEvent(event)
    })
    
    // 获取初始状态
    const activeWindow = this.platformWatcher.getActiveWindow()
    if (activeWindow) {
      this.currentWindow = activeWindow
      this.windowHistory.push({ window: activeWindow, timestamp: Date.now() })
    }
    
    this.isRunning = true
    console.log('[窗口监听] WindowWatcherManager 已启动')
  }
  
  /**
   * 停止监听
   */
  stop(): void {
    if (!this.isRunning) return
    
    this.platformWatcher?.stop()
    this.isRunning = false
    
    console.log('[窗口监听] WindowWatcherManager 已停止')
  }
  
  /**
   * 处理窗口事件
   */
  private handleWindowEvent(event: WindowEvent): void {
    // 应用过滤规则
    if (shouldIgnoreWindow(event.window, this.config)) {
      return
    }
    
    // 更新状态
    if (event.type === 'focus') {
      this.previousWindow = this.currentWindow
      this.currentWindow = event.window
      
      // 添加到历史记录
      this.windowHistory.push({ window: event.window, timestamp: event.timestamp })
      
      // 限制历史记录长度
      if (this.windowHistory.length > 100) {
        this.windowHistory = this.windowHistory.slice(-50)
      }
    } else if (event.type === 'blur') {
      this.previousWindow = this.currentWindow
      this.currentWindow = null
    } else {
      // 更新当前窗口信息
      if (this.currentWindow?.id === event.window.id) {
        this.currentWindow = event.window
      }
    }
    
    // 转换全屏事件
    if (event.type === 'maximize' && event.window.isFullscreen) {
      event.type = 'fullscreen'
    } else if (event.type === 'restore' && !event.window.isFullscreen) {
      event.type = 'windowed'
    }
    
    // 通知所有监听器
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[窗口监听] 监听器回调执行失败:', error)
      }
    }
  }
  
  /**
   * 添加事件监听器
   */
  onWindowEvent(callback: WindowEventCallback): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }
  
  /**
   * 移除事件监听器
   */
  offWindowEvent(callback: WindowEventCallback): void {
    this.listeners.delete(callback)
  }
  
  /**
   * 获取当前活跃窗口
   */
  getCurrentWindow(): WindowInfo | null {
    return this.currentWindow
  }
  
  /**
   * 获取上一个活跃窗口
   */
  getPreviousWindow(): WindowInfo | null {
    return this.previousWindow
  }
  
  /**
   * 获取窗口历史记录
   */
  getWindowHistory(): Array<{ window: WindowInfo; timestamp: number }> {
    return [...this.windowHistory]
  }
  
  /**
   * 获取所有已知窗口
   */
  getAllWindows(): WindowInfo[] {
    return this.platformWatcher?.getAllWindows() || []
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<WindowWatcherConfig>): void {
    this.config = { ...this.config, ...config }
    
    // 如果禁用了监听器，停止它
    if (!this.config.enabled && this.isRunning) {
      this.stop()
    }
    
    // 如果启用了监听器，启动它
    if (this.config.enabled && !this.isRunning) {
      this.start()
    }
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): WindowWatcherConfig {
    return { ...this.config }
  }
  
  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.isRunning
  }
  
  /**
   * 构建 AI 上下文信息
   */
  buildAIContext(): {
    currentApp: string | null
    currentTitle: string | null
    isFullscreen: boolean
    recentApps: string[]
  } {
    const recentApps = this.windowHistory
      .slice(-10)
      .map(item => item.window.processName)
      .filter((name, index, arr) => arr.indexOf(name) === index)
    
    return {
      currentApp: this.currentWindow?.processName || null,
      currentTitle: this.currentWindow?.title || null,
      isFullscreen: this.currentWindow?.isFullscreen || false,
      recentApps,
    }
  }
}

// 导出单例实例
let instance: WindowWatcherManager | null = null

export function getWindowWatcher(): WindowWatcherManager {
  if (!instance) {
    instance = new WindowWatcherManager()
  }
  return instance
}

export function destroyWindowWatcher(): void {
  if (instance) {
    instance.stop()
    instance = null
  }
}
