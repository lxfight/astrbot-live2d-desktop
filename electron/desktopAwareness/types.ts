import type { WindowInfo } from '../utils/windowWatcher'

export type DesktopAwarenessMode = 'quiet' | 'smart' | 'active'
export type DesktopAwarenessScopeMode = 'all' | 'include' | 'exclude'
export type DesktopAwarenessTransitionType =
  | 'app-switch'
  | 'window-switch'
  | 'fullscreen-enter'
  | 'fullscreen-exit'
  | 'initial'

export type DesktopAwarenessConfidence = 'high' | 'medium' | 'low'

export interface DesktopAwarenessSettings {
  enabled: boolean
  mode: DesktopAwarenessMode
  appScope: {
    mode: DesktopAwarenessScopeMode
    apps: string[]
  }
  privacy: {
    shareWindowTitle: boolean
    allowScreenshotOnRequest: boolean
  }
}

export interface AppIdentity {
  displayName: string
  canonicalKey: string
  processName: string
  processPath?: string
  bundleId?: string
  appId?: string
  matchKeys: string[]
  confidence: DesktopAwarenessConfidence
  isSystem: boolean
}

export interface DesktopContextSnapshot {
  app: AppIdentity | null
  window: WindowInfo | null
  windowTitle: string | null
  isFullscreen: boolean
  focusedSince: number | null
  updatedAt: number
}

export interface RecentDesktopApp {
  app: AppIdentity
  lastSeenAt: number
  windowTitle: string | null
}

export interface DesktopContextChangedEvent {
  app: AppIdentity
  previousApp: AppIdentity | null
  windowTitle: string | null
  transitionType: DesktopAwarenessTransitionType
  dwellMs: number
  timestamp: number
  confidence: DesktopAwarenessConfidence
  privacy: {
    titleShared: boolean
    screenshotIncluded: false
  }
}

export interface DesktopAwarenessSnapshot {
  settings: DesktopAwarenessSettings
  current: DesktopContextSnapshot
  recentApps: RecentDesktopApp[]
  lastEvent: DesktopContextChangedEvent | null
  lastDecision: {
    shouldNotify: boolean
    reason: string
    timestamp: number
  } | null
}

export type DesktopContextChangedCallback = (event: DesktopContextChangedEvent) => void
