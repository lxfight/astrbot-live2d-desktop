/**
 * L2D-Bridge Protocol 类型定义（前端）
 */

export interface MessageContent {
  type: 'text' | 'image' | 'audio' | 'video' | 'file'
  text?: string
  url?: string
  inline?: string
  rid?: string
  name?: string
}

export interface InputMessagePayload {
  content: MessageContent[]
  metadata: {
    userId: string
    userName?: string
    sessionId: string
    messageType: 'friend' | 'group' | 'notify'
  }
}

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

export interface PerformSequence {
  interrupt: boolean
  sequence: PerformElement[]
  interruptible?: boolean
}
