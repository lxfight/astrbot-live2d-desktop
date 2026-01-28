/**
 * Live2D-Bridge Protocol v1.0 消息类型定义（远程协议细化版）
 */

// 消息操作类型
export type MessageOperation =
  | 'sys.handshake'
  | 'sys.handshake_ack'
  | 'sys.error'
  | 'sys.ping'
  | 'sys.pong'
  | 'state.ready'
  | 'state.playing'
  | 'state.config'
  | 'resource.prepare'
  | 'resource.commit'
  | 'resource.get'
  | 'resource.release'
  | 'resource.progress'
  | 'perform.show'
  | 'perform.interrupt'
  | 'input.message'
  | 'input.touch'
  | 'input.shortcut'
  | 'model.list'
  | 'model.load'
  | 'model.unload'
  | 'model.state'
  | 'model.setExpression'
  | 'model.playMotion'
  | 'model.setParameter'
  | 'model.lookAt'
  | 'model.speak'
  | 'model.stop'
  | 'desktop.window.show'
  | 'desktop.window.hide'
  | 'desktop.window.move'
  | 'desktop.window.resize'
  | 'desktop.window.setOpacity'
  | 'desktop.window.setTopmost'
  | 'desktop.window.setClickThrough'
  | 'desktop.tray.notify'
  | 'desktop.openUrl'
  | 'desktop.capture.screenshot'
  | 'cmd.perform' // 兼容旧协议

export interface BasePacket<T = unknown> {
  op: MessageOperation
  id: string
  ts: number
  payload?: T
  error?: {
    code: number
    message: string
  }
}

export interface HandshakePayload {
  version?: string
  protocol_version?: string
  clientId: string
  clientName?: string
  client_type?: string
  token?: string
  capabilities?: string[]
  resume?: {
    sessionId?: string
    lastEventId?: number
  }
}

export interface HandshakeAckPayload {
  version: string
  serverTime?: number
  features?: string[]
  capabilities?: string[]
  config?: {
    maxMessageLength?: number
    maxInlineBytes?: number
    supportedImageFormats?: string[]
    supportedAudioFormats?: string[]
    resourceBaseUrl?: string
  }
  session?: {
    sessionId?: string
    userId?: string
  }
}

export interface HandshakeMessage extends BasePacket<HandshakePayload> {
  op: 'sys.handshake'
}

export interface HandshakeAckMessage extends BasePacket<HandshakeAckPayload> {
  op: 'sys.handshake_ack'
}

export interface ErrorMessage extends BasePacket {
  op: 'sys.error'
}

// 输入消息内容类型
export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image'
  data?: string // base64(data URI)
  inline?: string
  url?: string
  rid?: string
}

export interface VoiceContent {
  type: 'voice'
  data?: string // base64(data URI)
  inline?: string
  url?: string
  rid?: string
  sttMode?: 'local' | 'remote'
  text?: string
}

export type MessageContent = TextContent | ImageContent | VoiceContent

export interface InputMessagePayload {
  content: MessageContent[]
  metadata?: {
    userId?: string
    userName?: string
    sessionId?: string
    messageId?: string
  }
}

export interface StateReadyPayload {
  clientId?: string
}

export interface StatePlayingPayload {
  isPlaying: boolean
}

export interface StateConfigPayload {
  modelId?: string
  screen?: {
    w: number
    h: number
  }
}

// 用户输入消息
export interface InputMessage extends BasePacket<InputMessagePayload> {
  op: 'input.message'
}

// 触摸交互消息
export interface TouchMessage extends BasePacket {
  op: 'input.touch'
  payload: {
    part: string
    action: string
    x?: number
    y?: number
    duration?: number
  }
}

// 快捷键消息
export interface ShortcutMessage extends BasePacket {
  op: 'input.shortcut'
  payload: {
    key: string
  }
}

// 资源类型
export interface ResourcePayload {
  rid: string
  kind?: string
  mime?: string
  size?: number
  sha256?: string
  url?: string
  inline?: string
  headers?: Record<string, string>
  expiresAt?: number
}

