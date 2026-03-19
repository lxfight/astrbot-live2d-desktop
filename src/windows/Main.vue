<template>
  <div class="main-window" :style="mainWindowStyle" @click="handleWindowClick">
    <div class="main-stage-ambient" aria-hidden="true">
      <span class="ambient-orb ambient-orb--primary"></span>
      <span class="ambient-orb ambient-orb--secondary"></span>
    </div>

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
          :style="{
            ...getMenuItemStyle(index, menuItems.length),
            '--theme-color': menuThemeColor,
            '--theme-color-hover': menuThemeColorHover,
          }"
          @click="item.action"
        >
          <div class="menu-icon">
            <component :is="item.icon" :size="24" />
          </div>
          <span class="menu-label">{{ item.label }}</span>
        </div>
      </div>
    </Transition>

    <!-- 气泡栈：最多 3 个，从下往上堆叠，独立生命周期 -->
    <TransitionGroup name="bubble" tag="div" class="bubble-stack-host">
      <div
        v-for="(entry, i) in bubbleStack"
        :key="entry.id"
        :ref="(el) => setBubbleEl(entry.id, el as HTMLElement | null)"
        class="bubble"
        :class="bubbleTierClass(bubbleStack.length - 1 - i)"
        :style="{
          left: entry.styleLeft,
          top: entry.styleTop,
          '--bubble-offset-x': entry.offsetX + 'px',
          maxHeight: entry.styleMaxHeight || undefined,
        }"
        @click.stop
        @mouseenter="handleBubbleMouseEnter(entry)"
        @mouseleave="handleBubbleMouseLeave(entry)"
      >
        <div
          class="bubble-content"
          :ref="(el) => setBubbleContentEl(entry.id, el as HTMLElement | null)"
        >
          <div
            v-for="item in entry.items"
            :key="item.id"
            :class="['bubble-item', `bubble-item-${item.type}`]"
          >
            <div
              v-if="item.type === 'text'"
              class="bubble-text"
              v-html="renderBubbleMarkdown(item.renderedText)"
            ></div>
            <div v-else-if="item.type === 'image'" class="bubble-image">
              <img :src="item.src" :alt="item.alt" @load="handleBubbleMediaLoad(entry.id)" />
            </div>
          </div>
        </div>
      </div>
    </TransitionGroup>

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
          <span class="recording-hint">{{ recordingHintText }}</span>
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
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConnectionStore } from '@/stores/connection'
import { useModelStore } from '@/stores/model'
import { useThemeStore } from '@/stores/theme'
import {
  Drama, FolderOpen, ChartColumn, Settings, MessageCircle,
  Image as ImageIcon, Disc, Mic, X,
  CheckCircle, AlertCircle, Loader2, Info, AlertTriangle, SendHorizontal
} from 'lucide-vue-next'
import Live2DCanvas from '@/components/Live2D/Canvas.vue'
import MediaPlayer from '@/components/MediaPlayer.vue'
import { PerformanceQueue } from '@/utils/PerformanceQueue'
import { AudioRecorder } from '@/utils/AudioRecorder'
import {
  ADVANCED_SETTINGS_KEY,
  clampMaxRecordingSeconds,
  loadAdvancedSettings,
  type AdvancedSettings
} from '@/utils/advancedSettings'
import {
  computeBubbleAutoHideDelay,
  resolvePerformMediaSource,
  splitPerformSequenceForBubble,
  type BubbleRenderableItem,
} from '@/utils/bubbleContent'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { withAlpha } from '@/utils/themePalette'
import { extractModelThemeColor } from '@/utils/modelTheme'

type BubbleTextItem = {
  id: string
  type: 'text'
  fullText: string
  renderedText: string
}

type BubbleImageItem = {
  id: string
  type: 'image'
  src: string
  alt: string
}

type BubbleItem = BubbleTextItem | BubbleImageItem

// 气泡栈条目，每个条目独立维护打字机状态和生命周期
type BubbleEntry = {
  id: string
  items: BubbleItem[]
  offsetX: number        // 随机水平偏移 px（±30px）
  typingIdx: number      // 下一个待打字的 item 下标
  typingVer: number      // 递增取消令牌，与打字协程绑定
  typingDone: boolean    // 所有 item 打字完成
  hideTimerId: number | null
  pinned: boolean        // 鼠标悬停，抑制自动隐藏
  styleLeft: string
  styleTop: string
  styleMaxHeight: string // 动态 max-height，空字符串时使用 CSS 默认值
}

const connectionStore = useConnectionStore()
const modelStore = useModelStore()
const themeStore = useThemeStore()
const { palette, sourceRgb } = storeToRefs(themeStore)

const live2dCanvasRef = ref<InstanceType<typeof Live2DCanvas>>()
const mediaPlayerRef = ref<InstanceType<typeof MediaPlayer>>()

let audioEndResolvers: Array<() => void> = []

function waitForNextAudioEnd(): Promise<void> {
  return new Promise((resolve) => {
    audioEndResolvers.push(resolve)
  })
}
const showMenu = ref(false)
const menuStyle = ref({ left: '0px', top: '0px' })
const menuThemeColor = computed(() => withAlpha(palette.value.accent, 0.14))
const menuThemeColorHover = computed(() => withAlpha(palette.value.accent, 0.24))
const themeRgb = computed(() => sourceRgb.value)
const mainWindowStyle = computed(() => ({
  '--model-r': themeRgb.value.r,
  '--model-g': themeRgb.value.g,
  '--model-b': themeRgb.value.b,
  '--model-color': `rgb(${themeRgb.value.r}, ${themeRgb.value.g}, ${themeRgb.value.b})`,
  '--model-color-soft': `rgba(${themeRgb.value.r}, ${themeRgb.value.g}, ${themeRgb.value.b}, 0.15)`,
  '--model-color-glow': `rgba(${themeRgb.value.r}, ${themeRgb.value.g}, ${themeRgb.value.b}, 0.35)`,
}))
let menuAutoCloseTimer: number | null = null
// 气泡栈：index 0 = 最老（顶部），index length-1 = 最新（底部）
const bubbleStack = ref<BubbleEntry[]>([])
// DOM 元素引用（非响应式 Map，通过 :ref 回调维护）
const bubbleElMap = new Map<string, HTMLElement>()
const bubbleContentElMap = new Map<string, HTMLElement>()
// 追踪上次收到表演包的时间，用于判断追加消息
let lastPerformReceiveTime = 0

