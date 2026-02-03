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
      @model-right-click="handleModelRightClick"
      @model-loaded="handleModelLoaded"
      @model-info-changed="handleModelInfoChanged"
      @model-position-changed="handleModelPositionChanged"
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
      <div
        v-if="currentBubble"
        class="bubble"
        :style="bubbleStyle"
        @click.stop
        @mouseenter="handleBubbleMouseEnter"
        @mouseleave="handleBubbleMouseLeave"
      >
        <div class="bubble-content">
          <div v-html="renderBubbleMarkdown(currentBubble.content)"></div>
        </div>
      </div>
    </Transition>

    <!-- 全局录音提示 -->
    <Transition name="recording-toast">
      <div v-if="isRecording" class="recording-toast" @click.stop>
        <div class="recording-toast-content">
          <span class="recording-dot"></span>
          <span class="recording-text">正在录音... {{ recordingDuration }}s</span>
          <span class="recording-hint">再次按下快捷键停止</span>
        </div>
      </div>
    </Transition>

    <!-- 快速输入框 -->
    <Transition name="input">
      <div v-if="showInput" class="input-panel-container" :style="inputStyle" @click.stop>
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
import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const message = useMessage()
const connectionStore = useConnectionStore()
const modelStore = useModelStore()

const live2dCanvasRef = ref<InstanceType<typeof Live2DCanvas>>()
const mediaPlayerRef = ref<InstanceType<typeof MediaPlayer>>()
const showMenu = ref(false)
const menuStyle = ref({ left: '0px', top: '0px' })
const currentBubble = ref<any>(null)
const bubbleStyle = ref({ left: '0px', top: '0px' })
const showInput = ref(false)
const inputStyle = ref({ left: '0px', top: '0px' })
const inputText = ref('')
const hasModel = ref(false)
const selectedImage = ref<{ file: File; preview: string } | null>(null)
const isRecording = ref(false)
const recordingDuration = ref(0)
let audioRecorder: AudioRecorder | null = null
let recordingTimer: NodeJS.Timeout | null = null
let bubbleTimer: NodeJS.Timeout | null = null
let bubbleHoverTimer: NodeJS.Timeout | null = null
const isBubbleHovered = ref(false)
let modelPositionX = window.innerWidth / 2
let modelPositionY = window.innerHeight / 2

// 配置 marked（与 History.vue 相同）
marked.setOptions({
  breaks: true,
  gfm: true
})

marked.use({
  extensions: [
    {
      name: 'latex-inline',
      level: 'inline',
      start(src: string) { return src.indexOf('$') },
      tokenizer(src: string) {
        const match = src.match(/^\$([^\$]+)\$/)
        if (match) {
          return {
            type: 'latex-inline',
            raw: match[0],
            text: match[1]
          }
        }
      },
      renderer(token: any) {
        try {
          return katex.renderToString(token.text, { throwOnError: false })
        } catch (e) {
          return token.raw
        }
      }
    },
    {
      name: 'latex-block',
      level: 'block',
      start(src: string) { return src.indexOf('$$') },
      tokenizer(src: string) {
        const match = src.match(/^\$\$([^\$]+)\$\$/)
        if (match) {
          return {
            type: 'latex-block',
            raw: match[0],
            text: match[1]
          }
        }
      },
      renderer(token: any) {
        try {
          return katex.renderToString(token.text, {
            displayMode: true,
            throwOnError: false
          })
        } catch (e) {
          return token.raw
        }
      }
    }
  ]
})

// 渲染气泡 Markdown
function renderBubbleMarkdown(text: string): string {
  if (!text) return ''
  try {
    return marked.parse(text) as string
  } catch (error) {
    console.error('[Main] Markdown渲染失败:', error)
    return text
  }
}

// 气泡鼠标进入
function handleBubbleMouseEnter() {
  isBubbleHovered.value = true
  // 清除自动隐藏定时器
  if (bubbleHoverTimer) {
    clearTimeout(bubbleHoverTimer)
    bubbleHoverTimer = null
  }
}

// 气泡鼠标离开
function handleBubbleMouseLeave() {
  isBubbleHovered.value = false
  // 鼠标离开后 3 秒自动隐藏
  startBubbleHideTimer(3000)
}

// 启动气泡自动隐藏定时器
function startBubbleHideTimer(delay: number) {
  // 清除旧的定时器
  if (bubbleHoverTimer) {
    clearTimeout(bubbleHoverTimer)
  }
  // 设置新的定时器
  bubbleHoverTimer = setTimeout(() => {
    if (!isBubbleHovered.value) {
      currentBubble.value = null
    }
  }, delay)
}

// 创建表演队列
const performQueue = new PerformanceQueue()

