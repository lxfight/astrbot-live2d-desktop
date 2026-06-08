import type { CubismModelDiscoverySource } from './cubismModelDiscovery'

export const LIVE2D_EXPRESSION_TYPES = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'anxious',
  'surprised',
  'thinking',
  'tired',
  'disgusted',
  'blush',
  'playful',
  'sweat',
  'special',
  'speaking'
] as const

export type Live2DExpressionType = (typeof LIVE2D_EXPRESSION_TYPES)[number]

export type Live2DExpressionTypeMeta = {
  key: Live2DExpressionType
  label: string
  group: string
}

export type ExpressionTypeResolver = (key: string) => string

export function createLive2DExpressionTypeMeta(
  t: ExpressionTypeResolver
): Live2DExpressionTypeMeta[] {
  return [
    { key: 'neutral', label: t('expression.neutral'), group: t('expression.group.basic') },
    { key: 'happy', label: t('expression.happy'), group: t('expression.group.emotion') },
    { key: 'sad', label: t('expression.sad'), group: t('expression.group.emotion') },
    { key: 'angry', label: t('expression.angry'), group: t('expression.group.emotion') },
    { key: 'anxious', label: t('expression.anxious'), group: t('expression.group.emotion') },
    { key: 'surprised', label: t('expression.surprised'), group: t('expression.group.state') },
    { key: 'thinking', label: t('expression.thinking'), group: t('expression.group.state') },
    { key: 'tired', label: t('expression.tired'), group: t('expression.group.state') },
    { key: 'disgusted', label: t('expression.disgusted'), group: t('expression.group.state') },
    { key: 'blush', label: t('expression.blush'), group: t('expression.group.effect') },
    { key: 'playful', label: t('expression.playful'), group: t('expression.group.effect') },
    { key: 'sweat', label: t('expression.sweat'), group: t('expression.group.effect') },
    { key: 'special', label: t('expression.special'), group: t('expression.group.effect') },
    { key: 'speaking', label: t('expression.speaking'), group: t('expression.group.effect') }
  ]
}

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
