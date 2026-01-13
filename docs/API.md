# API 文档

本文档详细说明 AstrBot Live2D 桌面端的核心 API 和接口。

## 目录

- [Electron IPC API](#electron-ipc-api)
- [服务层 API](#服务层-api)
- [状态管理 API](#状态管理-api)
- [工具函数 API](#工具函数-api)

---

## Electron IPC API

通过 `window.electronAPI` 访问主进程功能。

### 设置管理

#### `getSettings(): Promise<AppSettings>`

获取应用设置。

**返回值：**
```typescript
{
  wsUrl: string
  token: string
  alwaysOnTop: boolean
  transparent: boolean
  modelScale: number
  modelX: number
  modelY: number
  windowSize: { width: number; height: number }
  windowPosition: { x: number; y: number } | null
  mousePassthrough?: boolean
  alphaThreshold?: number
  hotkeys?: Record<string, string>
}
```

#### `setSettings(settings: Partial<AppSettings>): Promise<void>`

保存应用设置。

**参数：**
- `settings` - 要更新的设置（部分）

#### `onSettingsChanged(callback: (settings: AppSettings) => void): void`

监听设置变更事件。

**参数：**
- `callback` - 设置变更时的回调函数

#### `setAlwaysOnTop(value: boolean): Promise<void>`

设置窗口是否置顶。

#### `setWindowPosition(x: number, y: number): Promise<void>`

设置窗口位置。

#### `setWindowSize(width: number, height: number): Promise<void>`

设置窗口大小。

#### `setIgnoreMouseEvents(value: boolean): Promise<void>`

设置鼠标穿透。

---

### 数据库操作

#### 会话管理

##### `getAllConversations(): Promise<Conversation[]>`

获取所有会话。

##### `getConversationById(id: number): Promise<Conversation | null>`

根据 ID 获取会话。

##### `createConversation(title: string): Promise<number>`

创建新会话，返回会话 ID。

##### `updateConversationTitle(id: number, title: string): Promise<void>`

更新会话标题。

##### `deleteConversation(id: number): Promise<void>`

删除会话。

##### `setActiveConversation(id: number): Promise<void>`

设置活跃会话。

##### `getActiveConversation(): Promise<Conversation | null>`

获取当前活跃会话。

#### 消息管理

##### `saveMessage(params: SaveMessageParams): Promise<number>`

保存消息，返回消息 ID。

**参数：**
```typescript
{
  conversation_id: number
  sender: 'user' | 'ai'
  message_type: 'text' | 'image' | 'voice' | 'motion' | 'expression' | 'tts'
  content: string
  raw_data: string
  timestamp: number
}
```

##### `getMessagesByConversation(conversationId: number): Promise<Message[]>`

获取会话的所有消息。

##### `getMessageById(id: number): Promise<Message | null>`

根据 ID 获取消息。

##### `deleteMessage(id: number): Promise<void>`

删除消息。

##### `searchMessages(keyword: string, limit?: number): Promise<Message[]>`

搜索消息。

#### 统计数据

##### `getDailyStatistics(date: string): Promise<DailyStatistics | null>`

获取指定日期的统计数据。

**参数：**
- `date` - 日期字符串（YYYY-MM-DD 格式）

##### `getStatisticsRange(startDate: string, endDate: string): Promise<DailyStatistics[]>`

获取日期范围内的统计数据。

##### `updateStatistics(params: UpdateStatisticsParams): Promise<void>`

更新统计数据。

##### `getTotalStatistics(): Promise<{ totalMessages: number; totalConversations: number; totalDuration: number }>`

获取总统计数据。

---

### 模型管理

#### `importModel(): Promise<string | null>`

打开文件选择对话框导入模型，返回模型路径。

#### `deleteModel(modelId: string): Promise<void>`

删除指定模型。

#### `getModelList(): Promise<ModelInfo[]>`

获取所有已安装的模型列表。

---

## 服务层 API

### SettingsService

位于 `src/services/settingsService.ts`。

```typescript
import { settingsService } from '@/services'

// 获取设置
const settings = await settingsService.getSettings()

// 保存设置
await settingsService.saveSettings({ alwaysOnTop: true })

// 设置窗口置顶
await settingsService.setAlwaysOnTop(true)

// 监听设置变更
settingsService.onSettingsChanged((settings) => {
  console.log('设置已更新', settings)
})
```

### DatabaseService

位于 `src/services/databaseService.ts`。

```typescript
import { databaseService } from '@/services'

// 创建会话
const conversationId = await databaseService.createConversation('新会话')

// 保存消息
await databaseService.saveMessage({
  conversation_id: conversationId,
  sender: 'user',
  message_type: 'text',
  content: '你好',
  raw_data: '{}',
  timestamp: Date.now()
})

// 获取消息
const messages = await databaseService.getMessagesByConversation(conversationId)
```

### ModelService

位于 `src/services/modelService.ts`。

```typescript
import { modelService } from '@/services'

// 获取可用模型
const models = await modelService.getAvailableModels()

// 导入新模型
const modelPath = await modelService.importModel()

// 验证模型
const isValid = await modelService.validateModel('/models/default/model3.json')
```

---

## 状态管理 API

### useSettingsStore

管理应用设置。

```typescript
import { useSettingsStore } from '@/stores'

const settingsStore = useSettingsStore()

// 加载设置
await settingsStore.loadSettings()

// 更新设置
await settingsStore.updateSetting('modelScale', 1.5)

// 访问设置
console.log(settingsStore.settings.wsUrl)
```

### useConversationStore

管理会话和消息。

```typescript
import { useConversationStore } from '@/stores'

const conversationStore = useConversationStore()

// 加载会话
await conversationStore.loadConversations()

// 创建会话
const id = await conversationStore.createConversation('新会话')

// 添加消息
await conversationStore.addMessage({
  conversation_id: id,
  sender: 'user',
  message_type: 'text',
  content: '消息内容',
  raw_data: '{}',
  timestamp: Date.now()
})

// 访问消息
console.log(conversationStore.messages)
```

### useUIStore

管理 UI 状态。

```typescript
import { useUIStore } from '@/stores'

const uiStore = useUIStore()

// 打开对话框
uiStore.openDialog('settings')

// 显示气泡
uiStore.showBubble('Hello', 100, 200)

// 设置录音状态
uiStore.setRecording(true)
```

### useStatisticsStore

管理统计数据。

```typescript
import { useStatisticsStore } from '@/stores'

const statsStore = useStatisticsStore()

// 加载统计数据
await statsStore.loadRecentStatistics(7) // 最近 7 天

// 记录消息
await statsStore.recordMessage('user', 'text')

// 访问统计数据
console.log(statsStore.totalStats)
console.log(statsStore.messageRatio)
```

---

## 工具函数 API

### Logger

统一日志工具。

```typescript
import { logger, createLogger, LogLevel } from '@/utils/logger'

// 使用全局 logger
logger.info('应用启动')
logger.error('发生错误', error)

// 创建自定义 logger
const customLogger = createLogger('MyModule', { level: LogLevel.DEBUG })
customLogger.debug('调试信息')
```

### 错误处理

```typescript
import { AppError, ErrorCode, handleError, tryCatch } from '@/utils/errorHandler'

// 创建错误
throw new AppError({
  code: ErrorCode.NETWORK,
  message: '网络连接失败',
  context: { url: 'ws://localhost:8765' }
})

// 处理错误
try {
  // ...
} catch (error) {
  const appError = handleError(error, 'MyComponent')
  console.log(appError.userMessage)
}

// 异步操作包装
const result = await tryCatch(
  async () => fetchData(),
  ErrorCode.NETWORK,
  'fetchData'
)
```

### HitTest

模型区域检测。

```typescript
import { HitTester } from '@/utils/hitTest'

const hitTester = new HitTester({
  alphaThreshold: 10,
  debounceMs: 50
})

hitTester.setContext(app, model)

const isHit = await hitTester.testWithDebounce(x, y)
```

---

## WebSocket 协议

### 消息格式

所有 WebSocket 消息使用 Live2D-Bridge Protocol v1.0 格式：

```typescript
{
  op: string           // 操作类型
  id: string           // 消息 ID
  ts: number           // 时间戳
  payload: any         // 数据负载
}
```

### 发送消息

#### 系统握手

```json
{
  "op": "sys.handshake",
  "id": "uuid",
  "ts": 1234567890,
  "payload": {
    "token": "your-token",
    "client": "astrbot-live2d-desktop",
    "version": "0.0.0"
  }
}
```

#### 用户输入

```json
{
  "op": "input.message",
  "id": "uuid",
  "ts": 1234567890,
  "payload": {
    "type": "text",
    "content": "你好"
  }
}
```

### 接收消息

#### 握手确认

```json
{
  "op": "sys.handshake_ack",
  "id": "uuid",
  "ts": 1234567890,
  "payload": {
    "success": true
  }
}
```

#### 执行动作

```json
{
  "op": "perform.show",
  "id": "uuid",
  "ts": 1234567890,
  "payload": {
    "sequence": [
      { "type": "say", "text": "你好！" },
      { "type": "motion", "name": "greeting" }
    ]
  }
}
```

---

## 类型定义

详细类型定义请参考：

- `src/electron-api.d.ts` - Electron IPC 类型
- `src/types/history.ts` - 数据库实体类型
- `src/services/*.ts` - 服务层类型
- `src/stores/*.ts` - 状态管理类型
