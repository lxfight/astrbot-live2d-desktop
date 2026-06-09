# Changelog

## [1.3.0] - 2026-06-09

### Added
- Connection behavior settings panel: Visual configuration for auto-connect, retry strategy, handshake timeout and more.
- Config import/export: Backup and restore all app settings (connection, user preferences, UI settings).
- Special thanks: Added futureppo's sponsor link in README and Settings About page, thanking for the generous AI Token support.

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
