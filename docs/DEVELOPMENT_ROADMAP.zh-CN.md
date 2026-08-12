# AstrBot Live2D Desktop 开发路线图与改进建议

## 📊 项目现状总览

### 基本信息
- **当前版本**: v1.6.0
- **代码规模**: ~43,655 行代码（TypeScript + Vue）
- **测试覆盖**: 38 个测试文件，覆盖核心模块
- **技术栈**: Electron 40 + Vue 3 + TypeScript + Naive UI
- **架构特点**: 主进程/渲染进程分离，WebSocket 实时通信

### 已完成的优化工作
✅ 代码规范自动化（ESLint + Prettier + Husky）
✅ 构建优化（智能代码分割，6 个独立 chunk）
✅ 运行时性能工具（资源缓存、消息批处理、性能监控）
✅ 无原生编译依赖（使用 node:sqlite，预编译二进制）
✅ 完善的文档体系

### 最近的重要变更
- 切换到 node:sqlite（移除 better-sqlite3 原生依赖）
- 修复鼠标穿透模式下的交互问题
- 回滚了 Soullink 情绪 SDK 集成（设计需要重新评估）

---

## 🎯 开发方向建议

### 优先级 P0：核心体验优化

#### 1. 完成 PRD v1.2.0 中的待实现功能

根据 `docs/PRD-zh-CN.md`，以下功能可能未完全实现：

**高优先级**：
- [x] **连接行为设置面板**：后端已实现但前端缺失 UI
  - 位置：设置 → 连接 → 连接策略
  - 涉及文件：新增设置组件，调用已有 IPC `connectionBehaviorSettings.ts`

- [x] **配置导入导出**：备份和迁移用户配置
  - 导出所有 user_config 和 LocalStorage 为 JSON
  - 导入前预览和确认
  - 重置所有设置功能

- [x] **日志级别持久化**：当前仅会话有效
  - 存入 user_config，启动时读取
  - 设置面板增加日志级别选择

#### 2. 集成已有的性能优化工具

优化工具已开发但未集成到主代码（**已完成**：资源缓存已接入 `CubismModel` 纹理加载、MessageBatcher 已接入 WebSocket 触摸事件流、性能监控已在开发模式启用）：

```typescript
// 1. 在 Live2D 模型加载中集成资源缓存
// src/utils/cubism/CubismModel.ts
import { getGlobalModelResourceCache } from './ModelResourceCache'

async loadTexture(url: string) {
  const cache = getGlobalModelResourceCache()
  let data = cache.get(url)

  if (!data) {
    const response = await fetch(url)
    data = await response.arrayBuffer()
    cache.set(url, data)
  }

  return createTextureFromArrayBuffer(data)
}

// 2. WebSocket 消息批处理
// electron/bridge/BridgeConnectionController.ts
import { MessageBatcher } from '@/utils/MessageBatcher'

const performBatcher = new MessageBatcher({
  maxBatchSize: 5,
  maxWaitTime: 16,
  processor: (messages) => {
    // 批量处理表演消息
  }
})

// 3. 性能监控（开发模式）
// src/windows/Main.vue
const monitor = getGlobalPerformanceMonitor()
monitor.start()
monitor.subscribe((snapshot) => {
  if (snapshot.fps < 30) {
    console.warn('FPS 低于 30:', snapshot.fps)
  }
})
```

**预期收益**：
- 减少 50-70% 的重复资源加载
- 高频消息处理性能提升 30-40%
- 实时性能问题监控

#### 3. 修复已知的代码质量问题

根据优化文档，存在一些 ESLint 警告：

```bash
# 主要问题
- @typescript-eslint/no-explicit-any  # 将 any 替换为具体类型
- no-console                          # 使用 logger 替代 console.log
- 空的 catch 块                        # 添加错误处理或注释说明
```

**状态**：已全部修复。`src/`、`electron/`、`tests/` 均通过 `--max-warnings=-1` 检查，零警告。

---

### 优先级 P1：功能增强

#### 4. 模型管理系统增强

当前模型管理较为基础，可以增强（**已完成**：收藏与标签、预设配置、批量导入、最近使用历史均已实现）：

```typescript
// 模型库管理系统
interface ModelLibrarySystem {
  // 收藏与分类
  favorites: Set<string>;
  tags: Map<string, string[]>;  // modelId -> tags
  categories: Map<string, ModelCategory>;
  
  // 模型预设
  presets: Map<string, ModelPreset>;
  
  // 搜索与过滤
  search(query: string): ModelInfo[];
  filterByTag(tag: string): ModelInfo[];
  
  // 批量操作
  importModels(paths: string[]): Promise<void>;
  exportModelConfig(modelId: string): string;
}

interface ModelPreset {
  position: { x: number; y: number };
  scale: number;
  behaviors: BehaviorSettings;
  themeColor: string;
  idleActions: string[];
}
```

