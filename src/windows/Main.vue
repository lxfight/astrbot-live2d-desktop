<template>
  <div class="main-window" @click="handleWindowClick">
    <!-- 空状态提示 -->
    <Transition name="fade">
      <div v-if="!hasModel" class="empty-state">
        <div class="empty-content">
          <div class="empty-icon">
            <Drama :size="80" />
          </div>
          <h2>欢迎使用 AstrBot Live2D</h2>
          <p>还没有导入模型，请先导入一个 Live2D 模型</p>
          <n-space vertical :size="16">
            <n-button type="primary" size="large" @click="handleImportModel">
              <template #icon>
                <FolderOpen :size="18" />
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
    <MediaPlayer
      ref="mediaPlayerRef"
      @audio-start="handleAudioStart"
      @audio-end="handleAudioEnd"
    />

    <!-- 圆形交互菜单 -->
    <Transition name="radial-menu">
      <div
        v-if="showMenu"
        class="radial-menu-container"
        :style="menuStyle"
        @click.stop
        @mouseenter="handleMenuMouseEnter"
        @mouseleave="handleMenuMouseLeave"
      >
        <!-- 中心圆点 (可选，作为视觉锚点) -->
        <div class="radial-center"></div>

        <div
          v-for="(item, index) in menuItems"
          :key="item.key"
          class="radial-menu-item"
          :style="{ ...getMenuItemStyle(index, menuItems.length), '--theme-color': themeColor }"
          @click="item.action"
        >
          <div class="menu-icon">
            <component :is="item.icon" :size="24" />
          </div>
          <span class="menu-label">{{ item.label }}</span>
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
        <div class="bubble-content" ref="bubbleContentRef">
          <div v-html="renderBubbleMarkdown(displayedText)"></div>
        </div>
      </div>
    </Transition>

    <!-- 模型状态提示 -->
    <Transition name="status-toast">
      <div
        v-if="modelStatus"
        class="model-status-toast"
        :class="modelStatus.type"
        :style="modelStatusStyle"
      >
        <div class="status-icon">
          <CheckCircle v-if="modelStatus.type === 'success'" :size="16" />
          <AlertCircle v-if="modelStatus.type === 'error'" :size="16" />
          <AlertTriangle v-if="modelStatus.type === 'warning'" :size="16" />
          <Loader2 v-if="modelStatus.type === 'loading'" :size="16" class="spin" />
          <Info v-if="modelStatus.type === 'info'" :size="16" />
        </div>
        <span>{{ modelStatus.text }}</span>
      </div>
    </Transition>

    <!-- 全局录音提示 -->
    <Transition name="recording-toast">
      <div v-if="isRecording" class="recording-toast" :style="recordingToastStyle" @click.stop>
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
        <!-- 录音提示 (悬浮) -->
        <Transition name="fade">
          <div v-if="isRecording" class="recording-indicator-floating">
            <span class="recording-dot"></span>
            <span>录音中... {{ recordingDuration }}s</span>
          </div>
        </Transition>

        <!-- 图片预览 (悬浮) -->
        <Transition name="fade">
          <div v-if="selectedImage" class="image-preview-floating">
            <img :src="selectedImage.preview" alt="Preview" />
            <button class="close-image-btn" @click="clearImage">
              <X :size="12" />
            </button>
          </div>
        </Transition>

        <!-- 玻璃拟态输入条 -->
        <div class="glass-input-bar">
          <button class="icon-btn" @click="handleSelectImage" title="发送图片">
            <ImageIcon :size="20" />
          </button>
          
          <input
            v-model="inputText"
            class="transparent-input"
            placeholder="输入消息... (Ctrl+V 粘贴)"
            @keydown.enter.exact="handleSendMessage"
            @paste="handlePasteEvent"
            ref="inputRef"
          />
          
          <div class="action-buttons">
            <button
              class="icon-btn record-btn"
              :class="{ 'recording': isRecording }"
              @mousedown="startRecording"
              @mouseup="stopRecording"
              @mouseleave="cancelRecordingIfActive"
              title="按住录音"
            >
              <component :is="isRecording ? Disc : Mic" :size="20" />
            </button>
            
            <button class="icon-btn send-btn" @click="handleSendMessage" title="发送">
              <SendHorizontal :size="20" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { useConnectionStore } from '@/stores/connection'
