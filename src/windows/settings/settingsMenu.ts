import {
  Cable,
  Drama,
  Globe,
  Heart,
  Info,
  Link2,
  MessageSquare,
  MessagesSquare,
  Palette,
  Settings,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  BarChart3,
  Database,
  Eye,
  Keyboard
} from 'lucide-vue-next'

export type SettingsGroupKey = 'connection' | 'model' | 'history' | 'advanced' | 'about'
export type SettingsChildKey =
  | 'bridge'
  | 'connectionBehavior'
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
  icon: unknown
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
      { key: 'bridge', icon: Link2 },
      { key: 'connectionBehavior', icon: SlidersHorizontal },
      { key: 'workspace', icon: Cable }
    ]
  },
  {
    key: 'model',
    icon: Drama,
    children: [
      { key: 'current', icon: Palette },
      { key: 'library', icon: Sparkles }
    ]
  },
  {
    key: 'history',
    icon: MessageSquare,
    children: [
      { key: 'messages', icon: MessagesSquare },
      { key: 'statistics', icon: BarChart3 }
    ]
  },
  {
    key: 'advanced',
    icon: Settings,
    children: [
      { key: 'behavior', icon: Settings2 },
      { key: 'shortcut', icon: Keyboard },
      { key: 'windowWatcher', icon: Eye },
      { key: 'data', icon: Database }
    ]
  },
  {
    key: 'about',
    icon: Info,
    children: [{ key: 'info', icon: Heart }]
  }
]

export function findSettingsMenuGroup(key: string): SettingsMenuGroup | undefined {
  return settingsMenuGroups.find(group => group.key === key)
}

export function findSettingsMenuChild(
  group: SettingsGroupKey,
  child: SettingsChildKey
): SettingsMenuChild | undefined {
  const groupMeta = findSettingsMenuGroup(group)
  return groupMeta?.children.find(item => item.key === child)
}
