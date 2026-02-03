<template>
  <div class="main-window" @click="handleWindowClick">
    <!-- 空状态提示 -->
    <Transition name="fade">
      <div v-if="!hasModel" class="empty-state">
        <div class="empty-content">
          <div class="empty-icon">🎭</div>
          <h2>欢迎使用 AstrBot Live2D</h2>
          <p>还没有导入模型，请先导入一个 Live2D 模型</p>
          <n-space vertical :size="16">
            <n-button type="primary" size="large" @click="handleImportModel">
              <template #icon>
                <span>📁</span>
              </template>
              导入模型
            </n-button>
            <n-button text @click="openSettings">
              或者在设置中管理模型
            </n-button>
          </n-space>
        </div>
      </div>
    </Transition>

    <!-- Live2D 画布 -->
    <Live2DCanvas
      v-show="hasModel"
      ref="live2dCanvasRef"
      @model-click="handleModelClick"
      @model-loaded="handleModelLoaded"
      @model-info-changed="handleModelInfoChanged"
    />

    <!-- 媒体播放器 -->
    <MediaPlayer ref="mediaPlayerRef" />

    <!-- 圆形交互菜单 -->
    <Transition name="menu">
      <div v-if="showMenu" class="context-menu" :style="menuStyle" @click.stop>
        <div class="menu-item" @click="openHistory">
          <span class="icon">📊</span>
          <span class="label">历史</span>
        </div>
        <div class="menu-item" @click="openSettings">
          <span class="icon">⚙️</span>
          <span class="label">设置</span>
        </div>
        <div class="menu-item" @click="openInput">
          <span class="icon">💬</span>
          <span class="label">对话</span>
        </div>
        <div class="menu-item" @click="playRandomMotion">
          <span class="icon">🎭</span>
          <span class="label">动作</span>
        </div>
      </div>
    </Transition>

    <!-- 文字气泡 -->
    <Transition name="bubble">
      <div v-if="currentBubble" class="bubble" :class="currentBubble.position">
        {{ currentBubble.content }}
      </div>
    </Transition>

    <!-- 快速输入框 -->
    <Transition name="input">
      <div v-if="showInput" class="input-panel-container" @click.stop>
        <div class="input-toolbar">
          <n-button text size="small" @click="handleSelectImage">
            <template #icon>
              <span>🖼️</span>
            </template>
          </n-button>
          <n-button text size="small" @click="handlePaste">
            <template #icon>
              <span>📋</span>
            </template>
          </n-button>
          <n-button
            text
            size="small"
            :type="isRecording ? 'error' : 'default'"
            @mousedown="startRecording"
            @mouseup="stopRecording"
            @mouseleave="cancelRecordingIfActive"
          >
            <template #icon>
              <span>{{ isRecording ? '⏺️' : '🎤' }}</span>
            </template>
          </n-button>
        </div>
        <div v-if="isRecording" class="recording-indicator">
          <span class="recording-dot"></span>
          <span>录音中... {{ recordingDuration }}s</span>
        </div>
        <n-input
          v-model:value="inputText"
          type="textarea"
          placeholder="输入消息... (Ctrl+V 粘贴图片)"
          :autosize="{ minRows: 2, maxRows: 4 }"
          @keydown.enter.exact="handleSendMessage"
          @paste="handlePasteEvent"
        />
        <div v-if="selectedImage" class="image-preview">
          <img :src="selectedImage.preview" alt="预览" />
          <n-button text size="small" @click="clearImage">
            <template #icon>
              <span>❌</span>
            </template>
          </n-button>
        </div>
        <n-button type="primary" @click="handleSendMessage">发送</n-button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { useConnectionStore } from '@/stores/connection'
import { useModelStore } from '@/stores/model'
import Live2DCanvas from '@/components/Live2D/Canvas.vue'
import MediaPlayer from '@/components/MediaPlayer.vue'
import { PerformanceQueue } from '@/utils/PerformanceQueue'
import { AudioRecorder } from '@/utils/AudioRecorder'

const message = useMessage()
const connectionStore = useConnectionStore()
const modelStore = useModelStore()

const live2dCanvasRef = ref<InstanceType<typeof Live2DCanvas>>()
const mediaPlayerRef = ref<InstanceType<typeof MediaPlayer>>()
const showMenu = ref(false)
const menuStyle = ref({ left: '0px', top: '0px' })
const currentBubble = ref<any>(null)
const showInput = ref(false)
const inputText = ref('')
const hasModel = ref(false)
const selectedImage = ref<{ file: File; preview: string } | null>(null)
const isRecording = ref(false)
const recordingDuration = ref(0)
let audioRecorder: AudioRecorder | null = null
let recordingTimer: NodeJS.Timeout | null = null

