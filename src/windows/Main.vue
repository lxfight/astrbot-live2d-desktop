<template>
  <div class="main-window" :style="mainWindowStyle" @click="handleWindowClick">
    <!-- Live2D 画布 -->
    <Transition name="fade">
      <div v-if="!hasModel" class="empty-state">
        <div class="empty-content">
          <div class="empty-icon">
            <Drama :size="80" />
          </div>
          <h2>{{ $t('main.empty.title') }}</h2>
          <p>{{ $t('main.empty.subtitle') }}</p>
          <n-space vertical :size="16">
            <n-button type="primary" size="large" @click="handleImportModel">
              <template #icon>
                <FolderOpen :size="18" />
              </template>
              {{ $t('main.empty.import') }}
            </n-button>
            <n-button text @click="openSettings">
              {{ $t('main.empty.settings') }}
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
    <MediaPlayer ref="mediaPlayerRef" @audio-start="handleAudioStart" @audio-end="handleAudioEnd" />

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
            '--theme-color-hover': menuThemeColorHover
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
        :ref="el => setBubbleEl(entry.id, el as HTMLElement | null)"
        class="bubble"
        :class="bubbleTierClass(bubbleStack.length - 1 - i)"
        :style="{
          left: entry.styleLeft,
          top: entry.styleTop,
          '--bubble-offset-x': entry.offsetX + 'px',
          maxHeight: entry.styleMaxHeight || undefined
        }"
        @click.stop
        @mouseenter="handleBubbleMouseEnter(entry)"
        @mouseleave="handleBubbleMouseLeave(entry)"
      >
        <div
          :ref="el => setBubbleContentEl(entry.id, el as HTMLElement | null)"
          class="bubble-content"
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
          <span class="recording-text">{{
            $t('main.recording.indicator', { duration: recordingDuration })
          }}</span>
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
            <span>{{ $t('main.recording.indicator', { duration: recordingDuration }) }}</span>
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
          <button class="icon-btn" :title="$t('main.input.sendImage')" @click="handleSelectImage">
            <ImageIcon :size="20" />
          </button>

          <input
            :ref="el => (inputPanel.inputRef.value = el as HTMLInputElement | null)"
            v-model="inputText"
            class="transparent-input"
            :placeholder="$t('main.input.placeholder')"
            @keydown.enter.exact="handleSendMessage"
            @paste="handlePasteEvent"
          />

          <div class="action-buttons">
            <button
              v-if="recordingMode === 'hold'"
              class="icon-btn record-btn"
              :class="{ recording: isRecording }"
              :title="$t('main.input.holdToRecord')"
              @mousedown="startRecording"
              @mouseup="stopRecording"
              @mouseleave="cancelRecordingIfActive"
            >
              <component :is="isRecording ? Disc : Mic" :size="20" />
            </button>
            <button
              v-else
              class="icon-btn record-btn"
              :class="{ recording: isRecording }"
              :title="isRecording ? $t('main.input.clickToStop') : $t('main.input.clickToRecord')"
              @click="toggleRecording"
            >
              <component :is="isRecording ? Disc : Mic" :size="20" />
            </button>

            <button
              class="icon-btn send-btn"
              :title="$t('main.input.send')"
              @click="handleSendMessage"
            >
              <SendHorizontal :size="20" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { PerformElement, PerformSequence, StateModelPayload } from '@/types/protocol'
import { useConnectionStore } from '@/stores/connection'
import { useModelStore } from '@/stores/model'
import { useThemeStore } from '@/stores/theme'
import {
  Drama,
  FolderOpen,
  Image as ImageIcon,
  Disc,
  Mic,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  AlertTriangle,
  SendHorizontal
} from 'lucide-vue-next'
import Live2DCanvas from '@/components/Live2D/Canvas.vue'
import MediaPlayer from '@/components/MediaPlayer.vue'
import { PerformanceQueue } from '@/utils/PerformanceQueue'
import { getGlobalPerformanceMonitor } from '@/utils/PerformanceMonitor'
import {
  ADVANCED_SETTINGS_KEY,
  clampMaxRecordingSeconds,
  loadAdvancedSettings,
  type AdvancedSettings
} from '@/utils/advancedSettings'
import { resolvePerformMediaSource, splitPerformSequenceForBubble } from '@/utils/bubbleContent'
import { configureMarked, renderBubbleMarkdown } from '@/utils/markedLatex'
import { extractModelThemeColor } from '@/utils/modelTheme'
import { sleep } from '@/utils/async'
import { rgbToHexString } from '@/utils/color'
import type { CubismExpressionRequest } from '@/utils/cubism'
import { useBubbleStack } from './composables/useBubbleStack'
import { useRecording } from './composables/useRecording'
import { useRadialMenu } from './composables/useRadialMenu'
import { useInputPanel, type FloatingOverlayStyle } from './composables/useInputPanel'
import { useAudioWaiters } from './composables/useAudioWaiters'
import { summarizePerformPayloadForLog } from './composables/performElementSummary'
import { recordPerformanceHistory } from './composables/performanceHistoryRecorder'

