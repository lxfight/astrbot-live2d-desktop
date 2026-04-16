import type { WindowEventType } from './windowWatcherConfig'
export type { WindowEventType, WindowWatcherConfig } from './windowWatcherConfig'
import * as windowWatcherConfigModule from './windowWatcherConfig'
import { BUILTIN_IGNORE_RULES } from './windowWatcherConfig'

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
  previousWindow?: WindowInfo | null  // 上一个活跃窗口（仅 focus 事件）
}

/**
 * 窗口事件监听器回调
 */
export type WindowEventCallback = (event: WindowEvent) => void

/**
 * 应用启动回调
 */
export type AppLaunchCallback = (appName: string, processName: string) => void

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
 * 窗口监听器管理器
 * 
 * 统一管理各平台的窗口事件监听，提供以下功能：
 * 1. 自动选择平台特定的监听器
 * 2. 事件过滤和转换
 * 3. 状态缓存和查询
 * 4. AI 上下文构建
 * 5. 节流控制（防止频繁触发）
 */
import { WindowThrottler } from './windowThrottler'

export class WindowWatcherManager {
  private platformWatcher: PlatformWatcher | null = null
  private listeners: Set<WindowEventCallback> = new Set()
  private isRunning = false

  // 配置和节流器（延迟加载）
  private configModule: any = null
  private throttler: any = null
  private config: any = null

  // 状态
  private currentWindow: WindowInfo | null = null
  private previousWindow: WindowInfo | null = null
  private windowHistory: Array<{ window: WindowInfo; timestamp: number }> = []

  // 应用启动检测
  private appLaunchActive = false
  private knownAppKeys: Set<string> = new Set()
  private appLaunchDetections: Map<string, { count: number; firstSeen: number }> = new Map()
  private appLaunchListeners: Set<AppLaunchCallback> = new Set()

  // 应用启动防抖
  private recentSwitchTimestamps: number[] = []
  private lastObservedAppKey = ''
  private suppressAppEventUntil = 0
  private lastAppEventTs = 0

  private static readonly FREQ_THRESHOLD = 3
  private static readonly FREQ_WINDOW_MS = 3 * 60 * 60 * 1000
  private static readonly APP_SWITCH_DEBOUNCE_WINDOW_MS = 20 * 1000
  private static readonly APP_SWITCH_DEBOUNCE_THRESHOLD = 4
  private static readonly APP_SWITCH_SUPPRESS_MS = 15 * 1000
  private static readonly APP_EVENT_MIN_INTERVAL_MS = 4 * 1000
  
  constructor() {
    // 平台监听器将在 start() 方法中初始化
  }
  
