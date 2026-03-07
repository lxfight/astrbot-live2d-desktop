# Changelog

## [1.1.0-beta.9] - 2026-03-07

### Fixed
- Ignore AstrBot Live2D's own Electron windows in desktop active-window detection and app-launch sensing.
- Keep message bubbles at natural width near screen edges instead of shrinking early.
- Add top/bottom bubble collision handling so bubbles stay inside the viewport.

### Packaging
- Include `active-win` runtime files in packaged builds so desktop window detection works after release packaging.