import { useModelStore } from '@/stores/model'
import {
  Drama, FolderOpen, ChartColumn, Settings, MessageCircle,
  Image as ImageIcon, Disc, Mic, X,
  CheckCircle, AlertCircle, Loader2, Info, AlertTriangle, SendHorizontal
} from 'lucide-vue-next'
import Live2DCanvas from '@/components/Live2D/Canvas.vue'
import MediaPlayer from '@/components/MediaPlayer.vue'
import { PerformanceQueue } from '@/utils/PerformanceQueue'
import { AudioRecorder } from '@/utils/AudioRecorder'
import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'
// @ts-ignore
import ColorThief from 'colorthief'

const connectionStore = useConnectionStore()
const modelStore = useModelStore()

const live2dCanvasRef = ref<InstanceType<typeof Live2DCanvas>>()
const mediaPlayerRef = ref<InstanceType<typeof MediaPlayer>>()
const showMenu = ref(false)
const menuStyle = ref({ left: '0px', top: '0px' })
const themeColor = ref('rgba(100, 108, 255, 0.8)') // Default accent color
let menuAutoCloseTimer: number | null = null
const currentBubble = ref<any>(null)
const bubbleStyle = ref<{ left: string; top?: string; bottom?: string }>({ left: '0px', top: '0px' })
const bubbleContentRef = ref<HTMLElement | null>(null)
const displayedText = ref('')
let typewriterTimer: any = null
let typewriterTargetText = ''
let isSwitchingText = false
let pendingTextPayload: { content: string; position: string } | null = null
let textTransitionVersion = 0

const NORMAL_TYPEWRITER_INTERVAL = 50
const FAST_TYPEWRITER_INTERVAL = 8
const MESSAGE_SWITCH_DELAY = 1000
const showInput = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const inputStyle = ref({ left: '0px', top: '0px' })
const inputText = ref('')
const currentUserName = ref('桌面用户')
const hasModel = ref(true) // 默认为 true，避免启动时闪现导入界面
const selectedImage = ref<{ file: File; preview: string } | null>(null)
const isRecording = ref(false)
const recordingDuration = ref(0)
let audioRecorder: AudioRecorder | null = null
let recordingTimer: NodeJS.Timeout | null = null
let bubbleHoverTimer: NodeJS.Timeout | null = null
const isBubbleHovered = ref(false)
let modelPositionX = window.innerWidth / 2
let modelPositionY = window.innerHeight / 2
let alwaysOnTopBeforeImport: boolean | null = null

// 模型状态提示
const modelStatus = ref<{ text: string; type: 'success' | 'error' | 'info' | 'loading' | 'warning' } | null>(null)
const modelStatusStyle = ref({ left: '0px', top: '0px' })
const recordingToastStyle = ref({ left: '0px', top: '0px' })

function showModelStatus(text: string, type: 'success' | 'error' | 'info' | 'loading' | 'warning' = 'info', duration = 3000) {
  modelStatus.value = { text, type }
  updateUIPositions()

  if (duration > 0) {
    setTimeout(() => {
      if (modelStatus.value?.text === text) {
        modelStatus.value = null
      }
    }, duration)
  }
}

// 当进入“导入模型”空状态时，不要置顶（避免挡住其他窗口）；加载到模型后恢复到原状态
watch(hasModel, async (value) => {
  try {
    if (!value) {
      if (alwaysOnTopBeforeImport === null) {
        alwaysOnTopBeforeImport = await window.electron.window.getAlwaysOnTop()
      }
      await window.electron.window.setAlwaysOnTop(false)
      await window.electron.window.setSize(600, 500)
      return
    }

    if (alwaysOnTopBeforeImport !== null) {
      await window.electron.window.setAlwaysOnTop(alwaysOnTopBeforeImport)
      alwaysOnTopBeforeImport = null
    }
    await window.electron.window.resetSize()
  } catch (error) {
    console.warn('[主窗口] 设置窗口置顶/大小状态失败:', error)
  }
})

