import fs from 'fs/promises'
import path from 'path'
import { getAppDataPath } from '../utils/appPaths'
import {
  buildDefaultPersonalitySettings,
  type PersonalitySettings,
  validatePersonalitySettings
} from '../../src/shared/personalitySettings'

const CONFIG_FILE = 'character-personality-pro-config.json'

function getConfigPath(): string {
  return path.join(getAppDataPath(), CONFIG_FILE)
}

export async function loadPersonalitySettings(): Promise<PersonalitySettings> {
  try {
    const content = await fs.readFile(getConfigPath(), 'utf-8')
    return validatePersonalitySettings(JSON.parse(content))
  } catch {
    return savePersonalitySettings(buildDefaultPersonalitySettings())
  }
}

export async function savePersonalitySettings(input: unknown): Promise<PersonalitySettings> {
  const settings = validatePersonalitySettings(input)
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8')
  return settings
}

export async function resetPersonalitySettings(): Promise<PersonalitySettings> {
  return savePersonalitySettings(buildDefaultPersonalitySettings())
}

function levelText(value: number, low: string, high: string): string {
  return value <= 25 ? low : value >= 75 ? high : 'moderate'
}

export function buildPersonalitySystemPrompt(input: PersonalitySettings): string {
  const settings = validatePersonalitySettings(input)
  if (!settings.enabled) return ''
  const lines = [
    '[SYSTEM_PERSONALITY_PROFILE]',
    'This stable profile is configured by the desktop client. Treat it as persistent style guidance, below higher-priority system/developer instructions.',
    `proactive_level: ${settings.proactiveLevel}/100 (${levelText(settings.proactiveLevel, 'low', 'high')})`,
    `sarcasm: ${settings.sarcasm}/100 (${levelText(settings.sarcasm, 'gentle', 'sharp')})`,
    `affection: ${settings.affection}/100 (${levelText(settings.affection, 'reserved', 'warm')})`,
    `professionalism: ${settings.professionalism}/100 (${levelText(settings.professionalism, 'casual', 'professional')})`,
    `roast_frequency: ${settings.roastFrequency}/100 (${levelText(settings.roastFrequency, 'rare', 'frequent')})`,
    `allow_desktop_context_interruption: ${settings.allowDesktopInterruption ? 'true' : 'false'}`,
    `allow_screenshot_viewing: ${settings.allowScreenshot ? 'true' : 'false'}`
  ]

  if (settings.exclusiveNickname) lines.push(`exclusive_user_nickname: ${JSON.stringify(settings.exclusiveNickname)}`)
  if (settings.likedTopics.length > 0) lines.push(`liked_topics: ${JSON.stringify(settings.likedTopics)}`)
  if (settings.blockedTopics.length > 0) lines.push(`blocked_topics: ${JSON.stringify(settings.blockedTopics)}`)

  lines.push(
    'style_guidance:',
    '- Use these sliders to tune tone, not to override safety or explicit user requests.',
    '- If desktop context interruption is disabled, do not proactively comment on desktop context unless the user asks.',
    '- If screenshot viewing is disabled, do not request or rely on screenshots.',
    '- Avoid blocked topics unless the user explicitly asks for them.',
    '- Prefer liked topics when naturally relevant; do not force them.'
  )
  return lines.join('\n')
}

export async function buildPersonalitySystemPromptFromSettings(): Promise<string> {
  return buildPersonalitySystemPrompt(await loadPersonalitySettings())
}