const NORMAL_TYPEWRITER_INTERVAL = 50
const TYPEWRITER_LAYOUT_UPDATE_INTERVAL_CHARS = 4
const BUBBLE_EDGE_PADDING = 16
const BUBBLE_VERTICAL_OFFSET = 200
const BUBBLE_GAP = 10          // 堆叠气泡间距 px
const BUBBLE_STACK_MAX = 3     // 最大气泡数量
const FOLLOW_UP_WINDOW_MS = 4000  // 追加消息时间窗口 ms
const showInput = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const inputStyle = ref<FloatingOverlayStyle>({ left: '0px', top: '0px' })
const inputText = ref('')
const currentUserName = ref('桌面用户')
const hasModel = ref(true) // 默认为 true，避免启动时闪现导入界面
const selectedImage = ref<{ file: File; preview: string } | null>(null)
const loadingModelPath = ref('')
type RecordingSource = 'manual' | 'shortcut'
type StopReason = 'manual' | 'shortcut' | 'max-duration'
type FloatingOverlayStyle = {
  left: string
  top?: string
  bottom?: string
}
let themeExtractionRevision = 0

const isRecording = ref(false)
const recordingDuration = ref(0)
const currentRecordingSource = ref<RecordingSource>('manual')
const recordingHintText = computed(() => {
  if (currentRecordingSource.value === 'shortcut') {
    return '再次按下快捷键停止'
  }

  return '点击麦克风按钮停止'
})

const advancedSettings = ref<AdvancedSettings>(loadAdvancedSettings())
let messageIdSequence = 0

function generateMessageId(prefix = 'msg'): string {
  messageIdSequence += 1
  const randomSegment = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${messageIdSequence}_${randomSegment}`
}

let audioRecorder: AudioRecorder | null = null
let recordingTimer: NodeJS.Timeout | null = null
let isStoppingRecording = false
let modelPositionX = window.innerWidth / 2
let modelPositionY = window.innerHeight / 2
let alwaysOnTopBeforeImport: boolean | null = null
const PLATFORM_COMPATIBILITY_HINT_KEY = 'platformCompatibilityHintShown'

// 模型状态提示
type ModelStatusType = 'success' | 'error' | 'info' | 'loading' | 'warning'
const modelStatus = ref<{ text: string; type: ModelStatusType } | null>(null)
const modelStatusStyle = ref<FloatingOverlayStyle>({ left: '0px', top: '0px' })
const recordingToastStyle = ref<FloatingOverlayStyle>({ left: '0px', top: '0px' })

function showModelStatus(text: string, type: ModelStatusType = 'info', duration = 3000) {
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

function showBaseEventStatus(text: string, type: ModelStatusType = 'info', duration = 3000) {
  if (!advancedSettings.value.showBaseEventNotifications) {
    return
  }

  showModelStatus(text, type, duration)
}

function showPlatformCompatibilityHint(capabilities: PlatformCapabilities): void {
  if (sessionStorage.getItem(PLATFORM_COMPATIBILITY_HINT_KEY) === '1') {
    return
  }

  let hint: { text: string; type: ModelStatusType; duration: number } | null = null

  if (capabilities.platform === 'linux') {
    hint = capabilities.linuxSessionType === 'wayland'
      ? {
          text: '当前为 Linux Wayland 会话：动态穿透已禁用，自动检测全屏应用不可用。',
          type: 'warning',
          duration: 5200,
        }
      : {
          text: '当前为 Linux 会话：动态穿透已降级为基础穿透，自动更新需手动下载。',
          type: 'info',
          duration: 4800,
        }
  }

  if (!hint) {
    return
  }

  sessionStorage.setItem(PLATFORM_COMPATIBILITY_HINT_KEY, '1')
  showModelStatus(hint.text, hint.type, hint.duration)
}

// 当进入“导入模型”空状态时，不要置顶（避免挡住其他窗口）；加载到模型后恢复到原状态
watch(hasModel, async (value) => {
  try {
    if (!value) {
      if (alwaysOnTopBeforeImport === null) {
        alwaysOnTopBeforeImport = await window.electron.window.getAlwaysOnTop()
      }
      await window.electron.window.setIgnoreMouseEvents(false)
      live2dCanvasRef.value?.disablePassThrough()
      await window.electron.window.setAlwaysOnTop(false)
      await window.electron.window.setSize(600, 500)
      return
    }

    if (alwaysOnTopBeforeImport !== null) {
      await window.electron.window.setAlwaysOnTop(alwaysOnTopBeforeImport)
      alwaysOnTopBeforeImport = null
    }
    await window.electron.window.setIgnoreMouseEvents(false)
    live2dCanvasRef.value?.enablePassThrough()
    await window.electron.window.resetSize()
  } catch (error) {
    console.warn('[主窗口] 设置窗口置顶/大小状态失败:', error)
  }
})

// 气泡栈变化时重新计算堆叠位置
watch(bubbleStack, () => {
  nextTick(() => updateStackPositions())
}, { deep: false })

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
    const renderedHtml = marked.parse(text) as string
    return DOMPurify.sanitize(renderedHtml, {
      USE_PROFILES: { html: true },
      ALLOW_DATA_ATTR: false
    })
  } catch (error) {
    console.error('[Main] Markdown渲染失败:', error)
    return text
  }
}

// ─── 气泡栈辅助函数 ───────────────────────────────────────────────────────────

function setBubbleEl(id: string, el: HTMLElement | null) {
  if (el) {
    bubbleElMap.set(id, el)
  } else {
    bubbleElMap.delete(id)
  }
}

function setBubbleContentEl(id: string, el: HTMLElement | null) {
  if (el) {
    bubbleContentElMap.set(id, el)
  } else {
    bubbleContentElMap.delete(id)
  }
}

// 返回气泡层级 CSS 类名（0=最新/底部，1=上一层，2=更上层）
function bubbleTierClass(tier: number): string {
  if (tier === 0) return 'bubble-tier-0'
  if (tier === 1) return 'bubble-tier-1'
  return 'bubble-tier-2'
}

function scheduleBubbleLayoutUpdate() {
  nextTick(() => {
    updateStackPositions()
    // 滚动最新气泡内容到底部
    const stack = bubbleStack.value
    if (stack.length > 0) {
      const el = bubbleContentElMap.get(stack[stack.length - 1].id)
      if (el) el.scrollTop = el.scrollHeight
    }
  })
}

function handleBubbleMediaLoad(entryId: string) {
  nextTick(() => {
    updateStackPositions()
    const el = bubbleContentElMap.get(entryId)
    if (el) el.scrollTop = el.scrollHeight
  })
}

function createBubbleItems(items: BubbleRenderableItem[]): BubbleItem[] {
  return items.map((item) => {
    if (item.type === 'text') {
      return {
        id: generateMessageId('bubble_text'),
        type: 'text' as const,
        fullText: item.text,
        renderedText: '',
      }
    }
    return {
      id: generateMessageId('bubble_image'),
      type: 'image' as const,
      src: item.src,
      alt: item.alt,
    }
  })
}

// ─── 堆叠定位 ────────────────────────────────────────────────────────────────

// 各层级 CSS max-height 对应的 vh 系数（须与 CSS 保持一致）
const TIER_VH_FACTORS = [0.40, 0.32, 0.24]

function getTierCSSMaxHeight(tier: number, vh: number): number {
  const factor = TIER_VH_FACTORS[Math.min(tier, 2)]
  return Math.min(factor * vh, vh - 32)
}

function resolveModelOverlayAnchor() {
  const modelBounds = live2dCanvasRef.value?.getModelBounds?.()
  if (modelBounds) {
    const anchorX = (modelBounds.left + modelBounds.right) / 2
    const statusTop = Math.max(18, modelBounds.top - 56)
    const recordingTop = Math.max(18, statusTop - 52)
    const inputTop = Math.min(modelBounds.bottom + 22, window.innerHeight - 76)

    return {
      anchorX,
      statusTop,
      recordingTop,
      inputTop,
    }
  }

  return {
    anchorX: modelPositionX,
    statusTop: Math.max(18, modelPositionY - 280),
    recordingTop: Math.max(18, modelPositionY - 330),
    inputTop: Math.min(modelPositionY + 150, window.innerHeight - 76),
  }
}

function waitForImageReady(image: HTMLImageElement): Promise<void> {
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const finalize = () => {
      image.removeEventListener('load', finalize)
      image.removeEventListener('error', finalize)
      resolve()
    }

    image.addEventListener('load', finalize, { once: true })
    image.addEventListener('error', finalize, { once: true })
  })
}

function rgbToHexString(rgb: { r: number; g: number; b: number }): string {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
    .join('')}`
}