// 监听气泡内容变化，自动滚动到底部
watch(displayedText, () => {
  nextTick(() => {
    if (bubbleContentRef.value) {
      bubbleContentRef.value.scrollTop = bubbleContentRef.value.scrollHeight
    }
  })
})

// 监听气泡关闭，重置打字机
watch(currentBubble, (val) => {
  if (!val) {
    if (typewriterTimer) {
      clearInterval(typewriterTimer)
      typewriterTimer = null
    }
    displayedText.value = ''
    typewriterTargetText = ''
    pendingTextPayload = null
    isSwitchingText = false
    textTransitionVersion++
  }
})

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

// 打字机效果
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isTypewriterRunning(): boolean {
  return Boolean(typewriterTimer) && displayedText.value.length < typewriterTargetText.length
}

function isContinuationText(text: string): boolean {
  if (!text) return false
  if (typewriterTargetText && text.startsWith(typewriterTargetText)) return true
  if (displayedText.value && text.startsWith(displayedText.value)) return true
  return false
}

function runTypewriter(text: string, intervalMs: number = NORMAL_TYPEWRITER_INTERVAL): Promise<void> {
  if (typewriterTimer) {
    clearInterval(typewriterTimer)
    typewriterTimer = null
  }

  typewriterTargetText = text

  let startIdx = 0
  if (text.startsWith(displayedText.value) && displayedText.value.length > 0) {
    startIdx = displayedText.value.length
  } else {
    displayedText.value = ''
  }

  let i = startIdx
  const len = text.length

  if (i >= len) {
    displayedText.value = text
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    typewriterTimer = setInterval(() => {
      if (i < len) {
        displayedText.value += text.charAt(i)
        i++
        return
      }

      if (typewriterTimer) {
        clearInterval(typewriterTimer)
        typewriterTimer = null
      }
      resolve()
    }, intervalMs)
  })
}

async function fastForwardCurrentText(): Promise<void> {
  if (!isTypewriterRunning() || !typewriterTargetText) {
    return
  }
  await runTypewriter(typewriterTargetText, FAST_TYPEWRITER_INTERVAL)
}

function showBubbleText(content: string, position: string) {
  currentBubble.value = { content, position }
  updateUIPositions()
  void runTypewriter(content)

  const autoHideDelay = Math.max(5000, content.length * 100)
  startBubbleHideTimer(autoHideDelay)
}

async function handleIncomingText(content: string, position: string) {
  if (isContinuationText(content) || !isTypewriterRunning()) {
    showBubbleText(content, position)
    return
  }

  pendingTextPayload = { content, position }
  if (isSwitchingText) {
    return
  }

  isSwitchingText = true
  const versionAtStart = textTransitionVersion

  try {
    await fastForwardCurrentText()
    if (versionAtStart !== textTransitionVersion) return

    await wait(MESSAGE_SWITCH_DELAY)
    if (versionAtStart !== textTransitionVersion) return
  } finally {
    isSwitchingText = false
  }

  const nextPayload = pendingTextPayload
  pendingTextPayload = null

  if (nextPayload) {
    showBubbleText(nextPayload.content, nextPayload.position)
  }
}

// Create performance queue
const performQueue = new PerformanceQueue()

// Register performance queue callbacks
performQueue.onText((content, position, _duration) => {
  void handleIncomingText(content, position)
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
    const result = await window.electron.model.selectFolder()

    if (result.canceled) {
      return
    }

    if (!result.success) {
      showModelStatus(`选择文件夹失败: ${result.error}`, 'error')
      return
    }

    // 提取模型名称（默认使用文件夹名称）
    const folderName = result.folderPath?.split(/[/\\]/).pop() || 'model'
    const modelName = folderName

    // 导入模型
    const importResult = await window.electron.model.import(result.folderPath!, modelName)

    if (!importResult.success) {
      showModelStatus(`导入模型失败: ${importResult.error}`, 'error')
      return
    }

    if (importResult.modelFiles && importResult.modelFiles.length > 1 && importResult.chosenFile) {
      showModelStatus(`检测到多个模型文件，已自动选择：${importResult.chosenFile}`, 'info')
    }

    // 加载模型，传入保存的位置（如果有）
    const savedPosition = modelStore.getModelPosition(importResult.modelPath!)
    await live2dCanvasRef.value?.loadModel(importResult.modelPath!, savedPosition || undefined)
    hasModel.value = true
    modelStore.setCurrentModel(importResult.modelPath!)

    // 如果有保存的位置，更新本地变量
    if (savedPosition) {
      console.log('[主窗口] 使用保存的模型位置:', savedPosition)
      modelPositionX = savedPosition.x
      modelPositionY = savedPosition.y
    } else {
      // 如果没有保存的位置，重置为中心
      console.log('[主窗口] 使用默认中心位置')
      modelPositionX = window.innerWidth / 2
      modelPositionY = window.innerHeight / 2
    }

    showModelStatus('模型导入成功', 'success')
  } catch (error: any) {
    showModelStatus(`导入模型失败: ${error.message}`, 'error')
  }
}