import { convertModelInfoToV2, shouldUseV2Protocol } from '@/utils/modelInfoConverter'
import { parseMotionIdParts } from '@/shared/modelAliasMerge'
import { AliasMapper } from '@electron/utils/aliasMapper'
import { IdleManager } from '@electron/services/idleManager'
import { ensureCubismCoreLoaded } from '@/bootstrap/windowApp'

const connectionStore = useConnectionStore()
const modelStore = useModelStore()
const themeStore = useThemeStore()
const { t } = useI18n()
const { sourceRgb } = storeToRefs(themeStore)
const { desiredState, lastError, lifecycleStatus, nextRetryAt, reconnectAttempt } =
  storeToRefs(connectionStore)

const live2dCanvasRef = ref<InstanceType<typeof Live2DCanvas> | null>(null)
const mediaPlayerRef = ref<InstanceType<typeof MediaPlayer>>()

const mainWindowDisposers: Unsubscribe[] = []

const { waitForNextAudioEnd, resolveNextAudioWaiter, releaseAllAudioWaiters } = useAudioWaiters()

const themeRgb = computed(() => sourceRgb.value)
const mainWindowStyle = computed(() => ({
  '--model-r': themeRgb.value.r,
  '--model-g': themeRgb.value.g,
  '--model-b': themeRgb.value.b,
  '--model-color': `rgb(${themeRgb.value.r}, ${themeRgb.value.g}, ${themeRgb.value.b})`,
  '--model-color-soft': `rgba(${themeRgb.value.r}, ${themeRgb.value.g}, ${themeRgb.value.b}, 0.15)`,
  '--model-color-glow': `rgba(${themeRgb.value.r}, ${themeRgb.value.g}, ${themeRgb.value.b}, 0.35)`
}))

let modelPositionX = window.innerWidth / 2
let modelPositionY = window.innerHeight / 2
const PLATFORM_COMPATIBILITY_HINT_KEY = 'platformCompatibilityHintShown'

const currentUserName = ref(t('main.defaultUserName'))
const hasModel = ref(false)
const loadingModelPath = ref('')
let themeExtractionRevision = 0
let modelLoadInFlight = false
let hasOpenedModelLibraryWindow = false

const advancedSettings = ref<AdvancedSettings>(loadAdvancedSettings())

// ─── 别名映射器 ─────────────────────────────────────────────────
const aliasMapper = new AliasMapper()

// ─── 待机管理器 ─────────────────────────────────────────────────
let idleManager: IdleManager | null = null

const expressionResetTimers = new Set<ReturnType<typeof setTimeout>>()

function clearExpressionResetTimers() {
  for (const timer of expressionResetTimers) {
    clearTimeout(timer)
  }
  expressionResetTimers.clear()
}

function scheduleExpressionReset(element: PerformElement, holdMs: number) {
  const timer = setTimeout(() => {
    expressionResetTimers.delete(timer)
    if (element.resetPolicy === 'fadeOut') {
      live2dCanvasRef.value?.setExpression({ id: '' })
    } else if (element.resetPolicy === 'default') {
      live2dCanvasRef.value?.setExpression({ id: 'default' })
    }
  }, holdMs)
  expressionResetTimers.add(timer)
}

function startIdleManagerFromConfig(motionIds: string[]) {
  if (motionIds.length === 0) {
    return
  }
  idleManager = new IdleManager()
  idleManager.setIdleMotions(motionIds)
  idleManager.start((group, index, priority, loop) => {
    live2dCanvasRef.value?.playMotion(group, index, priority, loop)
  })
  console.log('[主窗口] 待机管理器已启动，idle 动作数量:', motionIds.length)
}

function restoreIdleIfNeeded() {
  if (performQueue.hasPendingSequences()) {
    return
  }
  if (idleManager && !idleManager.isRunning()) {
    idleManager.start((group, index, priority, loop) => {
      live2dCanvasRef.value?.playMotion(group, index, priority, loop)
    })
    console.log('[主窗口] 待机管理器已恢复')
  }
}

function stopIdleForPerformance() {
  if (!idleManager?.isRunning()) {
    return
  }
  idleManager.stop(() => {
    live2dCanvasRef.value?.stopBodyMotions()
  })
  console.log('[主窗口] 待机管理器已停止')
}

// ─── 模型状态提示 ─────────────────────────────────────────────────
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

function openModelLibraryWindowOnce(): void {
  if (hasOpenedModelLibraryWindow) {
    return
  }
  hasOpenedModelLibraryWindow = true
  void window.electron.window.openSettings('model/library')
}

function showPlatformCompatibilityHint(capabilities: PlatformCapabilities): void {
  if (sessionStorage.getItem(PLATFORM_COMPATIBILITY_HINT_KEY) === '1') {
    return
  }

  let hint: { text: string; type: ModelStatusType; duration: number } | null = null

  if (capabilities.platform === 'linux') {
    hint =
      capabilities.linuxSessionType === 'wayland'
        ? {
            text: t('main.platform.waylandWarning'),
            type: 'warning',
            duration: 5200
          }
        : {
            text: t('main.platform.linuxWarning'),
            type: 'info',
            duration: 4800
          }
  }

  if (!hint) {
    return
  }

  sessionStorage.setItem(PLATFORM_COMPATIBILITY_HINT_KEY, '1')
  showModelStatus(hint.text, hint.type, hint.duration)
}

