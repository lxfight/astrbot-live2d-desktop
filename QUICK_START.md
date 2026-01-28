# AstrBot Live2D Desktop - 快速开始

## 前置要求

- Node.js 18+ 和 pnpm
- 已启动并配置好 AstrBot（包含 Live2D 适配器插件）

## 模型与运行时资源（重要）

由于 Live2D 官方许可限制，本仓库不分发任何 Live2D 模型文件与 Cubism Core 运行时文件。

在本地开发前请先准备：

1) 默认模型（用于本地开发）
```powershell
cd astrbot-live2d-desktop
pwsh -File .\\scripts\\fetch-default-model.ps1
```

2) Cubism Core 运行时
- 从 Live2D 官方 Cubism SDK for Web 获取 `live2dcubismcore.min.js`
- 放到 `astrbot-live2d-desktop/public/lib/live2dcubismcore.min.js`

## 安装与运行

### 1. 安装依赖

```bash
cd astrbot-live2d-desktop
pnpm install
```

### 2. 配置连接

默认连接地址：`ws://localhost:8765/ws`

如果你的 AstrBot Live2D 适配器使用了不同的端口或路径，需要修改：

**方式 1：通过设置界面（推荐）**
- 启动应用后点击设置按钮
- 在"连接设置"中修改 WebSocket URL 和 Token

**方式 2：修改默认配置**
编辑 `src/App.desktop.vue` 第 54 行：
```typescript
const wsUrl = settings?.wsUrl || 'ws://localhost:8765/ws'
const token = settings?.token || ''  // 如果适配器配置了 auth_token，这里填写
```

### 3. 启动应用

#### 开发模式（浏览器）

```bash
pnpm dev
```

访问 http://localhost:1420

#### Electron 桌面应用

```bash
pnpm dev:electron
```

这会启动完整的桌面应用，支持透明窗口、鼠标穿透等特性。

### 4. 生产构建

```bash
pnpm build
```

构建产物在 `dist/` 目录。

## 使用说明

### 基本交互

1. **点击模型**：弹出输入框，输入文字并回车发送到 AstrBot
2. **等待回复**：AstrBot 处理后会通过 WebSocket 返回消息
3. **查看回复**：Live2D 角色显示文字气泡、播放动作和表情

### 消息流程

```
用户输入 → Live2D Desktop
    ↓ (WebSocket: input.message)
Live2D Adapter (AstrBot 插件)
    ↓ (转换为 AstrBotMessage)
AstrBot 核心 → LLM 处理
    ↓ (MessageChain)
Live2D Adapter (转换为表演序列)
    ↓ (WebSocket: perform.show)
Live2D Desktop → 显示回复
```

### 调试

打开浏览器/Electron 开发者工具查看：
- WebSocket 连接状态
- 协议消息收发
- 错误信息

## 协议说明

桌面端已支持 **Live2D-Bridge Protocol v1.0**：

### 发送到服务器

- `sys.handshake` - 握手认证
- `input.message` - 发送消息（支持文本、图片、语音）
- `input.touch` - 触摸交互
- `input.shortcut` - 快捷键

### 接收自服务器

- `sys.handshake_ack` - 握手确认
- `perform.show` - 表演指令（文字、动作、表情、TTS）
- `sys.error` - 错误响应

## 常见问题

### 1. 连接失败

检查：
- AstrBot 是否正在运行
- Live2D 适配器插件是否已启用
- WebSocket 地址和端口是否正确
- 防火墙是否阻止了连接

### 2. 发送消息无响应

检查：
- AstrBot 日志中是否收到消息事件
- LLM 配置是否正确
- 适配器是否正常转换消息

### 3. 模型不显示

检查：
- 是否已下载默认模型（`public/models/default/`）
- 是否已放置 `public/lib/live2dcubismcore.min.js`
- 浏览器控制台是否有模型加载错误

## 开发参考

- [协议文档](../docs/Live2D-Bridge-Protocol.md)
- [适配器开发文档](../docs/adapter-spec.md)
- [桌面端开发说明](./DEVELOPMENT.md)
