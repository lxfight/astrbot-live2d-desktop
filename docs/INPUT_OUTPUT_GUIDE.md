# 输入输出功能实现指南

## 已完成部分

### 1. MediaPlayer 增强 ✅
- 支持 URL、RID、inline base64 三种格式
- `playAudio()`: 自动识别 base64 和 RID，转换为 URL
- `showImage()`: 支持所有三种格式
- `playVideo()`: 支持 URL 和 RID

### 2. 类型定义 ✅
- `src/types/protocol.ts`: 定义了 MessageContent、PerformElement 等类型
- 与后端 L2D-Bridge Protocol v1.0 保持一致

### 3. InputPanel 组件 ✅
- 文本输入框
- 图片、音频、视频文件选择
- 附件预览和删除
- 小文件自动转 base64（< 256KB）
- 大文件上传预留接口

## 待完成部分

### 1. 资源上传流程

需要在 `electron/protocol/client.ts` 中添加资源管理方法：

```typescript
/**
 * 资源上传流程
 */
async uploadResource(file: File): Promise<string> {
  // 1. 计算 SHA256
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const sha256 = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // 2. 申请上传 (resource.prepare)
  const prepareResp = await this.sendResourcePrepare({
    kind: file.type.startsWith('image/') ? 'image' :
          file.type.startsWith('audio/') ? 'audio' : 'video',
    mime: file.type,
    size: file.size,
    sha256
  })

  const { rid, upload, resource } = prepareResp

  // 3. 上传文件
  await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file
  })

  // 4. 确认上传 (resource.commit)
  await this.sendResourceCommit({ rid, size: file.size })

  return rid
}

/**
 * 发送 resource.prepare
 */
private sendResourcePrepare(payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = uuidv4()

    // 添加响应监听
    const handler = (packet: BasePacket) => {
      if (packet.id === id && packet.op === OP.RESOURCE_PREPARE) {
        this.off('packet', handler)
        if (packet.error) {
          reject(packet.error)
        } else {
          resolve(packet.payload)
        }
      }
    }

    this.on('packet', handler)

    this.send({
      op: OP.RESOURCE_PREPARE,
      id,
      ts: Date.now(),
      payload
    })

    // 超时处理
    setTimeout(() => {
      this.off('packet', handler)
      reject(new Error('资源上传申请超时'))
    }, 30000)
  })
}

/**
 * 发送 resource.commit
 */
private sendResourceCommit(payload: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = uuidv4()

    const handler = (packet: BasePacket) => {
      if (packet.id === id && packet.op === OP.RESOURCE_COMMIT) {
        this.off('packet', handler)
        if (packet.error) {
          reject(packet.error)
        } else {
          resolve()
        }
      }
    }

    this.on('packet', handler)

    this.send({
      op: OP.RESOURCE_COMMIT,
      id,
      ts: Date.now(),
      payload
    })

    setTimeout(() => {
      this.off('packet', handler)
      reject(new Error('资源上传确认超时'))
    }, 30000)
  })
}
```

### 2. 集成 InputPanel 到主窗口

在 `src/windows/Main.vue` 中：

```vue
<template>
  <div class="main-window">
    <!-- ... 现有内容 ... -->

    <!-- 输入面板（替换原来的快速输入框）-->
    <Transition name="input">
      <InputPanel
        v-if="showInput"
        @send="handleSendWithAttachments"
        @close="showInput = false"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import InputPanel from '@/components/InputPanel.vue'
import type { MessageContent } from '@/types/protocol'

/**
 * 发送带附件的消息
 */
async function handleSendWithAttachments(content: MessageContent[]) {
  if (!connectionStore.isConnected) {
    message.error('未连接到服务器')
    return
  }

  const result = await connectionStore.sendMessage(content, {
    userId: connectionStore.userId || 'desktop-user',
    userName: '桌面用户',
    sessionId: connectionStore.sessionId,
    messageType: 'friend'
  })

  if (result.success) {
    message.success('消息已发送')
    showInput.value = false
  } else {
    message.error(`发送失败: ${result.error}`)
  }
}
</script>
```