// 创建表演队列
const performQueue = new PerformanceQueue()

// 设置表演队列回调
performQueue.onText((content, position, duration) => {
  currentBubble.value = { content, position }
  // 文字会在队列中自动等待 duration 后继续
})

performQueue.onMotion((group, index, priority) => {
  live2dCanvasRef.value?.playMotion(group, index, priority)
})

performQueue.onExpression((id) => {
  live2dCanvasRef.value?.setExpression(id)
})

performQueue.onAudio((url, volume) => {
  mediaPlayerRef.value?.playAudio(url, volume)
})

performQueue.onImage((url, duration) => {
  mediaPlayerRef.value?.showImage(url, duration)
})

performQueue.onVideo((url) => {
  mediaPlayerRef.value?.playVideo(url)
})

// 导入模型
async function handleImportModel() {
  try {
    const result = await window.electron.model.selectFile()

    if (result.canceled) {
      return
    }

    if (!result.success) {
      message.error(`选择文件失败: ${result.error}`)
      return
    }

    // 提取模型名称
    const fileName = result.filePath.split(/[/\\]/).pop() || 'model'
    const modelName = fileName.replace(/\.(model|model3)\.json$/, '')

    // 导入模型
    const importResult = await window.electron.model.import(result.filePath, modelName)

    if (!importResult.success) {
      message.error(`导入模型失败: ${importResult.error}`)
      return
    }

    // 加载模型
    await live2dCanvasRef.value?.loadModel(importResult.modelPath)
    hasModel.value = true
    modelStore.setCurrentModel(importResult.modelPath)

    message.success('模型导入成功')
  } catch (error: any) {
    message.error(`导入模型失败: ${error.message}`)
  }
}

// 模型加载完成
function handleModelLoaded() {
  console.log('[主窗口] Live2D 模型加载完成')
  hasModel.value = true
  message.success('模型加载成功')
}

// 模型信息变化
async function handleModelInfoChanged(modelInfo: {
  name: string;
  motionGroups: Record<string, Array<{ index: number; file: string }>>;
  expressions: string[]
}) {
  console.log('[主窗口] 模型信息变化:', modelInfo)

  // 如果已连接到服务器，发送模型信息更新
  if (connectionStore.isConnected) {
    try {
      await connectionStore.sendState('state.model', modelInfo)
      console.log('[主窗口] 模型信息已发送到服务器')
    } catch (error: any) {
      console.error('[主窗口] 发送模型信息失败:', error)
    }
  }
}

// 点击模型
function handleModelClick(position: { x: number; y: number }) {
  console.log('[主窗口] 点击模型:', position)

  // 显示菜单
  menuStyle.value = {
    left: `${position.x - 100}px`,
    top: `${position.y - 100}px`
  }
  showMenu.value = true
}

// 点击窗口处理（只关闭菜单和输入框，不打开菜单）
function handleWindowClick(event: MouseEvent) {
  // 只关闭已打开的菜单和输入框
  if (showMenu.value) {
    showMenu.value = false
  }
  if (showInput.value) {
    showInput.value = false
  }
}

// 打开历史记录窗口
async function openHistory() {
  showMenu.value = false
  await window.electron.window.openHistory()
}

// 打开设置窗口
async function openSettings() {
  showMenu.value = false
  await window.electron.window.openSettings()
}

// 打开输入框
function openInput() {
  showMenu.value = false
  showInput.value = true
  inputText.value = ''
  selectedImage.value = null
}

// 选择图片
function handleSelectImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'

  input.onchange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    const file = files[0]
    if (file.size > 10 * 1024 * 1024) {
      message.warning('图片大小不能超过 10MB')
      return
    }

    // 创建预览
    const reader = new FileReader()
    reader.onload = (e) => {
      selectedImage.value = {
        file,
        preview: e.target?.result as string
      }
    }
    reader.readAsDataURL(file)
  }

  input.click()
}

// 粘贴图片
function handlePaste() {
  navigator.clipboard.read().then(items => {
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          item.getType(type).then(blob => {
            const file = new File([blob], 'pasted-image.png', { type })
            const reader = new FileReader()
            reader.onload = (e) => {
              selectedImage.value = {
                file,
                preview: e.target?.result as string
              }
            }
            reader.readAsDataURL(file)
          })
          return
        }
      }
    }
    message.warning('剪贴板中没有图片')
  }).catch(() => {
    message.error('读取剪贴板失败')
  })
}