// 模型加载完成
async function handleModelLoaded() {
  console.log('[主窗口] Live2D 模型加载完成')
  hasModel.value = true
  
  // 确保位置同步
  const currentPos = live2dCanvasRef.value?.getModelPosition()
  if (currentPos) {
    modelPositionX = currentPos.x
    modelPositionY = currentPos.y
    updateUIPositions()
  }
  
  showModelStatus('模型加载成功', 'success')

  // 提取主题色
  try {
    const img = live2dCanvasRef.value?.getTextureSource()
    if (img) {
      const colorThief = new ColorThief()
      // 确保图片已加载
      if (img.complete) {
        const color = colorThief.getColor(img)
        themeColor.value = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`
      } else {
        img.addEventListener('load', () => {
          const color = colorThief.getColor(img)
          themeColor.value = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`
        })
      }
      console.log('[主窗口] 提取主题色:', themeColor.value)
    }
  } catch (error) {
    console.warn('[主窗口] 提取主题色失败:', error)
  }
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

  // 更新菜单位置
  menuStyle.value = {
    left: `${position.x + 30}px`,
    top: `${position.y + 30}px`
  }

  // 如果菜单已显示，先关闭再打开以触发动画
  if (showMenu.value) {
    showMenu.value = false
    nextTick(() => {
      showMenu.value = true
    })
  } else {
    showMenu.value = true
  }

  // 启动自动关闭定时器（3秒后自动关闭）
  startMenuAutoCloseTimer()
}

// 启动菜单自动关闭定时器
function startMenuAutoCloseTimer() {
  // 清除之前的定时器
  if (menuAutoCloseTimer !== null) {
    clearTimeout(menuAutoCloseTimer)
  }

  // 2秒后自动关闭菜单
  menuAutoCloseTimer = window.setTimeout(() => {
    showMenu.value = false
    menuAutoCloseTimer = null
  }, 2000)
}

// 清除菜单自动关闭定时器
function clearMenuAutoCloseTimer() {
  if (menuAutoCloseTimer !== null) {
    clearTimeout(menuAutoCloseTimer)
    menuAutoCloseTimer = null
  }
}

// 鼠标进入菜单
function handleMenuMouseEnter() {
  // 鼠标进入菜单时，清除自动关闭定时器
  clearMenuAutoCloseTimer()
}

// 鼠标离开菜单
function handleMenuMouseLeave() {
  // 鼠标离开菜单时，重新启动自动关闭定时器
  startMenuAutoCloseTimer()
}

// 模型位置变化（拖动时）
function handleModelPositionChanged(position: { x: number; y: number }) {
  modelPositionX = position.x
  modelPositionY = position.y
  updateUIPositions()
  // 保存模型位置
  modelStore.setModelPosition(position.x, position.y)
}

