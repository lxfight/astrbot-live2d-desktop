// TypeScript 类型声明
declare global {
  interface BridgeSessionState {
    sessionId: string
    userId: string
    config: {
      resourceBaseUrl?: string
      resourcePath?: string
      maxInlineBytes?: number
    }
  }

  interface UpdateState {
    status: 'disabled' | 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
    message: string
    currentVersion: string
    latestVersion?: string
    progress?: number
    releaseDate?: string
  }

  interface UpdateCheckResult {
    success: boolean
    message: string
    state: UpdateState
  }

  interface PlatformCapabilities {
    platform: string
    linuxSessionType: 'x11' | 'wayland' | 'unknown' | 'n/a'
    mousePassthroughForward: boolean
    alwaysOnTopLevel: 'default' | 'screen-saver'
    gameMode: {
      supported: boolean
      mode: 'native-window-manager' | 'active-window-heuristic' | 'disabled'
      reason?: string
    }
  }

  /**
   * 窗口事件类型
   */
  type WindowEventType = 
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
  interface WindowInfo {
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
  interface WindowEvent {
    type: WindowEventType
    timestamp: number
    window: WindowInfo
    previousWindow?: WindowInfo  // 上一个活跃窗口（仅 focus 事件）
  }

  /**
   * 窗口监听器配置
   */
  interface WindowWatcherConfig {
    enabled: boolean
    pollInterval?: number
    ignoreTitleKeywords?: string[]
    ignoreProcessNames?: string[]
    detectBrowserUrl?: boolean
  }

  interface Window {
    electron: {
      bridge: {
        connect: (url: string, token?: string) => Promise<{ success: boolean; error?: string }>
        disconnect: () => Promise<{ success: boolean; error?: string }>
        isConnected: () => Promise<boolean>
        getSession: () => Promise<BridgeSessionState | null>
        sendMessage: (payload: any) => Promise<{ success: boolean; error?: string; content?: any[] }>
        sendTouch: (x: number, y: number, action: string) => Promise<{ success: boolean; error?: string }>
        sendState: (op: string, payload: any) => Promise<{ success: boolean; error?: string }>
        onConnected: (callback: (payload: any) => void) => void
        onDisconnected: (callback: (info: any) => void) => void
        onError: (callback: (error: any) => void) => void
        onPerformShow: (callback: (payload: any) => void) => void
        onPerformInterrupt: (callback: () => void) => void
      }
      window: {
        openSettings: (page?: string) => Promise<{ success: boolean }>
        closeSettings: () => Promise<{ success: boolean }>
        minimizeCurrent: () => Promise<{ success: boolean; error?: string }>
        toggleMaximizeCurrent: () => Promise<{ success: boolean; maximized?: boolean; error?: string }>
        isMaximizedCurrent: () => Promise<boolean>
        closeCurrent: () => Promise<{ success: boolean; error?: string }>
        openHistory: () => Promise<{ success: boolean }>
        closeHistory: () => Promise<{ success: boolean }>
        closeWelcome: () => Promise<{ success: boolean }>
        setAlwaysOnTop: (flag: boolean) => Promise<{ success: boolean }>
        getAlwaysOnTop: () => Promise<boolean>
        setIgnoreMouseEvents: (ignore: boolean) => Promise<{ success: boolean }>
        setSize: (width: number, height: number) => Promise<{ success: boolean }>
        resetSize: () => Promise<{ success: boolean }>
        getPassThroughMode: () => Promise<boolean>
        onPassThroughModeChanged: (callback: (enabled: boolean) => void) => void
        onMaximizedChanged: (callback: (maximized: boolean) => void) => void
        openExternal: (url: string) => Promise<{ success: boolean }>
        openResource: (source: string, suggestedName?: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>
        saveResource: (source: string, suggestedName?: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>
        getAppVersion: () => Promise<string>
        getPlatformCapabilities: () => Promise<PlatformCapabilities>
        
        // 窗口事件监听
        startWatching: () => Promise<{ success: boolean; error?: string }>
        getActiveWindow: () => Promise<WindowInfo | null>
        getWindowHistory: () => Promise<Array<{ window: WindowInfo; timestamp: number }>>
        getAllWindows: () => Promise<WindowInfo[]>
        buildAIContext: () => Promise<{
          currentApp: string | null
          currentTitle: string | null
          isFullscreen: boolean
          recentApps: string[]
        }>
        updateWatcherConfig: (config: Partial<WindowWatcherConfig>) => Promise<{ success: boolean }>
        onWindowEvent: (callback: (event: WindowEvent) => void) => void
      }
      settings: {
        getPendingPage: () => Promise<string | null>
        onNavigateTo: (callback: (page: string) => void) => void
      }
      user: {
        setUserName: (name: string) => Promise<{ success: boolean }>
        getUserName: () => Promise<string | null>
        getUserId: () => Promise<string>
      }
      history: {
        getMessages: (options: any) => Promise<{ success: boolean; data?: any[]; error?: string }>
        saveMessage: (record: any) => Promise<{ success: boolean; error?: string }>
        savePerformance: (record: any) => Promise<{ success: boolean; error?: string }>
        updateStatistics: (data: any) => Promise<{ success: boolean; error?: string }>
        getStatistics: (startDate: string, endDate: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        getAverageResponseTime: (startDate: number, endDate: number) => Promise<{ success: boolean; data?: number; error?: string }>
        clearHistory: () => Promise<{ success: boolean; error?: string }>
      }
      model: {
        selectFolder: () => Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }>
        import: (sourceDir: string, modelName: string) => Promise<{
          success: boolean;
          modelPath?: string;
          chosenFile?: string;
          modelFiles?: string[];
          error?: string
        }>
        getList: () => Promise<{ success: boolean; models?: Array<{ name: string; path: string }>; error?: string }>
        delete: (modelName: string) => Promise<{ success: boolean; error?: string }>
        load: (modelPath: string) => Promise<{ success: boolean; error?: string }>
        onLoad: (callback: (modelPath: string) => void) => void
      }
      shortcut: {
        register: (accelerator: string) => Promise<{ success: boolean; error?: string }>
        unregister: () => Promise<{ success: boolean; error?: string }>
        isRegistered: (accelerator: string) => Promise<boolean>
        onRecordingStart: (callback: () => void) => void
        onRecordingStop: (callback: () => void) => void
      }
      log: {
        debug: (...args: any[]) => void
        info: (...args: any[]) => void
        warn: (...args: any[]) => void
        error: (...args: any[]) => void
        getDirectory: () => Promise<string>
        openDirectory: () => Promise<{ success: boolean; path: string; error?: string }>
        setLevel: (level: 'info' | 'debug') => Promise<{ success: boolean; level: 'info' | 'debug' }>
        getConfig: () => Promise<{ level: 'info' | 'debug'; retentionDays: number }>
      }
      update: {
        check: () => Promise<UpdateCheckResult>
        getState: () => Promise<UpdateState>
        quitAndInstall: () => Promise<{ success: boolean; message: string }>
        onStateChanged: (callback: (state: UpdateState) => void) => void
      }
    }
  }
}

export {}
