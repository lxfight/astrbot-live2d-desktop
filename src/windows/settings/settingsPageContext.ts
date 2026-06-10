import type { InjectionKey, Ref } from 'vue'
import type { SettingsChildKey, SettingsGroupKey } from './settingsMenu'

export interface SettingsPageContext {
  activeGroup: Ref<SettingsGroupKey>
  activeChild: Ref<SettingsChildKey>
}

export const settingsPageContextKey: InjectionKey<SettingsPageContext> =
  Symbol('settings-page-context')