async function syncRecordingShortcutState(recording: boolean): Promise<void> {
  try {
    await window.electron.shortcut.setRecordingState(recording)
  } catch (error) {
    console.warn('[主窗口] 同步快捷键录音状态失败:', error)
  }
}

// ─── Composable 初始化 ──────────────────────────────────────────

// useBubbleStack：无外部依赖
const {
  bubbleStack,
  setBubbleEl,
  setBubbleContentEl,
  bubbleTierClass,
  handleBubbleMediaLoad,
  handleBubbleMouseEnter,
  handleBubbleMouseLeave,
  resolveModelOverlayAnchor,
  updateStackPositions,
  pushBubble,
  holdBubble,
  releaseBubble,
  clearAllBubbles,
  cleanup: cleanupBubbleStack,
  checkFollowUp,
  generateMessageId
} = useBubbleStack({
  live2dCanvasRef,
  advancedSettings,
  modelPositionX: {
    get value() {
      return modelPositionX
    },
    set value(v: number) {
      modelPositionX = v
    }
  },
  modelPositionY: {
    get value() {
      return modelPositionY
    },
    set value(v: number) {
      modelPositionY = v
    }
  }
})

// useInputPanel：需要 openInput 在 Main.vue 定义，先声明后传参
// 但 openInput 依赖 radialMenu 的 showMenu/clearMenuAutoCloseTimer，
// 所以需要先初始化 radialMenu 的 showMenu ref。
// 解法：先创建 radialMenu，再创建 inputPanel，再定义 openInput 等包装函数。

const {
  showMenu,
  menuStyle,
  menuThemeColor,
  menuThemeColorHover,
  menuItems,
  handleModelRightClick: _handleModelRightClick,
  clearMenuAutoCloseTimer,
  handleMenuMouseEnter,
  handleMenuMouseLeave,
  getMenuItemStyle,
  setOpenInput
} = useRadialMenu({
  themeStore,
  openHistory: async () => {
    showMenu.value = false
    clearMenuAutoCloseTimer()
    await window.electron.window.openSettings('history/messages')
  },
  openSettings: async () => {
    showMenu.value = false
    clearMenuAutoCloseTimer()
    await window.electron.window.openSettings()
  },
  resetPosition: () => {
    showMenu.value = false
    clearMenuAutoCloseTimer()
    modelPositionX = window.innerWidth / 2
    modelPositionY = window.innerHeight / 2
    live2dCanvasRef.value?.setModelPosition(modelPositionX, modelPositionY)
    const currentModelPath = modelStore.currentModel
    if (currentModelPath) {
      modelStore.setModelPosition(modelPositionX, modelPositionY)
    }
    updateUIPositions()
  }
})

const inputPanel = useInputPanel({
  connectionStore,
  currentUserName,
  advancedSettings,
  showModelStatus,
  showBaseEventStatus,
  updateUIPositions: () => updateUIPositions(),
  generateMessageId
})

const {
  showInput,
  inputStyle,
  inputText,
  selectedImage,
  handleSelectImage,
  handlePasteEvent,
  clearImage,
  closeInputPanel,
  openInput: _openInput,
  handleSendMessage
} = inputPanel

const {
  isRecording,
  recordingDuration,
  recordingHintText,
  recordingMode,
  startRecording,
  stopRecording,
  toggleRecording,
  cancelRecordingIfActive,
  cleanup: cleanupRecording
} = useRecording({
  connectionStore,
  currentUserName,
  advancedSettings,
  showModelStatus,
  showBaseEventStatus,
  updateUIPositions: () => updateUIPositions(),
  generateMessageId,
  syncRecordingState: syncRecordingShortcutState
})

function openInput() {
  showMenu.value = false
  clearMenuAutoCloseTimer()
  _openInput()
}

setOpenInput(openInput)

// 包装 handleModelRightClick，传入 modelPositionRef
function handleModelRightClick(position: { x: number; y: number }) {
  modelPositionX = position.x
  modelPositionY = position.y
  _handleModelRightClick(position, { x: modelPositionX, y: modelPositionY })
}

// 主窗口可见性由主进程统一协调：只有模型加载成功后才显示透明桌面窗口
watch(
  hasModel,
  async value => {
    try {
      await window.electron.desktopBehavior.setModelReady(value)
    } catch (error) {
      console.warn('[主窗口] 同步桌面交互状态失败:', error)
    }

    if (value) {
      hasOpenedModelLibraryWindow = false
    }
  },
  { immediate: true }
)

watch(
  () => (modelStore.currentModel ? modelStore.getModelScale(modelStore.currentModel) : 1.0),
  newScale => {
    if (live2dCanvasRef.value && modelStore.currentModel) {
      live2dCanvasRef.value.setModelScale(newScale)
    }
  }
)

// 初始化 marked + LaTeX 扩展（幂等）
configureMarked()