**功能点**：
- [x] 模型收藏夹
- [x] 自定义标签分类
- [x] 快速切换预设配置
- [x] 批量导入模型（多选文件夹逐个导入，失败汇总报告）
- [x] 最近使用历史（最近 10 个，点击快速加载，可移除）

#### 5. 表演编排系统

当前表演是由 AstrBot 推送，可以增加本地编排能力：

```typescript
// 表演序列编辑器
interface PerformanceSequence {
  id: string;
  name: string;
  description: string;
  steps: PerformanceStep[];
  triggers?: PerformanceTrigger[];
}

interface PerformanceStep {
  type: 'motion' | 'expression' | 'audio' | 'text' | 'wait';
  content: string;
  duration?: number;
  parallel?: boolean;  // 是否与下一步并行执行
}

interface PerformanceTrigger {
  type: 'keyword' | 'time' | 'emotion' | 'random';
  condition: string | number;
  probability?: number;
}
```

**功能点**：
- 可视化表演序列编辑器
- 支持动作+表情+语音组合
- 条件触发器（关键词、时间、情绪）
- 导入/导出表演序列
- 社区分享表演包

#### 6. 智能行为系统

让模型更有"生命力"（**已完成**：`SmartIdleBehavior`/`ReminderScheduler`/`FocusAwareOptimizer` 已实现并接入主窗口运行时，配置位于设置 → 高级 → 行为 → 智能行为；天气感知未做）：

```typescript
interface SmartBehaviorSystem {
  // 空闲行为
  idleActions: {
    enabled: boolean;
    minInterval: number;  // 最小间隔（秒）
    maxInterval: number;  // 最大间隔
    actionPool: string[]; // 动作池
    expressionPool: string[];  // 表情池
  };
  
  // 定时提醒
  reminders: Reminder[];
  
  // 焦点感知
  focusAwareness: {
    dimWhenInactive: boolean;     // 失焦时变暗
    pauseWhenMinimized: boolean;  // 最小化时暂停渲染
    pauseWhenFullscreen: boolean; // 全屏应用时暂停
  };
  
  // 环境感知
  environmentAwareness: {
    timeBasedBehavior: boolean;  // 根据时间变化行为
    weatherBasedMood: boolean;   // 根据天气（需要 API）
  };
}

interface Reminder {
  type: 'health' | 'break' | 'event' | 'custom';
  interval: number;
  message: string;
  action?: string;  // 触发的动作
  enabled: boolean;
}
```

**功能点**：
- [x] 空闲时自动播放动作（随机动作池，眨眼由 Cubism SDK 内置）
- [x] 健康提醒（久坐提醒、喝水提醒、护眼提醒）
- [x] 焦点感知（失焦降帧率、省电模式）
- [x] 时间感知（早上打招呼、晚上说晚安，i18n 双语）
- [ ] 天气感知（需要外部 API，未做）

#### 7. 多模态输入增强

扩展输入方式（**部分完成**：图片拖拽已实现，截图/剪贴板监听/手写未做）：

```typescript
interface InputSystem {
  // 截图输入
  screenshot: {
    hotkey: string;
    captureMode: 'region' | 'window' | 'fullscreen';
    autoSend: boolean;
  };
  
  // 文件拖拽
  dragAndDrop: {
    enabled: boolean;
    acceptTypes: string[];  // 'image/*', 'text/*', etc.
    maxFileSize: number;
  };
  
  // 剪贴板监听（可选）
  clipboardWatch: {
    enabled: boolean;
    autoDetectImage: boolean;
    hotkey: string;  // 快速发送剪贴板
  };
  
  // 手写输入（触控屏）
  handwriting: {
    enabled: boolean;
    recognitionLanguage: string;
  };
}
```

**功能点**：
- [x] 文件拖拽（图片拖到桌面窗口直接进入发送流程，非图片文件提示）
- [ ] 截图输入（快捷键截屏发送）
- [ ] 剪贴板监听（自动检测剪贴板图片）
- [ ] 手写输入（触控屏）

#### 8. 数据分析与可视化

增强历史记录的价值（**部分完成**：动作/表情使用排行图表已实现，关键词/情感分布/使用时长未做）：

