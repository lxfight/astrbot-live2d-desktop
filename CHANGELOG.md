# Changelog

## [1.1.0-beta.20] - 2026-05-07

### Changed
- 明确当前桌面端只支持 Cubism 3/4 的 `.model3.json` 模型入口，不支持 Cubism 2 `.model.json`。
- 补全文档中的模型发现边界：运行时会按 `.model3.json` 标准声明、`.vtube.json` companion、目录扫描 fallback 的顺序整合动作与表情。
- 补充 `astrbot.live2d.profile.json` 的真实作用范围：自动加载表情目录别名、语义标签与语义预设，不参与替代模型主清单。
- 补充 `exp3` / `combo` / `semantic` 的能力边界，说明哪些场景是稳定能力，哪些只是兼容兜底。

### Docs
- 更新 `README.md`、`docs/USAGE_TUTORIAL.zh-CN.md`、`docs/CUBISM_RUNTIME.zh-CN.md`、`docs/README.md`，统一对外说明实际支持范围与限制。

## [1.1.0-beta.9] - 2026-03-07

### Fixed
- Ignore AstrBot Live2D's own Electron windows in desktop active-window detection and app-launch sensing.
- Keep message bubbles at natural width near screen edges instead of shrinking early.
- Add top/bottom bubble collision handling so bubbles stay inside the viewport.

### Packaging
- Include `active-win` runtime files in packaged builds so desktop window detection works after release packaging.
