export interface PersonalitySettings {
  enabled: boolean
  injectIntoMessages: boolean
  proactiveLevel: number
  sarcasm: number
  affection: number
  professionalism: number
  roastFrequency: number
  allowDesktopInterruption: boolean
  allowScreenshot: boolean
  exclusiveNickname: string
  likedTopics: string[]
  blockedTopics: string[]
}

export function buildDefaultPersonalitySettings(): PersonalitySettings {
  return {
    enabled: true,
    injectIntoMessages: true,
    proactiveLevel: 45,
    sarcasm: 15,
    affection: 35,
    professionalism: 60,
    roastFrequency: 20,
    allowDesktopInterruption: true,
    allowScreenshot: true,
    exclusiveNickname: '',
    likedTopics: [],
    blockedTopics: []
  }
}

function clampPercent(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : fallback
}

function cleanList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\n|,|，/)
      : []
  return Array.from(new Set(items.map(item => String(item || '').trim()).filter(Boolean))).slice(0, 50)
}

export function validatePersonalitySettings(input: unknown): PersonalitySettings {
  const defaults = buildDefaultPersonalitySettings()
  const value = input && typeof input === 'object' ? (input as Partial<PersonalitySettings>) : {}
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    injectIntoMessages: typeof value.injectIntoMessages === 'boolean' ? value.injectIntoMessages : defaults.injectIntoMessages,
    proactiveLevel: clampPercent(value.proactiveLevel, defaults.proactiveLevel),
    sarcasm: clampPercent(value.sarcasm, defaults.sarcasm),
    affection: clampPercent(value.affection, defaults.affection),
    professionalism: clampPercent(value.professionalism, defaults.professionalism),
    roastFrequency: clampPercent(value.roastFrequency, defaults.roastFrequency),
    allowDesktopInterruption: typeof value.allowDesktopInterruption === 'boolean' ? value.allowDesktopInterruption : defaults.allowDesktopInterruption,
    allowScreenshot: typeof value.allowScreenshot === 'boolean' ? value.allowScreenshot : defaults.allowScreenshot,
    exclusiveNickname: typeof value.exclusiveNickname === 'string' ? value.exclusiveNickname.trim().slice(0, 60) : defaults.exclusiveNickname,
    likedTopics: cleanList(value.likedTopics),
    blockedTopics: cleanList(value.blockedTopics)
  }
}