export interface ResourceProgressPayload {
  rid: string
  current?: number
  total?: number
  percent?: number
  status?: string
}

export interface ResourcePreparePayload {
  kind: string
  mime: string
  size?: number
  sha256?: string
}

export interface ResourcePrepareResponse {
  rid: string
  upload?: {
    method: 'PUT' | 'POST'
    url: string
    headers?: Record<string, string>
  }
  resource?: ResourcePayload
}

// 表演序列项类型
export interface TextPerformItem {
  type: 'text'
  content: string
  duration?: number
  position?: 'center' | 'top' | 'bottom'
  style?: Record<string, unknown>
}

export interface ImagePerformItem {
  type: 'image'
  url?: string
  rid?: string
  inline?: string
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
  priority?: number
  loop?: boolean
  fadeIn?: number
  fadeOut?: number
  motionType?: string  // 新增：动作类型标识
}

export interface ExpressionPerformItem {
  type: 'expression'
  id?: string
  expressionId?: string
  fade?: number
  motionType?: string  // 新增：动作类型标识
}

export interface TtsPerformItem {
  type: 'tts'
  text?: string
  url?: string
  rid?: string
  inline?: string
  ttsMode?: 'remote' | 'local'
  voice?: string
  volume?: number
  speed?: number
}

export interface WaitPerformItem {
  type: 'wait'
  duration: number
}

export type PerformItem =
  | TextPerformItem
  | ImagePerformItem
  | MotionPerformItem
  | ExpressionPerformItem
  | TtsPerformItem
  | WaitPerformItem

// 表演消息
export interface PerformMessage extends BasePacket {
  op: 'perform.show' | 'cmd.perform'
  payload: {
    interrupt?: boolean
    sequence: PerformItem[]
  }
}

export interface PerformInterruptMessage extends BasePacket {
  op: 'perform.interrupt'
}

export interface ModelListPayload {
  models: Array<{
    id?: string
    name: string
    path?: string
    thumbnail?: string
    description?: string
  }>
}

export interface ModelLoadPayload {
  modelId?: string
  skinId?: string
  modelName?: string
}

export interface ModelStatePayload {
  modelId?: string
  modelName?: string
  position?: { x: number; y: number }
  scale?: number
  size?: { width: number; height: number }
  motions?: string[]
  expressions?: string[]
  parameters?: Record<string, number>
}

export interface ModelSetExpressionPayload {
  expressionId?: string
  blend?: number
  durationMs?: number
}

export interface ModelPlayMotionPayload {
  motionId?: string
  group?: string
  index?: number
  priority?: number
  loop?: boolean
}

export interface ModelSetParameterPayload {
  name: string
  value: number
  blend?: number
}

export interface ModelLookAtPayload {
  x: number
  y: number
  smooth?: boolean
}

export interface ModelSpeakPayload {
  text?: string
  rid?: string
  url?: string
  inline?: string
  lipSync?: boolean
}

export interface ModelStopPayload {
  scope?: 'motion' | 'expression' | 'speech' | 'all'
}

export interface DesktopWindowMovePayload {
  x: number
  y: number
}

export interface DesktopWindowResizePayload {
  w: number
  h: number
}

export interface DesktopWindowOpacityPayload {
  opacity: number
}

export interface DesktopWindowTopmostPayload {
  topmost: boolean
}

export interface DesktopWindowClickThroughPayload {
  enabled: boolean
  forward?: boolean
}

export interface DesktopTrayNotifyPayload {
  title: string
  message: string
  icon?: string
}

export interface DesktopOpenUrlPayload {
  url: string
}

export interface DesktopCaptureScreenshotPayload {
  format?: 'png' | 'jpeg'
  quality?: number
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
  | PerformInterruptMessage

// WebSocket 客户端配置
export interface WebSocketClientConfig {
  url: string
  token?: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

// WebSocket 客户端状态
export type WebSocketState = 'disconnected' | 'connecting' | 'connected' | 'error'
