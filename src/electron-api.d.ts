// Global type declarations for APIs injected by Electron preload.
// Keeping this file as an ambient script (no imports/exports) makes the
// Window augmentation reliably available to the TS/Vue language service.

import type {
  Conversation,
  Message,
  DailyStatistics,
  SaveMessageParams,
  UpdateStatisticsParams
} from './types/history'
import type { AppSettings, SettingsUpdate, WindowPosition } from './types/settings'
import type { PerformItem } from './types/websocket'

interface ElectronAPI {
  // 设置管理
  getSettings: () => Promise<AppSettings>
  setSettings: (settings: SettingsUpdate) => Promise<{ success: boolean; conflict?: boolean }>
  setWindowFlag: (flag: string, value: boolean) => Promise<void>

  // 鼠标穿透控制
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => Promise<{ success: boolean }>

  // 窗口控制
  showSettings: () => Promise<{ success: boolean }>
  hideWindow: () => Promise<{ success: boolean }>

  // 窗口位置控制
  getWindowPosition: () => Promise<WindowPosition>
  setWindowPosition: (x: number, y: number) => Promise<{ success: boolean }>

  // 窗口聚焦控制
  setWindowFocusable: (focusable: boolean) => Promise<{ success: boolean }>

  // 事件监听（返回清理函数）
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void

  // 托盘菜单控制
  updateConnectionStatus: (connected: boolean) => void

  // 模型管理
  selectModelFolder: () => Promise<{ canceled: boolean; folderPath?: string }>
  validateModel: (folderPath: string) => Promise<{
    valid: boolean
    modelName?: string
    configFile?: string
    version?: number
    textureCount?: number
    motionCount?: number
    error?: string
  }>
  importModel: (sourcePath: string, targetName: string) => Promise<{ success: boolean; modelPath?: string; error?: string }>
  getAvailableModels: () => Promise<{
    success: boolean
    models?: Array<{ name: string; path: string; isDeletable: boolean }>
    error?: string
  }>
  deleteModel: (modelName: string) => Promise<{ success: boolean; error?: string }>

  // 动作和表情预览
  previewMotion: (group: string, index: number) => Promise<{ success: boolean; error?: string }>
  previewExpression: (expressionId: string) => Promise<{ success: boolean; error?: string }>

  // 播放指令监听（返回清理函数）
  onPlayMotion: (callback: (group: string, index: number) => void) => () => void
  onPlayExpression: (callback: (expressionId: string) => void) => () => void

  // 全局快捷键录音监听（返回清理函数）
  onStartRecording: (callback: () => void) => () => void
  onStopRecording: (callback: () => void) => () => void

  // 消息详情窗口
  openMessageDetail: (messageData: { type: string; content: string } | PerformItem[]) => Promise<{ success: boolean }>
  getMessageDetailData: () => Promise<{ type: string; content: string } | PerformItem[] | null>
  closeMessageDetail: () => Promise<{ success: boolean }>

  // 数据库操作 - 对话管理
  dbGetConversations: () => Promise<Conversation[]>
  dbGetActiveConversation: () => Promise<Conversation | undefined>
  dbCreateConversation: (title?: string) => Promise<number>
  dbSetActiveConversation: (conversationId: number) => Promise<{ success: boolean }>
  dbUpdateConversationTitle: (conversationId: number, title: string) => Promise<{ success: boolean }>
  dbDeleteConversation: (conversationId: number) => Promise<{ success: boolean }>

  // 数据库操作 - 消息管理
  dbSaveMessage: (params: SaveMessageParams) => Promise<number>
  dbGetMessages: (conversationId: number, limit?: number, offset?: number) => Promise<Message[]>
  dbGetMessageCount: (conversationId: number) => Promise<number>
  dbDeleteMessage: (messageId: number) => Promise<{ success: boolean }>

  // 数据库操作 - 统计信息
  dbUpdateStatistics: (params: UpdateStatisticsParams) => Promise<{ success: boolean }>
  dbGetStatistics: (startDate?: string, endDate?: string) => Promise<DailyStatistics[]>
  dbGetTotalStatistics: () => Promise<Omit<DailyStatistics, 'id' | 'stat_date'>>
}

interface Window {
  PIXI: unknown
  electronAPI?: ElectronAPI
}
