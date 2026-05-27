# Changelog

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
