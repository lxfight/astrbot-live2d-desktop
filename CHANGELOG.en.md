# Changelog

## [1.6.0] - 2026-06-19

### Added
- Added desktop awareness foundations for normalized app/window identity and desktop RPC observation sync.
- Added model config change events so saves, deletes, and automatic config creation broadcast updates for main-window hot reload.
- Added expression request helpers and a model alias config editor composable to improve alias configuration maintenance.

### Changed
- Reworked settings design tokens, page actions, subsection styling, and Naive UI form-control theme overrides.
- Refined main-window overlays, radial-menu glass treatment, and settings visuals for better contrast and readability.
- Moved main-process window creation earlier to improve startup performance.

### Fixed
- Fixed reconnect getting stuck after the AstrBot side goes offline and comes back online.
- Fixed multiple race conditions around missing Cubism Core, model migration, background migration markers, and automatic model loading.
- Fixed `model:load` reliability, pending model state handling, startup model loading placeholder, and model config save behavior.
- Fixed settings migration blocking ready state, transparent card surfaces, and settings control alignment.

### Docs
- Updated desktop RPC protocol documentation.

## [1.5.0] - 2026-06-12

### Added
- Added v2 model capability sync: the desktop client reports motion/expression aliases, categories, and durations through `state.model`.
- Added per-model alias configuration for motion and expression names used by LLMs and the AstrBot adapter.
- Added motion preview, expression preview, and thumbnail capture entry points for model configuration.

### Changed
- `perform.show` now supports `motion.name` / `expression.name` alias triggers while keeping v1 `group/index` and `id` compatibility.
- Improved priority handling between idle motions, procedural noise, mouse gaze, and expression hold behavior.
- Bubble auto-hide now uses a fixed lifecycle to avoid long messages occupying the screen for too long.

### Fixed
- Fixed cross-platform smoke test failures caused by outdated bubble-hide and CubismTargetPoint easing expectations.

### Compatibility
- Update `astrbot_plugin_live2d_adapter` to a version that supports v2 alias model payloads to use the alias protocol fully.

## [1.4.0] - 2026-06-10

### Added
- Redesigned settings window: grouped sidebar navigation, title-bar quick menu, command palette (`Ctrl/Cmd+K`), and light/dark appearance.
- Advanced **Data management** local storage overview: database size, embedded media, model library, logs, Cubism Core, session/performance stats, and media-type breakdown.
- Config import/export restored under data management maintenance, backing up connection and behavior settings together.
- Audio lip-sync analyzer and procedural idle animation; per-model behavior configuration.
- More reliable theme color extraction from model texture source images.

### Changed
- Settings sections use a unified page scaffold and subsections; refreshed history, about, and model library layouts.
- Settings window no longer opens pinned by default; use the title-bar Pin control.
- Removed redundant explanatory copy in settings UI.

### Fixed
- Model theme color extraction improvements.

### Docs
- Updated README and usage tutorials for the new settings layout, data management, and history/statistics.

## [1.3.1] - 2026-06-09

### Fixed
- Fixed GitHub Release not showing code diff (incorrect PREVIOUS_TAG detection logic)

## [1.3.0] - 2026-06-09

### Added
- Connection behavior settings panel: Visual configuration for auto-connect, retry strategy, handshake timeout and more.
- Config import/export: Backup and restore all app settings (connection, user preferences, UI settings).
- Special thanks: Added Futureppo's sponsor link in README and Settings About page, thanking for the generous AI Token support.

### Improved
- Live2D resource loading optimization: Integrated ModelResourceCache to auto-cache textures, motions, expressions, reducing redundant loads.
- Performance monitoring: Auto-enabled FPS and memory monitoring in dev mode, with warnings when thresholds are breached.

## [1.2.0] - 2026-05-28

### Added
- Added "Save and Connect" primary button in connection settings for streamlined first-time setup.
- Recording mode now supports "Hold to talk" and "Click to toggle", configurable in advanced settings.
- Model drag now constrained to screen boundaries (at least 20% visible); added "Reset Position" in right-click menu.
- Settings window opens with always-on-top by default; added Pin button in titlebar to toggle.
- System tray tooltip now dynamically shows connection status and retry countdown.
- Log level (info/debug) is now persisted across app restarts.
- Added theme color picker in model settings with manual override and auto-extraction restore.
- Added "Download Live2D SDK" button in advanced data settings for re-download after initial skip.

### Fixed
- Cubism SDK download now retries up to 3 times on failure; cancelling download no longer exits the app.
- macOS tray icon no longer transparent (uses PNG instead of icns format).
- macOS app Dock icon now displays correctly in dev mode.
- macOS settings window title no longer overlaps with traffic light buttons.
- Fixed syntax errors in toggleSettingsPin and closeCurrent IPC handlers.

### Changed
- Mouse pass-through settings changed from two independent toggles to a mutually exclusive radio group (None / Smart / Full) for clearer interaction.

## [1.1.0] - 2026-05-11

### Changed
- Bumped version from `1.1.0-beta.20` to `1.1.0`.
- Clarified that the desktop client only supports Cubism 3/4 `.model3.json` model entries and does not support Cubism 2 `.model.json`.
- Documented model discovery boundaries: the runtime integrates motions and expressions in order of `.model3.json` standard declarations, `.vtube.json` companion, and directory scan fallback.
- Documented the actual scope of `astrbot.live2d.profile.json`: auto-loads expression catalog aliases, semantic tags, and semantic presets without replacing the main model manifest.
- Documented `exp3` / `combo` / `semantic` capability boundaries, clarifying which scenarios are stable capabilities and which are compatibility fallbacks.

### Docs
- Updated `README.md`, `docs/USAGE_TUTORIAL.zh-CN.md`, `docs/CUBISM_RUNTIME.zh-CN.md`, `docs/README.zh-CN.md` to uniformly describe actual support scope and limitations.

## [1.1.0-beta.9] - 2026-03-07

### Fixed
- Ignore AstrBot Live2D's own Electron windows in desktop active-window detection and app-launch sensing.
- Keep message bubbles at natural width near screen edges instead of shrinking early.
- Add top/bottom bubble collision handling so bubbles stay inside the viewport.

### Packaging
- Include `active-win` runtime files in packaged builds so desktop window detection works after release packaging.