// 处理粘贴事件
function handlePasteEvent(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue

      const reader = new FileReader()
      reader.onload = (e) => {
        selectedImage.value = {
          file,
          preview: e.target?.result as string
        }
      }
      reader.readAsDataURL(file)
      break
    }
  }
}

// 清除图片
function clearImage() {
  selectedImage.value = null
}

// 文件转 base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Blob 转 base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 开始录音
async function startRecording() {
  if (!AudioRecorder.isSupported()) {
    message.error('您的浏览器不支持录音功能')
    return
  }

  try {
    audioRecorder = new AudioRecorder({
      sampleRate: 16000,
      channelCount: 1
    })

    await audioRecorder.start()
    isRecording.value = true
    recordingDuration.value = 0

    // 更新录音时长
    recordingTimer = setInterval(() => {
      recordingDuration.value = Math.floor(audioRecorder!.getDuration() / 1000)

      // 最大录音时长 60 秒
      if (recordingDuration.value >= 60) {
        stopRecording()
      }
    }, 100)

    console.log('[主窗口] 开始录音')
  } catch (error: any) {
    message.error(`录音失败: ${error.message}`)
    isRecording.value = false
  }
}

// 停止录音并发送
async function stopRecording() {
  if (!audioRecorder || !isRecording.value) return

  try {
    const audioBlob = await audioRecorder.stop()
    isRecording.value = false

    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }

    console.log('[主窗口] 录音完成，大小:', audioBlob.size, '字节')

    // 检查连接状态
    if (!connectionStore.isConnected) {
      message.error('未连接到服务器')
      return
    }

    // 发送音频消息
    await sendAudioMessage(audioBlob)

  } catch (error: any) {
    message.error(`停止录音失败: ${error.message}`)
    isRecording.value = false
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
  }
}

// 取消录音
function cancelRecordingIfActive() {
  if (!audioRecorder || !isRecording.value) return

  audioRecorder.cancel()
  isRecording.value = false

  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }

  console.log('[主窗口] 录音已取消')
}

// 发送音频消息
async function sendAudioMessage(audioBlob: Blob) {
  try {
    message.info('正在发送语音...')

    // 转换为 base64
    const base64 = await blobToBase64(audioBlob)

    // 获取音频格式
    const format = audioBlob.type.split('/')[1] || 'webm'

    const content: any[] = [
      {
        type: 'audio',
        inline: base64,
        name: `voice.${format}`
      }
    ]

    const result = await connectionStore.sendMessage(content, {
      userId: connectionStore.userId || 'desktop-user',
      userName: '桌面用户',
      sessionId: connectionStore.sessionId,
      messageType: 'friend'
    })

    if (result.success) {
      message.success('语音已发送')

      // 保存语音消息记录
      try {
        await window.electron.history.saveMessage({
          messageId: `msg_${Date.now()}`,
          sessionId: connectionStore.sessionId || 'default',
          userId: connectionStore.userId || 'desktop-user',
          userName: '桌面用户',
          messageType: 'friend',
          direction: 'outgoing',
          content: content,
          rawText: '[语音消息]',
          timestamp: Date.now()
        })
      } catch (error) {
        console.error('[主窗口] 保存语音消息记录失败:', error)
      }
    } else {
      message.error(`发送失败: ${result.error}`)
    }
  } catch (error: any) {
    message.error(`发送失败: ${error.message}`)
  }
}

// 播放随机动作
function playRandomMotion() {
  showMenu.value = false
  live2dCanvasRef.value?.playRandomMotion()
}

