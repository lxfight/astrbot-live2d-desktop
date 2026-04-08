import { BrowserWindow, screen } from 'electron'
import type { DesktopFeatureSettings } from '../../src/utils/desktopFeatureSettings'
import { getPlatformCapabilities } from '../utils/platformCapabilities'
import {
  disableGameMode,
  enableGameMode,
  setGameModeVisibilityHandler,
} from '../utils/gameMode'
import {
  loadDesktopBehaviorPreferences,
  saveDesktopBehaviorPreferences,
} from './repository'
import {
  computeDesktopBehaviorEffectiveState,
  createDefaultDesktopBehaviorRuntimeState,
} from './store'
import type {
  DesktopBehaviorEffectiveState,
  DesktopBehaviorRuntimeState,
  DesktopBehaviorSnapshot,
  DesktopRevealReason,
} from './types'

type RevealPolicy = 'none' | 'showInactive' | 'focus'

function cloneRuntimeState(runtime: DesktopBehaviorRuntimeState): DesktopBehaviorRuntimeState {
  return { ...runtime }
}

function clonePreferences(preferences: DesktopFeatureSettings): DesktopFeatureSettings {
  return { ...preferences }
}

function cloneEffectiveState(effective: DesktopBehaviorEffectiveState): DesktopBehaviorEffectiveState {
  return { ...effective }
}

function statesEqual<T extends object>(left: T, right: T): boolean {
  const keys = Object.keys(left) as Array<keyof T>
  return keys.every((key) => left[key] === right[key])
}

function applyDesktopBounds(window: BrowserWindow): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { x, y, width, height } = primaryDisplay.workArea
  const [currentWidth, currentHeight] = window.getSize()
  const [currentX, currentY] = window.getPosition()
  if (currentWidth !== width || currentHeight !== height) {
    window.setSize(width, height)
  }
  if (currentX !== x || currentY !== y) {
    window.setPosition(x, y)
  }
}

function showWindow(window: BrowserWindow, revealPolicy: RevealPolicy): void {
  if (revealPolicy === 'focus') {
    window.show()
    window.focus()
    window.moveTop()
    return
  }

  if (revealPolicy === 'showInactive') {
    window.showInactive()
    return
  }

  if (!window.isVisible()) {
    window.showInactive()
  }
}

class DesktopBehaviorCoordinator {
  private readonly capabilities = getPlatformCapabilities()
  private readonly listeners = new Set<(snapshot: DesktopBehaviorSnapshot) => void>()
  private mainWindow: BrowserWindow | null = null
  private mousePassthroughEnabled = false
  private preferences = loadDesktopBehaviorPreferences()
  private runtime = createDefaultDesktopBehaviorRuntimeState()
  private effective = computeDesktopBehaviorEffectiveState(
    this.preferences,
    this.runtime,
    this.capabilities,
  )

  constructor() {
    setGameModeVisibilityHandler((hidden) => {
      this.setGameModeHidden(hidden)
    })
    this.syncGameModePreference()
  }

  attachMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
    this.applyEffectiveState({
      previousEffective: null,
      nextEffective: this.effective,
      revealPolicy: 'none',
      raiseToTop: this.effective.alwaysOnTop,
    })
    this.applyMousePassthrough(this.mousePassthroughEnabled, true)

