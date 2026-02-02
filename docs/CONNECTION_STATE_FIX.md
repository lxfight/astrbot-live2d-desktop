# 连接状态同步问题修复

## 问题描述

1. 设置页显示"已连接"，但主窗口输入时提示"未连接到服务器"
2. 启动时自动连接功能未生效

## 根本原因

Electron 应用中，每个窗口都是独立的渲染进程，它们之间的 Pinia store 状态**不共享**。

当在设置窗口点击"连接"后：
- 设置窗口的 `connectionStore.isConnected = true` ✅
- 主窗口的 `connectionStore.isConnected` 仍然是 `false` ❌

## 修复方案

通过 Electron 主进程广播连接状态变化到所有窗口。

### 修复1: 主窗口监听连接事件并更新状态

**文件**: `src/windows/Main.vue:289-311`

```typescript
window.electron.bridge.onConnected((payload: any) => {
  message.success('已连接到服务器')
  console.log('连接信息:', payload)

  // 更新连接状态
  connectionStore.isConnected = true
  if (payload.sessionId) {
    connectionStore.sessionId = payload.sessionId
  }
  if (payload.userId) {
    connectionStore.userId = payload.userId
  }
})

window.electron.bridge.onDisconnected((info: any) => {
  message.warning('已断开连接')
  console.log('断开信息:', info)

  // 更新连接状态
  connectionStore.isConnected = false
  connectionStore.sessionId = ''
  connectionStore.userId = ''
})
```

### 修复2: 设置窗口也监听连接事件

**文件**: `src/windows/Settings.vue:172-194`

```typescript
onMounted(() => {
  loadModelList()
  loadSettings()

  // 监听连接状态变化
  window.electron.bridge.onConnected((payload: any) => {
    connectionStore.isConnected = true
    if (payload.sessionId) {
      connectionStore.sessionId = payload.sessionId
    }
    if (payload.userId) {
      connectionStore.userId = payload.userId
    }
  })

  window.electron.bridge.onDisconnected(() => {
    connectionStore.isConnected = false
    connectionStore.sessionId = ''
    connectionStore.userId = ''
  })

  // 检查初始连接状态
  connectionStore.checkConnection()
})
```

### 修复3: 实现自动连接功能

**文件**: `src/windows/Main.vue:318-335`

```typescript
// 自动连接功能
const advancedSettings = localStorage.getItem('advancedSettings')
if (advancedSettings) {
  try {
    const settings = JSON.parse(advancedSettings)
    if (settings.autoConnect && !connectionStore.isConnected) {
      console.log('[主窗口] 启动时自动连接')
      const result = await connectionStore.connect()
      if (result.success) {
        console.log('[主窗口] 自动连接成功')
      } else {
        console.warn('[主窗口] 自动连接失败:', result.error)
      }
    }
  } catch (error) {
    console.error('[主窗口] 解析自动连接配置失败:', error)
  }
}
```

### 修复4: 完善握手确认的 payload

**文件**: `electron/protocol/client.ts:154-171`

确保 `onConnected` 事件包含完整信息：

```typescript
this.emit('connected', {
  sessionId: this.sessionId,
  userId: this.userId,
  capabilities: payload.capabilities,
  config: payload.config
})
```

## 数据流

```
┌─────────────────────┐
│   设置窗口点击连接   │
└─────────┬───────────┘
          │
          ▼
┌──────────────────────────┐
│ connectionStore.connect() │
└─────────┬────────────────┘
          │
          ▼
┌──────────────────────────┐
│  IPC: bridge:connect      │
└─────────┬────────────────┘
          │
          ▼
┌──────────────────────────┐
│  主进程: L2DBridgeClient  │
│  WebSocket 连接成功       │
└─────────┬────────────────┘
          │
          ▼
┌──────────────────────────┐
│  emit('connected')        │
└─────────┬────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│  主进程广播到所有窗口                 │
│  win.webContents.send('bridge:connected') │
└─────────┬───────────────────┬────────┘
          │                   │
          ▼                   ▼
  ┌───────────────┐   ┌───────────────┐
  │  主窗口监听    │   │  设置窗口监听  │
  │  onConnected   │   │  onConnected   │
  └───────┬───────┘   └───────┬───────┘
          │                   │
          ▼                   ▼
  ┌───────────────┐   ┌───────────────┐
  │ isConnected    │   │ isConnected    │
  │ = true ✅      │   │ = true ✅      │
  └───────────────┘   └───────────────┘
```

## 验证步骤

1. 启动应用
2. 在设置页点击"连接"
3. 回到主窗口，点击模型 → 对话
4. 输入文字并发送
5. ✅ 应该不再提示"未连接到服务器"

## 自动连接测试

1. 在设置页开启"启动时自动连接"
2. 保存设置
3. 重启应用
4. ✅ 应该自动连接到服务器（查看控制台日志）
5. ✅ 设置页应该显示"● 已连接"

## 注意事项

- 所有窗口都需要监听 `onConnected` 和 `onDisconnected` 事件
- 连接状态由主进程统一管理，通过事件同步到各个窗口
- `connectionStore.checkConnection()` 用于获取初始状态
- 自动连接配置保存在 `localStorage.advancedSettings` 中