  /**
   * 创建平台特定的监听器
   */
  private async createPlatformWatcher(): Promise<PlatformWatcher | null> {
    try {
      switch (process.platform) {
        case 'win32': {
          const { WindowsWatcher } = await import('./windowsWatcher')
          return new WindowsWatcher()
        }
        case 'darwin': {
          const { MacOSWatcher } = await import('./macosWatcher')
          return new MacOSWatcher()
        }
        case 'linux': {
          const { LinuxWatcher } = await import('./linuxWatcher')
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
   * 加载配置模块
   */
  private async loadConfigModule(): Promise<void> {
    if (this.configModule) return
    
    try {
      this.configModule = windowWatcherConfigModule
      
      // 加载配置
      this.config = await this.configModule.loadConfig()
      
      // 创建节流器
      this.throttler = new WindowThrottler(this.config)
      
      console.log('[窗口监听] 配置加载完成')
    } catch (error) {
      console.error('[窗口监听] 加载配置模块失败:', error)
      // 使用默认配置
      this.config = {
        enabled: true,
        throttle: { globalInterval: 1000, perWindowInterval: 3000, minInterval: 100 },
        events: { focus: true, blur: false, create: true, destroy: false, fullscreen: true, windowed: false, resize: false, move: false, minimize: false, maximize: false, restore: false },
        ignore: { processNames: ['dwm.exe', 'csrss.exe', 'explorer.exe'], titleKeywords: ['Program Manager', '锁屏', 'Lock Screen'] },
        aiResponse: { mode: 'first-open', specificApps: [] },
      }
    }
  }
  
  /**
   * 启动监听
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[窗口监听] 监听器已在运行')
      return
    }
    
    // 初始化平台监听器
    if (!this.platformWatcher) {
      this.platformWatcher = await this.createPlatformWatcher()
    }
    
    if (!this.platformWatcher) {
      console.error('[窗口监听] 平台监听器不可用')
      return
    }
    
    // 加载配置
    await this.loadConfigModule()
    
    if (!this.config?.enabled) {
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

    // 销毁节流器
    if (this.throttler) {
      this.throttler.destroy()
      this.throttler = null
    }

    this.currentWindow = null
    this.previousWindow = null
    this.windowHistory = []

    // 停止应用启动检测
    this.stopAppLaunchDetection()

    this.isRunning = false
    console.log('[窗口监听] WindowWatcherManager 已停止')
  }
  
  /**
   * 处理窗口事件
   */
  private handleWindowEvent(event: WindowEvent): void {
    // 使用节流器检查是否应该触发
    if (this.throttler) {
      const { shouldTrigger, reason } = this.throttler.shouldTrigger(event)
      if (!shouldTrigger) {
        console.log(`[窗口监听] 事件被节流: ${reason}`)
        return
      }
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

      // 应用启动检测
      if (this.appLaunchActive) {
        this.detectAppLaunch(event.window)
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
  async updateConfig(config: any): Promise<void> {
    if (!this.configModule) {
      await this.loadConfigModule()
    }
    
    // 验证并保存配置
    this.config = this.configModule.validateConfig(config)
    await this.configModule.saveConfig(this.config)
    
    // 更新节流器配置
    if (this.throttler) {
      this.throttler.updateConfig(this.config)
    }
    
    // 如果禁用了监听器，停止它
    if (!this.config.enabled && this.isRunning) {
      this.stop()
    }
    
    // 如果启用了监听器，启动它
    if (this.config.enabled && !this.isRunning) {
      await this.start()
    }
    
    console.log('[窗口监听] 配置已更新')
  }
  
  /**
   * 获取当前配置
   */
  async getConfig(): Promise<any> {
    if (!this.config) {
      await this.loadConfigModule()
    }
    return { ...this.config }
  }
  
  /**
   * 重置配置
   */
  async resetConfig(): Promise<void> {
    if (!this.configModule) {
      await this.loadConfigModule()
    }
    
    this.config = await this.configModule.resetConfig()
    
    // 更新节流器配置
    if (this.throttler) {
      this.throttler.updateConfig(this.config)
    }

    if (!this.config.enabled && this.isRunning) {
      this.stop()
    }

    if (this.config.enabled && !this.isRunning) {
      await this.start()
    }
    
    console.log('[窗口监听] 配置已重置')
  }
  
  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.isRunning
  }

  // ──────── 应用启动检测 ────────

  /**
   * 启动应用启动检测
   */
  async startAppLaunchDetection(): Promise<void> {
    if (!this.config) {
      await this.loadConfigModule()
    }
    if (!this.config?.enabled || !this.config?.appLaunchEnabled) {
      this.stopAppLaunchDetection()
      console.log('[应用启动] 应用启动检测已禁用')
      return
    }

    this.appLaunchActive = true
    this.knownAppKeys.clear()
    this.appLaunchDetections.clear()
    this.resetAppSwitchDebounceState()

    // 种子：常见的 shell 窗口
    this.seedKnownAppName('explorer.exe')
    this.seedKnownAppName('Explorer')
    this.seedKnownAppName('Windows Explorer')
    this.seedKnownAppName('File Explorer')
    this.seedKnownAppName('资源管理器')
    this.seedKnownAppName('文件资源管理器')

    // 从当前活跃窗口构建基线
    if (this.currentWindow) {
      this.seedKnownAppName(this.currentWindow.processName)
    }

    console.log('[应用启动] 应用启动检测已启动')
  }

  /**
   * 停止应用启动检测
   */
  stopAppLaunchDetection(): void {
    this.appLaunchActive = false
    this.knownAppKeys.clear()
    this.appLaunchDetections.clear()
    this.resetAppSwitchDebounceState()
    console.log('[应用启动] 应用启动检测已停止')
  }

  /**
   * 注册应用启动回调
   */
  onAppLaunch(callback: AppLaunchCallback): () => void {
    this.appLaunchListeners.add(callback)
    return () => this.appLaunchListeners.delete(callback)
  }

  private seedKnownAppName(name: string): void {
    const key = this.toAppKey(name)
    if (key) this.knownAppKeys.add(key)
  }

  private toAppKey(name: string): string {
    return name.trim().toLowerCase()
  }

  private resetAppSwitchDebounceState(): void {
    this.recentSwitchTimestamps = []
    this.lastObservedAppKey = ''
    this.suppressAppEventUntil = 0
    this.lastAppEventTs = 0
  }

  /**
   * 判断应用是否应被忽略
   */
  private shouldIgnoreApp(processName: string, title: string): boolean {
    const normalized = processName.trim()
    if (!normalized || normalized.length <= 2) return true

    const appKey = this.toAppKey(normalized)

    // 精确匹配进程名
    const allProcessNames = BUILTIN_IGNORE_RULES.processNames.map((n: string) => n.toLowerCase())
    if (allProcessNames.includes(appKey)) return true

    // 精确匹配标题关键词
    const titleLower = title.toLowerCase()
    for (const kw of BUILTIN_IGNORE_RULES.titleKeywords) {
      if (titleLower === kw.toLowerCase()) return true
    }

    // 部分匹配关键词
    const tokens = [appKey, titleLower]
    for (const kw of BUILTIN_IGNORE_RULES.ignoreKeywords) {
      if (tokens.some((t) => t.includes(kw.toLowerCase()))) return true
    }

    // 频率抑制
    const now = Date.now()
    const freq = this.appLaunchDetections.get(appKey)
    if (freq) {
      if (now - freq.firstSeen > WindowWatcherManager.FREQ_WINDOW_MS) {
        this.appLaunchDetections.set(appKey, { count: 1, firstSeen: now })
        return false
      }
      if (freq.count >= WindowWatcherManager.FREQ_THRESHOLD) return true
    }

    return false
  }

  private recordAppLaunch(appName: string): void {
    const appKey = this.toAppKey(appName)
    if (!appKey) return
    const now = Date.now()
    const freq = this.appLaunchDetections.get(appKey)
    if (freq && now - freq.firstSeen <= WindowWatcherManager.FREQ_WINDOW_MS) {
      freq.count++
    } else {
      this.appLaunchDetections.set(appKey, { count: 1, firstSeen: now })
    }
  }

  private shouldDebounceAppLaunch(appKey: string, now: number): boolean {
    if (this.lastObservedAppKey && this.lastObservedAppKey !== appKey) {
      this.recentSwitchTimestamps.push(now)
    }
    this.lastObservedAppKey = appKey

    const cutoff = now - WindowWatcherManager.APP_SWITCH_DEBOUNCE_WINDOW_MS
    this.recentSwitchTimestamps = this.recentSwitchTimestamps.filter((ts) => ts >= cutoff)

    if (this.recentSwitchTimestamps.length >= WindowWatcherManager.APP_SWITCH_DEBOUNCE_THRESHOLD) {
      this.suppressAppEventUntil = Math.max(this.suppressAppEventUntil, now + WindowWatcherManager.APP_SWITCH_SUPPRESS_MS)
      this.recentSwitchTimestamps = []
      return true
    }

    if (now < this.suppressAppEventUntil) return true
    if (this.lastAppEventTs > 0 && now - this.lastAppEventTs < WindowWatcherManager.APP_EVENT_MIN_INTERVAL_MS) return true

    return false
  }

  /**
   * 检测应用启动（在 focus 事件中调用）
   */
  private detectAppLaunch(window: WindowInfo): void {
    const processName = window.processName || ''
    const title = window.title || ''
    const appKey = this.toAppKey(processName)
    if (!appKey) return

    const now = Date.now()
    if (this.shouldDebounceAppLaunch(appKey, now)) return

    if (this.knownAppKeys.has(appKey)) return

    if (this.shouldIgnoreApp(processName, title)) {
      this.knownAppKeys.add(appKey)
      return
    }

    this.recordAppLaunch(processName)
    this.knownAppKeys.add(appKey)
    this.lastAppEventTs = now

    // 通知所有监听器
    for (const listener of this.appLaunchListeners) {
      try {
        listener(processName, processName)
      } catch (error) {
        console.error('[应用启动] 回调执行失败:', error)
      }
    }
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