async function extractAndApplyModelTheme(modelPath: string) {
  if (!advancedSettings.value.themeFollowModel) {
    return
  }

  const extractionRevision = ++themeExtractionRevision

  for (let attempt = 0; attempt < 3; attempt++) {
    if (extractionRevision !== themeExtractionRevision) {
      return
    }

    const textureCanvases = live2dCanvasRef.value?.getTextureSources?.() || []
    if (!textureCanvases.length) {
      await sleep(300)
      continue
    }

    if (extractionRevision !== themeExtractionRevision) {
      return
    }

    const extractedColor = extractModelThemeColor(textureCanvases)
    if (!extractedColor) {
      await sleep(300)
      continue
    }

    themeStore.applyModelTheme({
      modelPath,
      rgb: extractedColor
    })
    console.log('[主窗口] 提取主题色:', rgbToHexString(extractedColor))
    return
  }

  console.warn('[主窗口] 主题色提取失败，已重试 3 次')
}

// Create performance queue
const performQueue = new PerformanceQueue()
let latestBubbleEntryId: string | null = null

// Register performance queue callbacks
performQueue.onText((content, position, _duration) => {
  latestBubbleEntryId = pushBubble([{ type: 'text', text: content }], position, false)
})

performQueue.onMotion((element: PerformElement) => {
  // v2.0: 支持 name 字段（别名）
  if (element.name) {
    const motionId = aliasMapper.getMotionId(element.name)
    if (!motionId) {
      console.warn('[主窗口] 未知动作别名:', element.name)
      return
    }

    const { group, index } = parseMotionIdParts(motionId)

    live2dCanvasRef.value?.playMotion(group, index, element.priority ?? 2)
    return
  }

  // v1.0: 使用 group/index
  if (element.group) {
    live2dCanvasRef.value?.playMotion(element.group, element.index ?? 0, element.priority ?? 2)
  }
})

performQueue.onExpression((element: PerformElement) => {
  // v2.0: 支持 name 字段 + holdMs + resetPolicy
  if (element.name) {
    const exprId = aliasMapper.getExpressionId(element.name) || element.name

    live2dCanvasRef.value?.setExpression({
      id: exprId,
      fade: element.fade,
      holdMs: element.holdMs,
      resetPolicy: (element.resetPolicy as any) || 'previous'
    })

    if (element.holdMs && element.resetPolicy !== 'hold') {
      scheduleExpressionReset(element, element.holdMs)
    }
    return
  }

  // v1.0: 使用 id
  const expressionRequest: CubismExpressionRequest = {
    id: element.id,
    combo: element.combo,
    semantic: element.semantic,
    fade: element.fade,
    holdMs: element.holdMs,
    resetPolicy: (element.resetPolicy as any) || 'previous',
    motionType: element.motionType
  }
  live2dCanvasRef.value?.setExpression(expressionRequest)
})

performQueue.onAudio((source, volume) => {
  const mediaPlayer = mediaPlayerRef.value
  if (!mediaPlayer) return

  const audioBubbleEntryId = latestBubbleEntryId
  if (audioBubbleEntryId) {
    holdBubble(audioBubbleEntryId)
  }

  const audioEndPromise = waitForNextAudioEnd()
  void mediaPlayer.playAudio(source, volume)
  return audioEndPromise.finally(() => {
    if (audioBubbleEntryId) {
      releaseBubble(audioBubbleEntryId)
    }
  })
})

performQueue.onImage((url, _duration) => {
  const resolvedSrc =
    url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')
      ? url
      : resolvePerformMediaSource(
          { rid: url },
          {
            resourceBaseUrl: connectionStore.resourceBaseUrl,
            resourcePath: connectionStore.resourcePath,
            resourceToken: connectionStore.resourceToken
          }
        )

  if (!resolvedSrc) {
    return
  }

  latestBubbleEntryId = pushBubble(
    [{ type: 'image', src: resolvedSrc, alt: t('main.imageAlt') }],
    'center',
    false
  )
})

performQueue.onVideo(url => {
  mediaPlayerRef.value?.playVideo(url)
})

performQueue.onIdle(() => {
  restoreIdleIfNeeded()
})

function applyModelPositionState(savedPosition: { x: number; y: number } | null) {
  if (savedPosition) {
    console.log('[主窗口] 使用保存的模型位置:', savedPosition)
    modelPositionX = savedPosition.x
    modelPositionY = savedPosition.y
  } else {
    console.log('[主窗口] 使用默认中心位置')
    modelPositionX = window.innerWidth / 2
    modelPositionY = window.innerHeight / 2
  }

  updateUIPositions()
}

