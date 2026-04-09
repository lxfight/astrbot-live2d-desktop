import type { DesktopFeatureSettings } from '../../src/utils/desktopFeatureSettings'

export type DesktopRevealReason = 'tray' | 'restore' | 'manual'

export interface DesktopBehaviorRuntimeState {
  modelReady: boolean
  backgroundPaused: boolean
  gameModeHidden: boolean
}

export interface DesktopBehaviorEffectiveState {
  visible: boolean
  alwaysOnTop: boolean
  zOrderLevel: 'default' | 'screen-saver'
}

export interface DesktopBehaviorSnapshot {
  preferences: DesktopFeatureSettings
  runtime: DesktopBehaviorRuntimeState
  effective: DesktopBehaviorEffectiveState
}
