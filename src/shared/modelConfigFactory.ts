import type { CubismCompatibilityManifest } from './cubismModelDiscovery'

export type MotionAliasConfig = {
  id: string
  name: string
  category: 'idle' | 'action'
  description?: string
  duration: number
  enabled: boolean
}

export type ExpressionAliasConfig = {
  id: string
  name: string
  description?: string
  thumbnail?: string
  enabled: boolean
}

export type ModelAliasConfigV2 = {
  modelPath: string
  version: '2.0'
  motionAliases: MotionAliasConfig[]
  expressionAliases: ExpressionAliasConfig[]
}

const MOTION_ALIAS_PATTERNS: Record<string, string> = {
  Idle: '待机',
  TapBody: '触摸身体',
  TapHead: '触摸头部',
  Shake: '摇晃',
  Pinch: '捏脸',
  Flick: '戳'
}

const EXPRESSION_ALIAS_MAP: Record<string, string> = {
  f01: '微笑',
  f02: '惊讶',
  f03: '悲伤',
  f04: '生气',
  f05: '害羞',
  f06: '得意',
  f07: '困惑',
  f08: '无奈'
}

export function generateMotionAliasFromId(motionId: string): string {
  for (const [pattern, alias] of Object.entries(MOTION_ALIAS_PATTERNS)) {
    if (motionId.startsWith(pattern)) {
      const match = motionId.match(/_(\d+)$/)
      if (match) {
        const index = parseInt(match[1], 10)
        return `${alias}${index + 1}`
      }
      return alias
    }
  }
  return motionId.replace(/_/g, ' ')
}

export function generateExpressionAliasFromId(expressionId: string): string {
  return EXPRESSION_ALIAS_MAP[expressionId] || `表情${expressionId}`
}

export type ModelCatalogMotionItem = {
  id: string
  group: string
  index: number
  file: string
  durationMs: number
}

export type ModelCatalogPayload = {
  modelPath: string
  name: string
  motions: ModelCatalogMotionItem[]
  expressions: Array<{ id: string; file: string }>
}

export function buildModelConfigFromCatalog(catalog: ModelCatalogPayload): ModelAliasConfigV2 {
  const motionAliases: MotionAliasConfig[] = catalog.motions.map(motion => ({
    id: motion.id,
    name: generateMotionAliasFromId(motion.id),
    category: motion.group.toLowerCase() === 'idle' ? 'idle' : 'action',
    description: '',
    duration: motion.durationMs > 0 ? motion.durationMs : 3000,
    enabled: true
  }))

  const expressionAliases: ExpressionAliasConfig[] = catalog.expressions.map(expr => ({
    id: expr.id,
    name: generateExpressionAliasFromId(expr.id),
    description: '',
    enabled: true
  }))

  return {
    modelPath: catalog.modelPath,
    version: '2.0',
    motionAliases,
    expressionAliases
  }
}

export function buildModelCatalogFromManifest(
  modelPath: string,
  manifest: CubismCompatibilityManifest,
  modelDisplayName: string
): ModelCatalogPayload {
  const motions: ModelCatalogMotionItem[] = []

  for (const [group, entries] of Object.entries(manifest.motions || {})) {
    entries.forEach((entry, index) => {
      const motionId = `${group}_${String(index).padStart(2, '0')}`
      motions.push({
        id: motionId,
        group,
        index,
        file: entry.file,
        durationMs: 3000
      })
    })
  }

  return {
    modelPath,
    name: modelDisplayName,
    motions,
    expressions: manifest.expressions.map(expr => ({
      id: expr.id,
      file: expr.file
    }))
  }
}
