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
  bytes?: Uint8Array
  mime?: string
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

export interface PerformExpressionComboItem {
  id: string
  weight?: number
}

export interface PerformExpressionSemanticItem {
  tag: string
  weight?: number
}

export type PerformExpressionResetPolicy = 'previous' | 'neutral' | 'keep'

export interface ModelExpressionCapabilities {
  expressionCombo: boolean
  semanticExpression: boolean
  expressionProfile: boolean
}

export interface ModelExpressionCatalogItem {
  id: string
  aliases: string[]
  tags: string[]
  conflictGroups: string[]
  supportsCombo: boolean
}

export interface ModelDiscoveryInfo {
  mode: 'standard' | 'hybrid' | 'compatibility'
  sources: Array<'model3' | 'companion' | 'scan'>
  companionFiles: string[]
  standardDeclaredExpressions: number
  standardDeclaredMotionGroups: number
  discoveredExpressions: number
  discoveredMotionGroups: number
  scannedExpressionCount: number
  scannedMotionCount: number
  warnings: string[]
}

export interface StateModelPayload {
  version?: string // v2.0 新增
  name?: string // v1.0
  modelName?: string // v2.0
  motionGroups?: Record<string, Array<{ index: number; file: string }>> // v1.0
  motions?: Array<{ id: string; name: string; category: string; duration: number }> // v2.0
  expressions?: string[] | Array<{ id: string; name: string }> // v1.0 string[], v2.0 object[]
  capabilities?: ModelExpressionCapabilities | { idleMode: string; llmControlled: boolean } // v2.0 扩展
  expressionCatalog?: ModelExpressionCatalogItem[]
  semanticPresets?: Record<string, string[]>
  discovery?: ModelDiscoveryInfo
}

export interface PerformElement {
  type: 'text' | 'tts' | 'audio' | 'motion' | 'expression' | 'image' | 'video' | 'wait' | 'delay'

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

  // 动作（v1.0 使用 group/index，v2.0 使用 name）
  name?: string // v2.0: 别名
  group?: string
  index?: number
  priority?: number
  loop?: boolean
  fadeIn?: number
  fadeOut?: number
  motionType?: string

  // 表情（v1.0 使用 id，v2.0 使用 name）
  id?: string | number
  combo?: PerformExpressionComboItem[]
  semantic?: PerformExpressionSemanticItem[]
  fade?: number
  holdMs?: number
  resetPolicy?: PerformExpressionResetPolicy | 'fadeOut' | 'default' | 'hold' // v2.0 扩展

  // 图片/视频
  autoplay?: boolean
}

export interface PerformSequence {
  interrupt: boolean
  sequence: PerformElement[]
  interruptible?: boolean
}
