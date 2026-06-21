import fs from 'fs/promises'
import path from 'path'
import { getAppDataPath } from '../utils/appPaths'
import { getWindowWatcher, type WindowInfo } from '../utils/windowWatcher'
import { resolveWindowAppIdentity } from '../desktopAwareness/appIdentity'
import type { DesktopContextSnapshot } from '../desktopAwareness/types'
import {
  buildDefaultDesktopSceneSettings,
  type DesktopSceneResult,
  type DesktopSceneSettings,
  validateDesktopSceneSettings
} from '../../src/shared/desktopSceneSettings'

const CONFIG_FILE = 'desktop-scene-pro-config.json'

function getConfigPath(): string {
  return path.join(getAppDataPath(), CONFIG_FILE)
}

export async function loadDesktopSceneSettings(): Promise<DesktopSceneSettings> {
  try {
    const content = await fs.readFile(getConfigPath(), 'utf-8')
    return validateDesktopSceneSettings(JSON.parse(content))
  } catch {
    return saveDesktopSceneSettings(buildDefaultDesktopSceneSettings())
  }
}

export async function saveDesktopSceneSettings(input: unknown): Promise<DesktopSceneSettings> {
  const settings = validateDesktopSceneSettings(input)
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8')
  return settings
}

export async function resetDesktopSceneSettings(): Promise<DesktopSceneSettings> {
  return saveDesktopSceneSettings(buildDefaultDesktopSceneSettings())
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword))
}

export function detectDesktopScene(app: ReturnType<typeof resolveWindowAppIdentity> | null, windowTitle?: string | null): DesktopSceneResult {
  const key = String(app?.canonicalKey || '').toLowerCase()
  const processName = String(app?.processName || '').toLowerCase()
  const title = String(windowTitle || '').toLowerCase()
  const haystack = `${key} ${processName} ${title}`

  if (hasKeyword(haystack, ['code', 'vscode', 'visual studio', 'webstorm', 'idea', 'pycharm', 'cursor', 'sublime', 'notepad++', 'terminal', 'powershell', 'cmd', 'git', 'github'])) {
    return { type: 'code', label: '写代码', confidence: 'high', interruption: 'low', suggestion: '少打扰；适合提供调试、解释、保存提醒。' }
  }
  if (hasKeyword(haystack, ['steam', 'unity', 'unreal', 'genshin', 'starrail', 'minecraft', 'valorant', 'league', 'game', 'elden', 'sekiro', 'naruto', '原神', '崩坏', '火影'])) {
    return { type: 'game', label: '游戏', confidence: 'medium', interruption: 'very_low', suggestion: '尽量静默；适合自动穿透、降低主动发言。' }
  }
  if (hasKeyword(haystack, ['wechat', 'weixin', 'qq', 'telegram', 'discord', 'slack', 'teams', '微信', '聊天'])) {
    return { type: 'chat', label: '聊天', confidence: 'high', interruption: 'medium', suggestion: '谨慎插话；可理解聊天上下文但不要频繁主动。' }
  }
  if (hasKeyword(haystack, ['chrome', 'edge', 'firefox', 'browser', '浏览器'])) {
    return { type: 'browser', label: '浏览', confidence: 'medium', interruption: 'medium', suggestion: '可在用户停留较久时提供总结、查找或解释帮助。' }
  }
  if (hasKeyword(haystack, ['bilibili', 'youtube', 'potplayer', 'vlc', 'spotify', 'music', 'netease', 'cloudmusic', '视频', '音乐'])) {
    return { type: 'media', label: '影音', confidence: 'medium', interruption: 'low', suggestion: '降低打扰；适合轻量吐槽或静默陪伴。' }
  }
  if (hasKeyword(haystack, ['photoshop', 'clipstudio', 'sai', 'krita', 'blender', 'aseprite', 'paint', 'illustrator', '画', '插画'])) {
    return { type: 'art', label: '创作', confidence: 'high', interruption: 'low', suggestion: '少打扰；适合提供灵感、构图、配色建议。' }
  }
  if (hasKeyword(haystack, ['word', 'excel', 'powerpoint', 'pdf', 'obsidian', 'notion', 'typora', 'anki', '学习', '文档'])) {
    return { type: 'study', label: '学习/文档', confidence: 'medium', interruption: 'medium', suggestion: '适合解释、整理笔记、提醒休息。' }
  }
  return { type: 'general', label: '普通桌面', confidence: 'low', interruption: 'medium', suggestion: '保持普通主动策略。' }
}

export async function getCurrentDesktopSceneSnapshot(): Promise<{ settings: DesktopSceneSettings; scene: DesktopSceneResult; current: Partial<DesktopContextSnapshot> | null }> {
  const settings = await loadDesktopSceneSettings()
  const activeWindow: WindowInfo | null = getWindowWatcher().getCurrentWindow()
  if (!activeWindow) {
    return { settings, scene: detectDesktopScene(null, null), current: null }
  }
  const app = resolveWindowAppIdentity(activeWindow)
  return {
    settings,
    scene: detectDesktopScene(app, activeWindow.title || null),
    current: {
      app,
      window: activeWindow,
      windowTitle: activeWindow.title || null,
      isFullscreen: activeWindow.isFullscreen,
      updatedAt: Date.now()
    }
  }
}

export async function buildRuntimeScenePrompt(proactiveLevel = 45, desktopInterruptionAllowed = true): Promise<string> {
  const { settings, scene } = await getCurrentDesktopSceneSnapshot()
  if (!settings.enabled || !settings.includeInPrompt) return ''
  return [
    '[SYSTEM_SCENE_CONTEXT]',
    'This scene is detected at message-send time by the desktop client.',
    `scene_type: ${JSON.stringify(scene.type)}`,
    `scene_label: ${JSON.stringify(scene.label)}`,
    `scene_confidence: ${JSON.stringify(scene.confidence)}`,
    `recommended_interruption: ${JSON.stringify(scene.interruption)}`,
    `scene_suggestion: ${JSON.stringify(scene.suggestion)}`,
    `personality_proactive_level: ${proactiveLevel}/100`,
    `desktop_context_interruption_allowed_by_personality: ${desktopInterruptionAllowed ? 'true' : 'false'}`,
    'priority_rule:',
    '- Personality proactive_level is the base style preference.',
    '- Scene recommended_interruption is the real-time cap: game/media/code/art scenes should reduce unsolicited comments even if proactive_level is high.',
    '- If desktop_context_interruption_allowed_by_personality is false, do not proactively comment on desktop context unless the user asks.',
    '- User explicit requests always matter more than proactive scene suggestions.'
  ].join('\n')
}