// 发送消息
async function handleSendMessage() {
  if (!inputText.value.trim() && !selectedImage.value) return

  if (!connectionStore.isConnected) {
    message.error('未连接到服务器')
    return
  }

  try {
    const content: any[] = []

    // 添加文本
    if (inputText.value.trim()) {
      content.push({ type: 'text', text: inputText.value.trim() })
    }

    // 添加图片
    if (selectedImage.value) {
      const file = selectedImage.value.file

      // 小于 256KB 使用 inline base64
      if (file.size < 256 * 1024) {
        const base64 = await fileToBase64(file)
        content.push({ type: 'image', inline: base64 })
      } else {
        // 大文件暂时也用 base64（后续实现资源上传）
        message.info('正在处理图片...')
        const base64 = await fileToBase64(file)
        content.push({ type: 'image', inline: base64 })
      }
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
      inputText.value = ''
      selectedImage.value = null

      // 保存消息记录
      try {
        await window.electron.history.saveMessage({
          messageId: `msg_${Date.now()}`,
          sessionId: connectionStore.sessionId || 'default',
          userId: connectionStore.userId || 'desktop-user',
          userName: '桌面用户',
          messageType: 'friend',
          direction: 'outgoing',
          content: content,
          rawText: inputText.value,
          timestamp: Date.now()
        })
      } catch (error) {
        console.error('[主窗口] 保存消息记录失败:', error)
      }
    } else {
      message.error(`发送失败: ${result.error}`)
    }
  } catch (error: any) {
    message.error(`发送失败: ${error.message}`)
  }
}

// 监听表演指令
onMounted(async () => {
  // 监听全局快捷键录音
  window.electron.shortcut.onRecordingStart(() => {
    console.log('[主窗口] 全局快捷键：开始录音')
    startRecording()
  })

  window.electron.shortcut.onRecordingStop(() => {
    console.log('[主窗口] 全局快捷键：停止录音')
    stopRecording()
  })

  // 监听从设置页面加载模型的指令（只显示一次提示）
  let isLoadingModel = false
  window.electron.model.onLoad(async (modelPath: string) => {
    if (isLoadingModel) {
      console.log('[主窗口] 模型正在加载中，忽略重复请求')
      return
    }

    console.log('[主窗口] 收到模型加载指令:', modelPath)
    isLoadingModel = true

    try {
      await live2dCanvasRef.value?.loadModel(modelPath)
      hasModel.value = true
      modelStore.setCurrentModel(modelPath)
      // 不在这里显示提示，由 handleModelLoaded 统一处理
    } catch (error: any) {
      message.error(`模型加载失败: ${error.message}`)
    } finally {
      isLoadingModel = false
    }
  })

  window.electron.bridge.onPerformShow((payload: any) => {
    console.log('收到表演指令:', payload)

    // 使用表演队列执行
    if (payload.sequence) {
      performQueue.enqueue({
        sequence: payload.sequence,
        interruptible: payload.interruptible !== false
      })

      // 保存表演记录和更新统计
      try {
        const timestamp = Date.now()
        const date = new Date(timestamp)
        const dateStr = date.toISOString().split('T')[0]
        const hour = date.getHours()
        const performanceId = `perf_${timestamp}`

        // 先保存一条incoming消息记录（服务器发来的表演）
        window.electron.history.saveMessage({
          messageId: performanceId,
          sessionId: connectionStore.sessionId || 'default',
          userId: 'server',
          userName: '服务器',
          messageType: 'friend',
          direction: 'incoming',
          content: payload.sequence,
          rawText: '[表演序列]',
          timestamp: timestamp
        }).then(() => {
          // 保存表演记录（关联到消息）
          return window.electron.history.savePerformance({
            messageId: performanceId,
            sessionId: connectionStore.sessionId || 'default',
            sequence: payload.sequence,
            timestamp: timestamp
          })
        }).catch((error: any) => {
          console.error('[主窗口] 保存表演记录失败:', error)
        })

        // 统计各类元素数量
        let textCount = 0
        let imageCount = 0
        let audioCount = 0
        let videoCount = 0
        const motionUsage: Record<string, number> = {}
        const expressionUsage: Record<string, number> = {}

        payload.sequence.forEach((element: any) => {
          switch (element.type) {
            case 'text':
              textCount++
              break
            case 'image':
              imageCount++
              break
            case 'tts':
            case 'audio':
              audioCount++
              break
            case 'video':
              videoCount++
              break
            case 'motion':
              const motionKey = `${element.group}_${element.index}`
              motionUsage[motionKey] = (motionUsage[motionKey] || 0) + 1
              break
            case 'expression':
              const exprKey = element.expressionId || element.id
              if (exprKey) {
                expressionUsage[exprKey] = (expressionUsage[exprKey] || 0) + 1
              }
              break
          }
        })

        // 更新统计数据
        window.electron.history.updateStatistics({
          date: dateStr,
          hour: hour,
          messageCount: 1,
          textCount: textCount,
          imageCount: imageCount,
          audioCount: audioCount,
          videoCount: videoCount,
          motionUsage: JSON.stringify(motionUsage),
          expressionUsage: JSON.stringify(expressionUsage)
        }).catch((error: any) => {
          console.error('[主窗口] 更新统计数据失败:', error)
        })
      } catch (error) {
        console.error('[主窗口] 处理表演记录失败:', error)
      }
    }
  })

  window.electron.bridge.onPerformInterrupt(() => {
    console.log('收到中断指令')
    performQueue.interrupt()
    currentBubble.value = null
    mediaPlayerRef.value?.stopAudio()
    mediaPlayerRef.value?.hideImage()
    mediaPlayerRef.value?.hideVideo()
  })

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

  window.electron.bridge.onError((error: any) => {
    message.error(`连接错误: ${error.message || error}`)
  })

  // 检查初始连接状态
  await connectionStore.checkConnection()

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

  // 自动加载上次使用的模型
  const lastModelPath = modelStore.getLastModel()
  if (lastModelPath) {
    console.log('[主窗口] 自动加载上次模型:', lastModelPath)
    try {
      await live2dCanvasRef.value?.loadModel(lastModelPath)
      hasModel.value = true
      modelStore.setCurrentModel(lastModelPath)
      console.log('[主窗口] 自动加载成功')
    } catch (error: any) {
      console.warn('[主窗口] 自动加载失败:', error.message)
      // 自动加载失败不显示错误提示，让用户手动导入
    }
  }

  // 自动注册全局快捷键
  const advancedSettingsStr = localStorage.getItem('advancedSettings')
  if (advancedSettingsStr) {
    try {
      const settings = JSON.parse(advancedSettingsStr)
      if (settings.recordingShortcut) {
        // 转换为 Electron 格式（Ctrl -> CommandOrControl）
        const electronFormat = settings.recordingShortcut.replace('Ctrl', 'CommandOrControl')
        console.log('[主窗口] 注册全局快捷键:', electronFormat)
        const result = await window.electron.shortcut.register(electronFormat)
        if (result.success) {
          console.log('[主窗口] 快捷键注册成功')
        } else {
          console.warn('[主窗口] 快捷键注册失败:', result.error)
        }
      }
    } catch (error) {
      console.error('[主窗口] 解析快捷键配置失败:', error)
    }
  }
})
</script>