async function loadModelWithState(modelPath: string, options: { showWarnings?: boolean } = {}) {
  // 确保 Cubism Core 已加载（防止手动加载/IPC 加载与 onMounted 预加载竞态）
  await ensureCubismCoreLoaded()

  const shouldShowWarnings = options.showWarnings !== false
  const savedPosition = modelStore.getModelPosition(modelPath)
  const savedScale = modelStore.getModelScale(modelPath)
  loadingModelPath.value = modelPath
  const prepareResult = await window.electron.model.prepareLoad(modelPath)
  if (!prepareResult.success || !prepareResult.descriptor) {
    throw new Error(prepareResult.error || t('main.status.modelInfoParseFailed'))
  }

  const { descriptor } = prepareResult
  if (descriptor.warnings.length > 0) {
    console.warn('[主窗口] 模型兼容发现告警:', descriptor.warnings)
    if (shouldShowWarnings) {
      showModelStatus(
        t('main.model.compatibilityWarning', { warnings: descriptor.warnings.join('; ') }),
        'warning',
        5200
      )
    }
  }

  // 在加载前预设行为配置（待机动作/常驻表情），loadModel 内部会应用到新模型实例
  applyModelBehavior(descriptor.modelPath)

  await live2dCanvasRef.value?.loadModel(
    descriptor.modelPath,
    savedPosition || undefined,
    savedScale,
    descriptor.compatibilityManifest
  )
  hasModel.value = true
  modelStore.setCurrentModel(descriptor.modelPath)
  themeStore.setCurrentModel(descriptor.modelPath)
  applyModelPositionState(savedPosition)
}

function applyModelBehavior(modelPath?: string) {
  const path = modelPath || modelStore.currentModel
  const behavior = modelStore.getModelBehavior(path || undefined)
  live2dCanvasRef.value?.setIdleActivity(behavior.idleActivity)
  live2dCanvasRef.value?.setPersistentExpressions(behavior.persistentExpressions)
}

// 设置窗口修改行为配置后（storage 同步整体替换 modelBehaviors），即时应用到当前模型
watch(
  () => modelStore.modelBehaviors,
  () => {
    if (hasModel.value) {
      applyModelBehavior()
    }
  },
  { deep: true }
)

function interruptPerformance() {
  performQueue.interrupt()
  clearExpressionResetTimers()
  latestBubbleEntryId = null

  clearAllBubbles()

  mediaPlayerRef.value?.stopAudio()
  mediaPlayerRef.value?.hideImage()
  mediaPlayerRef.value?.hideVideo()

  releaseAllAudioWaiters()
}

// 导入模型
async function handleImportModel() {
  try {
    const result = await window.electron.model.selectFolder()

    if (result.canceled) {
      return
    }

    if (!result.success) {
      showModelStatus(t('main.model.folderFailed', { message: result.error }), 'error')
      return
    }

    // 提取模型名称（默认使用文件夹名称）
    const folderName = result.folderPath?.split(/[/\\]/).pop() || 'model'
    const modelName = folderName

    // 导入模型
    const importResult = await window.electron.model.import(result.folderPath!, modelName)

    if (!importResult.success) {
      showModelStatus(t('main.status.modelImportFailed', { message: importResult.error }), 'error')
      return
    }

    if (importResult.modelFiles && importResult.modelFiles.length > 1 && importResult.chosenFile) {
      showBaseEventStatus(
        t('main.model.multiFileDetected', { file: importResult.chosenFile }),
        'info'
      )
    }

    if (Array.isArray(importResult.warnings) && importResult.warnings.length > 0) {
      showModelStatus(
        t('main.model.compatibilityWarning', { warnings: importResult.warnings.join('; ') }),
        'warning',
        5200
      )
    }

    await loadModelWithState(importResult.modelPath!, { showWarnings: false })

    showBaseEventStatus(t('main.status.modelImportSuccess'), 'success')
  } catch (error: any) {
    loadingModelPath.value = ''
    showModelStatus(t('main.status.modelImportFailed', { message: error.message }), 'error')
  }
}

