import { Drama, Globe, Info, MessageSquare, Settings } from 'lucide-vue-next'

export type SettingsGroupKey = 'connection' | 'model' | 'history' | 'advanced' | 'about'
export type SettingsChildKey =
  | 'bridge'
  | 'workspace'
  | 'current'
  | 'library'
  | 'messages'
  | 'statistics'
  | 'behavior'
  | 'shortcut'
  | 'window-watcher'
  | 'data'
  | 'info'

export interface SettingsMenuChild {
  key: SettingsChildKey
  label: string
}

export interface SettingsMenuGroup {
  key: SettingsGroupKey
  icon: unknown
  label: string
  children: SettingsMenuChild[]
}

export const settingsMenuGroups: SettingsMenuGroup[] = [
  {
    key: 'connection',
    icon: Globe,
    label: '连接',
    children: [
      { key: 'bridge', label: 'Bridge 连接' },
      { key: 'workspace', label: '工作区状态' },
    ],
  },
  {
    key: 'model',
    icon: Drama,
    label: '模型',
    children: [
      { key: 'current', label: '当前模型' },
      { key: 'library', label: '模型库' },
    ],
  },
  {
    key: 'history',
    icon: MessageSquare,
    label: '历史',
    children: [
      { key: 'messages', label: '消息列表' },
      { key: 'statistics', label: '统计概览' },
    ],
  },
  {
    key: 'advanced',
    icon: Settings,
    label: '高级',
    children: [
      { key: 'behavior', label: '行为配置' },
      { key: 'shortcut', label: '快捷键' },
      { key: 'window-watcher', label: '窗口监听' },
      { key: 'data', label: '数据管理' },
    ],
  },
  {
    key: 'about',
    icon: Info,
    label: '关于',
    children: [
      { key: 'info', label: '关于' },
    ],
  },
]

export function findSettingsMenuGroup(key: string): SettingsMenuGroup | undefined {
  return settingsMenuGroups.find((group) => group.key === key)
}