    window.on('closed', () => {
      if (this.mainWindow === window) {
        this.mainWindow = null
      }
    })
  }

  reapplyMainWindowState(options?: { raiseToTop?: boolean }): void {
    this.applyEffectiveState({
      previousEffective: null,
      nextEffective: this.effective,
      revealPolicy: 'none',
      raiseToTop: Boolean(options?.raiseToTop && this.effective.alwaysOnTop),
    })
  }

  getPreferences(): DesktopFeatureSettings {
    return clonePreferences(this.preferences)
  }

  getSnapshot(): DesktopBehaviorSnapshot {
    return {
      preferences: clonePreferences(this.preferences),
      runtime: cloneRuntimeState(this.runtime),
      effective: cloneEffectiveState(this.effective),
    }
  }

  onSnapshotChanged(listener: (snapshot: DesktopBehaviorSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setMousePassthrough(ignoreMouseEvents: boolean): boolean {
    this.applyMousePassthrough(Boolean(ignoreMouseEvents))
    return this.mousePassthroughEnabled
  }

  updatePreferences(patch: Partial<DesktopFeatureSettings>): DesktopFeatureSettings {
    const previousPreferences = clonePreferences(this.preferences)
    const previousRuntime = cloneRuntimeState(this.runtime)
    this.preferences = saveDesktopBehaviorPreferences(patch)
    this.syncGameModePreference()
    this.recomputeAndApply(previousPreferences, previousRuntime, { revealPolicy: 'none' })
    return this.getPreferences()
  }

  setModelReady(ready: boolean): DesktopBehaviorSnapshot {
    if (this.runtime.modelReady === ready) {
      return this.getSnapshot()
    }

    const previousPreferences = clonePreferences(this.preferences)
    const previousRuntime = cloneRuntimeState(this.runtime)
    this.runtime = {
      ...this.runtime,
      modelReady: ready,
    }
    this.recomputeAndApply(previousPreferences, previousRuntime, { revealPolicy: ready ? 'showInactive' : 'none' })
    return this.getSnapshot()
  }

  setBackgroundPaused(paused: boolean): DesktopBehaviorSnapshot {
    if (this.runtime.backgroundPaused === paused) {
      return this.getSnapshot()
    }

    const revealPolicy: RevealPolicy = !paused ? 'showInactive' : 'none'
    const previousPreferences = clonePreferences(this.preferences)
    const previousRuntime = cloneRuntimeState(this.runtime)
    this.runtime = {
      ...this.runtime,
      backgroundPaused: paused,
    }
    this.recomputeAndApply(previousPreferences, previousRuntime, { revealPolicy })
    return this.getSnapshot()
  }

  setGameModeHidden(hidden: boolean): DesktopBehaviorSnapshot {
    if (this.runtime.gameModeHidden === hidden) {
      return this.getSnapshot()
    }

    const revealPolicy: RevealPolicy = !hidden ? 'showInactive' : 'none'
    const previousPreferences = clonePreferences(this.preferences)
    const previousRuntime = cloneRuntimeState(this.runtime)
    this.runtime = {
      ...this.runtime,
      gameModeHidden: hidden,
    }
    this.recomputeAndApply(previousPreferences, previousRuntime, { revealPolicy })
    return this.getSnapshot()
  }

  requestReveal(reason: DesktopRevealReason): DesktopBehaviorSnapshot {
    const revealPolicy: RevealPolicy =
      reason === 'tray' || reason === 'manual'
        ? 'focus'
        : 'showInactive'

    this.applyEffectiveState({
      previousEffective: null,
      nextEffective: this.effective,
      revealPolicy,
      raiseToTop: this.effective.alwaysOnTop,
    })
    return this.getSnapshot()
  }

  private syncGameModePreference(): void {
    if (!this.capabilities.gameMode.supported) {
      disableGameMode()
      if (this.runtime.gameModeHidden) {
        this.runtime = {
          ...this.runtime,
          gameModeHidden: false,
        }
      }
      return
    }

    if (this.preferences.autoDetectFullscreen) {
      enableGameMode()
      return
    }

    disableGameMode()
    if (this.runtime.gameModeHidden) {
      this.runtime = {
        ...this.runtime,
        gameModeHidden: false,
      }
    }
  }

  private recomputeAndApply(
    previousPreferences: DesktopFeatureSettings,
    previousRuntime: DesktopBehaviorRuntimeState,
    options?: { revealPolicy?: RevealPolicy },
  ): void {
    const previousEffective = computeDesktopBehaviorEffectiveState(
      previousPreferences,
      previousRuntime,
      this.capabilities,
    )
    const nextEffective = computeDesktopBehaviorEffectiveState(
      this.preferences,
      this.runtime,
      this.capabilities,
    )

    const preferencesChanged = !statesEqual(previousPreferences, this.preferences)
    const runtimeChanged = !statesEqual(previousRuntime, this.runtime)
    const effectiveChanged = !statesEqual(previousEffective, nextEffective)

    this.effective = nextEffective

    if (effectiveChanged) {
      this.applyEffectiveState({
        previousEffective,
        nextEffective,
        revealPolicy: options?.revealPolicy ?? 'none',
        raiseToTop: nextEffective.alwaysOnTop && (!previousEffective.alwaysOnTop || options?.revealPolicy === 'focus'),
      })
    } else if (options?.revealPolicy && options.revealPolicy !== 'none') {
      this.applyEffectiveState({
        previousEffective: null,
        nextEffective,
        revealPolicy: options.revealPolicy,
        raiseToTop: nextEffective.alwaysOnTop,
      })
    }

    if (preferencesChanged || runtimeChanged || effectiveChanged) {
      this.emitSnapshotChanged()
    }
  }

  private emitSnapshotChanged(): void {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private applyEffectiveState(options: {
    previousEffective: DesktopBehaviorEffectiveState | null
    nextEffective: DesktopBehaviorEffectiveState
    revealPolicy: RevealPolicy
    raiseToTop: boolean
  }): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    const { previousEffective, nextEffective, revealPolicy, raiseToTop } = options
    const window = this.mainWindow

    applyDesktopBounds(window)

    if (previousEffective?.alwaysOnTop && !nextEffective.alwaysOnTop) {
      window.setAlwaysOnTop(false)
    }

    if (nextEffective.visible) {
      showWindow(window, revealPolicy)
    } else if (window.isVisible()) {
      window.hide()
    }

    if (nextEffective.alwaysOnTop) {
      const level = nextEffective.zOrderLevel === 'screen-saver'
        ? 'screen-saver'
        : 'normal'
      window.setAlwaysOnTop(true, level)
      if (raiseToTop && window.isVisible()) {
        window.moveTop()
      }
    }
  }

  private applyMousePassthrough(ignoreMouseEvents: boolean, force = false): void {
    if (!force && this.mousePassthroughEnabled === ignoreMouseEvents) {
      return
    }

    this.mousePassthroughEnabled = ignoreMouseEvents

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    if (ignoreMouseEvents) {
      if (this.capabilities.mousePassthroughForward) {
        this.mainWindow.setIgnoreMouseEvents(true, { forward: true })
      } else {
        this.mainWindow.setIgnoreMouseEvents(true)
      }
      return
    }

    this.mainWindow.setIgnoreMouseEvents(false)
  }
}

let desktopBehaviorCoordinator: DesktopBehaviorCoordinator | null = null

export function getDesktopBehaviorCoordinator(): DesktopBehaviorCoordinator {
  if (!desktopBehaviorCoordinator) {
    desktopBehaviorCoordinator = new DesktopBehaviorCoordinator()
  }

  return desktopBehaviorCoordinator
}
