/**
 * 插件清单与运行时协议类型
 * 主进程（PluginManager/PluginHost）与插件 SDK 共用。
 */

export const PLUGIN_API_VERSION = '1.0.0'

/** 插件权限白名单：清单声明 + 宿主双检，未授权 API 不注入 */
export type PluginPermission =
  | 'storage'
  | 'network'
  | 'notifications'
  | 'timers'
  | 'events'
  | 'trayMenu'
  | 'settingsUi'

export type PluginEventKind = 'message:received' | 'message:sent' | 'model:loaded' | 'performance'

export type PluginSettingKind = 'text' | 'number' | 'boolean' | 'select' | 'multiSelect'

export interface PluginSettingsSchema {
  key: string
  kind: PluginSettingKind
  label: string
  description?: string
  defaultValue?: string | number | boolean | string[]
  options?: Array<{ label: string; value: string }>
  min?: number
  max?: number
}

export interface PluginTrayMenuItem {
  id: string
  label: string
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  entry: string
  minAppVersion?: string
  permissions?: PluginPermission[]
  settings?: PluginSettingsSchema[]
  trayMenu?: PluginTrayMenuItem[]
  subscriptions?: PluginEventKind[]
}

export type PluginRuntimeStatus = 'registered' | 'running' | 'disabled' | 'quarantined'

export interface PluginInfo {
  manifest: PluginManifest
  status: PluginRuntimeStatus
  settings: Record<string, unknown>
  crashCount: number
  lastError: string | null
  installedAt: number
}

export const PLUGIN_DEFAULT_PERMISSIONS: PluginPermission[] = ['storage']

export const PLUGIN_PERMISSION_VALID_VALUES: PluginPermission[] = [
  'storage',
  'network',
  'notifications',
  'timers',
  'events',
  'trayMenu',
  'settingsUi'
]

export const PLUGIN_EVENT_VALID_VALUES: PluginEventKind[] = [
  'message:received',
  'message:sent',
  'model:loaded',
  'performance'
]

/**
 * 宿主 → 插件：API 方法调用（RPC 风格）
 * 插件 → 宿主：事件上报（log 转发）
 */
export interface PluginHostRpcCall {
  type: 'rpc'
  id: number
  method: string
  params?: unknown[]
}

export interface PluginHostRpcResult {
  type: 'rpc-result'
  id: number
  ok: boolean
  value?: unknown
  error?: string
}

export interface PluginHostEventPush {
  type: 'event'
  kind: PluginEventKind
  payload: unknown
}

export interface PluginLifecycleCommand {
  type: 'command'
  action: 'enable' | 'disable'
}

export interface PluginEntrypoint {
  (api: unknown): void | { onDisable?: () => void }
}
