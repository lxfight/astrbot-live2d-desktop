# AstrBot Live2D Desktop

AstrBot 的 Live2D 桌面端 Web 应用，基于 Vue 3 + PixiJS 开发。

> **📊 重构状态**: 本项目正在进行深度优化重构（80% 完成）。查看 [重构状态](./docs/REFACTORING_STATUS.md) 了解详情。

## 技术栈

- Vue 3 - 渐进式 JavaScript 框架
- Pinia - Vue 状态管理
- PixiJS 7 - 2D WebGL 渲染引擎
- pixi-live2d-display - Live2D 模型渲染库
- WebSocket - 与服务端通信
- Vite - 构建工具

## 功能特性

- ✨ Live2D 模型渲染
- 💬 气泡对话框显示
- 🎭 动作和表情控制
- 🔊 语音播放与口型同步
- 🖱️ 鼠标交互（点击、触摸）
- 🔌 WebSocket 实时通信
- 📱 响应式设计

## 开发

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

访问：http://localhost:1420

### 生产构建

```bash
pnpm build
```

构建产物输出到 `dist/` 目录。

### 预览构建

```bash
pnpm preview
```

## 项目结构

```
src/
├── main.ts                 # 入口文件
├── App.vue                 # 根组件
├── style.css              # 全局样式
├── components/            # 组件目录
│   ├── Live2DRenderer.vue # Live2D 渲染组件
│   └── BubbleDialog.vue   # 气泡对话框组件
├── stores/                # Pinia 状态管理
│   └── connection.ts      # WebSocket 连接状态
└── utils/                 # 工具函数
    └── websocket.ts       # WebSocket 客户端
```

## 配置

在 `src/App.vue` 中修改 WebSocket 连接地址和 Token：

```typescript
connectionStore.connect('ws://localhost:8765/ws', 'your_token')
```

## 模型资源

Live2D 模型文件放置在 `public/models/` 目录下，格式为：

```
public/
└── models/
    ├── manifest.json
    └── default/
        ├── model3.json
        ├── textures/
        ├── motions/
        └── expressions/
```

## 协议

使用 L2D-Bridge Protocol v1.0，详见 [../docs/api.md](../docs/api.md)

## License

MIT
