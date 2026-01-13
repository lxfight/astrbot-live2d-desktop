/**
 * 应用设置类型定义
 */

// 应用设置
export interface AppSettings {
  // WebSocket 配置
  wsUrl: string
  token: string

  // 窗口配置
  alwaysOnTop: boolean
  transparent: boolean
  windowSize: {
    width: number
    height: number
  }
  windowPosition: {
    x: number
    y: number
  } | null

  // 模型配置
  currentModel: string
  modelScale: number
  modelX: number
  modelY: number

  // 鼠标穿透配置
  mousePassthrough?: {
    enabled: boolean
    alphaThreshold: number
  }

  // 快捷键配置
  recordHotkey?: string

  // 其他配置
  [key: string]: unknown
}

// 设置更新参数（部分更新）
export type SettingsUpdate = Partial<AppSettings>

// 窗口标志
export type WindowFlag = 'alwaysOnTop' | 'transparent'

// 窗口位置
export interface WindowPosition {
  x: number
  y: number
}

// 窗口大小
export interface WindowSize {
  width: number
  height: number
}

// 快捷键冲突信息
export interface HotkeyConflict {
  hotkey: string
  message: string
}
