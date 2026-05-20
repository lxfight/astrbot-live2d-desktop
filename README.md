# AstrBot Live2D Desktop

[![QQ Group](https://img.shields.io/badge/QQ群-1101928371-blue?style=flat-square&logo=tencent-qq)](https://qm.qq.com/q/ZaEiwF7vuG)

入群口令：`F7vuG`

一个基于 Electron + Vue 3 的 Live2D 桌面客户端。
可与 AstrBot 实时通信，让模型展示文本、动作、表情、语音与多媒体内容。

> 💡 我最初开发这个项目的目的是为了展示 **AstrBot 插件生态的完善性与兼容性**，因此通过适配器插件的形式实现与桌面应用的连接。这也想说明一点：**AstrBot 的能力远不止现有的默认平台**，它可以拓展到更多场景。在智能处理方面，**本项目本身并不带有任何 Agent 功能**——所有输入、输出、交互及智能决策逻辑，全部交由 AstrBot 端定义和驱动，桌面端只专注于 Live2D 模型的渲染与表现。当然，目前项目可能还存在许多不足，**非常欢迎社区的朋友们提交 PR**，一起让它变得更好。

> 使用前请先安装 AstrBot 适配器插件：
> [astrbot_plugin_live2d_adapter](https://github.com/lxfight/astrbot_plugin_live2d_adapter)

## 快速入口

- 详细使用教程：[`docs/USAGE_TUTORIAL.zh-CN.md`](./docs/USAGE_TUTORIAL.zh-CN.md)
- 平台支持矩阵：[`docs/PLATFORM_SUPPORT.zh-CN.md`](./docs/PLATFORM_SUPPORT.zh-CN.md)
- Cubism 接入说明：[`docs/CUBISM_RUNTIME.zh-CN.md`](./docs/CUBISM_RUNTIME.zh-CN.md)
- 协议文档：`AstrBot/data/plugins/astrbot-live2d-adapter/docs/API.md`
- 适配器部署教程：`AstrBot/data/plugins/astrbot-live2d-adapter/docs/TUTORIAL.zh-CN.md`

## 功能亮点

- Live2D 模型渲染，仅支持 Cubism 3/4 的 `.model3.json` 模型
- 不支持 Cubism 2 `.model.json` 模型导入与运行
- 与 AstrBot WebSocket 实时交互，低延迟消息与表演推送
- 文本/图片/语音输入，自动触发表演序列播放
- 历史消息、表演记录与统计分析
- 录音链路与全局快捷键
- 托盘、置顶、鼠标穿透等桌面助手能力

## 模型兼容边界

- 当前桌面端只接受 `.model3.json` 作为模型入口文件；检测到 `.model.json` 会直接拒绝导入。
- “支持 Cubism 3/4” 的含义是：支持 Cubism 3/4 时代常见的 `.model3.json` 资源组织方式，不代表兼容 Cubism 2。
- 模型动作与表情会按以下顺序自适应发现：
  1. `.model3.json` 内的标准 `FileReferences` 声明
  2. 模型目录中的 `.vtube.json` companion 声明
  3. 模型目录递归扫描得到的 `.motion3.json` / `.exp3.json` fallback
- 如果模型目录存在 `astrbot.live2d.profile.json`，应用会自动尝试加载它，为表情目录补充别名、语义标签和语义预设；如果文件不存在、读取失败或内容无效，则只是不启用这部分附加语义信息。
- 目录扫描 fallback 属于兼容补全，不等价于官方标准声明。遇到重名候选时会按内置规则择优，并可能产生兼容告警。

## 表情能力边界

- `exp3`：当前表情目录与组合能力以 `.exp3.json` 解析结果为基础。只有成功解析且包含有效参数的表情，才会进入 `combo` / `semantic` 等参数化能力构建；解析失败或无有效参数时，若原生表情加载成功，仍可能以单表情回退方式可用。
- `combo`：支持一次请求中组合多个表情，并按权重叠加；是否能稳定组合取决于表情参数是否冲突。
- `semantic`：支持按语义标签选择表情，但它不是任意自然语言理解。
  - 只有已发现且成功解析出参数的表情，才会参与标签归类与语义路由。
  - 仅靠目录扫描发现的表情，默认不会自动开放推断语义标签；需要在 `astrbot.live2d.profile.json` 中显式配置 `tags` 或 `semanticPresets`。
- 更完整的加载规则与限制说明见 [`docs/CUBISM_RUNTIME.zh-CN.md`](./docs/CUBISM_RUNTIME.zh-CN.md)。


## 用户快速开始

### 1) 下载应用

从 [Releases](https://github.com/lxfight/astrbot-live2d-desktop/releases) 页面下载对应平台的安装包：

- Windows: `astrbot-live2d-desktop-v<version>-win-<arch>.exe` (安装版) 或 `astrbot-live2d-desktop-v<version>-portable-<arch>.exe` (便携版)
- macOS: `astrbot-live2d-desktop-v<version>-mac-<arch>.dmg`
- Linux: `astrbot-live2d-desktop-v<version>-linux-<arch>.AppImage`

> 首次启动时，应用会提示下载 Live2D Cubism Core 运行时文件（约 200KB），点击确定即可自动下载。

### 2) 准备服务端

在 AstrBot 中安装并启用 `astrbot-live2d-adapter`，确保服务端已运行。

### 3) 配置连接

在桌面端「设置 -> 连接」填写：

1. 服务器地址（例：`ws://127.0.0.1:9090/astrbot/live2d`）
2. 认证令牌（必填，需与适配器 `auth_token` 一致）
3. 点击连接

> 认证令牌会保存到主进程用户配置（可用时加密），重启后无需重复输入。

### 4) 导入模型

首次启动导入包含 `.model3.json` 的 Live2D 模型目录，即可开始对话与互动。

建议把以下兼容文件放在同一模型目录内，应用会自动参与发现流程，并在可解析时纳入兼容清单：

- `.model3.json`：标准模型入口
- `.vtube.json`：可选 companion 声明
- `astrbot.live2d.profile.json`：可选表情别名 / 标签 / 语义预设
- `.motion3.json` / `.exp3.json`：可被标准声明、companion 或目录扫描发现

## 开发指南

### 环境要求

- Node.js >= 18
- pnpm

### 安装依赖

```bash
pnpm install
```

安装阶段会自动：

- 下载官方 Cubism Core 到 `public/lib/`
- 从官方仓库拉取固定版本 framework
- 生成 `.generated/cubism-framework/`
- 应用项目本地 patch

### 常用命令

```bash
# 开发
pnpm run dev

# 重建 Electron 原生依赖（better-sqlite3 / active-win 等）
pnpm run rebuild

# 构建（不包含 SDK，用户首次启动时自动下载）
pnpm run build
pnpm run build:win
pnpm run build:mac
pnpm run build:linux
pnpm run build:dir

# 类型检查
pnpm run typecheck
```

### 打包产物命名

- 安装包：`astrbot-live2d-desktop-v<version>-<os>-<arch>.<ext>`
- Windows 便携版：`astrbot-live2d-desktop-v<version>-portable-<arch>.exe`

> 注意：构建产物不包含 Live2D Cubism SDK，应用首次启动时会提示用户下载。

> 补充：仓库不会把官方 framework 源码直接放进 `src/`；当前接入细节见 `docs/CUBISM_RUNTIME.zh-CN.md`。

### 原生依赖构建说明（Windows）

若 `better-sqlite3` 重建失败，请先安装 **Visual Studio 2022 Build Tools**（勾选 `Desktop development with C++`），然后执行：

```bash
pnpm run rebuild
```

## 安全建议

- 连接令牌必须启用，不要使用弱口令
- 云服务器部署时务必限制端口来源 IP
- 优先使用内网或 WSS，避免公网明文传输
- 语音唤醒计划在后续版本重新引入，当前版本不提供该能力

## 数据存储

- SQLite：消息历史、表演记录、统计数据
- UserConfig（Electron Store，支持令牌加密）：连接配置
- LocalStorage：界面偏好、主题状态、模型位置等非敏感数据
- 文件系统：导入模型与缓存资源

常见目录：

- Windows: `%APPDATA%/astrbot-live2d-desktop/`
- macOS: `~/Library/Application Support/astrbot-live2d-desktop/`
- Linux: `~/.config/astrbot-live2d-desktop/`

## 已知限制

- 不支持 Cubism 2 `.model.json` 模型
- `.vtube.json` 仅作为 companion 补充来源使用，不代表完整兼容 VTube Studio 的全部配置语义
- `semantic` 表情选择依赖已发现的表情目录与 profile 标注，不能保证所有第三方模型都能自动得到理想语义映射
- 受 Cubism Core 版本影响，部分较新 moc3 版本可能不兼容
- 某些环境下透明窗口与 GPU 驱动组合存在兼容差异

## 版权说明

本项目不包含 Live2D Cubism SDK，应用首次启动时会提示用户从 Live2D 官方网站下载。Live2D Cubism SDK 的使用需遵守 [Live2D 官方许可协议](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)。

## 相关项目

- [AstrBot](https://github.com/Soulter/AstrBot)
- [astrbot_plugin_live2d_adapter](https://github.com/lxfight/astrbot_plugin_live2d_adapter)
- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/)

## License

MIT
