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
  previousWindow?: WindowInfo | null  // 上一个活跃窗口（仅 focus 事件）
}

/**
 * 窗口事件监听器回调
 */
export type WindowEventCallback = (event: WindowEvent) => void

/**
 * 窗口监听器配置
 */
export interface WindowWatcherConfig {
  enabled: boolean
  throttle: {
    globalInterval: number
    perWindowInterval: number
    minInterval: number
  }
  events: {
    focus: boolean
    blur: boolean
    create: boolean
    destroy: boolean
    fullscreen: boolean
    windowed: boolean
    resize: boolean
    move: boolean
    minimize: boolean
    maximize: boolean
    restore: boolean
  }
  ignore: {
    processNames: string[]
    titleKeywords: string[]
  }
  aiResponse: {
    mode: 'first-open' | 'every-switch' | 'specific-apps'
    specificApps: string[]
  }
}

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
      this.configModule = await import('./windowWatcherConfig')
      const { WindowThrottler } = await import('./windowThrottler')
      
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
    
    console.log('[窗口监听] 配置已重置')
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
