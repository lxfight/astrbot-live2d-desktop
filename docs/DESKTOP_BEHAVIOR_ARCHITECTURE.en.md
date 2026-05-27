# Desktop Behavior Architecture (Always-on-Top / Passthrough / Visibility)

## 1. Design Goals

- Eliminate state overwrite issues caused by multiple modules directly calling `BrowserWindow`.
- Layer "user preferences", "runtime events", and "final window behavior" to avoid state coupling.
- Ensure that future window policy additions only require changes in a single main flow entry point.

## 2. Single State Owner

The main process `DesktopBehaviorCoordinator` is the only module allowed to call window behavior APIs.

- Coordinator path: `electron/desktopBehavior/coordinator.ts`
- State computation path: `electron/desktopBehavior/store.ts`
- Persistence path: `electron/desktopBehavior/repository.ts`
- IPC contract path: `electron/ipc/desktopBehavior.ts`

Except for the coordinator, other modules may only send semantic events and are prohibited from directly calling:

- `setAlwaysOnTop`
- `setIgnoreMouseEvents`
- `setSize` / `setPosition` (desktop-behavior-related)
- `show` / `showInactive` / `focus` (desktop-behavior-related)

## 3. Three-Layer State Model

### Preferences (Persisted)

Stored in `userConfig`:

- `alwaysOnTop`
- `fullPassThrough`
- `dynamicPassThrough`
- `autoDetectFullscreen`

### Runtime (In Memory)

Exists only in memory:

- `modelReady`: whether the Live2D model has been successfully loaded
- `backgroundPaused`: lock screen / suspend background pause
- `gameModeHidden`: hidden during full-screen applications

### Effective (Final Behavior)

Computed purely from `Preferences + Runtime + PlatformCapabilities`:

- `visible`
- `alwaysOnTop`
- `zOrderLevel`

## 4. Event Entry Points and Data Flow

Unified IPC entry points:

- `desktopBehavior:getPreferences`
- `desktopBehavior:updatePreferences`
- `desktopBehavior:getSnapshot`
- `desktopBehavior:setMousePassthrough`
- `desktopBehavior:setModelReady`
- `desktopBehavior:requestReveal`

Fixed processing flow:

1. IPC input validation (main process)
2. Coordinator updates Runtime/Preferences
3. `store.computeDesktopBehaviorEffectiveState` computes the new state
4. Coordinator applies differences to the main window
5. Broadcast `desktopBehavior:snapshotChanged`
6. Renderer process subscribes to snapshots and updates the UI

## 5. Key Behavior Policies

- When full-screen detection triggers hiding: only the runtime state changes; external modules must not directly `show/hide` the main window.
- When no model is loaded: the main window stays hidden, with the settings window (model library) handling the import flow.
- `requestReveal` only retains two strategies: focus-to-front on manual/tray activation, `showInactive` only for all other scenarios.
- Mouse passthrough is controlled through an independent channel and does not participate in `visible/alwaysOnTop` computation or decision-making.

## 6. Maintenance Constraints

- When adding a new desktop behavior toggle, the following must be modified synchronously:
  - `src/utils/desktopFeatureSettings.ts`
  - `electron/desktopBehavior/repository.ts`
  - `electron/desktopBehavior/store.ts`
  - `src/types/electron.d.ts` (if IPC types are involved)
- Any window z-order behavior changes must go through the coordinator and must not directly manipulate the main window in business modules.
- The renderer process only expresses "intent" and does not directly call window APIs.

## 7. Regression Checklist

1. Tray "Show main window" should focus to front when a model is present; open the model library page when no model is present.
2. Opening the settings/history window should not cause the main window to cover foreground applications.
3. Empty-state import and model restoration should correctly coordinate size and always-on-top behavior.
4. Main window should correctly hide/restore when entering/exiting full-screen applications.