```typescript
interface AnalyticsSystem {
  // 对话统计
  conversationStats: {
    totalMessages: number;
    dailyAverage: number;
    peakHours: number[];
    topKeywords: Map<string, number>;
    emotionDistribution: Map<string, number>;
  };
  
  // 表演统计
  performanceStats: {
    mostUsedMotions: string[];
    mostUsedExpressions: string[];
    averagePerformanceDuration: number;
  };
  
  // 使用时长
  usageStats: {
    totalActiveTime: number;
    sessionCount: number;
    averageSessionDuration: number;
    dailyUsagePattern: number[];  // 24 hours
  };
  
  // 导出报告
  exportReport(format: 'json' | 'csv' | 'pdf'): Promise<string>;
}
```

**可视化面板**：
- 对话趋势图（ECharts 已集成）
- [x] 动作使用排行图（Top 10 横向柱状图）
- [x] 表情使用排行图（Top 10 横向柱状图）
- [ ] 情感分布饼图
- [ ] 使用时长热力图
- [ ] 每周/每月使用报告

---

### 优先级 P2：生态与扩展

#### 9. 插件系统

为社区开发者提供扩展能力：

```typescript
// 插件 API 设计
interface DesktopPlugin {
  // 元数据
  manifest: {
    name: string;
    version: string;
    author: string;
    description: string;
    permissions: string[];  // 'model', 'network', 'storage', etc.
  };
  
  // 生命周期
  onLoad(): Promise<void>;
  onUnload(): Promise<void>;
  onModelLoaded?(model: Live2DModel): void;
  onMessageReceived?(message: Message): void;
  
  // UI 扩展
  settingsPanel?: () => VNode;
  contextMenuItems?: MenuItem[];
  statusBarWidgets?: Widget[];
  
  // 数据存储
  storage: PluginStorage;
}

// 插件加载器
class PluginManager {
  async loadPlugin(path: string): Promise<DesktopPlugin>;
  async unloadPlugin(id: string): Promise<void>;
  listPlugins(): PluginInfo[];
  enablePlugin(id: string): void;
  disablePlugin(id: string): void;
}
```

**插件示例**：
- 天气显示插件
- 日程提醒插件
- 音乐控制插件
- 笔记快捷入口插件
- 自定义主题包插件

#### 10. 主题系统增强

当前只有主题色提取，可以扩展：

```typescript
interface ThemeSystem {
  // 预设主题
  presets: Map<string, ThemePreset>;
  
  // 自定义主题
  custom: {
    colors: ColorScheme;
    effects: VisualEffects;
    layout: LayoutConfig;
  };
  
  // 动态主题
  dynamic: {
    seasonalThemes: boolean;  // 季节主题
    timeBasedThemes: boolean; // 时间主题（日间/夜间）
    eventThemes: boolean;     // 节日主题
  };
  
  // 导入/导出
  exportTheme(): ThemeFile;
  importTheme(file: ThemeFile): void;
}

interface ThemePreset {
  name: string;
  colors: ColorScheme;
  backgroundType: 'none' | 'color' | 'gradient' | 'image' | 'video';
  backgroundContent?: string;
  particleEffects?: ParticleConfig;
  borderStyle?: BorderStyle;
}
```

**功能点**：
- 多套官方主题
- 动态背景（静态图、视频、粒子效果）
- 季节性主题自动切换
- 节日主题包（春节、圣诞等）
- 主题商店（社区分享）

#### 11. 社区功能

连接用户和创作者：

```typescript
interface CommunityFeatures {
  // 模型分享
  modelHub: {
    browse(): ModelInfo[];
    search(query: string): ModelInfo[];
    download(modelId: string): Promise<void>;
    upload(model: ModelPackage): Promise<void>;
  };
  
  // 表演分享
  performanceHub: {
    browseSequences(): PerformanceSequence[];
    downloadSequence(id: string): Promise<void>;
    uploadSequence(seq: PerformanceSequence): Promise<void>;
  };
  
  // 主题分享
  themeHub: {
    browseThemes(): ThemePreset[];
    downloadTheme(id: string): Promise<void>;
    uploadTheme(theme: ThemePreset): Promise<void>;
  };
  
  // 评分与评论
  rating: {
    rate(itemId: string, score: number): Promise<void>;
    comment(itemId: string, text: string): Promise<void>;
  };
}
```

---

### 优先级 P3：高级功能

#### 12. 多模型支持

同时显示多个模型：