// 设置表演队列回调
performQueue.onText((content, position, duration) => {
  currentBubble.value = { content, position }
  updateUIPositions()
  // 启动自动隐藏定时器（默认 5 秒后隐藏）
  startBubbleHideTimer(5000)
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
    const fileName = result.filePath?.split(/[/\\]/).pop() || 'model'
    const modelName = fileName.replace(/\.(model|model3)\.json$/, '')

    // 导入模型
    const importResult = await window.electron.model.import(result.filePath!, modelName)

    if (!importResult.success) {
      message.error(`导入模型失败: ${importResult.error}`)
      return
    }

    // 加载模型
    await live2dCanvasRef.value?.loadModel(importResult.modelPath!)
    hasModel.value = true
    modelStore.setCurrentModel(importResult.modelPath!)

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
  motionGroups: string[] | Record<string, Array<{ index: number; file: string }>>;
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

// 模型右键点击
function handleModelRightClick(position: { x: number; y: number }) {
  console.log('[主窗口] 右键点击模型:', position)

  // 更新模型位置
  modelPositionX = position.x
  modelPositionY = position.y

  // 显示菜单（在鼠标位置附近）
  menuStyle.value = {
    left: `${position.x - 100}px`,
    top: `${position.y - 100}px`
  }
  showMenu.value = true
}

// 模型位置变化（拖动时）
function handleModelPositionChanged(position: { x: number; y: number }) {
  modelPositionX = position.x
  modelPositionY = position.y
  updateUIPositions()
}

// 更新 UI 元素位置（跟随模型）
function updateUIPositions() {
  // 更新气泡位置（模型头顶上方 250px，避免遮挡模型）
  if (currentBubble.value) {
    bubbleStyle.value = {
      left: `${modelPositionX}px`,
      top: `${modelPositionY - 250}px`
    }
  }

  // 更新输入框位置（模型下方 150px）
  if (showInput.value) {
    inputStyle.value = {
      left: `${modelPositionX}px`,
      top: `${modelPositionY + 150}px`
    }
  }
}

// 点击窗口处理（关闭菜单和输入框）
function handleWindowClick(event: MouseEvent) {
  // 检查点击是否在交互元素上
  const target = event.target as HTMLElement

  // 如果点击的是菜单、输入框、气泡或其子元素，不处理
  if (
    target.closest('.context-menu') ||
    target.closest('.input-panel-container') ||
    target.closest('.bubble') ||
    target.closest('.recording-toast') ||
    target.closest('.empty-state')
  ) {
    return
  }

  // 关闭菜单和输入框
  if (showMenu.value) {
    showMenu.value = false
  }
  if (showInput.value) {
    showInput.value = false
    // 输入框关闭后，恢复动态穿透
    live2dCanvasRef.value?.enablePassThrough()
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
  updateUIPositions()
  // 禁用动态穿透，让整个窗口可以接收点击事件
  live2dCanvasRef.value?.disablePassThrough()
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

    // 检查录音时长
    if (audioBlob.size < 1000) {
      message.warning('录音时间太短')
      return
    }

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
      // 恢复动态穿透
      live2dCanvasRef.value?.enablePassThrough()

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
  background: transparent;
  -webkit-app-region: no-drag;
}

/* 需要交互的元素不穿透 */
.live2d-canvas,
.context-menu,
.bubble,
.recording-toast,
.input-panel-container,
.empty-state {
  pointer-events: auto; /* 这些元素不穿透 */
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
  background: rgba(26, 26, 26, 0.95);
  backdrop-filter: blur(20px);
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
  background: rgba(26, 26, 26, 0.95);
  color: var(--color-text-primary);
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 14px;
  max-width: 600px;
  max-height: 30vh;
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-md);
  z-index: 100;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform: translateX(-50%);
}

.bubble-content {
  overflow-y: auto;
  overflow-x: hidden;
  line-height: 1.6;
  word-wrap: break-word;
  word-break: break-word;
  overscroll-behavior: contain;
  flex: 1;
  min-height: 0;

  /* Markdown 样式 */
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    margin: 12px 0 8px 0;
    font-weight: 600;
    line-height: 1.4;
    word-wrap: break-word;
  }

  :deep(h1) { font-size: 1.6em; }
  :deep(h2) { font-size: 1.4em; }
  :deep(h3) { font-size: 1.2em; }
  :deep(h4) { font-size: 1.1em; }

  :deep(p) {
    margin: 6px 0;
    word-wrap: break-word;
    word-break: break-word;
  }

  :deep(ul), :deep(ol) {
    margin: 6px 0;
    padding-left: 20px;
  }

  :deep(li) {
    margin: 3px 0;
    word-wrap: break-word;
    word-break: break-word;
  }

  :deep(code) {
    background: rgba(100, 108, 255, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.9em;
    word-break: break-all;
  }

  :deep(pre) {
    background: rgba(100, 108, 255, 0.1);
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 6px 0;
    max-width: 100%;
  }

  :deep(pre code) {
    background: none;
    padding: 0;
    word-break: normal;
  }

  :deep(blockquote) {
    border-left: 3px solid rgba(100, 108, 255, 0.5);
    padding-left: 10px;
    margin: 6px 0;
    color: var(--color-text-secondary);
    word-wrap: break-word;
  }

  :deep(a) {
    color: #646cff;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 6px 0;
    font-size: 0.9em;
  }

  :deep(th), :deep(td) {
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 6px 10px;
    text-align: left;
  }

  :deep(th) {
    background: rgba(100, 108, 255, 0.2);
    font-weight: 600;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 12px 0;
  }

  :deep(strong) {
    font-weight: 600;
    color: #fff;
  }

  :deep(em) {
    font-style: italic;
  }

  /* LaTeX 公式样式 */
  :deep(.katex) {
    font-size: 1.05em;
  }

  :deep(.katex-display) {
    margin: 12px 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  /* 滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(100, 108, 255, 0.5);
    border-radius: 3px;

    &:hover {
      background: rgba(100, 108, 255, 0.7);
    }
  }
}

.input-panel-container {
  position: absolute;
  width: 400px;
  padding: 16px;
  background: rgba(26, 26, 26, 0.95);
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  transform: translateX(-50%);

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

.recording-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;

  .recording-toast-content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 77, 79, 0.95);
    border-radius: 8px;
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 16px rgba(255, 77, 79, 0.4);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    pointer-events: auto;

    .recording-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #fff;
      animation: recording-pulse 1.5s ease-in-out infinite;
    }

    .recording-text {
      font-weight: 600;
    }

    .recording-hint {
      font-size: 12px;
      opacity: 0.85;
      margin-left: 4px;
      padding-left: 8px;
      border-left: 1px solid rgba(255, 255, 255, 0.3);
    }
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

.recording-toast-enter-active, .recording-toast-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.recording-toast-enter-from, .recording-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
