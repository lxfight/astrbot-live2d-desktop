# 代码规范与运行时优化配置指南

## 已完成的改进

### 1. 代码规范自动化 ✅

#### ESLint + Prettier 配置
- **ESLint**: 使用 flat config 格式（eslint.config.mjs）
- **Prettier**: 统一代码格式化（.prettierrc.json）
- **Git Hooks**: 自动在提交前检查和格式化代码

#### 新增命令

```bash
# 代码检查
pnpm run lint

# 自动修复
pnpm run lint:fix

# 格式化所有文件
pnpm run format

# 检查格式（CI 用）
pnpm run format:check
```

#### Git Hooks (Husky + lint-staged)

提交时自动执行：
- TypeScript/Vue 文件: ESLint 修复 + Prettier 格式化
- JavaScript 文件: ESLint 修复 + Prettier 格式化
- JSON/CSS/Markdown: Prettier 格式化

#### 配置要点

**ESLint 规则**:
- TypeScript 严格模式
- Vue 3 Composition API 优先
- 禁用 `any` 类型（警告级别）
- 未使用变量检查（下划线前缀例外）

**Prettier 规则**:
- 无分号
- 单引号
- 无尾逗号
- 行宽 100 字符

### 2. 构建优化 ✅

#### Vite 构建配置优化

**代码分割策略**:
```typescript
// 智能代码分割
- cubism-framework: Live2D 框架独立打包
- naive-ui: UI 组件库独立打包
- echarts: 图表库独立打包
- vue-vendor: Vue 核心（vue, pinia, @vue/*）
- utils: 工具库（axios, date-fns, uuid）
- vendor: 其他 node_modules
```

**构建性能优化**:
- 禁用 gzip 大小报告，加快构建速度
- 优化资源文件命名（带 hash）
- 目标设置为 esnext，减少转译

**预期效果**:
- 首次加载更快（按需加载）
- 更好的缓存策略（分块独立）
- 减少重复打包

### 3. 运行时优化 ✅

#### 新增工具模块

##### ModelResourceCache.ts
**Live2D 模型资源缓存**:
- 缓存纹理、动作、表情等二进制资源
- 自动清理过期缓存（默认 30 分钟）
- 内存限制管理（默认 100MB）
- 资源预加载支持
- 缓存命中率统计

**使用示例**:
```typescript
import { getGlobalModelResourceCache } from '@/utils/cubism/ModelResourceCache'

const cache = getGlobalModelResourceCache()

// 预加载资源
await cache.preload([
  '/models/texture1.png',
  '/models/texture2.png'
])

// 获取缓存
const data = cache.get('/models/texture1.png')

// 查看统计
const stats = cache.getStats()
console.log(`缓存命中率: ${(stats.hitRate * 100).toFixed(2)}%`)
```

##### MessageBatcher.ts
**WebSocket 消息批处理**:
- 合并短时间内的多条消息
- 减少处理函数调用次数
- 优化高频消息场景（如鼠标跟踪）
- 提供节流、防抖工具函数

**使用示例**:
```typescript
import { MessageBatcher, throttle, debounce, rafThrottle } from '@/utils/MessageBatcher'

// 消息批处理
const batcher = new MessageBatcher({
  maxBatchSize: 10,
  maxWaitTime: 16, // ~60fps
  processor: (messages) => {
    // 批量处理消息
    console.log(`处理 ${messages.length} 条消息`)
  }
})

batcher.add(message1)
batcher.add(message2)
// 自动批量处理

// 节流（高频事件）
const throttledUpdate = throttle((data) => {
  updateModel(data)
}, 16)

// 防抖（输入事件）
const debouncedSearch = debounce((query) => {
  search(query)
}, 300)

// RAF 节流（动画更新）
const rafUpdate = rafThrottle((position) => {
  updatePosition(position)
})
```

##### PerformanceMonitor.ts
**性能监控工具**:
- FPS 监控
- 内存使用监控
- 性能指标记录
- 性能标记工具