async function extractAndApplyModelTheme(modelPath: string) {
  const extractionRevision = ++themeExtractionRevision
  const textureSources = live2dCanvasRef.value?.getTextureSources?.() || []

  if (!textureSources.length) {
    return
  }

  const images = textureSources.slice(0, 6)
  await Promise.all(images.map(waitForImageReady))

  if (extractionRevision !== themeExtractionRevision) {
    return
  }

  const extractedColor = extractModelThemeColor(images)
  if (!extractedColor) {
    return
  }

  themeStore.applyModelTheme({
    modelPath,
    rgb: extractedColor,
  })
  console.log('[主窗口] 提取主题色:', rgbToHexString(extractedColor))
}

function updateStackPositions() {
  const stack = bubbleStack.value
  if (!stack.length) return

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const anchorX = modelPositionX
  const usableHeight = viewportHeight - 2 * BUBBLE_EDGE_PADDING

  // 测量每个气泡的自然高度（scrollHeight 不受 max-height 约束）
  const data = stack.map((entry, i) => {
    const el = bubbleElMap.get(entry.id)
    const contentEl = bubbleContentElMap.get(entry.id)
    const tier = stack.length - 1 - i
    const cssMaxH = getTierCSSMaxHeight(tier, viewportHeight)
    const contentScrollH = contentEl?.scrollHeight ?? 56
    // 自然高度 = 内容高度 + 气泡 padding，再不超过 CSS 层级上限
    const naturalH = Math.min(contentScrollH + 24, cssMaxH)
    return {
      entry,
      naturalHeight: naturalH,
      width: el?.offsetWidth ?? 300,
    }
  })

  const totalGaps = Math.max(0, stack.length - 1) * BUBBLE_GAP
  const totalNaturalHeight = data.reduce((s, d) => s + d.naturalHeight, 0) + totalGaps
  const idealAnchor = modelPositionY - BUBBLE_VERTICAL_OFFSET

  let anchorBottom: number
  let finalHeights: number[]

  if (totalNaturalHeight <= idealAnchor - BUBBLE_EDGE_PADDING) {
    anchorBottom = idealAnchor
    finalHeights = data.map(d => d.naturalHeight)
    for (const d of data) d.entry.styleMaxHeight = ''
  } else if (totalNaturalHeight <= usableHeight) {
    anchorBottom = BUBBLE_EDGE_PADDING + totalNaturalHeight
    finalHeights = data.map(d => d.naturalHeight)
    for (const d of data) d.entry.styleMaxHeight = ''
  } else {
    anchorBottom = viewportHeight - BUBBLE_EDGE_PADDING
    const usableForBubbles = Math.max(0, usableHeight - totalGaps)
    const totalNatural = data.reduce((s, d) => s + d.naturalHeight, 0)
    const scale = totalNatural > 0 ? usableForBubbles / totalNatural : 1
    const MIN_BUBBLE_H = 60
    finalHeights = data.map(d => Math.max(MIN_BUBBLE_H, Math.floor(d.naturalHeight * scale)))
    for (let i = 0; i < data.length; i++) {
      data[i].entry.styleMaxHeight = `${finalHeights[i]}px`
    }
  }

  // 从最新（底部）往最老（顶部）依次放置，绝不重叠
  let currentBottom = anchorBottom
  for (let i = data.length - 1; i >= 0; i--) {
    const { entry, width: elW } = data[i]
    const elH = finalHeights[i]
    const halfW = elW / 2
    const minLeft = BUBBLE_EDGE_PADDING + halfW
    const maxLeft = viewportWidth - BUBBLE_EDGE_PADDING - halfW
    const rawLeft = anchorX + entry.offsetX
    const clampedLeft = Math.min(Math.max(rawLeft, minLeft), maxLeft)

    entry.styleLeft = `${clampedLeft}px`
    entry.styleTop = `${currentBottom - elH}px`
    currentBottom = currentBottom - elH - BUBBLE_GAP
  }
}