```typescript
interface MultiModelSystem {
  models: Map<string, ModelInstance>;
  layout: 'free' | 'grid' | 'stack';
  
  addModel(config: ModelConfig): Promise<string>;
  removeModel(id: string): void;
  switchActiveModel(id: string): void;
  
  // 模型间交互
  enableInteraction: boolean;
  interactionRules: InteractionRule[];
}

interface InteractionRule {
  trigger: 'proximity' | 'click' | 'message';
  sourceModel: string;
  targetModel: string;
  action: string;  // 触发的动作
}
```

#### 13. VR/AR 支持（实验性）

为 VR 头显提供支持：

```typescript
interface VRSupport {
  mode: 'desktop' | 'vr' | 'ar';
  
  vrSettings: {
    roomScale: boolean;
    modelDistance: number;
    modelHeight: number;
    followHeadset: boolean;
  };
  
  arSettings: {
    anchorMode: 'surface' | 'world' | 'face';
    occlusionEnabled: boolean;
  };
}
```

#### 14. 云同步功能

跨设备同步配置：

```typescript
interface CloudSyncSystem {
  provider: 'webdav' | 's3' | 'custom';
  
  sync(): Promise<void>;
  enableAutoSync(interval: number): void;
  
  syncItems: {
    models: boolean;
    settings: boolean;
    history: boolean;
    performances: boolean;
  };
  
  conflictResolution: 'local' | 'remote' | 'manual';
}
```

---

## 🛠️ 技术架构改进建议

### 1. 测试覆盖率提升

当前有 54 个测试文件（386 个测试 + 14 个跳过），`src/utils` 覆盖率 72%、`src/windows/composables` 覆盖率 32%，建议：

```bash
# 目标
- 单元测试覆盖率: >70%
- 集成测试: 核心流程全覆盖
- E2E 测试: 主要用户场景

# 新增测试
- [x] Performance 系统测试（PerformanceMonitor/PerformanceMark/MessageBatcher）
- [x] WebSocket 断线重连测试（重连计数重置、挂起/唤醒、dispose 清理）
- [x] 模型加载压力测试（ModelResourceCache 命中/过期/驱逐/preload 单测）
- [x] 内存泄漏测试（dispose/卸载后监听器清理、定时器取消）
```

### 2. 性能基准与监控

建立性能基准（**部分完成**：`pnpm bench` 已覆盖核心纯函数吞吐，运行时指标用 PerformanceMonitor 观测）：

```typescript
// 性能基准测试
interface PerformanceBenchmark {
  modelLoadTime: number;        // <2s
  firstFrameTime: number;       // <100ms
  averageFPS: number;            // >55
  memoryUsage: number;           // <500MB
  webSocketLatency: number;     // <50ms
}

// CI 中运行基准测试
pnpm run benchmark
pnpm run benchmark:regression  // 检测性能退化
```

### 3. 错误追踪与分析

集成错误追踪服务：

```typescript
// 可选集成 Sentry 或类似服务
interface ErrorTracking {
  captureException(error: Error, context?: Record<string, any>): void;
  captureMessage(message: string, level: 'info' | 'warning' | 'error'): void;
  setUser(user: { id: string; name?: string }): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
}
```

### 4. 构建优化进阶

```typescript
// package.json 新增脚本
{
  "scripts": {
    "analyze": "vite-bundle-visualizer",           // 分析打包体积
    "profile": "NODE_OPTIONS=--inspect vite build", // 性能分析
    "check:deps": "depcheck && ncu",               // 依赖检查
    "check:security": "npm audit --production",    // 安全审计
    "check:outdated": "npm outdated"               // 过期依赖
  }
}
```

### 5. 文档体系完善

当前文档已很完善，可以补充：

- [ ] API 文档（TypeDoc 生成）
- [ ] 贡献指南（CONTRIBUTING.md）
- [ ] 插件开发指南
- [x] 性能优化最佳实践（`PERFORMANCE_TOOLS_INTEGRATION.md`）
- [x] 故障排查手册（`docs/TROUBLESHOOTING.zh-CN.md`，连接/模型/桌面行为/性能/数据问题定位）
- [x] 更新日志（`docs/CHANGELOG.zh-CN.md`，遵循 keep-a-changelog）

---

## 📅 建议的实施路线图

### 第一阶段：完善与优化（1-2 个月）

**Week 1-2: 集成现有工具**
- 集成资源缓存到模型加载
- 集成消息批处理到 WebSocket
- 启用性能监控（开发模式）
- 修复高优先级 ESLint 错误