**使用示例**:
```typescript
import { getGlobalPerformanceMonitor, PerformanceMark } from '@/utils/PerformanceMonitor'

// 全局监控
const monitor = getGlobalPerformanceMonitor()
monitor.start()

monitor.subscribe((snapshot) => {
  console.log(`FPS: ${snapshot.fps.toFixed(2)}`)
  console.log(`内存: ${(snapshot.memory.used / 1024 / 1024).toFixed(2)}MB`)
})

// 性能标记
const mark = new PerformanceMark()
mark.start('loadModel')
// ... 执行操作
mark.endAndLog('loadModel', 100) // 超过 100ms 会警告
```

## 下一步集成建议

### 1. 在 Live2D 组件中集成资源缓存

```typescript
// src/components/Live2D/Canvas.vue 或 CubismModel.ts
import { getGlobalModelResourceCache } from '@/utils/cubism/ModelResourceCache'

// 加载纹理前先检查缓存
const cache = getGlobalModelResourceCache()
const cachedData = cache.get(textureUrl)

if (cachedData) {
  // 使用缓存数据
} else {
  // 加载并缓存
  const data = await loadTexture(textureUrl)
  cache.set(textureUrl, data)
}
```

### 2. 在 WebSocket 通信中使用批处理

```typescript
// electron/bridge/BridgeConnectionController.ts
import { MessageBatcher } from '@/utils/MessageBatcher'

const performBatcher = new MessageBatcher({
  maxBatchSize: 5,
  maxWaitTime: 16,
  processor: (messages) => {
    // 批量处理表演消息
  }
})

// 在消息接收处使用
onMessage((msg) => {
  if (msg.type === 'perform.show') {
    performBatcher.add(msg)
  }
})
```

### 3. 在主窗口中启用性能监控

```typescript
// src/windows/Main.vue
import { getGlobalPerformanceMonitor } from '@/utils/PerformanceMonitor'

const monitor = getGlobalPerformanceMonitor()
monitor.start()

// 在开发模式下显示性能信息
if (import.meta.env.DEV) {
  monitor.subscribe((snapshot) => {
    if (snapshot.fps < 30) {
      console.warn('低帧率警告:', snapshot.fps)
    }
  })
}
```

## 使用指南

### 首次使用

```bash
# 1. 安装依赖（已完成）
# pnpm install

# 2. 运行格式化（可选，会自动格式化所有文件）
pnpm run format

# 3. 检查是否有问题
pnpm run lint

# 4. 自动修复问题
pnpm run lint:fix
```

### 日常开发

```bash
# Git 提交时会自动触发检查和格式化
git add .
git commit -m "feat: add new feature"

# 如果需要跳过检查（不推荐）
git commit --no-verify -m "..."
```

### VSCode 配置

建议安装以下扩展：
- ESLint
- Prettier - Code formatter
- Vue - Official

配置已更新到 `.vscode/settings.json`，保存时自动格式化和修复。

## 性能优化效果预期

### 构建优化
- ✅ 减少首次加载时间（代码分割）
- ✅ 提升缓存利用率（独立分块）
- ✅ 加快构建速度（禁用不必要的报告）

### 运行时优化
- ✅ 减少重复资源加载（资源缓存）
- ✅ 降低高频消息处理开销（批处理）
- ✅ 实时性能监控（问题早发现）

## 注意事项

1. **ESLint 警告**: 初次运行可能会有一些警告，可以逐步修复
2. **Git Hooks**: 如遇到提交失败，检查代码是否符合规范
3. **缓存管理**: 注意监控内存使用，必要时调整缓存大小
4. **性能监控**: 生产环境建议关闭详细日志

## 配置文件清单

- ✅ `eslint.config.mjs` - ESLint 配置
- ✅ `.prettierrc.json` - Prettier 配置
- ✅ `.prettierignore` - Prettier 忽略文件
- ✅ `.husky/pre-commit` - Git pre-commit hook
- ✅ `package.json` - 添加 lint-staged 配置
- ✅ `vite.config.ts` - 优化构建配置
- ✅ `.vscode/settings.json` - VSCode 编辑器配置

## 新增文件清单

- ✅ `src/utils/cubism/ModelResourceCache.ts` - 模型资源缓存
- ✅ `src/utils/MessageBatcher.ts` - 消息批处理工具
- ✅ `src/utils/PerformanceMonitor.ts` - 性能监控工具