// ─── 独立打字机 ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function typeItemChars(item: BubbleTextItem, entry: BubbleEntry, localVer: number) {
  let idx = item.renderedText.length
  let sinceLayout = 0

  while (idx < item.fullText.length) {
    if (entry.typingVer !== localVer) return
    item.renderedText += item.fullText.charAt(idx)
    idx++
    sinceLayout++
    if (sinceLayout >= TYPEWRITER_LAYOUT_UPDATE_INTERVAL_CHARS || idx >= item.fullText.length) {
      sinceLayout = 0
      scheduleBubbleLayoutUpdate()
    }
    await sleep(NORMAL_TYPEWRITER_INTERVAL)
  }
}

async function runEntryTypewriter(entry: BubbleEntry) {
  const localVer = entry.typingVer

  while (entry.typingIdx < entry.items.length) {
    if (entry.typingVer !== localVer) return
    const item = entry.items[entry.typingIdx]
    entry.typingIdx++

    if (item.type === 'text') {
      await typeItemChars(item as BubbleTextItem, entry, localVer)
    } else {
      scheduleBubbleLayoutUpdate()
    }
    if (entry.typingVer !== localVer) return
  }

  // 所有 item 打字完成
  if (entry.typingVer === localVer) {
    entry.typingDone = true
    startEntryHideTimer(entry)
  }
}

// 强制冻结条目（将所有文本跳到最终状态，取消打字机）
function freezeEntry(entry: BubbleEntry) {
  entry.typingVer++  // 取消正在运行的打字协程
  for (const item of entry.items) {
    if (item.type === 'text') {
      (item as BubbleTextItem).renderedText = (item as BubbleTextItem).fullText
    }
  }
  entry.typingDone = true
}

// ─── 自动隐藏 ─────────────────────────────────────────────────────────────────

function computeEntryAutoHideDelay(entry: BubbleEntry): number {
  return computeBubbleAutoHideDelay(
    entry.items.map((item) => {
      if (item.type === 'text') return { type: 'text' as const, text: (item as BubbleTextItem).fullText }
      return { type: 'image' as const, src: (item as BubbleImageItem).src, alt: (item as BubbleImageItem).alt }
    })
  )
}

function startEntryHideTimer(entry: BubbleEntry) {
  if (entry.pinned) return  // 悬停时不启动
  if (entry.hideTimerId !== null) clearTimeout(entry.hideTimerId)
  const delay = computeEntryAutoHideDelay(entry)
  entry.hideTimerId = window.setTimeout(() => {
    removeEntry(entry.id)
  }, delay)
}

function removeEntry(id: string) {
  const idx = bubbleStack.value.findIndex((e) => e.id === id)
  if (idx === -1) return
  const entry = bubbleStack.value[idx]
  if (entry.hideTimerId !== null) clearTimeout(entry.hideTimerId)
  entry.typingVer++  // 取消打字协程
  bubbleStack.value.splice(idx, 1)
}

function clearAllBubbles() {
  for (const entry of bubbleStack.value) {
    if (entry.hideTimerId !== null) clearTimeout(entry.hideTimerId)
    entry.typingVer++
  }
  bubbleStack.value = []
}

// ─── 鼠标交互 ─────────────────────────────────────────────────────────────────

function handleBubbleMouseEnter(entry: BubbleEntry) {
  entry.pinned = true
  if (entry.hideTimerId !== null) {
    clearTimeout(entry.hideTimerId)
    entry.hideTimerId = null
  }
}

function handleBubbleMouseLeave(entry: BubbleEntry) {
  entry.pinned = false
  if (entry.typingDone) {
    // 离开后 3s 隐藏
    entry.hideTimerId = window.setTimeout(() => removeEntry(entry.id), 3000)
  }
}

// ─── 主入口：推入新气泡 ───────────────────────────────────────────────────────

function pushBubble(bubbleItems: BubbleRenderableItem[], _position: string, interrupt: boolean) {
  if (!bubbleItems.length) return

  if (interrupt) {
    clearAllBubbles()
  }

  // 超过最大数量时驱逐最老的
  if (bubbleStack.value.length >= BUBBLE_STACK_MAX) {
    const oldest = bubbleStack.value[0]
    freezeEntry(oldest)
    bubbleStack.value.splice(0, 1)
  }

  const runtimeItems = createBubbleItems(bubbleItems)
  const offsetX = Math.round((Math.random() - 0.5) * 50)  // ±25px 随机偏移
  const entry: BubbleEntry = {
    id: generateMessageId('bubble'),
    items: runtimeItems,
    offsetX,
    typingIdx: 0,
    typingVer: 0,
    typingDone: false,
    hideTimerId: null,
    pinned: false,
    styleLeft: '0px',
    styleTop: '0px',
    styleMaxHeight: '',
  }

  bubbleStack.value.push(entry)
  // push 后必须从数组取响应式代理，否则修改 renderedText 不触发重渲染
  const reactiveEntry = bubbleStack.value[bubbleStack.value.length - 1]
  nextTick(() => {
    updateStackPositions()
    void runEntryTypewriter(reactiveEntry)
  })
}

// Create performance queue
const performQueue = new PerformanceQueue()

// Register performance queue callbacks
performQueue.onText((content, position, _duration) => {
  pushBubble([{ type: 'text', text: content }], position, false)
})

performQueue.onMotion((group, index, priority) => {
  live2dCanvasRef.value?.playMotion(group, index, priority)
})

performQueue.onExpression((id) => {
  live2dCanvasRef.value?.setExpression(id)
})

performQueue.onAudio((url, volume) => {
  const mediaPlayer = mediaPlayerRef.value
  if (!mediaPlayer) return

  const audioEndPromise = waitForNextAudioEnd()
  void mediaPlayer.playAudio(url, volume)
  return audioEndPromise
})

