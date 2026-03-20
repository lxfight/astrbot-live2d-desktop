/**
 * 窗口监听配置
 * 
 * 定义窗口监听器的所有配置项，支持用户自定义
 */

import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

/**
 * 窗口事件类型
 */
export type WindowEventType = 
  | 'focus'      // 窗口获得焦点
  | 'blur'       // 窗口失去焦点
  | 'create'     // 窗口创建
  | 'destroy'    // 窗口销毁
  | 'resize'     // 窗口大小变化
  | 'move'       // 窗口位置变化
  | 'minimize'   // 窗口最小化
  | 'maximize'   // 窗口最大化
  | 'restore'    // 窗口恢复
  | 'fullscreen' // 窗口进入全屏
  | 'windowed'   // 窗口退出全屏

/**
 * AI 响应模式
 */
export type AIResponseMode = 
  | 'first-open'      // 仅首次打开应用时响应
  | 'every-switch'    // 每次应用切换都响应
  | 'specific-apps'   // 仅检测到特定应用时响应

/**
 * 内置忽略规则（不可修改）
 */
export const BUILTIN_IGNORE_RULES = {
  processNames: [
    'dwm.exe',                  // Desktop Window Manager
    'csrss.exe',                // Client Server Runtime Process
    'explorer.exe',             // Windows Explorer
    'SearchUI.exe',             // Windows Search
    'ShellExperienceHost.exe',  // Shell Experience Host
    'StartMenuExperienceHost.exe', // Start Menu
    'TextInputHost.exe',        // 文本输入
    'SecurityHealthSystray.exe', // 安全中心托盘
  ],
  titleKeywords: [
    'Program Manager',
    '锁屏',
    'Lock Screen',
    'LockApp',
    'Windows Shell Experience Host',
    'Windows Default Lock Screen',
    'Windows 输入体验',
    'Task Switching',
    'Task View',
  ],
}

/**
 * 窗口监听配置
 */
export interface WindowWatcherConfig {
  // 基础开关
  enabled: boolean
  
  // 频率限制（毫秒）
  throttle: {
    globalInterval: number      // 全局最小间隔
    perWindowInterval: number   // 单窗口最小间隔
    minInterval: number         // 最小间隔（防止过于频繁）
  }
  
  // 监控事件
  events: {
    focus: boolean              // 窗口获得焦点
    blur: boolean               // 窗口失去焦点
    create: boolean             // 新窗口创建
    destroy: boolean            // 窗口关闭
    fullscreen: boolean         // 进入全屏
    windowed: boolean           // 退出全屏
    resize: boolean             // 大小变化
    move: boolean               // 位置变化
    minimize: boolean           // 最小化
    maximize: boolean           // 最大化
    restore: boolean            // 恢复
  }
  
  // 忽略规则
  ignore: {
    processNames: string[]      // 用户自定义的忽略进程名
    titleKeywords: string[]     // 用户自定义的忽略标题关键词
  }
  
  // AI 响应模式
  aiResponse: {
    mode: AIResponseMode
    specificApps: string[]      // 特定应用列表（仅 mode=specific-apps 时生效）
  }
}

/**
 * 默认配置（用户自定义部分）
 */
export const DEFAULT_CONFIG: WindowWatcherConfig = {
  enabled: true,
  throttle: {
    globalInterval: 1000,       // 1秒
    perWindowInterval: 3000,    // 3秒
    minInterval: 100,           // 100ms
  },
  events: {
    focus: true,
    blur: false,
    create: true,
    destroy: false,
    fullscreen: true,
    windowed: false,
    resize: false,
    move: false,
    minimize: false,
    maximize: false,
    restore: false,
  },
  ignore: {
    processNames: [],           // 用户可以添加额外的忽略规则
    titleKeywords: [],          // 用户可以添加额外的忽略规则
  },
  aiResponse: {
    mode: 'first-open',
    specificApps: [],
  },
}

/**
 * 获取合并后的忽略规则（内置 + 用户自定义）
 */
