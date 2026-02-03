/**
 * L2D-Bridge Protocol v1.0 类型定义
 */

// 基础数据包结构
export interface BasePacket {
  op: string
  id: string
  ts: number
  payload?: any
  error?: {
    code: number
    message: string
  }
}

// 操作码常量
export const OP = {
  // 系统级
  SYS_HANDSHAKE: 'sys.handshake',
  SYS_HANDSHAKE_ACK: 'sys.handshake_ack',
  SYS_PING: 'sys.ping',
  SYS_PONG: 'sys.pong',
  SYS_ERROR: 'sys.error',

  // 输入
  INPUT_MESSAGE: 'input.message',
  INPUT_TOUCH: 'input.touch',
  INPUT_SHORTCUT: 'input.shortcut',

  // 表演
  PERFORM_SHOW: 'perform.show',
  PERFORM_INTERRUPT: 'perform.interrupt',

  // 资源
  RESOURCE_PREPARE: 'resource.prepare',
  RESOURCE_COMMIT: 'resource.commit',
  RESOURCE_GET: 'resource.get',
  RESOURCE_RELEASE: 'resource.release',
  RESOURCE_PROGRESS: 'resource.progress',

  // 状态
  STATE_READY: 'state.ready',
  STATE_PLAYING: 'state.playing',
  STATE_CONFIG: 'state.config',
  STATE_MODEL: 'state.model', // 模型信息更新

  // STT（语音转文字）
  STT_TRANSCRIBE: 'stt.transcribe',
  STT_RESULT: 'stt.result'
} as const

// 错误码
export const ERROR_CODE = {
  AUTH_FAILED: 4001,
  VERSION_MISMATCH: 4002,
  INVALID_PACKET: 4003,
  UNSUPPORTED_OP: 4004,
  RATE_LIMITED: 4029,
  INTERNAL_ERROR: 5000,
  RESOURCE_NOT_FOUND: 5001,
  RESOURCE_QUOTA_EXCEEDED: 5002,
  RESOURCE_INVALID_STATE: 5003,
  RESOURCE_UPLOAD_FAILED: 5004,
  RESOURCE_DOWNLOAD_FAILED: 5005,
  RESOURCE_IO_ERROR: 5006
} as const

// 握手请求
export interface HandshakePayload {
  version: string
  clientId: string
  token?: string
  model?: {
    name: string
    motionGroups: string[] // 可用的动作组列表
    expressions: string[] // 可用的表情列表
  }
}

// 握手确认
export interface HandshakeAckPayload {
  sessionId?: string
  userId?: string
  session?: {
    sessionId: string
    userId: string
  }
  capabilities: string[]
  config: {
    maxMessageLength: number
    supportedImageFormats: string[]
    supportedAudioFormats: string[]
    maxInlineBytes: number
    resourceBaseUrl: string
  }
}

// 输入消息内容
export interface MessageContent {
  type: 'text' | 'image' | 'audio' | 'video' | 'file'
  text?: string
  url?: string
  inline?: string
  rid?: string
  name?: string
}

// 输入消息载荷
export interface InputMessagePayload {
  content: MessageContent[]
  metadata: {
    userId: string
    userName?: string
    sessionId: string
    messageType: 'friend' | 'group' | 'notify'
  }
}

// 表演序列元素
export interface PerformElement {
  type: 'text' | 'tts' | 'motion' | 'expression' | 'image' | 'video' | 'wait'

  // 文字气泡
  content?: string
  duration?: number
  position?: 'top' | 'center' | 'bottom'

  // TTS
  text?: string
  url?: string
  inline?: string
  rid?: string
  ttsMode?: 'local' | 'remote'
  volume?: number
  speed?: number

  // 动作
  group?: string
  index?: number
  priority?: number
  loop?: boolean
  fadeIn?: number
  fadeOut?: number
  motionType?: string

  // 表情
  id?: string
  fade?: number

  // 图片/视频
  autoplay?: boolean
}

// 表演载荷
export interface PerformShowPayload {
  interrupt: boolean
  sequence: PerformElement[]
}

// 资源引用
export interface ResourceReference {
  url?: string
  rid?: string
  inline?: string
}

// 触摸事件
export interface TouchPayload {
  x: number
  y: number
  action: 'tap' | 'double_tap' | 'long_press' | 'drag'
}

// 快捷键事件
export interface ShortcutPayload {
  key: string
  modifiers: string[]
}

// 状态载荷
export interface StateReadyPayload {
  ready: boolean
}

export interface StatePlayingPayload {
  playing: boolean
  current?: number
  total?: number
}

export interface StateConfigPayload {
  config: Record<string, any>
}

// STT 转录请求载荷
export interface STTTranscribePayload {
  audio: {
    inline?: string // base64 编码的音频
    url?: string // 音频 URL
    rid?: string // 资源 ID
  }
  format: string // 音频格式：'wav', 'webm', 'mp3', 'ogg'
  language?: string // 语言代码：'zh-CN', 'en-US'
}

// STT 转录结果载荷
export interface STTResultPayload {
  text: string // 识别的文字
  confidence?: number // 置信度 0-1
  language?: string // 检测到的语言
}

// 模型信息载荷
export interface StateModelPayload {
  name: string // 模型名称
  motionGroups: Record<string, Array<{ index: number; file: string }>> // 动作组及每个动作的详细信息
  expressions: string[] // 可用的表情列表
}
