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
import type {
  BridgeLifecycleCommandResult as _BridgeLifecycleCommandResult,
  BridgeLifecycleSnapshot as _BridgeLifecycleSnapshot,
  BridgeSessionState as _BridgeSessionState,
} from '../shared/bridgeLifecycle'
import type {
  ConnectionBehaviorSettingsChangedEvent as _ConnectionBehaviorSettingsChangedEvent,
  ConnectionBehaviorSettingsLoadResult as _ConnectionBehaviorSettingsLoadResult,
  ConnectionBehaviorSettingsMigrateLegacyResult as _ConnectionBehaviorSettingsMigrateLegacyResult,
  ConnectionBehaviorSettingsSavePayload as _ConnectionBehaviorSettingsSavePayload,
  ConnectionBehaviorSettingsSaveResult as _ConnectionBehaviorSettingsSaveResult,
  ConnectionBehaviorSettingsPersistedV1 as _ConnectionBehaviorSettingsPersistedV1,
} from '../shared/connectionBehaviorSettings'
import type {
  ConnectionSettingsChangedEvent as _ConnectionSettingsChangedEvent,
  ConnectionSettingsLoadResult as _ConnectionSettingsLoadResult,
  ConnectionSettingsMigrateLegacyResult as _ConnectionSettingsMigrateLegacyResult,
  ConnectionSettingsSavePayload as _ConnectionSettingsSavePayload,
  ConnectionSettingsSaveResult as _ConnectionSettingsSaveResult,
} from '../shared/connectionSettings'
import type {
  HistoryGetMessagesResult as _HistoryGetMessagesResult,
  HistoryMessageQueryOptions as _HistoryMessageQueryOptions,
  HistoryMessageRecord as _HistoryMessageRecord,
  HistorySaveMessageResult as _HistorySaveMessageResult,
} from '../shared/history'

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
  type BridgeLifecycleCommandResult = _BridgeLifecycleCommandResult
  type BridgeLifecycleSnapshot = _BridgeLifecycleSnapshot
  type BridgeSessionState = _BridgeSessionState
  type ConnectionBehaviorSettingsChangedEvent = _ConnectionBehaviorSettingsChangedEvent
  type ConnectionBehaviorSettingsLoadResult = _ConnectionBehaviorSettingsLoadResult
  type ConnectionBehaviorSettingsSavePayload = _ConnectionBehaviorSettingsSavePayload
  type ConnectionBehaviorSettingsSaveResult = _ConnectionBehaviorSettingsSaveResult
  type ConnectionBehaviorSettingsMigrateLegacyResult = _ConnectionBehaviorSettingsMigrateLegacyResult
  type ConnectionBehaviorSettingsPersistedV1 = _ConnectionBehaviorSettingsPersistedV1
  type ConnectionSettingsChangedEvent = _ConnectionSettingsChangedEvent
  type ConnectionSettingsLoadResult = _ConnectionSettingsLoadResult
  type ConnectionSettingsSavePayload = _ConnectionSettingsSavePayload
  type ConnectionSettingsSaveResult = _ConnectionSettingsSaveResult
  type ConnectionSettingsMigrateLegacyResult = _ConnectionSettingsMigrateLegacyResult
  type HistoryMessageQueryOptions = _HistoryMessageQueryOptions
  type HistoryMessageRecord = _HistoryMessageRecord
  type HistoryGetMessagesResult = _HistoryGetMessagesResult
  type HistorySaveMessageResult = _HistorySaveMessageResult

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
        getSession: () => Promise<BridgeSessionState | null>
        sendMessage: (payload: any) => Promise<{ success: boolean; error?: string; content?: any[] }>
        sendTouch: (x: number, y: number, action: string) => Promise<{ success: boolean; error?: string }>
        sendState: (op: string, payload: any) => Promise<{ success: boolean; error?: string }>
        onPerformShow: (callback: (payload: any) => void) => Unsubscribe
        onPerformInterrupt: (callback: () => void) => Unsubscribe
      }
      bridgeLifecycle: {
        getSnapshot: () => Promise<BridgeLifecycleSnapshot>
        connect: () => Promise<BridgeLifecycleCommandResult>
        disconnect: () => Promise<BridgeLifecycleCommandResult>
        onStateChanged: (callback: (snapshot: BridgeLifecycleSnapshot) => void) => Unsubscribe
      }
      window: {
        openSettings: (page?: string) => Promise<{ success: boolean }>
        closeSettings: () => Promise<{ success: boolean }>
        minimizeCurrent: () => Promise<{ success: boolean; error?: string }>
        toggleMaximizeCurrent: () => Promise<{ success: boolean; maximized?: boolean; error?: string }>
        isMaximizedCurrent: () => Promise<boolean>
        closeCurrent: () => Promise<{ success: boolean; error?: string }>
        notifyRendererReady: (windowKind: string) => Promise<{ success: boolean; error?: string }>
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
      connectionSettings: {
        load: () => Promise<ConnectionSettingsLoadResult>
        save: (payload: ConnectionSettingsSavePayload) => Promise<ConnectionSettingsSaveResult>
        migrateLegacy: (rawLegacyJson: string) => Promise<ConnectionSettingsMigrateLegacyResult>
        onChanged: (callback: (event: ConnectionSettingsChangedEvent) => void) => Unsubscribe
      }
      connectionBehaviorSettings: {
        load: () => Promise<ConnectionBehaviorSettingsLoadResult>
        save: (payload: ConnectionBehaviorSettingsSavePayload) => Promise<ConnectionBehaviorSettingsSaveResult>
        migrateLegacy: (rawLegacyJson: string) => Promise<ConnectionBehaviorSettingsMigrateLegacyResult>
        onChanged: (callback: (event: ConnectionBehaviorSettingsChangedEvent) => void) => Unsubscribe
      }
      history: {
        getMessages: (options: HistoryMessageQueryOptions) => Promise<HistoryGetMessagesResult>
        saveMessage: (record: HistoryMessageRecord) => Promise<HistorySaveMessageResult>
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
        getConfig: () => Promise<{ level: 'info' | 'debug'; retentionDays: number; maxFileBytes: number }>
        exportBundle: (days?: number) => Promise<{ success: boolean; path: string; count: number; error?: string }>
      }
      update: {
        check: () => Promise<UpdateCheckResult>
        getState: () => Promise<UpdateState>
        getSettings: () => Promise<UpdaterSettings>
        updateSettings: (settings: Partial<UpdaterSettings>) => Promise<UpdaterSettings>
        quitAndInstall: () => Promise<{ success: boolean; message: string }>
        onStateChanged: (callback: (state: UpdateState) => void) => Unsubscribe
      }
    }
  }
}

export {}