### 3. 添加拖拽上传支持

在 `src/windows/Main.vue` 中添加拖拽事件：

```vue
<template>
  <div
    class="main-window"
    @click="handleWindowClick"
    @drop.prevent="handleDrop"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    :class="{ 'drag-over': isDragOver }"
  >
    <!-- ... -->
  </div>
</template>

<script setup lang="ts">
const isDragOver = ref(false)

function handleDragOver(event: DragEvent) {
  isDragOver.value = true
}

function handleDragLeave(event: DragEvent) {
  isDragOver.value = false
}

async function handleDrop(event: DragEvent) {
  isDragOver.value = false

  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return

  // 自动识别文件类型并发送
  const content: MessageContent[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const type = getFileType(file)

    if (!type) {
      message.warning(`不支持的文件类型: ${file.name}`)
      continue
    }

    // 转换为 base64 或上传
    if (file.size < 256 * 1024) {
      const base64 = await fileToBase64(file)
      content.push({ type, inline: base64 })
    } else {
      const rid = await uploadFile(file)
      content.push({ type, rid })
    }
  }

  if (content.length > 0) {
    await connectionStore.sendMessage(content, {
      userId: connectionStore.userId || 'desktop-user',
      userName: '桌面用户',
      sessionId: connectionStore.sessionId,
      messageType: 'friend'
    })
    message.success('文件已发送')
  }
}

function getFileType(file: File): 'image' | 'audio' | 'video' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  return null
}
</script>

<style>
.main-window.drag-over {
  outline: 2px dashed var(--color-accent);
  outline-offset: -10px;
}
</style>
```

### 4. 更新 ConnectionStore

在 `src/stores/connection.ts` 中添加资源基础 URL：

```typescript
export const useConnectionStore = defineStore('connection', () => {
  const resourceBaseUrl = ref('http://localhost:9091')

  // 从握手响应中获取资源基础 URL
  function updateResourceBaseUrl(url: string) {
    resourceBaseUrl.value = url
    // 保存到全局
    ;(window as any).resourceBaseUrl = url
  }

  // 在握手成功后调用
  // await client.connect(url, token)
  // const session = client.getSession()
  // if (session.config?.resourceBaseUrl) {
  //   updateResourceBaseUrl(session.config.resourceBaseUrl)
  // }

  return {
    resourceBaseUrl,
    updateResourceBaseUrl
  }
})
```

### 5. TTS 音频处理

在 `src/utils/PerformanceQueue.ts` 中，`tts` 类型元素应该：

```typescript
case 'tts':
  if (this.onAudioCallback && element.url) {
    // 播放 TTS 音频
    this.onAudioCallback(element.url, element.volume || 1.0)

    // 同时显示文字气泡
    if (this.onTextCallback && element.text) {
      this.onTextCallback(
        element.text,
        'center',
        element.duration || 3000
      )
    }

    // 等待音频播放完成（如果指定了 duration）
    if (element.duration) {
      await this.delay(element.duration)
    }
  }
  break
```

## 实现优先级

1. **高优先级**：
   - MediaPlayer 增强（已完成✅）
   - 类型定义（已完成✅）
   - ConnectionStore 更新资源 URL
   - TTS 音频处理

2. **中优先级**：
   - InputPanel 集成到主窗口
   - 简单的文件上传（仅 base64）

3. **低优先级**：
   - 完整的资源上传流程
   - 拖拽上传
   - 资源进度显示

## 测试方法

1. 启动 AstrBot 服务器
2. 在设置中连接到服务器
3. 点击对话按钮，测试输入框
4. 发送文字、图片、音频、视频
5. 观察服务器返回的表演序列
6. 检查资源是否正确显示

## 注意事项

- 小文件（< 256KB）使用 inline base64，大文件使用资源服务器
- 资源上传需要实现 SHA256 计算
- 资源服务器需要正确配置 CORS
- 记得处理上传失败的情况
- TTS 音频需要同时显示文字和播放音频
