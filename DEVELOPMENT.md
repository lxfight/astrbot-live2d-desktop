# AstrBot Live2D 桌面端 - 开发说明

## 项目概述

AstrBot Live2D 桌面端是一个基于 Electron + Vue 3 + PixiJS 的轻量级桌面端 Live2D 应用。

### 核心特性

- ✅ Live2D Cubism 4.0 模型渲染
- ✅ 透明无边框窗口
- ✅ 智能鼠标穿透（在模型区域拦截，在透明区域穿透）
- ✅ 窗口拖拽功能
- ✅ 视线跟随
- ✅ 点击交互
- ✅ 完整的设置界面
- ✅ 配置持久化

## 技术栈

- **桌面框架**: Electron 39+
- **前端框架**: Vue 3 + Vite 6
- **状态管理**: Pinia
- **渲染引擎**: PixiJS v6（pixi.js@6.5.10）+ pixi-live2d-display v0.4.0
- **配置存储**: electron-store

## 项目结构

```
astrbot-live2d-desktop/
├── electron/                  # Electron 主进程
│   ├── main.cjs              # 应用入口
│   ├── preload.cjs           # IPC 预加载脚本
│   └── ...                   # 其它主进程模块
├── src/                      # Vue 前端源码
│   ├── components/
│   │   ├── Live2DRenderer.vue   # Live2D 渲染组件
│   │   ├── SettingsNew.vue      # 设置界面入口
│   │   ├── settings/            # 设置子组件
│   │   └── BubbleDialog.vue     # 气泡对话框
│   ├── utils/
│   │   ├── hitTest.ts           # 模型区域识别
│   │   └── mousePassthrough.ts  # 智能鼠标穿透
│   ├── App.desktop.vue       # 桌面应用主组件
│   └── main.ts               # 入口文件
├── public/
│   └── models/               # Live2D 模型文件
│       └── default/
└── package.json
```

## 模型与运行时资源（重要）

由于 Live2D 官方许可限制，本仓库不分发：
- Live2D 模型资产（`*.moc3`、纹理、动作等）
- Cubism Core 运行时（`public/lib/live2dcubismcore.min.js`）

本地开发时：
1. 运行 `scripts/fetch-default-model.ps1` 下载官方示例模型到 `public/models/default/`。
2. 从 Live2D 官方 Cubism SDK for Web 获取 `live2dcubismcore.min.js` 并放到 `public/lib/`。

## 快速开始

### 1. 安装依赖

```bash
cd astrbot-live2d-desktop
pnpm install
```

### 2. 开发模式

#### 方式 1: 仅运行前端（浏览器预览）

```bash
pnpm run dev
```

然后访问 http://localhost:1420

#### 方式 2: 运行完整的 Electron 应用

```bash
pnpm run dev:electron
```

这会同时启动 Vite 开发服务器和 Electron 窗口。

### 3. 构建生产版本

```bash
pnpm run build
```

## 已实现功能

### Phase 2: 核心功能（✅ 已完成）

1. **模型区域识别算法** (src/utils/hitTest.ts)
   - PixiJS 命中检测（HitTest / Bounds / Alpha）
   - Live2D HitArea 检测
   - Canvas Alpha 像素检测（备用方案）
   - 防抖优化机制

2. **智能鼠标穿透** (src/utils/mousePassthrough.ts)
   - 鼠标在模型区域：拦截事件（可点击、拖拽）
   - 鼠标在透明区域：穿透到桌面
   - 状态变化时通过 IPC 通知主进程

3. **窗口拖拽** (src/components/Live2DRenderer.vue:178-279)
   - 在模型区域内长按拖拽移动窗口
   - 区分点击和拖拽（5像素阈值）
   - 窗口位置自动保存

4. **设置界面** (src/components/SettingsNew.vue)
   - 基础设置：窗口置顶、透明
   - 模型设置/管理：显示、交互、穿透、导入/删除/切换
   - WebSocket 配置
   - 系统设置：开机自启（待实现）

## IPC API

### 主进程 → 渲染进程

```typescript
window.electronAPI = {
  // 设置管理
  getSettings: () => Promise<Settings>
  setSettings: (settings: Settings) => Promise<{success: boolean}>

  // 鼠标穿透控制
  setIgnoreMouseEvents: (ignore: boolean, options?: {forward: boolean}) => Promise<void>

  // 窗口位置控制
  getWindowPosition: () => Promise<{x: number, y: number}>
  setWindowPosition: (x: number, y: number) => Promise<{success: boolean}>

  // 窗口控制
  showSettings: () => Promise<void>
  hideWindow: () => Promise<void>
}
```

## 配置文件

配置存储在:
- Windows: `%APPDATA%\astrbot-live2d-desktop\config.json`
- macOS: `~/Library/Application Support/astrbot-live2d-desktop/config.json`
- Linux: `~/.config/astrbot-live2d-desktop/config.json`

默认配置:
```json
{
  "alwaysOnTop": true,
  "transparent": true,
  "modelScale": 1.0,
  "passthroughEnabled": true,
  "alphaThreshold": 10,
  "debounceMs": 50,
  "eyeTracking": true,
  "clickFeedback": true,
  "dragEnabled": true
}
```

## 已知问题

1. **BLEND_MODES 补丁**
   - pixi-live2d-display 依赖 `PIXI.BLEND_MODES.SRC_TO_X`，项目启动时会自动补齐（见 `src/main.ts`）

2. **Electron 安装**
   - 某些环境可能需要重新安装 Electron
   - 解决：`rm -rf node_modules/.pnpm/electron@* && pnpm install electron`

3. **托盘图标**
   - 需要提供 `public/icon.png` 文件
   - 如果文件不存在，会跳过托盘创建

## 下一步计划（Phase 3）

- [ ] 模型管理功能（导入、切换多个模型）
- [ ] 性能优化（降低 CPU/内存占用）
- [ ] 多平台测试（Windows/macOS/Linux）
- [ ] 打包配置（electron-builder）
- [ ] 添加托盘图标
- [ ] 完善错误处理
- [ ] 添加日志系统

## 参考文档

- [快速开始](./QUICK_START.md)
- [API / WebSocket 协议](./docs/API.md)
- [模型导入说明](./docs/MODEL_IMPORT.md)
- [贡献指南](./docs/CONTRIBUTING.md)
- [AstrBot 平台适配器](https://github.com/lxfight/astrbot-live2d-adapter)

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
