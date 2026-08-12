# 更新日志 (Changelog)

本文件记录 AstrBot Live2D Desktop 的重要版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增

- 智能行为系统：空闲随机动作、时间感知问候、健康提醒（久坐/喝水/护眼）、失焦省电，配置位于设置 → 高级 → 行为 → 智能行为
- 模型收藏与标签系统：收藏模型、自定义标签、快速筛选（`electron/database` schema v3）
- 模型预设配置系统：保存位置/缩放/行为等组合为预设，从模型库一键应用
- 模型批量导入：多选文件夹逐个导入，失败汇总报告
- 模型最近使用历史：最近 10 个，点击快速加载，可移除
- 图片拖拽输入：图片拖到桌面窗口直接进入发送流程，非图片文件提示
- 动作/表情使用排行图表：历史统计页新增 Top 10 横向柱状图
- 核心纯函数性能基准（`pnpm bench`），用于及早发现性能退化
- MessageBatcher 批处理器接入 WebSocket 触摸事件流，减少高频消息处理压力
- node:sqlite 数据库门面，移除 better-sqlite3 原生依赖，全平台无需编译工具链

### 变更

- 日志级别持久化：写入 `user_config`，重启后保持（`electron/ipc/log.ts`）
- 消息历史存储由 better-sqlite3 迁移至 Node 内置 `node:sqlite`
- Windows 全屏检测改用 koffi WindowsWatcher，移除 node-window-manager 依赖
- 测试覆盖：新增 MessageBatcher、PerformanceMonitor、themePalette 等测试，`src/utils` 覆盖率 44.7% → 64.5%

### 修复

- 鼠标穿透禁用时桌面保持可点击
- MessageBatcher 同步抛错的处理器不再卡住后续批次
- SmartIdleBehavior 眨眼测试的随机性缺陷（间隔 [1,2]s 推进 1.5s 约 50% 概率失败）

## [1.6.0] - 2026-06-19

### 变更

- 主窗口加载速度优化：设置页迁移不阻塞 ready、主进程窗口创建提前
- Cubism Core 加载竞态修复：缺失时不再永久挂起，`model:load` 消息可靠化
- pending 模型加载成功后跳过自动加载，避免重复加载

### 修复

- 便携版首次迁移竞态
- 各种启动期竞态问题

## [1.5.2] - 2026-06-16

### 修复

- CI：Windows x64 使用 selective rebuild 绕过 node-gyp 不识别新 VS 的问题

## [1.5.0] - 2026-06-12

### 变更

- 发布文档与别名协议准备

## [1.4.0] - 2026-06-10

### 变更

- 文档视觉升级：README 渐变 hero 横幅（支持浅色/深色 SVG）

## [1.3.1] - 2026-06-10

### 修复

- GitHub Release 变更日志生成

## [1.3.0] - 2026-06-09

### 新增

- BridgeConnectionController 单元测试
- 协议日志脱敏模块（独立提取）
- 包含 src 内测试文件到 vitest 范围

### 变更

- 移除未使用的唤醒词监听实现
- ESLint 规则调整：警告不再阻塞提交
- CI 构建加速：缓存与并行 postinstall

## [1.2.0] - 2026-05-28

### 新增

- PRD v1.2.0 功能集：连接行为设置面板、配置导入导出、日志级别、主题色手动编辑等

### 修复

- 模型 store API 名称对齐（currentModel, setModelPosition）

## [1.1.0] - 2026-05-11

### 新增

- 首个稳定版本：Live2D 模型渲染、AstrBot WebSocket 通信、桌面行为（托盘/置顶/穿透）
- Cubism 3/4 模型支持（.model3.json），模型发现三模式（标准声明/vtube companion/目录扫描）
- 表演系统：动作/表情/音频/气泡消息

## [1.0.0-beta.4] - 2026-05

### 新增

- 首个公开 beta：基础桌面宠物体验
