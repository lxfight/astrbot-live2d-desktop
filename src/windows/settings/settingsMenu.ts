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
  | 'windowWatcher'
  | 'data'
  | 'info'

export interface SettingsMenuChild {
  key: SettingsChildKey
}

export interface SettingsMenuGroup {
  key: SettingsGroupKey
  icon: unknown
  children: SettingsMenuChild[]
}

export const settingsMenuGroups: SettingsMenuGroup[] = [
  {
    key: 'connection',
    icon: Globe,
    children: [
      { key: 'bridge' },
      { key: 'workspace' },
    ],
  },
  {
    key: 'model',
    icon: Drama,
    children: [
      { key: 'current' },
      { key: 'library' },
    ],
  },
  {
    key: 'history',
    icon: MessageSquare,
    children: [
      { key: 'messages' },
      { key: 'statistics' },
    ],
  },
  {
    key: 'advanced',
    icon: Settings,
    children: [
      { key: 'behavior' },
      { key: 'shortcut' },
      { key: 'windowWatcher' },
      { key: 'data' },
    ],
  },
  {
    key: 'about',
    icon: Info,
    children: [
      { key: 'info' },
    ],
  },
]

export function findSettingsMenuGroup(key: string): SettingsMenuGroup | undefined {
  return settingsMenuGroups.find((group) => group.key === key)
}