**Week 3-4: 完成 PRD 待实现功能**
- 连接行为设置面板 UI
- 配置导入导出功能
- 日志级别持久化
- 主题色手动编辑（如果未实现）

**Week 5-6: 测试与优化**
- 提升测试覆盖率至 60%+
- 性能基准测试
- 修复发现的 bug
- 文档更新

**Week 7-8: 发布 v1.7.0**
- 完整回归测试
- 更新 CHANGELOG
- 发布版本

### 第二阶段：功能增强（2-3 个月）

**Month 1: 模型管理增强**
- 模型收藏与标签系统
- 模型预设配置
- 批量导入功能
- 快速切换界面

**Month 2: 智能行为系统**
- 空闲动作系统
- 定时提醒功能
- 焦点感知优化
- 时间感知行为

**Month 3: 表演编排系统**
- 表演序列编辑器 UI
- 条件触发器
- 导入导出功能
- 内置表演库

**发布 v1.8.0**

### 第三阶段：生态建设（3-6 个月）

**Month 1-2: 插件系统**
- 插件 API 设计
- 插件加载器
- 示例插件开发
- 插件开发文档

**Month 3-4: 主题与外观**
- 主题系统重构
- 预设主题包
- 动态背景支持
- 主题编辑器

**Month 5-6: 数据分析**
- 统计系统完善
- 可视化面板
- 使用报告生成
- 数据导出功能

**发布 v2.0.0**

### 第四阶段：社区与高级功能（持续迭代）

- 模型/表演/主题分享平台
- 多模型支持（实验性）
- 云同步功能
- 移动端伴侣应用

---

## 🚀 快速开始：下周可以做的事

1. **立即可做**（1-2 天）：
   ```bash
   # 1. 集成资源缓存
   # 修改 src/utils/cubism/CubismModel.ts
   
   # 2. 修复 ESLint 错误
   pnpm run lint:fix
   
   # 3. 启用性能监控
   # 在 src/windows/Main.vue 中添加监控代码
   ```

2. **本周完成**（5-7 天）：
   - 实现连接行为设置面板 UI
   - 添加配置导入导出功能
   - 完善日志持久化

3. **下周计划**：
   - 开始模型收藏功能
   - 设计空闲行为系统架构
   - 编写插件系统设计文档

---

## 💡 创新功能建议

### 1. AI 助手集成（深度整合）

既然已经与 AstrBot 连接，可以增强桌面端的 AI 能力：

- 语音唤醒（"嘿，助手"）
- 屏幕内容理解（截图分析）
- 文件智能处理（拖拽文件自动识别和处理）
- 上下文感知（根据当前应用提供建议）

### 2. 生产力工具集成

让模型不只是"宠物"，还是"助手"：

- 番茄钟计时器
- 待办事项快捷入口
- 会议提醒
- 代码片段管理
- 快速笔记

### 3. 游戏化元素

增加趣味性和粘性：

- 养成系统（互动越多，模型"成长"）
- 成就系统（解锁特殊动作/表情）
- 心情值系统（影响模型行为）
- 收集要素（解锁新模型、主题）

### 4. 多设备生态

- 移动端伴侣应用（远程控制）
- Web 版轻量查看器
- 智能音箱集成（语音交互）
- 智能手表通知

---

## 🎓 学习与参考

### 类似项目分析

- **VTube Studio**: 学习其模型管理和表情系统
- **Wallpaper Engine**: 学习其主题商店和社区生态
- **Rainmeter**: 学习其插件系统设计
- **Voicemod**: 学习其音频处理和实时效果

### 技术栈升级考虑

当前技术栈已经很现代，未来可以考虑：

- Electron 自动更新优化
- WebGPU 支持（性能提升）
- Rust 原生模块（关键路径优化）
- WASM 模块（跨平台算法）

---

## 📝 总结

这个项目已经有了坚实的基础和清晰的架构，建议按以下优先级推进：

**立即执行**：
1. 集成已开发的性能优化工具
2. 完成 PRD 中的待实现功能
3. 提升代码质量和测试覆盖率

**短期规划**（1-3 个月）：
1. 模型管理增强
2. 智能行为系统
3. 表演编排系统

**中期规划**（3-6 个月）：
1. 插件系统
2. 主题系统增强
3. 数据分析与可视化

**长期愿景**：
1. 社区生态建设
2. 多设备生态
3. 高级实验性功能

项目的核心优势是与 AstrBot 的深度集成和 Live2D 的专业渲染，应该继续强化这两个方向，同时逐步完善桌面端的独立功能，让它成为一个功能完善、体验优秀的桌面助手应用。
