import type { CubismModelDiscoverySource } from './cubismModelDiscovery'

export const LIVE2D_EXPRESSION_TYPES = [
  'neutral',
  'calm',
  'happy',
  'laugh',
  'excited',
  'warm',
  'relieved',
  'proud',
  'smug',
  'sad',
  'cry',
  'disappointed',
  'angry',
  'annoyed',
  'fear',
  'anxious',
  'surprised',
  'confused',
  'thinking',
  'curious',
  'bored',
  'tired',
  'sleepy',
  'disgusted',
  'contempt',
  'shy',
  'embarrassed',
  'blush',
  'pout',
  'wink',
  'eyes_closed',
  'sparkle',
  'sweat',
  'shadow',
  'dizzy',
  'speaking',
] as const

export type Live2DExpressionType = typeof LIVE2D_EXPRESSION_TYPES[number]

export type Live2DExpressionTypeMeta = {
  key: Live2DExpressionType
  label: string
  group: '基础' | '正向' | '负向' | '状态' | '视觉'
}

export const LIVE2D_EXPRESSION_TYPE_META: Live2DExpressionTypeMeta[] = [
  { key: 'neutral', label: '中性', group: '基础' },
  { key: 'calm', label: '平静', group: '基础' },
  { key: 'happy', label: '开心', group: '正向' },
  { key: 'laugh', label: '大笑', group: '正向' },
  { key: 'excited', label: '兴奋', group: '正向' },
  { key: 'warm', label: '温柔', group: '正向' },
  { key: 'relieved', label: '安心', group: '正向' },
  { key: 'proud', label: '自信', group: '正向' },
  { key: 'smug', label: '得意', group: '正向' },
  { key: 'sad', label: '难过', group: '负向' },
  { key: 'cry', label: '哭泣', group: '负向' },
  { key: 'disappointed', label: '失望', group: '负向' },
  { key: 'angry', label: '生气', group: '负向' },
  { key: 'annoyed', label: '不爽', group: '负向' },
  { key: 'fear', label: '害怕', group: '负向' },
  { key: 'anxious', label: '紧张', group: '负向' },
  { key: 'surprised', label: '惊讶', group: '状态' },
  { key: 'confused', label: '困惑', group: '状态' },
  { key: 'thinking', label: '思考', group: '状态' },
  { key: 'curious', label: '好奇', group: '状态' },
  { key: 'bored', label: '无聊', group: '状态' },
  { key: 'tired', label: '疲惫', group: '状态' },
  { key: 'sleepy', label: '困倦', group: '状态' },
  { key: 'disgusted', label: '厌恶', group: '状态' },
  { key: 'contempt', label: '鄙夷', group: '状态' },
  { key: 'shy', label: '害羞', group: '视觉' },
  { key: 'embarrassed', label: '尴尬', group: '视觉' },
  { key: 'blush', label: '脸红', group: '视觉' },
  { key: 'pout', label: '撅嘴', group: '视觉' },
  { key: 'wink', label: '眨眼', group: '视觉' },
  { key: 'eyes_closed', label: '闭眼', group: '视觉' },
  { key: 'sparkle', label: '星星眼', group: '视觉' },
  { key: 'sweat', label: '冷汗', group: '视觉' },
  { key: 'shadow', label: '阴影', group: '视觉' },
  { key: 'dizzy', label: '晕眩', group: '视觉' },
  { key: 'speaking', label: '说话', group: '视觉' },
]

export type Live2DExpressionTypePresetMap = Record<Live2DExpressionType, string[]>

export type Live2DExpressionTypeEntry = {
  id: string
  file: string
  aliases: string[]
  source: CubismModelDiscoverySource
}

export type Live2DExpressionTypesLoadResult = {
  success: boolean
  modelPath?: string
  profilePath?: string
  expressions?: Live2DExpressionTypeEntry[]
  presets?: Live2DExpressionTypePresetMap
  error?: string
}

export type Live2DExpressionTypesSaveResult = {
  success: boolean
  profilePath?: string
  error?: string
}

export function createEmptyExpressionTypePresets(): Live2DExpressionTypePresetMap {
  return LIVE2D_EXPRESSION_TYPES.reduce((result, key) => {
    result[key] = []
    return result
  }, {} as Live2DExpressionTypePresetMap)
}

export function cloneExpressionTypePresets(
  presets: Partial<Record<Live2DExpressionType, readonly string[] | undefined>>
): Live2DExpressionTypePresetMap {
  return LIVE2D_EXPRESSION_TYPES.reduce((result, key) => {
    const items = presets[key]
    result[key] = Array.isArray(items)
      ? items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
    return result
  }, {} as Live2DExpressionTypePresetMap)
}

export function isLive2DExpressionType(value: string): value is Live2DExpressionType {
  return (LIVE2D_EXPRESSION_TYPES as readonly string[]).includes(value)
}