<style scoped lang="scss">
.main-window {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: var(--color-bg-dark);
}

.empty-state {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-dark);
  z-index: 10;

  .empty-content {
    text-align: center;
    padding: 40px;

    .empty-icon {
      font-size: 80px;
      margin-bottom: 24px;
    }

    h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--color-text-primary);
    }

    p {
      font-size: 14px;
      color: var(--color-text-secondary);
      margin-bottom: 32px;
    }
  }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.context-menu {
  position: fixed;
  display: grid;
  grid-template-columns: repeat(2, 80px);
  grid-template-rows: repeat(2, 80px);
  gap: 16px;
  padding: 16px;
  background: rgba(26, 26, 26, 0.95);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-lg);
  z-index: 1000;

  .menu-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    border-radius: 12px;
    transition: all 0.2s;

    &:hover {
      background: rgba(100, 108, 255, 0.2);
      transform: scale(1.05);
    }

    .icon {
      font-size: 24px;
    }

    .label {
      font-size: 12px;
      color: var(--color-text-primary);
    }
  }
}

.bubble {
  position: absolute;
  background: rgba(26, 26, 26, 0.9);
  color: var(--color-text-primary);
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 14px;
  max-width: 300px;
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-md);
  z-index: 100;

  &.center {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  &.top {
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
  }

  &.bottom {
    bottom: 20%;
    left: 50%;
    transform: translateX(-50%);
  }
}

.input-panel-container {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  padding: 16px;
  background: rgba(26, 26, 26, 0.95);
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-lg);
  z-index: 200;

  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.input-toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 77, 79, 0.1);
  border-radius: 4px;
  margin-bottom: 8px;
  color: var(--color-error);
  font-size: 14px;

  .recording-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-error);
    animation: recording-pulse 1.5s ease-in-out infinite;
  }
}

@keyframes recording-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.image-preview {
  position: relative;
  width: 100%;
  max-height: 200px;
  margin: 8px 0;
  border-radius: 4px;
  overflow: hidden;

  img {
    width: 100%;
    height: auto;
    display: block;
  }

  button {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    padding: 4px;
  }
}

.menu-enter-active, .menu-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.menu-enter-from, .menu-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.bubble-enter-active, .bubble-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.bubble-enter-from, .bubble-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
}

.input-enter-active, .input-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.input-enter-from, .input-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
