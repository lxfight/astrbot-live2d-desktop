// TypeScript 类型声明
// 从 windowWatcher.ts 导入窗口相关类型
import type { 
  WindowEventType as _WindowEventType, 
  WindowInfo as _WindowInfo, 
  WindowEvent as _WindowEvent, 
  WindowWatcherConfig as _WindowWatcherConfig 
} from '../../electron/utils/windowWatcher'
import type { DesktopFeatureSettings as _DesktopFeatureSettings } from '../utils/desktopFeatureSettings'
import type { UpdaterSettings as _UpdaterSettings } from '../utils/updaterSettings'
import type { ScreenshotSettings as _ScreenshotSettings } from '../utils/screenshotSettings'
import type {
  DesktopBehaviorEffectiveState as _DesktopBehaviorEffectiveState,
  DesktopBehaviorRuntimeState as _DesktopBehaviorRuntimeState,
  DesktopBehaviorSnapshot as _DesktopBehaviorSnapshot,
  DesktopRevealReason as _DesktopRevealReason,
} from '../../electron/desktopBehavior/types'

declare global {
  type Unsubscribe = () => void
  // 重新导出窗口相关类型
  type WindowEventType = _WindowEventType
  type WindowInfo = _WindowInfo
  type WindowEvent = _WindowEvent
  type WindowWatcherConfig = _WindowWatcherConfig
  type DesktopFeatureSettings = _DesktopFeatureSettings
  type UpdaterSettings = _UpdaterSettings
  type ScreenshotSettings = _ScreenshotSettings
  type DesktopBehaviorEffectiveState = _DesktopBehaviorEffectiveState
  type DesktopBehaviorRuntimeState = _DesktopBehaviorRuntimeState
  type DesktopBehaviorSnapshot = _DesktopBehaviorSnapshot
  type DesktopRevealReason = _DesktopRevealReason
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
        onConnected: (callback: (payload: any) => void) => Unsubscribe
        onDisconnected: (callback: (info: any) => void) => Unsubscribe
        onError: (callback: (error: any) => void) => Unsubscribe
        onPerformShow: (callback: (payload: any) => void) => Unsubscribe
        onPerformInterrupt: (callback: () => void) => Unsubscribe
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
        getScreenshotSettings: () => Promise<ScreenshotSettings>
        updateScreenshotSettings: (settings: Partial<ScreenshotSettings>) => Promise<ScreenshotSettings>
        onMaximizedChanged: (callback: (maximized: boolean) => void) => Unsubscribe
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
        getWatcherConfig: () => Promise<WindowWatcherConfig>
        updateWatcherConfig: (config: Partial<WindowWatcherConfig>) => Promise<{ success: boolean }>
        resetWatcherConfig: () => Promise<{ success: boolean; config: WindowWatcherConfig }>
        onWindowEvent: (callback: (event: WindowEvent) => void) => Unsubscribe
      }
      desktopBehavior: {
        getPreferences: () => Promise<DesktopFeatureSettings>
        updatePreferences: (config: Partial<DesktopFeatureSettings>) => Promise<DesktopFeatureSettings>
        getSnapshot: () => Promise<DesktopBehaviorSnapshot>
        setMousePassthrough: (ignoreMouseEvents: boolean) => Promise<boolean>
        setModelReady: (ready: boolean) => Promise<DesktopBehaviorSnapshot>
        requestReveal: (reason?: DesktopRevealReason) => Promise<DesktopBehaviorSnapshot>
        onSnapshotChanged: (callback: (snapshot: DesktopBehaviorSnapshot) => void) => Unsubscribe
      }
      settings: {
        getPendingPage: () => Promise<string | null>
        onNavigateTo: (callback: (page: string) => void) => Unsubscribe
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
          warnings?: string[];
          manifest?: {
            modelFile: string;
            moc: string;
            textures: string[];
            motions: string[];
            expressions: string[];
            physics?: string;
            pose?: string;
            userData?: string;
          };
          error?: string
        }>
        getList: () => Promise<{ success: boolean; models?: Array<{ name: string; path: string }>; error?: string }>
        delete: (modelName: string) => Promise<{ success: boolean; error?: string }>
        load: (modelPath: string) => Promise<{ success: boolean; error?: string }>
        onLoad: (callback: (modelPath: string) => void) => Unsubscribe
      }
      shortcut: {
        register: (accelerator: string) => Promise<{ success: boolean; error?: string }>
        unregister: () => Promise<{ success: boolean; error?: string }>
        isRegistered: (accelerator: string) => Promise<boolean>
        setRecordingState: (recording: boolean) => Promise<{ success: boolean; isRecording: boolean }>
        onRecordingStart: (callback: () => void) => Unsubscribe
        onRecordingStop: (callback: () => void) => Unsubscribe
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
        getSettings: () => Promise<UpdaterSettings>
        updateSettings: (settings: Partial<UpdaterSettings>) => Promise<UpdaterSettings>
        quitAndInstall: () => Promise<{ success: boolean; message: string }>
        onStateChanged: (callback: (state: UpdateState) => void) => Unsubscribe
      }
      secureStorage: {
        isEncryptionAvailable: () => boolean
        encryptString: (value: string) => string
        decryptString: (value: string) => string
      }
    }
  }
}

export {}
