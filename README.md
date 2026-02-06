# AstrBot Live2D 桌面应用

基于 Electron + Vue3 + TypeScript 的 Live2D 桌面展示应用，可与 AstrBot 服务器通过 WebSocket 连接进行实时表演交互。

> ⚠️ **重要提示**：使用本应用前，请确保您的 AstrBot 已经安装了适配器插件：[astrbot-live2d-adapter](https://github.com/lxfight/astrbot-live2d-adapter)。

## 功能特性

- **Live2D 渲染**：支持 Cubism 2/4 模型，支持动作、表情、音频、视频等多媒体表演。
- **实时连接**：通过 WebSocket 与 AstrBot 服务器连接。
- **数据统计**：消息历史记录、数据可视化分析。
- **灵活配置**：窗口置顶、鼠标穿透、自动连接等高级选项。
- **界面设计**：基于 Naive UI 的现代化界面设计。

## 技术栈

- **前端框架**：Vue 3 + TypeScript + Vite
- **桌面框架**：Electron 28
- **UI 组件库**：Naive UI
- **状态管理**：Pinia
- **图表可视化**：ECharts
- **数据库**：Better-SQLite3
- **Live2D**：pixi-live2d-display

## 开发环境

### 前置要求

- Node.js >= 18
- npm / yarn / pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
# 构建所有平台
npm run build

# 仅构建 Windows
npm run build:win

# Build macOS only
npm run build:mac

# Build Linux only
npm run build:linux

# Build unpacked directory only
npm run build:dir
```

## 项目结构

```
desktop/
├── electron/              # Electron 主进程代码
│   ├── main.ts           # 主进程入口
│   ├── preload.ts        # 预加载脚本
│   ├── windows/          # 窗口管理
│   ├── ipc/              # IPC 通信处理
│   ├── bridge/           # WebSocket 桥接
│   └── database/         # SQLite 数据库
├── src/                  # Vue 渲染进程代码
│   ├── windows/          # 窗口组件
│   ├── components/       # 公共组件
│   ├── stores/           # Pinia 状态管理
│   ├── utils/            # 工具函数
│   └── assets/           # 静态资源
├── public/               # 公共资源
│   └── models/           # Live2D 模型存放
├── resources/            # 打包资源（图标等）
└── package.json          # 项目配置
```

## 使用说明

### 1. 导入 Live2D 模型

首次启动时，需要先导入一个 Live2D 模型：

1. 点击主窗口的"导入模型"按钮。
2. 选择模型配置文件（`.model.json` 或 `.model3.json`）。
3. 等待模型加载完成。

### 2. 连接服务器

在设置窗口中配置 WebSocket 连接：

1. 填写服务器地址（如 `ws://localhost:6185`）。
2. 可选填写认证令牌。
3. 点击"连接"按钮。

### 3. 查看历史记录

在历史记录窗口中可以：

- 查看消息历史。
- 查看统计图表。
- 分析表演数据。

## 配置选项

### 连接配置

- 服务器地址
- 认证令牌

### 模型管理

- 导入/删除模型
- 切换当前模型
- 模型自动加载

### 表演设置

- 默认动作组
- 文字显示时长
- 动作优先级
- 自动播放动画

### 高级选项

- 窗口置顶
- 鼠标穿透
- 启动时自动连接
- 启动时自动加载模型

## 数据持久化

应用使用以下方式存储数据：

- **SQLite 数据库**：消息历史、表演记录、统计数据。
- **LocalStorage**：用户设置、模型路径等轻量配置。
- **文件系统**：导入的 Live2D 模型文件。

数据存储位置：
- Windows: `%APPDATA%/astrbot-live2d-desktop/`
- macOS: `~/Library/Application Support/astrbot-live2d-desktop/`
- Linux: `~/.config/astrbot-live2d-desktop/`

## 性能优化

- 使用共享的 PIXI Application 避免 WebGL 上下文耗尽。
- ECharts 图表自适应窗口大小。
- 按需加载和代码分割（Naive UI、ECharts、Vendor）。
- 生产构建启用压缩和混淆。

## 已知问题

- **moc3 v6 支持**：当前使用的 Cubism Core 5.1.0 仅支持 moc3 v5，v6 模型暂不支持。
- **CSP unsafe-eval**：PIXI.js 需要 eval() 编译 WebGL 着色器，开发环境会有警告。

## 协议

L2D-Bridge Protocol v1.0

详见：`AstrBot/data/plugins/astrbot-live2d-adapter/API.md`

## 许可证

MIT License

## 相关链接

- [AstrBot](https://github.com/Soulter/AstrBot)
- [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)
- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/)