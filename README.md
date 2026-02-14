# AstrBot Live2D Desktop

一个基于 Electron + Vue 3 的 Live2D 桌面客户端。  
可与 AstrBot 实时通信，让模型展示文本、动作、表情、语音与多媒体内容。

> 使用前请先安装 AstrBot 适配器插件：  
> [astrbot_plugin_live2d_adapter](https://github.com/lxfight/astrbot_plugin_live2d_adapter)

## 快速入口

- 详细使用教程：[`docs/USAGE_TUTORIAL.zh-CN.md`](./docs/USAGE_TUTORIAL.zh-CN.md)
- 协议文档：`AstrBot/data/plugins/astrbot-live2d-adapter/docs/API.md`
- 适配器部署教程：`AstrBot/data/plugins/astrbot-live2d-adapter/docs/TUTORIAL.zh-CN.md`

## 功能亮点

- Live2D 模型渲染，支持 Cubism 3/4（`.model3.json`）模型
- 与 AstrBot WebSocket 实时交互，低延迟消息与表演推送
- 文本/图片/语音输入，自动触发表演序列播放
- 历史消息、表演记录与统计分析
- 语音唤醒与录音链路（可控开关 + 安全提示）
- 托盘、置顶、鼠标穿透等桌面助手能力

## 技术栈

| 模块 | 技术 |
| --- | --- |
| UI | Vue 3 + TypeScript + Naive UI |
| 桌面框架 | Electron 28 |
| 状态管理 | Pinia |
| 图表 | ECharts |
| 数据存储 | Better-SQLite3 |
| Live2D | pixi-live2d-display |

## 用户快速开始

### 1) 下载应用

从 [Releases](https://github.com/lxfight/astrbot-live2d-desktop/releases) 页面下载对应平台的安装包：

- Windows: `AstrBot-Live2D-x.x.x-win-x64.exe` (安装版) 或 `AstrBot-Live2D-x.x.x-portable-x64.exe` (便携版)
- macOS: `AstrBot-Live2D-x.x.x-mac.dmg`
- Linux: `AstrBot-Live2D-x.x.x-linux.AppImage`

> 首次启动时，应用会提示下载 Live2D Cubism SDK（约 200KB），点击确定即可自动下载。

### 2) 准备服务端

在 AstrBot 中安装并启用 `astrbot-live2d-adapter`，确保服务端已运行。

### 3) 配置连接

在桌面端「设置 -> 连接」填写：

1. 服务器地址（例：`ws://127.0.0.1:9090/astrbot/live2d`）
2. 认证令牌（必填，需与适配器 `auth_token` 一致）
3. 点击连接

> 认证令牌会保存到本地，重启后无需重复输入。

### 4) 导入模型

首次启动导入 Live2D 模型目录（`.model3.json`），即可开始对话与互动。

## 开发指南

### 环境要求

- Node.js >= 18
- npm / pnpm / yarn

### 安装依赖

```bash
npm install
```

### 常用命令

```bash
# 开发
npm run dev

# 构建（不包含 SDK，用户首次启动时自动下载）
npm run build
npm run build:win
npm run build:mac
npm run build:linux
npm run build:dir

# 类型检查
npm run typecheck
```

> 注意：构建产物不包含 Live2D Cubism SDK，应用首次启动时会提示用户下载。

## 项目结构

```text
astrbot-live2d-desktop/
├─ electron/               # 主进程、IPC、窗口、协议桥接
├─ src/                    # 渲染进程（Vue）
│  ├─ windows/             # 主窗口/设置/历史等
│  ├─ components/          # 组件
│  ├─ stores/              # Pinia 状态
│  └─ utils/               # 工具与业务模块
├─ public/                 # 公共资源（模型、静态文件）
├─ resources/              # 打包资源
└─ docs/                   # 使用文档
```

## 安全建议

- 连接令牌必须启用，不要使用弱口令
- 云服务器部署时务必限制端口来源 IP
- 优先使用内网或 WSS，避免公网明文传输
- 语音唤醒仅在可信环境启用

## 数据存储

- SQLite：消息历史、表演记录、统计数据
- LocalStorage：连接配置、用户偏好、模型状态
- 文件系统：导入模型与缓存资源

常见目录：

- Windows: `%APPDATA%/astrbot-live2d-desktop/`
- macOS: `~/Library/Application Support/astrbot-live2d-desktop/`
- Linux: `~/.config/astrbot-live2d-desktop/`

## 已知限制

- 受 Cubism Core 版本影响，部分较新 moc3 版本可能不兼容
- 某些环境下透明窗口与 GPU 驱动组合存在兼容差异

## 版权说明

本项目不包含 Live2D Cubism SDK，应用首次启动时会提示用户从 Live2D 官方网站下载。Live2D Cubism SDK 的使用需遵守 [Live2D 官方许可协议](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)。

## 相关项目

- [AstrBot](https://github.com/Soulter/AstrBot)
- [astrbot_plugin_live2d_adapter](https://github.com/lxfight/astrbot_plugin_live2d_adapter)
- [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)
- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/)

## License

MIT