export function getMergedIgnoreRules(userConfig: WindowWatcherConfig): {
  processNames: string[]
  titleKeywords: string[]
} {
  return {
    processNames: [
      ...BUILTIN_IGNORE_RULES.processNames,
      ...userConfig.ignore.processNames,
    ],
    titleKeywords: [
      ...BUILTIN_IGNORE_RULES.titleKeywords,
      ...userConfig.ignore.titleKeywords,
    ],
  }
}

/**
 * 配置文件路径
 */
function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'window-watcher-config.json')
}

/**
 * 验证配置
 */
export function validateConfig(config: Partial<WindowWatcherConfig>): WindowWatcherConfig {
  const validated: WindowWatcherConfig = { ...DEFAULT_CONFIG }
  
  // 基础开关
  if (typeof config.enabled === 'boolean') {
    validated.enabled = config.enabled
  }
  
  // 节流配置
  if (config.throttle) {
    if (typeof config.throttle.globalInterval === 'number' && 
        config.throttle.globalInterval >= 0) {
      validated.throttle.globalInterval = config.throttle.globalInterval
    }
    if (typeof config.throttle.perWindowInterval === 'number' && 
        config.throttle.perWindowInterval >= 0) {
      validated.throttle.perWindowInterval = config.throttle.perWindowInterval
    }
    if (typeof config.throttle.minInterval === 'number' && 
        config.throttle.minInterval >= 0) {
      validated.throttle.minInterval = config.throttle.minInterval
    }
  }
  
  // 事件配置
  if (config.events) {
    const eventKeys: Array<keyof WindowWatcherConfig['events']> = [
      'focus', 'blur', 'create', 'destroy', 'fullscreen', 'windowed',
      'resize', 'move', 'minimize', 'maximize', 'restore'
    ]
    for (const key of eventKeys) {
      if (typeof config.events[key] === 'boolean') {
        validated.events[key] = config.events[key]
      }
    }
  }
  
  // 忽略规则（只保存用户自定义部分，内置规则始终生效）
  if (config.ignore) {
    if (Array.isArray(config.ignore.processNames)) {
      // 过滤掉内置规则，只保留用户添加的
      validated.ignore.processNames = config.ignore.processNames.filter(
        name => typeof name === 'string' && 
                name.trim() && 
                !BUILTIN_IGNORE_RULES.processNames.includes(name)
      )
    }
    if (Array.isArray(config.ignore.titleKeywords)) {
      // 过滤掉内置规则，只保留用户添加的
      validated.ignore.titleKeywords = config.ignore.titleKeywords.filter(
        keyword => typeof keyword === 'string' && 
                   keyword.trim() && 
                   !BUILTIN_IGNORE_RULES.titleKeywords.includes(keyword)
      )
    }
  }
  
  // AI 响应模式
  if (config.aiResponse) {
    const validModes: AIResponseMode[] = ['first-open', 'every-switch', 'specific-apps']
    if (validModes.includes(config.aiResponse.mode as AIResponseMode)) {
      validated.aiResponse.mode = config.aiResponse.mode as AIResponseMode
    }
    if (Array.isArray(config.aiResponse.specificApps)) {
      validated.aiResponse.specificApps = config.aiResponse.specificApps.filter(
        app => typeof app === 'string' && app.trim()
      )
    }
  }
  
  return validated
}

/**
 * 加载配置
 */
export async function loadConfig(): Promise<WindowWatcherConfig> {
  try {
    const configPath = getConfigPath()
    const content = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(content)
    return validateConfig(parsed)
  } catch {
    // 配置文件不存在或格式错误，返回默认配置
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * 保存配置
 */
export async function saveConfig(config: WindowWatcherConfig): Promise<void> {
  try {
    const configPath = getConfigPath()
    const validated = validateConfig(config)
    await fs.writeFile(configPath, JSON.stringify(validated, null, 2), 'utf-8')
  } catch (error) {
    console.error('[窗口监听] 保存配置失败:', error)
    throw error
  }
}

/**
 * 重置配置
 */
export async function resetConfig(): Promise<WindowWatcherConfig> {
  await saveConfig(DEFAULT_CONFIG)
  return { ...DEFAULT_CONFIG }
}
