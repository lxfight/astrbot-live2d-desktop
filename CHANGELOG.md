# Changelog

## [1.3.0] - 2026-06-09

### Added
- 连接行为设置面板：可视化配置自动连接、重试策略、握手超时等参数。
- 配置导入导出功能：支持备份和恢复所有应用配置（连接设置、用户偏好、界面设置）。
- 特别鸣谢：在 README 和设置「关于」页面中添加 futureppo 的友情链接，感谢其提供的 AI Token 支持。

### Improved
- Live2D 资源加载优化：集成 ModelResourceCache，自动缓存纹理、动作、表情等资源，减少重复加载。
- 性能监控：开发模式下自动启用 FPS 和内存监控，低于阈值时发出警告。

## [1.2.0] - 2026-05-28

### Added
- 连接设置新增「保存并连接」主按钮，简化首次配置流程。
- 录音模式支持「按住说话」和「点击切换」两种模式，在高级设置中可切换。
- 模型拖拽增加屏幕边界约束（至少保留 20% 可见），右键菜单新增「重置位置」。
- 设置窗口默认置顶，标题栏增加 Pin 按钮可切换置顶状态。
- 系统托盘提示文字动态显示当前连接状态和重试倒计时。
- 日志级别（info/debug）现在会持久化，重启后保持。
- 模型设置中新增主题色选择器，支持手动覆盖颜色和恢复自动提取。
- 高级设置「数据管理」中新增「下载 Live2D SDK」按钮，供首次跳过下载后手动补装。

### Fixed
- Cubism SDK 下载失败后支持最多 3 次重试，取消下载不再导致应用退出。
- macOS 托盘图标不再透明（改用 PNG 替代 icns 格式）。
- macOS 开发模式下应用 Dock 图标正常显示。
- macOS 设置窗口标题文字不再与系统红绿灯按钮重叠。
- 修复设置窗口 toggleSettingsPin / closeCurrent IPC handler 语法错误。

### Changed
- 鼠标穿透设置从两个独立开关改为互斥 Radio 组（不穿透 / 智能穿透 / 完全穿透），交互更清晰。

## [1.1.0] - 2026-05-11

### Changed
- 正式版号从 `1.1.0-beta.20` 升级为 `1.1.0`。
- 明确当前桌面端只支持 Cubism 3/4 的 `.model3.json` 模型入口，不支持 Cubism 2 `.model.json`。
- 补全文档中的模型发现边界：运行时会按 `.model3.json` 标准声明、`.vtube.json` companion、目录扫描 fallback 的顺序整合动作与表情。
- 补充 `astrbot.live2d.profile.json` 的真实作用范围：自动加载表情目录别名、语义标签与语义预设，不参与替代模型主清单。
- 补充 `exp3` / `combo` / `semantic` 的能力边界，说明哪些场景是稳定能力，哪些只是兼容兜底。

### Docs
- 更新 `README.md`、`docs/USAGE_TUTORIAL.zh-CN.md`、`docs/CUBISM_RUNTIME.zh-CN.md`、`docs/README.zh-CN.md`，统一对外说明实际支持范围与限制。

## [1.1.0-beta.9] - 2026-03-07

### Fixed
- Ignore AstrBot Live2D's own Electron windows in desktop active-window detection and app-launch sensing.
- Keep message bubbles at natural width near screen edges instead of shrinking early.
- Add top/bottom bubble collision handling so bubbles stay inside the viewport.

### Packaging
- Include `active-win` runtime files in packaged builds so desktop window detection works after release packaging.
