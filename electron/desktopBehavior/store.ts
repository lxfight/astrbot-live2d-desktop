import type { DesktopFeatureSettings } from '../../src/utils/desktopFeatureSettings'
import type { PlatformCapabilities } from '../utils/platformCapabilities'
import type {
  DesktopBehaviorEffectiveState,
  DesktopBehaviorRuntimeState,
} from './types'

export function createDefaultDesktopBehaviorRuntimeState(): DesktopBehaviorRuntimeState {
  return {
    modelReady: false,
    backgroundPaused: false,
    gameModeHidden: false,
  }
}

export function computeDesktopBehaviorEffectiveState(
  preferences: DesktopFeatureSettings,
  runtime: DesktopBehaviorRuntimeState,
  capabilities: PlatformCapabilities,
): DesktopBehaviorEffectiveState {
  const visible = runtime.modelReady && !runtime.backgroundPaused && !runtime.gameModeHidden

  return {
    visible,
    alwaysOnTop: visible && preferences.alwaysOnTop,
    zOrderLevel: capabilities.alwaysOnTopLevel,
  }
}
