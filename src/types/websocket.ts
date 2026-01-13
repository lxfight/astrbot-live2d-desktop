/**
 * Live2D-Bridge Protocol v1.0 消息类型定义
 */

// 消息操作类型
export type MessageOperation =
  | 'sys.handshake'
  | 'sys.handshake_ack'
  | 'sys.error'
  | 'input.message'
  | 'input.touch'
  | 'input.shortcut'
  | 'perform.show'
  | 'cmd.perform' // 兼容旧协议

// 基础消息结构
export interface BaseMessage {
  op: MessageOperation
  payload: unknown
}

// 握手消息
export interface HandshakeMessage extends BaseMessage {
  op: 'sys.handshake'
  payload: {
    protocol_version: string
    client_type: string
    token?: string
  }
}

// 握手确认消息
export interface HandshakeAckMessage extends BaseMessage {
  op: 'sys.handshake_ack'
  payload: {
    success: boolean
    message?: string
  }
}

// 错误消息
export interface ErrorMessage extends BaseMessage {
  op: 'sys.error'
  payload: {
    code: string
    message: string
  }
}

// 输入消息内容类型
export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image'
  data: string // base64
}

export interface VoiceContent {
  type: 'voice'
  data: string // base64
  sttMode?: 'local' | 'remote'
}

export type MessageContent = TextContent | ImageContent | VoiceContent

// 用户输入消息
export interface InputMessage extends BaseMessage {
  op: 'input.message'
  payload: {
    content: MessageContent[]
  }
}

// 触摸交互消息
export interface TouchMessage extends BaseMessage {
  op: 'input.touch'
  payload: {
    area: string
    x: number
    y: number
  }
}

// 快捷键消息
export interface ShortcutMessage extends BaseMessage {
  op: 'input.shortcut'
  payload: {
    key: string
  }
}

// 表演序列项类型
export interface TextPerformItem {
  type: 'text'
  content: string
  duration?: number
}

export interface ImagePerformItem {
  type: 'image'
  url: string
  duration?: number
  position?: 'center' | 'top' | 'bottom'
  size?: {
    width: number
    height: number
  }
}

export interface MotionPerformItem {
  type: 'motion'
  group: string
  index: number
}

export interface ExpressionPerformItem {
  type: 'expression'
  expressionId: string
}

export type PerformItem =
  | TextPerformItem
  | ImagePerformItem
  | MotionPerformItem
  | ExpressionPerformItem

// 表演消息
export interface PerformMessage extends BaseMessage {
  op: 'perform.show' | 'cmd.perform'
  payload: {
    sequence: PerformItem[]
  }
}

// 所有消息类型联合
export type WebSocketMessage =
  | HandshakeMessage
  | HandshakeAckMessage
  | ErrorMessage
  | InputMessage
  | TouchMessage
  | ShortcutMessage
  | PerformMessage

// WebSocket 客户端配置
export interface WebSocketClientConfig {
  url: string
  token?: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

// WebSocket 客户端状态
export type WebSocketState = 'disconnected' | 'connecting' | 'connected' | 'error'