// 模型加载完成
async function handleModelLoaded() {
  console.log('[主窗口] Live2D 模型加载完成')
  hasModel.value = true
  const activeModelPath =
    loadingModelPath.value || modelStore.currentModel || modelStore.getLastModel() || ''

  // 确保位置同步
  const currentPos = live2dCanvasRef.value?.getModelPosition()
  if (currentPos) {
    modelPositionX = currentPos.x
    modelPositionY = currentPos.y
    updateUIPositions()
  }

  showBaseEventStatus(t('main.status.modelLoaded'), 'success')
  if (activeModelPath) {
    modelStore.setCurrentModel(activeModelPath)
    themeStore.setCurrentModel(activeModelPath)
  }

  idleManager = null

  // 加载或自动生成别名配置
  if (activeModelPath) {
    try {
      const motionDurations = live2dCanvasRef.value?.getMotionDurationMap?.() ?? {}
      const ensureResult = await window.electron.modelConfig.ensure({
        modelPath: activeModelPath,
        motionDurations
      })

      if (ensureResult.success && ensureResult.config) {
        aliasMapper.loadFromConfig(ensureResult.config)
        if (ensureResult.created) {
          console.log('[主窗口] 已自动生成并保存别名配置')
        } else {
          console.log('[主窗口] 别名配置已加载')
        }

        const idleMotions = ensureResult.config.motionAliases
          .filter((m: { enabled: boolean; category: string }) => m.enabled && m.category === 'idle')
          .map((m: { id: string }) => m.id)

        startIdleManagerFromConfig(idleMotions)
      } else {
        console.warn('[主窗口] 别名配置不可用:', ensureResult.error)
      }
    } catch (error) {
      console.warn('[主窗口] 加载别名配置失败:', error)
    }

    await syncCurrentModelInfoToBridge('模型加载完成')
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

// 模型信息变化（配置加载完成前可能先触发，仅更新主题名）
async function handleModelInfoChanged(modelInfo: StateModelPayload) {
  console.log('[主窗口] 模型信息变化:', modelInfo)
  if (modelInfo.name) {
    themeStore.setModelName(modelInfo.name)
  }
}

async function syncModelInfoToBridge(
  modelInfo: StateModelPayload | null | undefined,
  reason: string
) {
  if (!connectionStore.isConnected || !modelInfo?.name) {
    return
  }

  try {
    // 根据配置决定使用 v1.0 或 v2.0 协议
    let payload = modelInfo

    if (shouldUseV2Protocol()) {
      // 如果有配置文件，使用 aliasMapper 导出
      if (aliasMapper.hasConfig()) {
        payload = aliasMapper.exportForAdapter(modelInfo.name || '未命名模型')
        console.log('[主窗口] 使用 AliasMapper 导出 v2.0 格式')
      } else {
        // 否则使用自动转换
        payload = convertModelInfoToV2(modelInfo)
        console.log('[主窗口] 使用自动转换 v2.0 格式')
      }
    }

    console.log('[主窗口] 发送模型信息:', payload)
    await connectionStore.sendState('state.model', payload)
    console.log(`[主窗口] 已同步模型信息到服务器 (${payload.version || 'v1.0'}): ${reason}`)
  } catch (error: any) {
    console.error(`[主窗口] 同步模型信息失败: ${reason}`, error)
  }
}

async function syncCurrentModelInfoToBridge(reason: string) {
  const modelInfo = live2dCanvasRef.value?.getModelInfo()
  await syncModelInfoToBridge(modelInfo, reason)
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

// 打开设置窗口
async function openSettings() {
  showMenu.value = false
  clearMenuAutoCloseTimer()
  await window.electron.window.openSettings()
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
  advancedSettings.value.maxRecordingSeconds = clampMaxRecordingSeconds(
    advancedSettings.value.maxRecordingSeconds
  )
  void applyLogLevelFromAdvancedSettings()
}

function refreshAdvancedSettings() {
  advancedSettings.value = loadAdvancedSettings()
  advancedSettings.value.maxRecordingSeconds = clampMaxRecordingSeconds(
    advancedSettings.value.maxRecordingSeconds
  )
  void applyLogLevelFromAdvancedSettings()
}

function handleStorageChange(event: StorageEvent) {
  if (event.key && event.key !== ADVANCED_SETTINGS_KEY) {
    return
  }

  const wasThemeFollowModel = advancedSettings.value.themeFollowModel
  refreshAdvancedSettings()

  // themeFollowModel 从 false 变为 true 时，立即重新提取主题色
  if (!wasThemeFollowModel && advancedSettings.value.themeFollowModel) {
    const activeModelPath =
      loadingModelPath.value || modelStore.currentModel || modelStore.getLastModel() || ''
    if (activeModelPath) {
      void extractAndApplyModelTheme(activeModelPath)
    }
  }
}

function formatRetryHint(): string {
  if (!nextRetryAt.value) {
    return t('main.retry.waiting')
  }

  const seconds = Math.max(1, Math.ceil((nextRetryAt.value - Date.now()) / 1000))
  return t('main.retry.hint', { seconds, attempt: reconnectAttempt.value })
}

watch(lifecycleStatus, (status, previousStatus) => {
  if (status === 'connected' && previousStatus !== 'connected') {
    showBaseEventStatus(t('main.status.connected'), 'success')
    void syncCurrentModelInfoToBridge('连接建立后补发当前模型状态')
    return
  }

  if (status === 'waiting_retry') {
    showBaseEventStatus(formatRetryHint(), 'warning', 3600)
    return
  }

  if (status === 'suspended') {
    showBaseEventStatus(t('main.status.suspended'), 'info', 3600)
    return
  }

  if (
    status === 'idle' &&
    previousStatus &&
    previousStatus !== 'idle' &&
    desiredState.value === 'disconnected'
  ) {
    showBaseEventStatus(t('main.status.disconnected'), 'warning')
  }
})

watch(lastError, (error, previousError) => {
  if (!error || error.at === previousError?.at) {
    return
  }

  showModelStatus(t('main.status.connectionError', { message: error.message }), 'error', 4200)
})

function handleAudioStart(audioElement: HTMLAudioElement) {
  live2dCanvasRef.value?.startLipSync(audioElement)
}

function handleAudioEnd() {
  console.log('[主窗口] 音频播放结束')
  live2dCanvasRef.value?.stopLipSync()
  resolveNextAudioWaiter()
}

// 监听表演指令
onMounted(async () => {
  // 并行启动：Cubism Core 预加载（预热，不 await）+ connection store 初始化。
  // Core 加载原本在 beforeMount 中阻塞 createApp，现在改为后台预热，实际等待由 loadModelWithState 统一处理。
  void ensureCubismCoreLoaded().catch(error => {
    console.warn('[主窗口] Cubism Core 预热失败（加载模型时会重试）:', error.message)
  })
  const ensureInitPromise = connectionStore.ensureInitialized()

  // 启用性能监控（开发模式）
  if (import.meta.env.DEV) {
    const perfMonitor = getGlobalPerformanceMonitor()
    perfMonitor.start()

    const unsubscribe = perfMonitor.subscribe(snapshot => {
      // 低 FPS 警告
      if (snapshot.fps < 30) {
        console.warn('[性能监控] FPS 低于 30:', snapshot.fps.toFixed(2))
      }

      // 内存使用警告
      const memoryUsagePercent = (snapshot.memory.used / snapshot.memory.limit) * 100
      if (memoryUsagePercent > 80) {
        console.warn(
          '[性能监控] 内存使用过高:',
          (snapshot.memory.used / 1024 / 1024).toFixed(2) + 'MB',
          `(${memoryUsagePercent.toFixed(1)}%)`
        )
      }

      // 每 60 秒输出一次性能统计
      if (snapshot.timestamp % 60000 < 1000) {
        console.log('[性能监控]', {
          fps: snapshot.fps.toFixed(2),
          memoryMB: (snapshot.memory.used / 1024 / 1024).toFixed(2),
          memoryPercent: memoryUsagePercent.toFixed(1) + '%'
        })
      }
    })

    // 存储 unsubscribe 函数以便清理
    mainWindowDisposers.push(unsubscribe)
  }

  // 同步注册监听器
  initializeAdvancedSettingsForSession()
  modelStore.startStorageSync()
  window.addEventListener('storage', handleStorageChange)
  window.addEventListener('resize', updateUIPositions)

  // 等待 connection store 初始化完成
  await ensureInitPromise

  // 并行执行快速启动期 IPC（getUserName/getPlatformCapabilities/syncRecordingShortcutState）
  // startWatching 单独后台启动，不阻塞模型加载和事件注册
  const startupOutcome = await Promise.allSettled([
    window.electron.user.getUserName(),
    window.electron.window.getPlatformCapabilities(),
    syncRecordingShortcutState(false)
  ])

  // startWatching 后台启动（不 await，避免拖慢启动）
  void window.electron.window.startWatching().then(
    result => {
      if (!result.success) {
        console.warn('[主窗口] 窗口监听启动失败:', result.error)
      }
    },
    error => {
      console.warn('[主窗口] 窗口监听启动失败:', error)
    }
  )

  const userNameOutcome = startupOutcome[0]
  if (userNameOutcome.status === 'fulfilled' && userNameOutcome.value) {
    currentUserName.value = userNameOutcome.value
  } else if (userNameOutcome.status === 'rejected') {
    console.error('[主窗口] 获取用户名称失败:', userNameOutcome.reason)
  }

  const platformOutcome = startupOutcome[1]
  if (platformOutcome.status === 'fulfilled') {
    showPlatformCompatibilityHint(platformOutcome.value)
  }
  mainWindowDisposers.push(
    window.electron.shortcut.onRecordingStart(() => {
      console.log('[主窗口] 全局快捷键：开始录音')
      void startRecording({ source: 'shortcut' })
    })
  )

  mainWindowDisposers.push(
    window.electron.shortcut.onRecordingStop(() => {
      console.log('[主窗口] 全局快捷键：停止录音')
      void stopRecording({ reason: 'shortcut' })
    })
  )

  mainWindowDisposers.push(
    window.electron.model.onPreviewMotion(payload => {
      stopIdleForPerformance()
      live2dCanvasRef.value?.playMotion(
        payload.group,
        payload.index,
        payload.priority ?? 2,
        payload.loop ?? false
      )
    })
  )

  mainWindowDisposers.push(
    window.electron.model.onPreviewExpression(payload => {
      const holdMs = payload.holdMs ?? 2500
      const resetPolicy =
        (payload.resetPolicy as CubismExpressionRequest['resetPolicy']) ?? 'neutral'
      live2dCanvasRef.value?.setExpression({
        id: payload.id,
        fade: payload.fade ?? 200,
        holdMs,
        resetPolicy
      })
    })
  )

  // 监听从设置页面加载模型的指令（只显示一次提示）
  mainWindowDisposers.push(
    window.electron.model.onLoad(async (modelPath: string) => {
      if (modelLoadInFlight) {
        console.log('[主窗口] 模型正在加载中，忽略重复请求')
        return
      }

      console.log('[主窗口] 收到模型加载指令:', modelPath)
      modelLoadInFlight = true

      try {
        await loadModelWithState(modelPath)

        // 不在这里显示提示，由 handleModelLoaded 统一处理
      } catch (error: any) {
        loadingModelPath.value = ''
        hasModel.value = false
        showModelStatus(t('main.status.modelLoadFailed', { message: error.message }), 'error')
        openModelLibraryWindowOnce()
      } finally {
        modelLoadInFlight = false
      }
    })
  )

  // 主窗口 ready 后，拉取可能在 onLoad 注册前发送的 pending model path
  let consumedPendingLoad = false
  try {
    const pendingResult = await window.electron.model.getPendingLoad()
    if (pendingResult.success && pendingResult.modelPath) {
      console.log('[主窗口] 拉取到 pending 模型加载指令:', pendingResult.modelPath)
      // 复用 onLoad 的处理逻辑，直接触发 model:load 事件处理
      if (!modelLoadInFlight) {
        modelLoadInFlight = true
        try {
          await loadModelWithState(pendingResult.modelPath)
          consumedPendingLoad = true
        } catch (error: any) {
          loadingModelPath.value = ''
          hasModel.value = false
          showModelStatus(t('main.status.modelLoadFailed', { message: error.message }), 'error')
          openModelLibraryWindowOnce()
        } finally {
          modelLoadInFlight = false
        }
      }
    }
  } catch (error) {
    console.warn('[主窗口] 拉取 pending 模型加载指令失败:', error)
  }

  mainWindowDisposers.push(
    window.electron.bridge.onPerformShow((payload: PerformSequence) => {
      console.log('收到表演指令:', summarizePerformPayloadForLog(payload))

      // 停止待机
      stopIdleForPerformance()

      const { isFollowUp } = checkFollowUp()

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
            resourceToken: connectionStore.resourceToken
          }
        )

        if (bubbleItems.length > 0) {
          latestBubbleEntryId = pushBubble(bubbleItems, position, shouldInterrupt)
        }

        if (remainingSequence.length > 0) {
          performQueue.enqueue({
            sequence: remainingSequence as PerformElement[],
            interruptible: payload.interruptible !== false
          })
        } else {
          restoreIdleIfNeeded()
        }

        // 保存表演记录和更新统计
        try {
          recordPerformanceHistory({
            sequence: payload.sequence,
            sessionId: connectionStore.sessionId || 'default',
            performanceId: generateMessageId('perf'),
            serverUserName: t('main.serverUser'),
            fallbackRawText: t('main.performSequence'),
            saveFailedMessage: t('error.saveOfflineHistoryFailed'),
            resourceContext: {
              resourceBaseUrl: connectionStore.resourceBaseUrl,
              resourcePath: connectionStore.resourcePath,
              resourceToken: connectionStore.resourceToken
            }
          })
        } catch (error) {
          console.error('[主窗口] 处理表演记录失败:', error)
        }
      }
    })
  )

  mainWindowDisposers.push(
    window.electron.bridge.onPerformInterrupt(() => {
      console.log('收到中断指令')
      interruptPerformance()
    })
  )

  const lastModelPath = modelStore.getLastModel()
  let autoLoadFailed = false
  // 如果 pending 模型加载成功，跳过自动加载（避免重复加载）
  if (consumedPendingLoad) {
    console.log('[主窗口] 已加载 pending 模型，跳过自动加载')
  } else if (advancedSettings.value.autoLoadLastModel && lastModelPath) {
    console.log('[主窗口] 自动加载上次模型:', lastModelPath)

    try {
      // loadModelWithState 内部已统一 await ensureCubismCoreLoaded()
      await loadModelWithState(lastModelPath)
      console.log('[主窗口] 自动加载成功')
    } catch (error: any) {
      console.warn('[主窗口] 自动加载失败:', error.message)
      autoLoadFailed = true
      loadingModelPath.value = ''
      // 自动加载失败，显示导入提示
      hasModel.value = false
      openModelLibraryWindowOnce()
    }
  } else {
    // 未启用自动加载或没有上次模型，显示导入提示
    hasModel.value = false
    openModelLibraryWindowOnce()
  }

  // 监听后台迁移完成（便携版首次启动时 models 迁移可能在自动加载后完成）
  if (autoLoadFailed && lastModelPath) {
    mainWindowDisposers.push(
      window.electron.migration.onBackgroundCompleted(async payload => {
        const copiedEntries = payload.copiedEntries || []
        if (copiedEntries.includes('models')) {
          console.log('[主窗口] 后台模型迁移完成，重试自动加载')
          try {
            await loadModelWithState(lastModelPath)
            console.log('[主窗口] 重试自动加载成功')
          } catch (error: any) {
            console.warn('[主窗口] 重试自动加载失败:', error.message)
          }
        }
      })
    )
  }

  // 自动注册全局快捷键
  if (advancedSettings.value.recordingShortcut) {
    const electronFormat = advancedSettings.value.recordingShortcut.replace(
      'Ctrl',
      'CommandOrControl'
    )
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
  // 停止性能监控
  if (import.meta.env.DEV) {
    const perfMonitor = getGlobalPerformanceMonitor()
    perfMonitor.stop()
  }

  for (const dispose of mainWindowDisposers.splice(0)) {
    dispose()
  }
  window.removeEventListener('storage', handleStorageChange)
  window.removeEventListener('resize', updateUIPositions)
  connectionStore.stopSync()
  modelStore.stopStorageSync()
  cleanupBubbleStack()
  releaseAllAudioWaiters()
  cleanupRecording()
})
</script>

<style scoped lang="scss" src="./main-window.scss"></style>