// 更新 UI 元素位置（跟随模型）
function updateUIPositions() {
  // 更新气泡位置（模型头顶上方 250px，避免遮挡模型）
  if (currentBubble.value) {
    bubbleStyle.value = {
      left: `${modelPositionX}px`,
      bottom: `calc(100vh - ${modelPositionY - 200}px)`
    }
  }

  // 更新状态提示位置（模型头顶上方 280px）
  if (modelStatus.value) {
    modelStatusStyle.value = {
      left: `${modelPositionX}px`,
      top: `${modelPositionY - 280}px`
    }
  }

  // 更新录音提示位置（模型头顶上方 330px）
  if (isRecording.value) {
    recordingToastStyle.value = {
      left: `${modelPositionX}px`,
      top: `${modelPositionY - 330}px`
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
    target.closest('.radial-menu-container') ||
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
    clearMenuAutoCloseTimer()
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
  clearMenuAutoCloseTimer()
  await window.electron.window.openHistory()
}

// 打开设置窗口
async function openSettings() {
  showMenu.value = false
  clearMenuAutoCloseTimer()
  await window.electron.window.openSettings()
}

// 打开输入框
function openInput() {
  showMenu.value = false
  clearMenuAutoCloseTimer()
  showInput.value = true
  inputText.value = ''
  selectedImage.value = null
  updateUIPositions()
  // 禁用动态穿透，让整个窗口可以接收点击事件
  live2dCanvasRef.value?.disablePassThrough()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 菜单配置
const menuItems = [
  { key: 'history', icon: ChartColumn, label: '历史', action: openHistory },
  { key: 'settings', icon: Settings, label: '设置', action: openSettings },
  { key: 'talk', icon: MessageCircle, label: '对话', action: openInput }
]

const MENU_RADIUS = 100

function getMenuItemStyle(index: number, total: number) {
  // 从 -90 度（正上方）开始
  const startAngle = -90
  const angleStep = 360 / total
  const angle = startAngle + index * angleStep
  const radian = (angle * Math.PI) / 180

  const x = Math.cos(radian) * MENU_RADIUS
  const y = Math.sin(radian) * MENU_RADIUS

  return {
    '--tx': `${x}px`,
    '--ty': `${y}px`,
    '--delay': `${index * 0.05}s`
  }
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
      showModelStatus('图片大小不能超过 10MB', 'warning')
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
    showModelStatus('您的浏览器不支持录音功能', 'error')
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
    showModelStatus(`录音失败: ${error.message}`, 'error')
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
      showModelStatus('录音时间太短', 'warning')
      return
    }

    // 检查连接状态
    if (!connectionStore.isConnected) {
      showModelStatus('未连接到服务器', 'error')
      return
    }

    // 发送音频消息
    await sendAudioMessage(audioBlob)

  } catch (error: any) {
    showModelStatus(`停止录音失败: ${error.message}`, 'error')
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
    showModelStatus('正在发送语音...', 'info')

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
      userName: currentUserName.value || '桌面用户',
      sessionId: connectionStore.sessionId,
      messageType: 'friend'
    })

    if (result.success) {
      showModelStatus('语音已发送', 'success')

      // 保存语音消息记录
      try {
        await window.electron.history.saveMessage({
          messageId: `msg_${Date.now()}`,
          sessionId: connectionStore.sessionId || 'default',
          userId: connectionStore.userId || 'desktop-user',
          userName: currentUserName.value || '桌面用户',
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
      showModelStatus(`发送失败: ${result.error}`, 'error')
    }
  } catch (error: any) {
    showModelStatus(`发送失败: ${error.message}`, 'error')
  }
}

// 处理音频开始播放（启动口型同步）
function handleAudioStart(audioElement: HTMLAudioElement) {
  console.log('[主窗口] 音频开始播放，启动口型同步')
  live2dCanvasRef.value?.startLipSync(audioElement)
}

// 处理音频播放结束
function handleAudioEnd() {
  console.log('[主窗口] 音频播放结束')
}

// 发送消息
async function handleSendMessage() {
  if (!inputText.value.trim() && !selectedImage.value) return

  if (!connectionStore.isConnected) {
    showModelStatus('未连接到服务器', 'error')
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
        showModelStatus('正在处理图片...', 'info')
        const base64 = await fileToBase64(file)
        content.push({ type: 'image', inline: base64 })
      }
    }

    const result = await connectionStore.sendMessage(content, {
      userId: connectionStore.userId || 'desktop-user',
      userName: currentUserName.value || '桌面用户',
      sessionId: connectionStore.sessionId,
      messageType: 'friend'
    })

    if (result.success) {
      showModelStatus('消息已发送', 'success')
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
          userName: currentUserName.value || '桌面用户',
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
      showModelStatus(`发送失败: ${result.error}`, 'error')
    }
  } catch (error: any) {
    showModelStatus(`发送失败: ${error.message}`, 'error')
  }
}

