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
import { createScopedLogger } from '../utils/logger'
import type {
  DesktopBehaviorEffectiveState,
  DesktopBehaviorRuntimeState,
  DesktopBehaviorSnapshot,
  DesktopRevealReason,
} from './types'

type RevealPolicy = 'none' | 'showInactive' | 'focus'

const logger = createScopedLogger('desktop.behavior')

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
    logger.info('coordinator.create', {
      capabilities: this.capabilities,
      preferences: this.preferences,
      runtime: this.runtime,
      effective: this.effective,
    })
    setGameModeVisibilityHandler((hidden) => {
      this.setGameModeHidden(hidden)
    })
    this.syncGameModePreference()
  }

  attachMainWindow(window: BrowserWindow): void {
    logger.info('main_window.attach', {
      windowId: window.id,
      effective: this.effective,
      mousePassthroughEnabled: this.mousePassthroughEnabled,
    })
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
        logger.info('main_window.closed', { windowId: window.id })
        this.mainWindow = null
      }
    })
  }

  reapplyMainWindowState(options?: { raiseToTop?: boolean }): void {
    logger.debug('main_window.reapply', {
      raiseToTop: Boolean(options?.raiseToTop),
      effective: this.effective,
    })
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
    logger.debug('mouse_passthrough.requested', {
      requested: Boolean(ignoreMouseEvents),
      current: this.mousePassthroughEnabled,
    })
    this.applyMousePassthrough(Boolean(ignoreMouseEvents))
    return this.mousePassthroughEnabled
  }

  updatePreferences(patch: Partial<DesktopFeatureSettings>): DesktopFeatureSettings {
    const previousPreferences = clonePreferences(this.preferences)
    const previousRuntime = cloneRuntimeState(this.runtime)
    logger.info('preferences.update', {
      patch,
      previousPreferences,
    })
    this.preferences = saveDesktopBehaviorPreferences(patch)
    this.syncGameModePreference()
    this.recomputeAndApply(previousPreferences, previousRuntime, { revealPolicy: 'none' })
    return this.getPreferences()
  }

  setModelReady(ready: boolean): DesktopBehaviorSnapshot {
    if (this.runtime.modelReady === ready) {
      logger.debug('model_ready.unchanged', { ready })
      return this.getSnapshot()
    }

    logger.info('model_ready.update', {
      previous: this.runtime.modelReady,
      next: ready,
    })
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
      logger.debug('background_paused.unchanged', { paused })
      return this.getSnapshot()
    }

    logger.info('background_paused.update', {
      previous: this.runtime.backgroundPaused,
      next: paused,
    })
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
      logger.debug('game_mode_hidden.unchanged', { hidden })
      return this.getSnapshot()
    }

    logger.info('game_mode_hidden.update', {
      previous: this.runtime.gameModeHidden,
      next: hidden,
    })
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

    logger.info('reveal.requested', {
      reason,
      revealPolicy,
      effective: this.effective,
    })
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
      logger.debug('game_mode.sync.unsupported', {
        reason: this.capabilities.gameMode.reason,
      })
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
      logger.info('game_mode.sync.enable')
      enableGameMode()
      return
    }

    logger.info('game_mode.sync.disable')
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
      logger.info('effective.changed', {
        previousEffective,
        nextEffective,
        preferencesChanged,
        runtimeChanged,
        revealPolicy: options?.revealPolicy ?? 'none',
      })
      this.applyEffectiveState({
        previousEffective,
        nextEffective,
        revealPolicy: options?.revealPolicy ?? 'none',
        raiseToTop: nextEffective.alwaysOnTop && (!previousEffective.alwaysOnTop || options?.revealPolicy === 'focus'),
      })
    } else if (options?.revealPolicy && options.revealPolicy !== 'none') {
      logger.debug('effective.reveal_without_state_change', {
        nextEffective,
        revealPolicy: options.revealPolicy,
      })
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
    logger.debug('snapshot.broadcast', { snapshot })
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
      logger.debug('effective.apply.skipped', {
        reason: 'main_window_unavailable',
        nextEffective: options.nextEffective,
      })
      return
    }

    const { previousEffective, nextEffective, revealPolicy, raiseToTop } = options
    const window = this.mainWindow

    applyDesktopBounds(window)
    logger.debug('effective.apply.start', {
      windowId: window.id,
      previousEffective,
      nextEffective,
      revealPolicy,
      raiseToTop,
      visibleBefore: window.isVisible(),
    })

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
    logger.debug('effective.apply.done', {
      windowId: window.id,
      visibleAfter: window.isVisible(),
      alwaysOnTop: nextEffective.alwaysOnTop,
      zOrderLevel: nextEffective.zOrderLevel,
    })
  }

  private applyMousePassthrough(ignoreMouseEvents: boolean, force = false): void {
    if (!force && this.mousePassthroughEnabled === ignoreMouseEvents) {
      logger.debug('mouse_passthrough.unchanged', { ignoreMouseEvents })
      return
    }

    logger.info('mouse_passthrough.apply', {
      previous: this.mousePassthroughEnabled,
      next: ignoreMouseEvents,
      force,
      mousePassthroughForward: this.capabilities.mousePassthroughForward,
    })
    this.mousePassthroughEnabled = ignoreMouseEvents

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      logger.debug('mouse_passthrough.window_unavailable', { ignoreMouseEvents })
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
