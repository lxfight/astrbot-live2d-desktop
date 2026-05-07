import type { ParsedExpressionFile } from './exp3Parser'
import type { ExpressionProfile } from './expressionProfile'
import type { CubismModelDiscoverySource } from '@/shared/cubismModelDiscovery'

export type ExpressionCatalogEntry = {
  id: string
  file: string
  aliases: string[]
  tags: string[]
  confidence: number
  parameterIds: string[]
  conflictGroups: string[]
  supportsCombo: boolean
}

export type ExpressionCatalogInput = {
  parsed: ParsedExpressionFile
  source: CubismModelDiscoverySource
}

export type ExpressionCatalogBuildResult = {
  entries: ExpressionCatalogEntry[]
  semanticPresets: Record<string, string[]>
}

const KEYWORD_TAGS: Array<{ tag: string; keywords: string[]; confidence: number }> = [
  { tag: 'happy', keywords: ['happy', 'smile', 'joy', 'laugh', 'grin', '开心', '高兴', '笑'], confidence: 0.92 },
  { tag: 'sad', keywords: ['sad', 'cry', 'tear', 'blue', '难过', '伤心', '哭'], confidence: 0.92 },
  { tag: 'angry', keywords: ['angry', 'mad', 'rage', 'annoy', '生气', '愤怒'], confidence: 0.92 },
  { tag: 'surprised', keywords: ['surprise', 'shock', 'wow', '惊讶', '震惊'], confidence: 0.9 },
  { tag: 'thinking', keywords: ['think', 'thinking', 'ponder', '思考'], confidence: 0.86 },
  { tag: 'neutral', keywords: ['neutral', 'default', 'normal', 'idle', '平静', '默认'], confidence: 0.82 },
  { tag: 'speaking', keywords: ['talk', 'speak', 'chat', '说话'], confidence: 0.72 },
]

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(
    values
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map(value => value.trim())
  )]
}

function normalizePresetKey(value: string): string {
  return value.trim().toLowerCase()
}

function inferTags(id: string, parameterIds: string[], profile?: ExpressionProfile): { tags: string[]; confidence: number } {
  const explicitTags = profile?.tags?.[id] ?? []
  if (explicitTags.length > 0) {
    return {
      tags: uniqueStrings(explicitTags),
      confidence: 1
    }
  }

  const name = id.toLowerCase()
  const matched = KEYWORD_TAGS.filter(item =>
    item.keywords.some(keyword => name.includes(keyword.toLowerCase()))
  )

  const parameterName = parameterIds.join(' ').toLowerCase()
  if (parameterName.includes('mouth')) {
    matched.push({ tag: 'speaking', keywords: [], confidence: 0.68 })
  }

  const tags = uniqueStrings(matched.map(item => item.tag))
  const confidence = matched.length > 0
    ? Math.max(...matched.map(item => item.confidence))
    : 0.35

  return { tags, confidence }
}

function inferConflictGroups(tags: string[]): string[] {
  const groups: string[] = []
  if (tags.some(tag => ['happy', 'sad', 'angry', 'surprised', 'neutral'].includes(tag))) {
    groups.push('emotion')
  }
  if (tags.includes('speaking')) {
    groups.push('speech')
  }
  if (tags.includes('thinking')) {
    groups.push('cognition')
  }
  return uniqueStrings(groups)
}

function hasExplicitTags(profile: ExpressionProfile | null, expressionId: string): boolean {
  const explicitTags = profile?.tags?.[expressionId]
  return Array.isArray(explicitTags) && explicitTags.length > 0
}

function resolveCatalogExpressionId(value: string, aliasIndex: Map<string, string>): string | null {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  return aliasIndex.get(normalized.toLowerCase()) ?? null
}

function hasProfileSemanticPresets(profile: ExpressionProfile | null): boolean {
  return Boolean(profile?.semanticPresets && Object.keys(profile.semanticPresets).length > 0)
}

export function buildExpressionCatalog(
  parsedExpressions: ExpressionCatalogInput[],
  profile: ExpressionProfile | null
): ExpressionCatalogBuildResult {
  const useProfileSemanticPresets = hasProfileSemanticPresets(profile)
  const entries: ExpressionCatalogEntry[] = parsedExpressions
    .filter(({ parsed }) => parsed.parameters.length > 0)
    .map(({ parsed, source }) => {
      const inferred = inferTags(parsed.id, parsed.parameterIds, profile ?? undefined)
      const aliases = uniqueStrings([
        parsed.id,
        ...(profile?.aliases?.[parsed.id] ?? [])
      ])
      const allowInferredSemantic = source !== 'scan' || hasExplicitTags(profile, parsed.id)
      const tags = useProfileSemanticPresets
        ? uniqueStrings(profile?.tags?.[parsed.id] ?? [])
        : allowInferredSemantic ? inferred.tags : []
      const conflictGroups = inferConflictGroups(tags)

      return {
        id: parsed.id,
        file: parsed.file,
        aliases,
        tags,
        confidence: useProfileSemanticPresets
          ? tags.length > 0 ? 1 : 0.35
          : allowInferredSemantic ? inferred.confidence : 0.35,
        parameterIds: parsed.parameterIds,
        conflictGroups,
        supportsCombo: parsed.parameters.length > 0
      }
    })

  const aliasIndex = new Map<string, string>()
  for (const entry of entries) {
    for (const alias of uniqueStrings([entry.id, ...entry.aliases])) {
      aliasIndex.set(alias.toLowerCase(), entry.id)
    }
  }

  const semanticPresets: Record<string, string[]> = {}

  if (!useProfileSemanticPresets) {
    for (const entry of entries) {
      for (const tag of entry.tags) {
        const presetKey = normalizePresetKey(tag)
        if (!presetKey) {
          continue
        }
        if (!semanticPresets[presetKey]) {
          semanticPresets[presetKey] = []
        }
        semanticPresets[presetKey].push(entry.id)
      }
    }
  }

  for (const [preset, items] of Object.entries(profile?.semanticPresets ?? {})) {
    const presetKey = normalizePresetKey(preset)
    if (!presetKey) {
      continue
    }

    const resolvedItems = uniqueStrings(items
      .map((item) => resolveCatalogExpressionId(item, aliasIndex))
      .filter((item): item is string => Boolean(item)))

    semanticPresets[presetKey] = resolvedItems
  }

  return {
    entries,
    semanticPresets
  }
}