performQueue.onImage((url, _duration) => {
  const resolvedSrc = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')
    ? url
    : resolvePerformMediaSource({ rid: url }, {
        resourceBaseUrl: connectionStore.resourceBaseUrl,
        resourcePath: connectionStore.resourcePath,
        resourceToken: connectionStore.resourceToken,
      })

  if (!resolvedSrc) {
    return
  }

  pushBubble([{ type: 'image', src: resolvedSrc, alt: 'AstrBot message image' }], 'center', false)
})

performQueue.onVideo((url) => {
  mediaPlayerRef.value?.playVideo(url)
})

function interruptPerformance() {
  performQueue.interrupt()

  clearAllBubbles()

  mediaPlayerRef.value?.stopAudio()
  mediaPlayerRef.value?.hideImage()
  mediaPlayerRef.value?.hideVideo()

  // Ensure any awaiting audio tasks are released
  while (audioEndResolvers.length > 0) {
    const resolve = audioEndResolvers.shift()
    if (resolve) resolve()
  }
}

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
      showBaseEventStatus(`检测到多个模型文件，已自动选择：${importResult.chosenFile}`, 'info')
    }

    // 加载模型，传入保存的位置（如果有）
    const savedPosition = modelStore.getModelPosition(importResult.modelPath!)
    loadingModelPath.value = importResult.modelPath!
    await live2dCanvasRef.value?.loadModel(importResult.modelPath!, savedPosition || undefined)
    hasModel.value = true
    modelStore.setCurrentModel(importResult.modelPath!)
    themeStore.setCurrentModel(importResult.modelPath!)

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

    showBaseEventStatus('模型导入成功', 'success')
  } catch (error: any) {
    loadingModelPath.value = ''
    showModelStatus(`导入模型失败: ${error.message}`, 'error')
  }
}

// 模型加载完成
async function handleModelLoaded() {
  console.log('[主窗口] Live2D 模型加载完成')
  hasModel.value = true
  const activeModelPath = loadingModelPath.value || modelStore.currentModel || modelStore.getLastModel() || ''
  
  // 确保位置同步
  const currentPos = live2dCanvasRef.value?.getModelPosition()
  if (currentPos) {
    modelPositionX = currentPos.x
    modelPositionY = currentPos.y
    updateUIPositions()
  }
  
  showBaseEventStatus('模型加载成功', 'success')
  if (activeModelPath) {
    themeStore.setCurrentModel(activeModelPath)
  }

  // 提取主题色
  try {
    if (activeModelPath) {
      await extractAndApplyModelTheme(activeModelPath)
    }
  } catch (error) {
    console.warn('[主窗口] 提取主题色失败:', error)
  } finally {
    loadingModelPath.value = ''
  }
}

