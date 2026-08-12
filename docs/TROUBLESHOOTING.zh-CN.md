# 故障排查手册

本手册汇总 AstrBot Live2D Desktop 常见问题的定位方法与处理建议。定位问题前，请先确认使用的是最新版本（`设置 → 关于`），并保留问题现场的日志文件。

## 1. 日志与数据文件位置

排查问题通常需要查看日志。数据目录按打包方式区分（判定逻辑见 `electron/utils/appPaths.ts`）：

- **安装版**：Electron 默认 userData 目录，即 `%APPDATA%/astrbot-live2d-desktop`（Windows）、`~/Library/Application Support/astrbot-live2d-desktop`（macOS）、`~/.config/astrbot-live2d-desktop`（Linux）
- **便携版**：可执行文件所在目录下的 `data/` 子目录（目录名含 `portable.txt` 标记或设置了 `PORTABLE_EXECUTABLE_DIR` 时启用）

数据目录内关键文件：

| 文件/目录 | 用途 |
| --- | --- |
| `logs/astrbot-live2d-YYYY-MM-DD.log` | 当日日志（同名文件按序号滚动），保留 14 天 |
| `history.db` | SQLite 数据库（消息历史、表演记录、`user_config` 设置表） |
| Electron userData 文件 | 渲染进程 localStorage 等 |

日志级别可在 `设置 → 高级 → 行为` 调整（持久化于 `user_config` 表）。

## 2. 连接问题（连不上 AstrBot）

连接失败时设置窗口的状态栏会显示错误码。错误码与含义（分类逻辑见 `electron/bridge/bridgeFailureClassifier.ts`）：

| 错误码 | 含义 | 处理建议 |
| --- | --- | --- |
| `INVALID_URL` | 服务地址格式无效 | 检查 `设置 → 连接` 中的地址是否以 `ws://` 或 `wss://` 开头 |
| `TOKEN_REQUIRED` | 令牌为空 | 填写 AstrBot 适配器插件配置中给出的令牌 |
| `AUTH_FAILED` | 令牌校验失败 | 确认令牌未过期、无多余空格；重连不会自动重试此错误 |
| `VERSION_MISMATCH` | 协议版本不兼容 | 升级桌面端与 AstrBot 插件到配套版本（协议版本见 `package.json` 的 `desktopMetadata.protocol.version`） |
| `WS_CONNECT_FAILED` | 网络连接被拒绝 | AstrBot 未启动、端口被防火墙拦截，或地址写错 |
| `WS_UNEXPECTED_CLOSE` | 连接建立后异常断开 | 查看 AstrBot 日志；此错误会自动重试，可在 `设置 → 连接 → 连接策略` 调整重试次数与退避 |

通用检查顺序：

1. AstrBot 本体是否运行，适配器插件是否启用。
2. 服务地址与令牌是否与插件配置一致（注意 `ws` 与 `wss` 的区分——HTTPS 反向代理场景需要 `wss`）。
3. 本机防火墙是否放行对应端口。
4. 若代理软件（Clash/v2ray 等）开启，尝试关闭或配置白名单后重试。

## 3. 模型加载问题

### 3.1 提示"不支持的模型格式"

仅支持 Cubism 3/4 的 `.model3.json` 模型；Cubism 2 的 `.model.json` 会在导入时被直接拒绝。请确认模型目录内存在 `.model3.json` 文件（发现顺序为：标准声明 → `.vtube.json` companion → 目录扫描 fallback）。

### 3.2 模型无法显示 / 白屏

1. **Cubism Core 未就绪**：首次启动时需下载 Cubism SDK（构建产物不包含 SDK）。检查 `设置 → 关于` 中的 SDK 状态，网络受限时按 `docs/CUBISM_RUNTIME.zh-CN.md` 手动放置 Core 文件。
2. **纹理加载失败**：日志中会出现 `[CubismModel] 纹理加载失败`。确认模型资源文件完整，且自定义资源地址（`设置 → 连接 → 资源地址`）可达。
3. **透明窗口渲染异常**：部分 GPU 驱动组合下透明窗口兼容性不佳（见 `docs/PLATFORM_SUPPORT.zh-CN.md`）。尝试在设置中关闭窗口透明度或更新显卡驱动。

## 4. 桌面行为问题（穿透/置顶/托盘）

- **鼠标穿透关不掉或点不到**：穿透模式有三种（无穿透、智能穿透、完全穿透）。智能穿透在全屏应用检测到"游戏模式"时会自动切换——先确认当前模式是否为自动切换所致。
- **置顶不生效**：部分 Linux 桌面环境（非 GNOME/KDE）对置顶协议支持有限，见平台支持矩阵。

## 5. 性能问题（卡顿/高占用）

1. **FPS 低**：失焦省电功能会把帧率降到配置值（`设置 → 高级 → 行为 → 智能行为`），这是预期行为；恢复聚焦后应回到 60fps。
2. **内存持续增长**：可在 `设置 → 历史与统计` 观察记录量。若怀疑泄漏，保留日志并提交 issue，附上任务管理器中的内存曲线。
3. **开发模式**：开发模式下 PerformanceMonitor 会输出性能快照，可据此定位帧率瓶颈。

## 6. 数据问题（历史/设置丢失）

- **数据库文件**：`history.db` 使用 `node:sqlite`，无原生依赖。异常退出后数据库一般可自动恢复；若损坏，可备份后删除该文件（历史记录会丢失，设置项会恢复默认）。
- **配置备份**：使用 `设置 → 高级 → 数据` 中的配置导入/导出功能定期备份，迁移设备时先导出再导入。

## 7. 提交问题反馈

提交 issue 时建议附带：

1. 桌面端版本、操作系统及版本。
2. 复现步骤与预期/实际表现。
3. 当日日志文件（`logs/` 目录，注意日志可能包含连接地址等敏感信息，可先脱敏）。
4. 如涉及模型，附模型名称与来源（不要直接上传版权模型文件）。

## 参考

- 使用教程：`docs/USAGE_TUTORIAL.zh-CN.md`
- Cubism 运行时说明：`docs/CUBISM_RUNTIME.zh-CN.md`
- 平台支持矩阵：`docs/PLATFORM_SUPPORT.zh-CN.md`
- 桌面行为架构：`docs/DESKTOP_BEHAVIOR_ARCHITECTURE.zh-CN.md`