// 监听表演指令
onMounted(async () => {
  // 获取用户名称
  try {
    const name = await window.electron.user.getUserName()
    if (name) {
      currentUserName.value = name
    }
  } catch (error) {
    console.error('[主窗口] 获取用户名称失败:', error)
  }

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
      // 获取保存的位置并传入 loadModel
      const savedPosition = modelStore.getModelPosition(modelPath)
      await live2dCanvasRef.value?.loadModel(modelPath, savedPosition || undefined)
      hasModel.value = true
      modelStore.setCurrentModel(modelPath)

      // 如果有保存的位置，更新本地变量
      if (savedPosition) {
        console.log('[主窗口] 使用保存的模型位置:', savedPosition)
        modelPositionX = savedPosition.x
        modelPositionY = savedPosition.y
      } else {
        // 如果没有保存的位置，重置为中心
        console.log('[主窗口] 使用默认中心位置')
        modelPositionX = window.innerWidth / 2
        modelPositionY = window.innerHeight / 2
      }

      // 不在这里显示提示，由 handleModelLoaded 统一处理
    } catch (error: any) {
      showModelStatus(`模型加载失败: ${error.message}`, 'error')
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
    showModelStatus('已连接到服务器', 'success')
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
    showModelStatus('已断开连接', 'warning')
    console.log('断开信息:', info)

    // 更新连接状态
    connectionStore.isConnected = false
    connectionStore.sessionId = ''
    connectionStore.userId = ''
  })

  window.electron.bridge.onError((error: any) => {
    showModelStatus(`连接错误: ${error.message || error}`, 'error')
  })

  // 检查初始连接状态
  await connectionStore.checkConnection()

  // 自动连接功能
  const advancedSettingsStr = localStorage.getItem('advancedSettings')
  let shouldAutoConnect = true // 默认为 true

  if (advancedSettingsStr) {
    try {
      const settings = JSON.parse(advancedSettingsStr)
      if (settings.autoConnect !== undefined) {
        shouldAutoConnect = settings.autoConnect
      }
    } catch (error) {
      console.error('[主窗口] 解析自动连接配置失败:', error)
    }
  }

  if (shouldAutoConnect && !connectionStore.isConnected) {
    console.log('[主窗口] 启动时自动连接')
    const result = await connectionStore.connect()
    if (result.success) {
      console.log('[主窗口] 自动连接成功')
    } else {
      console.warn('[主窗口] 自动连接失败:', result.error)
    }
  }

  // 自动加载上次使用的模型
  const lastModelPath = modelStore.getLastModel()
  if (lastModelPath) {
    console.log('[主窗口] 自动加载上次模型:', lastModelPath)

    try {
      // 获取保存的位置并传入 loadModel
      const savedPosition = modelStore.getModelPosition(lastModelPath)
      await live2dCanvasRef.value?.loadModel(lastModelPath, savedPosition || undefined)
      modelStore.setCurrentModel(lastModelPath)
      console.log('[主窗口] 自动加载成功')

      // 如果有保存的位置，更新本地变量
      if (savedPosition) {
        console.log('[主窗口] 使用保存的模型位置:', savedPosition)
        modelPositionX = savedPosition.x
        modelPositionY = savedPosition.y
      }
    } catch (error: any) {
      console.warn('[主窗口] 自动加载失败:', error.message)
      // 自动加载失败，显示导入提示
      hasModel.value = false
    }
  } else {
    // 没有上次使用的模型，显示导入提示
    hasModel.value = false
  }

  // 自动注册全局快捷键
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
  /* 导入界面背景保持透明，避免遮挡桌面 */
  background: transparent;
  z-index: 10;

  .empty-content {
    text-align: center;
    padding: 44px 48px;
    background: rgba(26, 26, 26, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 12px 50px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(18px);
    max-width: 520px;

    .empty-icon {
      margin-bottom: 24px;
      color: var(--color-text-secondary);
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

.radial-menu-container {
  position: fixed;
  width: 0;
  height: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 允许鼠标穿透容器本身，只拦截子元素 */
  pointer-events: none;

  .radial-center {
    position: absolute;
    width: 10px;
    height: 10px;
    background: rgba(100, 108, 255, 0.5);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    opacity: 0; /* 默认隐藏，调试时可开启 */
  }

  .radial-menu-item {
    position: absolute;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--theme-color, rgba(26, 26, 26, 0.9));
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto; /* 恢复点击 */

    /* 使用 CSS 变量控制位置 */
    transform: translate(-50%, -50%) translate(var(--tx), var(--ty));
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay),
                background 0.3s,
                box-shadow 0.3s;

    .menu-icon {
      color: #fff;
      display: flex;
      transition: transform 0.3s;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }

    .menu-label {
      position: absolute;
      top: 100%;
      margin-top: 8px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s;
      white-space: nowrap;
      pointer-events: none;
    }

    &:hover {
      background: var(--theme-color);
      filter: brightness(1.2);
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
      z-index: 10;

      .menu-icon {
        transform: scale(1.2);
      }

      .menu-label {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
}

/* 进场/离场动画 */
.radial-menu-enter-active,
.radial-menu-leave-active {
  transition: opacity 0.3s;
}

.radial-menu-enter-from,
.radial-menu-leave-to {
  opacity: 0;

  .radial-menu-item {
    /* 收缩回中心，并带有旋转 */
    transform: translate(-50%, -50%) translate(0, 0) rotate(-180deg) scale(0);
  }
}

.radial-menu-enter-to,
.radial-menu-leave-from {
  opacity: 1;
  /* 恢复默认 transform (由 inline style 定义) */
}

.bubble {
  position: absolute;
  background: rgba(26, 26, 26, 0.95);
  color: var(--color-text-primary);
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 14px;
  max-width: 450px;
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
  width: 420px;
  z-index: 200;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: transparent;
  pointer-events: none; /* Container passes clicks, children catch them */
}

.input-panel-container > * {
  pointer-events: auto;
}

.glass-input-bar {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: rgba(20, 20, 20, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 25px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.glass-input-bar:focus-within {
  background: rgba(20, 20, 20, 0.8);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.transparent-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 14px;
  height: 100%;
}

.transparent-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.icon-btn:active {
  transform: scale(0.95);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.record-btn.recording {
  color: #ff4d4f;
  animation: pulse-red 1.5s infinite;
}

.send-btn {
  color: #4096ff;
}

.send-btn:hover {
  background: rgba(64, 150, 255, 0.1);
  color: #69b1ff;
}

.recording-indicator-floating {
  background: rgba(255, 77, 79, 0.9);
  padding: 6px 12px;
  border-radius: 20px;
  color: white;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  backdrop-filter: blur(4px);
  
  .recording-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    animation: recording-pulse 1.5s ease-in-out infinite;
  }
}

.image-preview-floating {
  position: relative;
  background: rgba(0,0,0,0.5);
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 4px;
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(4px);
}

.image-preview-floating img {
  max-height: 100px;
  max-width: 200px;
  border-radius: 4px;
  display: block;
}

.close-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ff4d4f;
  border: 2px solid rgba(255,255,255,0.8);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

@keyframes pulse-red {
  0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(255, 77, 79, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
}

.recording-toast {
  position: absolute;
  /* top is controlled by inline style */
  left: 50%; /* Initial center, also controlled by inline style */
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



.bubble-enter-active, .bubble-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.bubble-enter-from, .bubble-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px) scale(0.9);
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

.model-status-toast {
  position: absolute;
  padding: 8px 16px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 1000;
  pointer-events: none;
  transform: translateX(-50%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-size: 14px;
  white-space: nowrap;

  &.success { background: rgba(82, 196, 26, 0.9); }
  &.error { background: rgba(255, 77, 79, 0.9); }
  &.warning { background: rgba(250, 173, 20, 0.9); }
  &.loading { background: rgba(24, 144, 255, 0.9); }
  &.info { background: rgba(0, 0, 0, 0.8); }

  .status-icon {
    display: flex;
    align-items: center;
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-toast-enter-active, .status-toast-leave-active {
  transition: all 0.3s ease;
}

.status-toast-enter-from, .status-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
