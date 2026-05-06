export type ExpressionProfile = {
  version?: number
  modelId?: string
  aliases?: Record<string, string[]>
  tags?: Record<string, string[]>
  semanticPresets?: Record<string, string[]>
}

const PROFILE_FILE_NAME = 'astrbot.live2d.profile.json'

type RawExpressionProfile = {
  version?: unknown
  modelId?: unknown
  aliases?: unknown
  tags?: unknown
  semanticPresets?: unknown
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const normalized = value.trim()
    if (!normalized) {
      continue
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(normalized)
  }

  return result
}

function normalizeStringArray(value: unknown): string[] {
  if (typeof value === 'string') {
    return uniqueStrings([value])
  }

  if (!Array.isArray(value)) {
    return []
  }

  return uniqueStrings(value.filter((item): item is string => typeof item === 'string'))
}

function normalizeStringRecord(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const normalized: Record<string, string[]> = {}
  for (const [key, rawItems] of Object.entries(value)) {
    const normalizedKey = key.trim()
    if (!normalizedKey) {
      continue
    }

    const items = normalizeStringArray(rawItems)
    if (items.length > 0) {
      normalized[normalizedKey] = items
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function normalizeSemanticPresets(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const normalized: Record<string, string[]> = {}
  for (const [key, rawItems] of Object.entries(value)) {
    const normalizedKey = key.trim()
    if (!normalizedKey) {
      continue
    }

    const rawList = Array.isArray(rawItems) ? rawItems : [rawItems]
    const ids = uniqueStrings(rawList.map((item) => {
      if (typeof item === 'string') {
        return item
      }
      if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
        return (item as { id: string }).id
      }
      return null
    }))

    if (ids.length > 0) {
      normalized[normalizedKey] = ids
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function normalizeExpressionProfile(payload: RawExpressionProfile): ExpressionProfile | null {
  const profile: ExpressionProfile = {}

  if (typeof payload.version === 'number' && Number.isFinite(payload.version)) {
    profile.version = payload.version
  }

  if (typeof payload.modelId === 'string' && payload.modelId.trim()) {
    profile.modelId = payload.modelId.trim()
  }

  const aliases = normalizeStringRecord(payload.aliases)
  if (aliases) {
    profile.aliases = aliases
  }

  const tags = normalizeStringRecord(payload.tags)
  if (tags) {
    profile.tags = tags
  }

  const semanticPresets = normalizeSemanticPresets(payload.semanticPresets)
  if (semanticPresets) {
    profile.semanticPresets = semanticPresets
  }

  return Object.keys(profile).length > 0 ? profile : null
}

export async function loadExpressionProfile(
  modelPath: string,
  profileFile: string | null | undefined = undefined,
): Promise<ExpressionProfile | null> {
  if (profileFile === null) {
    return null
  }

  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  const relativeProfilePath = typeof profileFile === 'string' && profileFile.trim()
    ? profileFile.trim()
    : PROFILE_FILE_NAME
  const profilePath = `${modelDir}${relativeProfilePath}`

  try {
    const response = await fetch(profilePath)
    if (!response.ok) {
      return null
    }

    const payload = await response.json() as ExpressionProfile
    if (!payload || typeof payload !== 'object') {
      return null
    }

    return normalizeExpressionProfile(payload as RawExpressionProfile)
  } catch {
    return null
  }
}