// 模型信息变化
async function handleModelInfoChanged(modelInfo: {
  name: string;
  motionGroups: string[] | Record<string, Array<{ index: number; file: string }>>;
  expressions: string[]
}) {
  console.log('[主窗口] 模型信息变化:', modelInfo)
  if (modelInfo.name) {
    themeStore.setModelName(modelInfo.name)
  }

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
  const overlayAnchor = resolveModelOverlayAnchor()

  // 重新计算气泡栈位置
  if (bubbleStack.value.length > 0) {
    updateStackPositions()
  }

  // 更新状态提示位置（跟随模型头部）
  if (modelStatus.value) {
    modelStatusStyle.value = {
      left: `${overlayAnchor.anchorX}px`,
      top: `${overlayAnchor.statusTop}px`
    }
  }

  // 更新录音提示位置（跟随模型头部）
  if (isRecording.value) {
    recordingToastStyle.value = {
      left: `${overlayAnchor.anchorX}px`,
      top: `${overlayAnchor.recordingTop}px`
    }
  }

  // 更新输入框位置（模型下方）
  if (showInput.value) {
    inputStyle.value = {
      left: `${overlayAnchor.anchorX}px`,
      top: `${overlayAnchor.inputTop}px`
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
    closeInputPanel()
  }
}

function closeInputPanel() {
  showInput.value = false
  inputText.value = ''
  selectedImage.value = null
  live2dCanvasRef.value?.enablePassThrough()
}

// 打开历史记录窗口（现在合并到设置窗口中）
async function openHistory() {
  showMenu.value = false
  clearMenuAutoCloseTimer()
  await window.electron.window.openSettings('history')
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
  const wasOpen = showInput.value
  showInput.value = true
  if (!wasOpen) {
    updateUIPositions()
  }
  // 禁用动态穿透，让整个窗口可以接收点击事件
  live2dCanvasRef.value?.disablePassThrough()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function applySelectedImage(file: File, preview: string) {
  selectedImage.value = { file, preview }

  if (!showInput.value) {
    openInput()
    return
  }

  live2dCanvasRef.value?.disablePassThrough()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 菜单配置
const menuItems = computed(() => [
  { key: 'history', icon: ChartColumn, label: '历史', action: openHistory },
  { key: 'settings', icon: Settings, label: '设置', action: openSettings },
  { key: 'talk', icon: MessageCircle, label: '对话', action: openInput }
])

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
      applySelectedImage(file, e.target?.result as string)
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
        applySelectedImage(file, e.target?.result as string)
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

// 开始录音
function clearRecordingTimer() {
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
}

function getMaxRecordingSeconds(): number {
  return clampMaxRecordingSeconds(advancedSettings.value.maxRecordingSeconds)
}

async function applyLogLevelFromAdvancedSettings() {
  try {
    await window.electron.log.setLevel(advancedSettings.value.logLevel)
  } catch (error) {
    console.warn('[主窗口] 应用日志级别失败:', error)
  }
}

function initializeAdvancedSettingsForSession() {
  advancedSettings.value = loadAdvancedSettings()
  advancedSettings.value.maxRecordingSeconds = clampMaxRecordingSeconds(advancedSettings.value.maxRecordingSeconds)
  void applyLogLevelFromAdvancedSettings()
}

function refreshAdvancedSettings() {
  advancedSettings.value = loadAdvancedSettings()
  advancedSettings.value.maxRecordingSeconds = clampMaxRecordingSeconds(advancedSettings.value.maxRecordingSeconds)
  void applyLogLevelFromAdvancedSettings()
}

function handleStorageChange(event: StorageEvent) {
  if (event.key && event.key !== ADVANCED_SETTINGS_KEY) {
    return
  }

  refreshAdvancedSettings()
}

interface StartRecordingOptions {
  source?: RecordingSource
}

interface StopRecordingOptions {
  reason?: StopReason
}

async function startRecording(options: StartRecordingOptions | MouseEvent = {}) {
  if (isRecording.value || isStoppingRecording) {
    return
  }

  if (!AudioRecorder.isSupported()) {
    showModelStatus('您的浏览器不支持录音功能', 'error')
    return
  }

  const source = (typeof options === 'object' && options !== null && 'source' in options
    ? (options as StartRecordingOptions).source
    : 'manual') || 'manual'
  const maxRecordingSeconds = getMaxRecordingSeconds()

  try {
    audioRecorder = new AudioRecorder({
      sampleRate: 16000,
      channelCount: 1,
      silenceDetection: {
        enabled: false
      }
    })

    await audioRecorder.start()
    isRecording.value = true
    updateUIPositions()
    currentRecordingSource.value = source
    recordingDuration.value = 0

    recordingTimer = setInterval(() => {
      if (!audioRecorder) {
        return
      }

      recordingDuration.value = Math.floor(audioRecorder.getDuration() / 1000)
      if (recordingDuration.value >= maxRecordingSeconds) {
        void stopRecording({ reason: 'max-duration' })
      }
    }, 100)

    console.log('[主窗口] 开始录音，来源:', source)
  } catch (error: any) {
    showModelStatus(`录音失败: ${error.message}`, 'error')
    isRecording.value = false
    recordingDuration.value = 0
    currentRecordingSource.value = 'manual'
    audioRecorder = null
    clearRecordingTimer()
  }
}

// Stop recording and send
async function stopRecording(_options: StopRecordingOptions | MouseEvent = {}) {
  if (!audioRecorder || !isRecording.value || isStoppingRecording) {
    return
  }

  const currentRecorder = audioRecorder
  isStoppingRecording = true

  try {
    clearRecordingTimer()
    const audioBlob = await currentRecorder.stop()
    isRecording.value = false
    audioRecorder = null

    console.log('[主窗口] 录音完成，大小:', audioBlob.size, '字节')

    if (audioBlob.size < 1000) {
      showModelStatus('录音时间太短', 'warning')
      return
    }

    if (!connectionStore.isConnected) {
      showModelStatus('未连接到服务器', 'error')
      return
    }

    await sendAudioMessage(audioBlob)
  } catch (error: any) {
    showModelStatus(`停止录音失败: ${error.message}`, 'error')
    } finally {
      isRecording.value = false
      recordingDuration.value = 0
      currentRecordingSource.value = 'manual'
      audioRecorder = null
      isStoppingRecording = false
    }
}

// Cancel recording
function cancelRecordingIfActive() {
  if (!audioRecorder || !isRecording.value) {
    return
  }

  audioRecorder.cancel()
  isRecording.value = false
  recordingDuration.value = 0
  currentRecordingSource.value = 'manual'
  audioRecorder = null
  isStoppingRecording = false
  clearRecordingTimer()

  console.log('[主窗口] 录音已取消')
}

async function sendAudioMessage(audioBlob: Blob) {
  try {
    showBaseEventStatus('正在发送语音...', 'info')

    // 获取音频格式
    const format = audioBlob.type.split('/')[1] || 'webm'

    const content: any[] = [
      {
        type: 'audio',
        bytes: new Uint8Array(await audioBlob.arrayBuffer()),
        mime: audioBlob.type || 'audio/webm',
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
      showBaseEventStatus('语音已发送', 'success')

      // 保存语音消息记录
      try {
        await window.electron.history.saveMessage({
          messageId: generateMessageId(),
          sessionId: connectionStore.sessionId || 'default',
          userId: connectionStore.userId || 'desktop-user',
          userName: currentUserName.value || '桌面用户',
          messageType: 'friend',
          direction: 'outgoing',
          content: result.content || content,
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
  live2dCanvasRef.value?.stopLipSync()
  const resolve = audioEndResolvers.shift()
  if (resolve) resolve()
}

// 发送消息
async function handleSendMessage() {
  const rawTextToStore = inputText.value.trim()
  if (!rawTextToStore && !selectedImage.value) return

  if (!connectionStore.isConnected) {
    showModelStatus('未连接到服务器', 'error')
    return
  }

  try {
    const content: any[] = []

    // 添加文本
    if (rawTextToStore) {
      content.push({ type: 'text', text: rawTextToStore })
    }

    // 添加图片
    if (selectedImage.value) {
      const file = selectedImage.value.file

      // 小于 256KB 使用 inline base64
      if (file.size < 256 * 1024) {
        const base64 = await fileToBase64(file)
        content.push({ type: 'image', inline: base64 })
      } else {
        showBaseEventStatus('正在处理图片...', 'info')
        content.push({
          type: 'image',
          bytes: new Uint8Array(await file.arrayBuffer()),
          mime: file.type || 'image/png',
          name: file.name,
        })
      }
    }

    const result = await connectionStore.sendMessage(content, {
      userId: connectionStore.userId || 'desktop-user',
      userName: currentUserName.value || '桌面用户',
      sessionId: connectionStore.sessionId,
      messageType: 'friend'
    })

    if (result.success) {
      showBaseEventStatus('消息已发送', 'success')
      closeInputPanel()
      inputText.value = ''

      // 保存消息记录
      try {
        await window.electron.history.saveMessage({
          messageId: generateMessageId(),
          sessionId: connectionStore.sessionId || 'default',
          userId: connectionStore.userId || 'desktop-user',
          userName: currentUserName.value || '桌面用户',
          messageType: 'friend',
          direction: 'outgoing',
          content: result.content || content,
          rawText: rawTextToStore,
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
  initializeAdvancedSettingsForSession()
  window.addEventListener('storage', handleStorageChange)
  window.addEventListener('resize', updateUIPositions)

  try {
    const platformCapabilities = await window.electron.window.getPlatformCapabilities()
    showPlatformCompatibilityHint(platformCapabilities)
  } catch {
    // ignore capability lookup failures in startup flow
  }

  window.electron.shortcut.onRecordingStart(() => {
    console.log('[主窗口] 全局快捷键：开始录音')
    void startRecording({ source: 'shortcut' })
  })

  window.electron.shortcut.onRecordingStop(() => {
    console.log('[主窗口] 全局快捷键：停止录音')
    void stopRecording({ reason: 'shortcut' })
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
      loadingModelPath.value = modelPath
      await live2dCanvasRef.value?.loadModel(modelPath, savedPosition || undefined)
      hasModel.value = true
      modelStore.setCurrentModel(modelPath)
      themeStore.setCurrentModel(modelPath)

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
      loadingModelPath.value = ''
      showModelStatus(`模型加载失败: ${error.message}`, 'error')
    } finally {
      isLoadingModel = false
    }
  })

  window.electron.bridge.onPerformShow((payload: any) => {
    console.log('收到表演指令:', payload)

    const now = Date.now()
    // 4s 窗口内的连续消息视为追加（不中断），超出则中断旧内容
    const isFollowUp = bubbleStack.value.length > 0 && (now - lastPerformReceiveTime) < FOLLOW_UP_WINDOW_MS
    lastPerformReceiveTime = now

    // interrupt=true 且不是追加时才中断旧表演
    const shouldInterrupt = payload.interrupt !== false && !isFollowUp

    if (shouldInterrupt) {
      interruptPerformance()
    }

    // 使用表演队列执行
    if (payload.sequence) {
      const { bubbleItems, position, remainingSequence } = splitPerformSequenceForBubble(
        payload.sequence,
        {
          resourceBaseUrl: connectionStore.resourceBaseUrl,
          resourcePath: connectionStore.resourcePath,
          resourceToken: connectionStore.resourceToken,
        }
      )

      if (bubbleItems.length > 0) {
        pushBubble(bubbleItems, position, shouldInterrupt)
      }

      if (remainingSequence.length > 0) {
        performQueue.enqueue({
          sequence: remainingSequence as any[],
          interruptible: payload.interruptible !== false
        })
      }

      // 保存表演记录和更新统计
      try {
        const timestamp = Date.now()
        const date = new Date(timestamp)
        const dateStr = date.toISOString().split('T')[0]
        const hour = date.getHours()
        const performanceId = generateMessageId('perf')

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
          motionUsage,
          expressionUsage
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
    interruptPerformance()
  })

  window.electron.bridge.onConnected((payload: any) => {
    showBaseEventStatus('已连接到服务器', 'success')
    console.log('连接信息:', payload)

    connectionStore.isConnected = true
    connectionStore.applySessionState(payload)
  })

  window.electron.bridge.onDisconnected((info: any) => {
    showBaseEventStatus('已断开连接', 'warning')
    console.log('断开信息:', info)

    connectionStore.resetSessionState()
  })

  window.electron.bridge.onError((error: any) => {
    showModelStatus(`连接错误: ${error.message || error}`, 'error')
  })

  // 检查初始连接状态
  await connectionStore.checkConnection()

  // 自动连接功能
  if (advancedSettings.value.autoConnect && !connectionStore.isConnected) {
    console.log('[Main] Auto connect on startup')
    const result = await connectionStore.connect()
    if (result.success) {
      console.log('[Main] Auto connect success')
    } else {
      console.warn('[Main] Auto connect failed:', result.error)
    }
  }

  const lastModelPath = modelStore.getLastModel()
  if (lastModelPath) {
    console.log('[主窗口] 自动加载上次模型:', lastModelPath)

    try {
      // 获取保存的位置并传入 loadModel
      const savedPosition = modelStore.getModelPosition(lastModelPath)
      loadingModelPath.value = lastModelPath
      await live2dCanvasRef.value?.loadModel(lastModelPath, savedPosition || undefined)
      modelStore.setCurrentModel(lastModelPath)
      themeStore.setCurrentModel(lastModelPath)
      console.log('[主窗口] 自动加载成功')

      // 如果有保存的位置，更新本地变量
      if (savedPosition) {
        console.log('[主窗口] 使用保存的模型位置:', savedPosition)
        modelPositionX = savedPosition.x
        modelPositionY = savedPosition.y
      }
    } catch (error: any) {
      console.warn('[主窗口] 自动加载失败:', error.message)
      loadingModelPath.value = ''
      // 自动加载失败，显示导入提示
      hasModel.value = false
    }
  } else {
    // 没有上次使用的模型，显示导入提示
    hasModel.value = false
  }

  // 自动注册全局快捷键
  if (advancedSettings.value.recordingShortcut) {
    const electronFormat = advancedSettings.value.recordingShortcut.replace('Ctrl', 'CommandOrControl')
    console.log('[Main] Register shortcut:', electronFormat)
    const result = await window.electron.shortcut.register(electronFormat)
    if (result.success) {
      console.log('[Main] Shortcut register success')
    } else {
      console.warn('[Main] Shortcut register failed:', result.error)
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleStorageChange)
  window.removeEventListener('resize', updateUIPositions)
  clearRecordingTimer()
  clearAllBubbles()

  if (audioRecorder && isRecording.value) {
    audioRecorder.cancel()
    audioRecorder = null
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

.main-stage-ambient {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.ambient-orb {
  position: absolute;
  display: block;
}

.ambient-orb {
  border-radius: 999px;
  filter: blur(68px);

  &--primary {
    top: -90px;
    left: -40px;
    width: 240px;
    height: 240px;
    background: rgba(var(--model-r, 116), var(--model-g, 165), var(--model-b, 255), 0.18);
  }

  &--secondary {
    right: -90px;
    bottom: 120px;
    width: 280px;
    height: 280px;
    background: rgba(var(--model-r, 116), var(--model-g, 165), var(--model-b, 255), 0.12);
  }
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
    position: relative;
    text-align: center;
    padding: 48px 52px;
    background: var(--surface-bg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    max-width: 520px;

    &::before {
      content: '';
      position: absolute;
      top: 0; left: 10%; right: 10%; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
    }

    .empty-icon {
      margin-bottom: 24px;
      color: var(--color-text-tertiary);
    }

    h2 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
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
  transition: opacity var(--duration-norm) var(--ease-out);
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
    background: rgba(var(--model-r, 116), var(--model-g, 165), var(--model-b, 255), 0.5);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    opacity: 0; /* 默认隐藏，调试时可开启 */
  }

  .radial-menu-item {
    position: absolute;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02)),
      linear-gradient(135deg, var(--theme-color, transparent), transparent 72%),
      var(--surface-bg);
    border: 1px solid rgba(var(--model-r, 116), var(--model-g, 165), var(--model-b, 255), 0.22);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;

    transform: translate(-50%, -50%) translate(var(--tx), var(--ty));
    transition: transform var(--duration-slow) var(--ease-bounce) var(--delay),
                background var(--duration-fast),
                box-shadow var(--duration-fast),
                border-color var(--duration-fast);

    .menu-icon {
      color: var(--color-text-primary);
      display: flex;
      transition: transform var(--duration-norm) var(--ease-out);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    }

    .menu-label {
      position: absolute;
      top: 100%;
      margin-top: 8px;
      background: var(--surface-bg);
      border: 1px solid var(--surface-border);
      color: var(--color-text-primary);
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.3px;
      opacity: 0;
      transform: translateY(-8px);
      transition: all var(--duration-norm) var(--ease-out);
      white-space: nowrap;
      pointer-events: none;
    }

    &:hover {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04)),
        linear-gradient(135deg, var(--theme-color-hover, transparent), transparent 72%),
        var(--surface-bg-hover);
      border-color: rgba(var(--model-r, 116), var(--model-g, 165), var(--model-b, 255), 0.34);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.16),
        var(--shadow-md),
        0 0 16px var(--model-color-glow, var(--color-accent-glow));
      z-index: 10;

      .menu-icon {
        transform: scale(1.15);
      }

      .menu-label {
        opacity: 1;
        transform: translateY(0);
      }
    }

    &:active {
      transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) scale(0.93);
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

/* 气泡栈宿主容器（零尺寸，仅作 TransitionGroup 挂载点） */
.bubble-stack-host {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
}

.bubble {
  position: absolute;
  background: rgba(26, 26, 26, 0.95);
  color: var(--color-text-primary);
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 14px;
  width: max-content;
  max-width: min(450px, calc(100vw - 32px));
  max-height: min(40vh, calc(100vh - 32px));
  box-shadow: var(--shadow-md);
  z-index: 100;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  pointer-events: auto;
  transform: translateX(calc(-50% + var(--bubble-offset-x, 0px)));
  transition: top 0.3s ease-out, opacity 0.3s, transform 0.3s, max-height 0.3s ease-out;
}

.bubble-tier-1 {
  opacity: 0.72;
  transform: translateX(calc(-50% + var(--bubble-offset-x, 0px))) scale(0.95);
  filter: blur(0.3px);
  max-height: min(32vh, calc(100vh - 32px));
}

.bubble-tier-2 {
  opacity: 0.48;
  transform: translateX(calc(-50% + var(--bubble-offset-x, 0px))) scale(0.88);
  filter: blur(0.6px);
  max-height: min(24vh, calc(100vh - 32px));
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

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.25);
    border-radius: 4px;

    &:hover {
      background: rgba(255, 255, 255, 0.4);
    }
  }
}

.bubble-item + .bubble-item {
  margin-top: 10px;
}

.bubble-item-text {
  min-width: 0;
}

.bubble-text:empty {
  display: none;
}

.bubble-text :deep(p:first-child) {
  margin-top: 0;
}

.bubble-text :deep(p:last-child) {
  margin-bottom: 0;
}

.bubble-image {
  display: flex;
  justify-content: center;
}

.bubble-image img {
  display: block;
  max-width: 100%;
  max-height: min(32vh, 280px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  background: rgba(255, 255, 255, 0.04);
}

.input-panel-container {
  position: absolute;
  width: min(420px, calc(100vw - 24px));
  z-index: 200;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: transparent;
  pointer-events: none;
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
  background: #141414;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 25px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.glass-input-bar:focus-within {
  background: #1a1a1a;
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
  color: var(--color-error);
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

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
  background: rgba(0, 0, 0, 0.5);
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  border: 2px solid rgba(255, 255, 255, 0.8);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

@keyframes pulse-red {
  0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(255, 77, 79, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
}

.recording-toast {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;

  .recording-toast-content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: rgba(248, 113, 113, 0.90);
    border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: var(--radius);
    box-shadow: 0 4px 20px rgba(248, 113, 113, 0.3);
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



.bubble-enter-active {
  transition: transform 0.35s ease-out;
}

.bubble-enter-from {
  transform: translateX(calc(-50% + var(--bubble-offset-x, 0px))) translateY(18px) scale(0.92);
}

.bubble-leave-active {
  transition: opacity 0.28s ease-in, transform 0.28s ease-in;
  position: absolute;
}

.bubble-leave-to {
  opacity: 0;
  transform: translateX(calc(-50% + var(--bubble-offset-x, 0px))) translateY(-10px) scale(0.94);
}

.bubble-move {
  transition: top 0.3s ease-out;
}

.input-enter-active, .input-leave-active {
  transition: opacity var(--duration-norm) var(--ease-out), transform var(--duration-norm) var(--ease-out);
}

.input-enter-from, .input-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

.recording-toast-enter-active, .recording-toast-leave-active {
  transition: opacity var(--duration-norm) var(--ease-out), transform var(--duration-norm) var(--ease-out);
}

.recording-toast-enter-from, .recording-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.model-status-toast {
  position: absolute;
  padding: 8px 18px;
  border-radius: var(--radius-full);
  background: var(--surface-bg);
  color: white;
  border: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 1000;
  pointer-events: none;
  transform: translateX(-50%);
  box-shadow: var(--shadow-md);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.2px;
  white-space: nowrap;

  &.success { background: rgba(52, 211, 153, 0.85); border-color: rgba(52, 211, 153, 0.3); }
  &.error   { background: rgba(248, 113, 113, 0.85); border-color: rgba(248, 113, 113, 0.3); }
  &.warning { background: rgba(251, 191, 36, 0.85); border-color: rgba(251, 191, 36, 0.3); }
  &.loading { background: rgba(96, 165, 250, 0.85); border-color: rgba(96, 165, 250, 0.3); }
  &.info    { background: var(--surface-bg); color: var(--color-text-primary); }

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
  transition: all var(--duration-norm) var(--ease-out);
}

.status-toast-enter-from, .status-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
