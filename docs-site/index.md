---
layout: home

hero:
  name: AstrBot Live2D Desktop
  text: 桌面端与桥接协议文档
  tagline: 面向 AstrBot Live2D 桌面端、适配器、模型别名、媒体资源与 L2D 桥接协议的实用参考。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 协议参考
      link: /protocol/overview

features:
  - title: 桌面端
    details: 基于 Electron + Vue，负责模型渲染、气泡、媒体播放、截图、录制和桌面感知行为。
  - title: AstrBot 适配器
    details: 通过 WebSocket 将 AstrBot 消息链与规划器输出转换为 perform.show 序列。
  - title: 别名协议
    details: v2 state.model 上报可读的动作与表情名称，让 LLM 规划器安全触发模型能力。
---

## 当前版本

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| 桌面端 | 1.5.0 | 新增 v2 alias model payload 与模型别名编辑。 |
| 桥接协议 | 1.0.0 + v2 别名扩展 | v1 包仍兼容；v2 扩展 `state.model` 与 `perform.show`。 |
| AstrBot 适配器 | `9689fd3` 之后的 master | 完整使用 v2 alias payload 时需要配套更新。 |

## 文档地图

- [快速开始](./guide/getting-started.md)：安装、连接、导入模型并验证桥接链路。
- [使用教程](./guide/usage.md)：桌面端日常使用、录音、历史、数据维护与常见问题。
- [适配器部署](./adapter/deployment.md)：AstrBot 插件安装、云服务器部署、安全基线与常用命令。
- [Cubism Runtime](./guide/cubism-runtime.md)：官方 SDK 接入、模型发现、profile 与表情能力边界。
- [架构](./guide/architecture.md)：桌面端、适配器、AstrBot 与模型运行时如何协作。
- [协议总览](./protocol/overview.md)：包结构、协议分层与兼容性规则。
- [连接与握手](./protocol/connection.md)：WebSocket、token、握手响应、心跳与资源配置。
- [输入事件](./protocol/input-events.md)：消息链、触摸、快捷键与桌面主动通知。
- [State Model v2](./protocol/state-model-v2.md)：桌面端上报的模型别名能力 payload。
- [Perform Show](./protocol/perform-show.md)：文本、媒体、动作、表情与别名执行。
- [资源协议](./protocol/resources.md)：`url` / `rid` / `inline` 引用和资源上传流程。
- [桌面感知 RPC](./protocol/desktop-rpc.md)：窗口列表、活跃窗口、截图和工具调用。
- [模型别名](./model-config/overview.md)：如何配置动作和表情名称。
- [平台支持](./release/platform-support.md)：Windows、macOS、Linux X11/Wayland 的能力矩阵。
