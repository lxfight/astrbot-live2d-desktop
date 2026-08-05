export type DesktopSceneType = 'code' | 'game' | 'chat' | 'browser' | 'media' | 'art' | 'study' | 'general'
export type DesktopSceneConfidence = 'low' | 'medium' | 'high'
export type DesktopSceneInterruption = 'very_low' | 'low' | 'medium' | 'high'

export interface DesktopSceneSettings {
  enabled: boolean
  includeInPrompt: boolean
  adaptiveSuggestion: boolean
  quietScenes: DesktopSceneType[]
  activeScenes: DesktopSceneType[]
}

export interface DesktopSceneResult {
  type: DesktopSceneType
  label: string
  confidence: DesktopSceneConfidence
  interruption: DesktopSceneInterruption
  suggestion: string
}

export function buildDefaultDesktopSceneSettings(): DesktopSceneSettings {
  return {
    enabled: true,
    includeInPrompt: true,
    adaptiveSuggestion: true,
    quietScenes: ['game', 'media'],
    activeScenes: ['code', 'art', 'study']
  }
}

function cleanSceneList(value: unknown, fallback: DesktopSceneType[]): DesktopSceneType[] {
  const allowed = new Set<DesktopSceneType>(['code', 'game', 'chat', 'browser', 'media', 'art', 'study', 'general'])
  if (!Array.isArray(value)) return fallback
  return Array.from(new Set(value.map(String).filter((item): item is DesktopSceneType => allowed.has(item as DesktopSceneType))))
}

export function validateDesktopSceneSettings(input: unknown): DesktopSceneSettings {
  const defaults = buildDefaultDesktopSceneSettings()
  const value = input && typeof input === 'object' ? (input as Partial<DesktopSceneSettings>) : {}
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    includeInPrompt: typeof value.includeInPrompt === 'boolean' ? value.includeInPrompt : defaults.includeInPrompt,
    adaptiveSuggestion: typeof value.adaptiveSuggestion === 'boolean' ? value.adaptiveSuggestion : defaults.adaptiveSuggestion,
    quietScenes: cleanSceneList(value.quietScenes, defaults.quietScenes),
    activeScenes: cleanSceneList(value.activeScenes, defaults.activeScenes)
  }
}
