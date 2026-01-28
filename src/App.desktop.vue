<template>
  <div class="app-container">
    <Live2DRenderer ref="renderer" @model-input="openModelInput" />

    <!-- 录音状态指示器 -->
    <RecordingIndicator :is-recording="isRecording" />

    <BubbleDialog
      v-if="currentText"
      :text="currentText"
      :x="bubblePos.x"
      :y="bubblePos.y"
      :duration="BUBBLE_DURATION"
      :full-content="currentFullMessage"
      :content-style="currentTextStyle"
      @hover="onBubbleHover"
      @click="onBubbleClick"
    />

    <div v-if="currentImage" class="image-display" :style="imageStyle">
      <img :src="currentImage.url" :style="imageContentStyle" @load="onImageLoad" @error="onImageError" />
    </div>


    <!-- 隐藏的文件输入 -->
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      @change="handleImageSelect"
      style="display: none"
    />

    <div v-if="inputVisible" class="input-popup" :style="inputStyle">
      <input
        ref="inputEl"
        v-model="inputText"
        class="input"
        type="text"
        placeholder="输入文字并回车发送..."
        @keydown.enter.prevent="send"
        @keydown.esc.prevent="closeInput"
        @blur="onInputBlur"
        @paste="handlePaste"
      />
      <button class="btn-attachment" type="button" @click="triggerImageSelect" title="添加图片附件">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>
      <button class="btn" type="button" @click="send">发送</button>
    </div>

    <!-- 附件预览 -->
    <div v-if="attachedImage" class="attachment-preview">
      <img :src="attachedImage" alt="附件预览" />
      <button class="btn-remove" @click="removeAttachment" title="移除附件">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import Live2DRenderer from './components/Live2DRenderer.vue'
import BubbleDialog from './components/BubbleDialog.vue'
import RecordingIndicator from './components/RecordingIndicator.vue'
import { useConnectionStore } from './stores/connection'
import { logger } from './utils/logger'
import type { SaveMessageParams } from './types/history'
import type {
  BasePacket,
  DesktopCaptureScreenshotPayload,
  DesktopOpenUrlPayload,
  DesktopTrayNotifyPayload,
  DesktopWindowClickThroughPayload,
  DesktopWindowMovePayload,
  DesktopWindowOpacityPayload,
  DesktopWindowResizePayload,
  DesktopWindowTopmostPayload,
  ModelLoadPayload,
  ModelLookAtPayload,
  ModelPlayMotionPayload,
  ModelSetExpressionPayload,
  ModelSetParameterPayload,
  ModelSpeakPayload,
  ModelStopPayload
} from './types/websocket'
import { modelService } from './services/modelService'

const renderer = ref()
const connectionStore = useConnectionStore()

const inputText = ref('')
const currentText = ref('')
const currentTextStyle = ref<Record<string, string | number> | undefined>(undefined)
const currentTextPosition = ref<'center' | 'top' | 'bottom'>('center')
const currentImage = ref<{ url: string; duration: number; position: string; size?: { width: number; height: number } } | null>(null)
const inputVisible = ref(false)
const inputPos = ref({ x: 0, y: 0 })
const inputEl = ref<HTMLInputElement | null>(null)
const bubblePos = ref({ x: window.innerWidth / 2, y: 20 })
const imageInput = ref<HTMLInputElement>()
const attachedImage = ref<string | null>(null)
const attachedImageFile = ref<File | null>(null)
const isRecording = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])
const currentConversationId = ref<number | null>(null)

// 气泡增强功能
const BUBBLE_DURATION = 5000  // 延长显示时间至 5 秒
const bubbleHovered = ref(false)
const currentFullMessage = ref<any>(null)
let bubbleRaf: number | null = null
let bubbleTimer: number | null = null
let autoClearText = false

type PerformTask = {
  sequence: any[]
  interrupt?: boolean
}

const performQueue: PerformTask[] = []
let performRunning = false
let performAbort: AbortController | null = null
let currentAudio: HTMLAudioElement | null = null
let currentSpeech: SpeechSynthesisUtterance | null = null
let currentAudioRid: string | null = null
let isPlayingState = false

// 事件监听器清理函数
let cleanupPlayMotion: (() => void) | null = null
let cleanupPlayExpression: (() => void) | null = null
let cleanupStartRecording: (() => void) | null = null
let cleanupStopRecording: (() => void) | null = null
let cleanupSettingsChanged: (() => void) | null = null

let lastConnectionSettings = {
  wsUrl: 'ws://localhost:9090/astrbot/live2d',
  token: ''
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const handleWindowResize = () => {
  syncStateConfig()
}

// Keep the WS connection in sync with persisted settings (wsUrl/token).
const applyConnectionSettings = (next?: any) => {
  const wsUrl = String(next?.wsUrl || lastConnectionSettings.wsUrl || 'ws://localhost:9090/astrbot/live2d')
  const token = String(next?.token || '')

  if (wsUrl === lastConnectionSettings.wsUrl && token === lastConnectionSettings.token) return

  lastConnectionSettings = { wsUrl, token }
  connectionStore.disconnect()
  connectionStore.connect(wsUrl, token)
}

const inputStyle = computed(() => ({
  left: `${inputPos.value.x}px`,
  top: `${inputPos.value.y}px`
}))

const imageStyle = computed(() => {
  if (!currentImage.value) return {}
  const position = currentImage.value.position || 'center'
  const style: any = {}

  if (position === 'center') {
    style.left = '50%'
    style.top = '50%'
    style.transform = 'translate(-50%, -50%)'
  } else if (position === 'top') {
    style.left = '50%'
    style.top = '20px'
    style.transform = 'translateX(-50%)'
  } else if (position === 'bottom') {
    style.left = '50%'
    style.bottom = '20px'
    style.transform = 'translateX(-50%)'
  }

  return style
})

const imageContentStyle = computed(() => {
  if (!currentImage.value?.size) return { maxWidth: '80vw', maxHeight: '80vh' }
  return {
    width: currentImage.value.size.width ? `${currentImage.value.size.width}px` : 'auto',
    height: currentImage.value.size.height ? `${currentImage.value.size.height}px` : 'auto',
    maxWidth: '80vw',
    maxHeight: '80vh'
  }
})

onMounted(async () => {
  logger.info('应用已启动')

  await initializeConversation()

  // 从 Electron 加载设置
  if (window.electronAPI?.getSettings) {
    window.electronAPI.getSettings().then((settings) => {
      logger.info('已加载设置:', settings)
      applyConnectionSettings(settings)
    })
  } else {
    applyConnectionSettings({ wsUrl: 'ws://localhost:9090/astrbot/live2d', token: '' })
  }

  // When settings are saved in the settings window, the main window should react immediately.
  if (window.electronAPI?.onSettingsChanged) {
    cleanupSettingsChanged = window.electronAPI.onSettingsChanged((nextSettings) => {
      applyConnectionSettings(nextSettings)
    })
  }

  // 监听连接状态变化，通知主进程更新托盘菜单
  if (window.electronAPI?.updateConnectionStatus) {
    connectionStore.$subscribe((_mutation, state) => {
      window.electronAPI?.updateConnectionStatus(state.connected)
    })
  }

  connectionStore.onPerform((sequence, interrupt) => {
    enqueuePerformSequence(sequence, interrupt)
  })
  connectionStore.onPerformInterrupt(() => {
    interruptPerform('remote')
  })
  connectionStore.onCommand((packet) => {
    void handleCommandPacket(packet)
  })
  connectionStore.onState((packet) => {
    if (packet.op === 'state.ready') {
      syncStateConfig()
    }
  })

  // 监听来自设置窗口的播放指令
  if (window.electronAPI?.onPlayMotion) {
    cleanupPlayMotion = window.electronAPI.onPlayMotion((group, index) => {
      logger.debug(`播放动作: ${group} #${index}`)
      renderer.value?.playMotion(group, index)
    })
  }

  if (window.electronAPI?.onPlayExpression) {
    cleanupPlayExpression = window.electronAPI.onPlayExpression((expressionId) => {
      logger.debug(`播放表情: ${expressionId}`)
      renderer.value?.setExpression(expressionId)
    })
  }

  // 监听全局快捷键录音指令
  if (window.electronAPI?.onStartRecording) {
    cleanupStartRecording = window.electronAPI.onStartRecording(() => {
      logger.debug('收到开始录音指令')
      startRecording()
    })
  }

  if (window.electronAPI?.onStopRecording) {
    cleanupStopRecording = window.electronAPI.onStopRecording(() => {
      logger.debug('收到停止录音指令')
      stopRecording()
    })
  }

  window.addEventListener('resize', handleWindowResize)
  window.setTimeout(() => {
    syncStateConfig()
  }, 800)
})

const enqueuePerformSequence = (sequence: any[], interrupt?: boolean) => {
  const shouldInterrupt = interrupt !== false
  if (shouldInterrupt) {
    interruptPerform('perform.show')
  }
  performQueue.push({ sequence, interrupt: shouldInterrupt })
  void runPerformQueue()
}

const runPerformQueue = async () => {
  if (performRunning) return
  performRunning = true
  updatePlayingState(true)

  while (performQueue.length > 0) {
    const task = performQueue.shift()
    if (!task) break
    performAbort = new AbortController()
    try {
      currentFullMessage.value = task.sequence
      await runPerformSequence(task.sequence, performAbort.signal)
    } catch (error) {
      if (!performAbort.signal.aborted) {
        logger.error('执行表演序列失败:', error)
      }
    }
    if (performAbort.signal.aborted) {
      break
    }
  }

  performAbort = null
  performRunning = false
  updatePlayingState(false)
}

const runPerformSequence = async (sequence: any[], signal: AbortSignal) => {
  for (const item of sequence ?? []) {
    if (signal.aborted) return
    await executePerformItem(item, signal)
    await recordPerformItem(item)
  }
}

const executePerformItem = async (item: any, signal: AbortSignal) => {
  if (!item?.type || signal.aborted) return

  if (item.type === 'text') {
    await showTextItem(item, signal)
    return
  }

  if (item.type === 'image') {
    await showImageItem(item, signal)
    return
  }

  if (item.type === 'motion') {
    // 处理带有动作类型的动作
    if (item.motionType) {
      const { motionService } = await import('./services/motionManagement')
      const motionAssignment = motionService.getRandomMotionForType(item.motionType)
      
      if (motionAssignment) {
        renderer.value?.playMotion(motionAssignment.groupId, motionAssignment.index, item.priority)
        logger.debug(`播放类型化动作: ${item.motionType} -> ${motionAssignment.motionName}`)
        return
      } else {
        logger.debug(`动作类型 ${item.motionType} 没有分配动作，使用原始动作`)
      }
    }
    
    // 回退到原始动作
    renderer.value?.playMotion(item.group, item.index, item.priority)
    return
  }

  if (item.type === 'expression') {
    // 处理带有动作类型的表情
    const expressionId = item.id || item.expressionId
    if (item.motionType) {
      const { motionService } = await import('./services/motionManagement')
      const expressionAssignment = motionService.getRandomExpressionForType(item.motionType)
      
      if (expressionAssignment) {
        renderer.value?.setExpression(expressionAssignment.motionId)
        logger.debug(`播放类型化表情: ${item.motionType} -> ${expressionAssignment.motionName}`)
        return
      } else {
        logger.debug(`动作类型 ${item.motionType} 没有分配表情，使用原始表情`)
      }
    }
    
    // 回退到原始表情
    if (expressionId) {
      renderer.value?.setExpression(expressionId)
    }
    return
  }

  if (item.type === 'tts') {
    await playTTSItem(item, signal)
    return
  }

  if (item.type === 'wait') {
    const duration = Math.max(0, Number(item.duration) || 0)
    await waitWithAbort(duration, signal)
  }
}

const updatePlayingState = (playing: boolean) => {
  if (isPlayingState === playing) return
  isPlayingState = playing
  connectionStore.sendStatePlaying(playing)
}

const interruptPerform = (source: string) => {
  // 中断当前表演，清理队列与 UI 状态
  logger.debug(`中断表演: ${source}`)
  performQueue.length = 0
  if (performAbort) {
    performAbort.abort()
  }
  stopAllMedia()
  clearText()
  currentImage.value = null
  updatePlayingState(false)
}

const waitWithAbort = (duration: number, signal: AbortSignal) => {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    const timer = window.setTimeout(() => {
      cleanup()
      resolve()
    }, duration)
    const cleanup = () => {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

const showTextItem = async (item: any, signal: AbortSignal) => {
  const textContent = item.content ?? item.text ?? ''
  currentText.value = String(textContent)
  currentTextStyle.value = normalizeBubbleStyle(item.style)
  currentTextPosition.value = item.position || 'center'
  bubbleHovered.value = false

  startBubbleTracking()
  renderer.value?.setUiInteracting?.(true)

  if (bubbleTimer) {
    window.clearTimeout(bubbleTimer)
    bubbleTimer = null
  }

  const rawDuration = item.duration
  const parsedDuration = Number(rawDuration)
  const duration = Number.isFinite(parsedDuration) && parsedDuration > 0
    ? parsedDuration
    : BUBBLE_DURATION
  autoClearText = true
  bubbleTimer = window.setTimeout(() => {
    if (!bubbleHovered.value) {
      clearText()
    }
  }, duration)
  await waitWithAbort(duration, signal)
}

const showImageItem = async (item: any, signal: AbortSignal) => {
  const resolved = await resolveResource(item)
  if (!resolved?.url || signal.aborted) return

  const duration = Math.max(0, Number(item.duration) || 5000)
  currentImage.value = {
    url: resolved.url,
    duration,
    position: item.position || 'center',
    size: item.size
  }

  await waitWithAbort(duration, signal)
  currentImage.value = null
  if (resolved.rid) {
    await releaseResourceSafely(resolved.rid)
  }
}

const playTTSItem = async (item: any, signal: AbortSignal) => {
  const ttsMode = item.ttsMode || 'remote'
  if (ttsMode === 'remote') {
    const resolved = await resolveResource(item)
    if (!resolved?.url || signal.aborted) return
    await playRemoteAudio(resolved.url, item, signal, resolved.rid)
    return
  }

  if (ttsMode === 'local' && item.text) {
    await playLocalSpeech(item.text, item, signal)
  }
}

const playRemoteAudio = async (
  url: string,
  item: any,
  signal: AbortSignal,
  rid?: string
) => {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    const audio = new Audio(url)
    currentAudio = audio
    currentAudioRid = rid || null
    audio.volume = item.volume || 1.0
    audio.playbackRate = item.speed || 1.0

    const cleanup = async () => {
      if (currentAudio === audio) {
        currentAudio = null
        currentAudioRid = null
      }
      signal.removeEventListener('abort', onAbort)
      if (rid) {
        await releaseResourceSafely(rid)
      }
      resolve()
    }

    const onAbort = () => {
      audio.pause()
      audio.currentTime = 0
      cleanup()
    }

    audio.onended = () => {
      cleanup()
    }
    audio.onerror = () => {
      cleanup()
    }

    signal.addEventListener('abort', onAbort, { once: true })
    audio.play().catch(() => cleanup())
  })
}

const playLocalSpeech = async (text: string, item: any, signal: AbortSignal) => {
  return new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) {
      logger.error('浏览器不支持Web Speech API')
      return resolve()
    }
    const utterance = new SpeechSynthesisUtterance(text)
    currentSpeech = utterance
    utterance.voice = item.voice || null
    utterance.volume = item.volume || 1.0
    utterance.rate = item.speed || 1.0

    const cleanup = () => {
      if (currentSpeech === utterance) {
        currentSpeech = null
      }
      signal.removeEventListener('abort', onAbort)
      resolve()
    }

    const onAbort = () => {
      window.speechSynthesis.cancel()
      cleanup()
    }

    utterance.onend = () => cleanup()
    utterance.onerror = () => cleanup()

    signal.addEventListener('abort', onAbort, { once: true })
    window.speechSynthesis.speak(utterance)
  })
}

const stopAllMedia = () => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if (currentSpeech) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    currentSpeech = null
  }
  if (currentAudioRid) {
    void releaseResourceSafely(currentAudioRid)
    currentAudioRid = null
  }
}

const clearText = () => {
  if (bubbleTimer) {
    window.clearTimeout(bubbleTimer)
    bubbleTimer = null
  }
  currentText.value = ''
  currentTextStyle.value = undefined
  currentFullMessage.value = null
  bubbleHovered.value = false
  autoClearText = false
  stopBubbleTracking()
  renderer.value?.setUiInteracting?.(false)
}

const normalizeBubbleStyle = (style: unknown) => {
  if (!style || typeof style !== 'object') return undefined
  const normalized: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(style as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number') {
      normalized[key] = value
    }
  }
  return Object.keys(normalized).length ? normalized : undefined
}

const resolveResource = async (item: any) => {
  if (item.url) return { url: item.url, rid: undefined }
  if (item.inline) return { url: item.inline, rid: undefined }
  if (item.rid) {
    const resource = await connectionStore.getResource(item.rid)
    return { url: resource?.url || resource?.inline || '', rid: item.rid }
  }
  return null
}

const releaseResourceSafely = async (rid: string) => {
  if (!rid || !connectionStore.hasCapability('resource.release')) return
  try {
    await connectionStore.releaseResource(rid)
  } catch (error) {
    logger.debug('资源释放失败:', error)
  }
}

const syncStateConfig = () => {
  if (!connectionStore.connected) return
  const info = renderer.value?.getModelInfo?.()
  const modelId = info?.modelInfo?.name || info?.modelInfo?.id || info?.modelInfo?.modelId
  connectionStore.sendStateConfig({
    modelId,
    screen: { w: window.innerWidth, h: window.innerHeight }
  })
}

const handleCommandPacket = async (packet: BasePacket) => {
  if (!packet?.op) return
  if (packet.op.startsWith('model.')) {
    await handleModelCommand(packet)
    return
  }
  if (packet.op.startsWith('desktop.')) {
    await handleDesktopCommand(packet)
  }
}

const handleModelCommand = async (packet: BasePacket) => {
  if (packet.op === 'model.list') {
    try {
      const models = await modelService.getAvailableModels()
      connectionStore.sendPacket(packet.op, {
        models: models.map((model) => ({
          id: model.id || model.name,
          name: model.name,
          path: model.path,
          thumbnail: model.thumbnail,
          description: model.description
        }))
      }, packet.id)
    } catch (error) {
      connectionStore.sendError(packet.id, 5004, '模型列表获取失败')
    }
    return
  }

  if (packet.op === 'model.load') {
    const payload = (packet.payload ?? {}) as ModelLoadPayload
    const modelId = payload.modelId || payload.modelName
    if (!modelId) {
      connectionStore.sendError(packet.id, 4003, '缺少 modelId')
      return
    }
    try {
      const modelInfo = await modelService.getModelById(modelId)
      const targetName = modelInfo?.name || modelId
      const result = await renderer.value?.reloadModel?.(targetName)
      if (!result?.success) {
        connectionStore.sendError(packet.id, 5003, result?.error || '模型加载失败')
        return
      }
      connectionStore.sendPacket(packet.op, { success: true, modelId: targetName }, packet.id)
      syncStateConfig()
    } catch (error) {
      connectionStore.sendError(packet.id, 5003, '模型加载失败')
    }
    return
  }

  if (packet.op === 'model.unload') {
    const result = await renderer.value?.unloadModel?.()
    if (!result?.success) {
      connectionStore.sendError(packet.id, 5003, result?.error || '模型卸载失败')
      return
    }
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'model.state') {
    const info = renderer.value?.getModelInfo?.()
    const modelInfo = info?.modelInfo
    connectionStore.sendPacket(packet.op, {
      modelId: modelInfo?.name,
      modelName: modelInfo?.name,
      position: info?.position,
      scale: info?.scale,
      size: info ? { width: info.width, height: info.height } : undefined,
      motions: modelInfo?.motionGroups,
      expressions: modelInfo?.expressions
    }, packet.id)
    return
  }

  if (packet.op === 'model.setExpression') {
    const payload = (packet.payload ?? {}) as ModelSetExpressionPayload
    const expressionId = payload.expressionId
    if (!expressionId) {
      connectionStore.sendError(packet.id, 4003, '缺少 expressionId')
      return
    }
    renderer.value?.setExpression?.(expressionId)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'model.playMotion') {
    const payload = (packet.payload ?? {}) as ModelPlayMotionPayload
    const parsed = parseMotionPayload(payload)
    if (!parsed.group) {
      connectionStore.sendError(packet.id, 4003, '缺少 motionId 或 group')
      return
    }
    renderer.value?.playMotion?.(parsed.group, parsed.index, parsed.priority)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'model.setParameter') {
    const payload = (packet.payload ?? {}) as ModelSetParameterPayload
    if (!payload.name || typeof payload.value !== 'number') {
      connectionStore.sendError(packet.id, 4003, '参数不完整')
      return
    }
    const ok = renderer.value?.setParameter?.(payload.name, payload.value, payload.blend)
    if (!ok) {
      connectionStore.sendError(packet.id, 5004, '参数设置不支持')
      return
    }
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'model.lookAt') {
    const payload = (packet.payload ?? {}) as ModelLookAtPayload
    if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
      connectionStore.sendError(packet.id, 4003, '缺少 x/y')
      return
    }
    const ok = renderer.value?.lookAt?.(payload.x, payload.y, payload.smooth)
    if (!ok) {
      connectionStore.sendError(packet.id, 5004, '注视控制不支持')
      return
    }
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'model.speak') {
    const payload = (packet.payload ?? {}) as ModelSpeakPayload
    if (!payload.text && !payload.rid && !payload.url && !payload.inline) {
      connectionStore.sendError(packet.id, 4003, '缺少文本或音频资源')
      return
    }
    const resolved = await resolveResource(payload)
    const signal = new AbortController()
    if (payload.text) {
      await playLocalSpeech(payload.text, payload, signal.signal)
    } else if (resolved?.url) {
      await playRemoteAudio(resolved.url, payload, signal.signal, resolved.rid)
    }
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'model.stop') {
    const payload = (packet.payload ?? {}) as ModelStopPayload
    const scope = payload.scope || 'all'
    let supported = true
    if (scope === 'speech' || scope === 'all') {
      stopAllMedia()
    }
    if (scope === 'motion') {
      supported = !!renderer.value?.stopMotion?.()
    }
    if (scope === 'expression') {
      supported = !!renderer.value?.resetExpression?.()
    }
    if (scope === 'all') {
      clearText()
      currentImage.value = null
      renderer.value?.stopMotion?.()
      renderer.value?.resetExpression?.()
    }
    if (!supported) {
      connectionStore.sendError(packet.id, 5004, '停止动作/表情不支持')
      return
    }
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op.startsWith('model.')) {
    connectionStore.sendError(packet.id, 5004, '不支持的模型指令')
  }
}

const parseMotionPayload = (payload: ModelPlayMotionPayload) => {
  if (payload.motionId && typeof payload.motionId === 'string') {
    const parts = payload.motionId.split(':')
    return {
      group: parts[0],
      index: parts[1] ? Number(parts[1]) : undefined,
      priority: payload.priority
    }
  }
  return {
    group: payload.group,
    index: payload.index,
    priority: payload.priority
  }
}

const handleDesktopCommand = async (packet: BasePacket) => {
  if (!window.electronAPI) {
    connectionStore.sendError(packet.id, 5004, '桌面指令仅支持 Electron 环境')
    return
  }

  if (packet.op === 'desktop.window.show') {
    if (!window.electronAPI.showWindow) {
      connectionStore.sendError(packet.id, 5004, '窗口显示能力不可用')
      return
    }
    await window.electronAPI.showWindow()
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.window.hide') {
    if (!window.electronAPI.hideWindow) {
      connectionStore.sendError(packet.id, 5004, '窗口隐藏能力不可用')
      return
    }
    await window.electronAPI.hideWindow()
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.window.move') {
    const payload = (packet.payload ?? {}) as DesktopWindowMovePayload
    if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
      connectionStore.sendError(packet.id, 4003, '缺少 x/y')
      return
    }
    if (!window.electronAPI.setWindowPosition) {
      connectionStore.sendError(packet.id, 5004, '窗口移动能力不可用')
      return
    }
    await window.electronAPI.setWindowPosition(payload.x, payload.y)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.window.resize') {
    const payload = (packet.payload ?? {}) as DesktopWindowResizePayload
    if (typeof payload.w !== 'number' || typeof payload.h !== 'number') {
      connectionStore.sendError(packet.id, 4003, '缺少 w/h')
      return
    }
    if (!window.electronAPI.setWindowSize) {
      connectionStore.sendError(packet.id, 5004, '窗口缩放能力不可用')
      return
    }
    await window.electronAPI.setWindowSize(payload.w, payload.h)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.window.setOpacity') {
    const payload = (packet.payload ?? {}) as DesktopWindowOpacityPayload
    if (typeof payload.opacity !== 'number') {
      connectionStore.sendError(packet.id, 4003, '缺少 opacity')
      return
    }
    if (!window.electronAPI.setWindowOpacity) {
      connectionStore.sendError(packet.id, 5004, '透明度设置不可用')
      return
    }
    await window.electronAPI.setWindowOpacity(payload.opacity)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.window.setTopmost') {
    const payload = (packet.payload ?? {}) as DesktopWindowTopmostPayload
    if (typeof payload.topmost !== 'boolean') {
      connectionStore.sendError(packet.id, 4003, '缺少 topmost')
      return
    }
    if (!window.electronAPI.setWindowTopmost) {
      connectionStore.sendError(packet.id, 5004, '置顶设置不可用')
      return
    }
    await window.electronAPI.setWindowTopmost(payload.topmost)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.window.setClickThrough') {
    const payload = (packet.payload ?? {}) as DesktopWindowClickThroughPayload
    const enabled = !!payload.enabled
    const forward = !!payload.forward
    if (!window.electronAPI.setIgnoreMouseEvents) {
      connectionStore.sendError(packet.id, 5004, '点击穿透设置不可用')
      return
    }
    await window.electronAPI.setIgnoreMouseEvents(enabled, forward ? { forward } : undefined)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.tray.notify') {
    const payload = (packet.payload ?? {}) as DesktopTrayNotifyPayload
    if (!payload.title || !payload.message) {
      connectionStore.sendError(packet.id, 4003, '缺少通知内容')
      return
    }
    if (!window.electronAPI.trayNotify) {
      connectionStore.sendError(packet.id, 5004, '系统通知不可用')
      return
    }
    await window.electronAPI.trayNotify(payload.title, payload.message, payload.icon)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.openUrl') {
    const payload = (packet.payload ?? {}) as DesktopOpenUrlPayload
    if (!payload.url) {
      connectionStore.sendError(packet.id, 4003, '缺少 url')
      return
    }
    if (!window.electronAPI.openExternal) {
      connectionStore.sendError(packet.id, 5004, '打开链接能力不可用')
      return
    }
    await window.electronAPI.openExternal(payload.url)
    connectionStore.sendPacket(packet.op, { success: true }, packet.id)
    return
  }

  if (packet.op === 'desktop.capture.screenshot') {
    const payload = (packet.payload ?? {}) as DesktopCaptureScreenshotPayload
    if (!window.electronAPI.captureScreenshot) {
      connectionStore.sendError(packet.id, 5004, '截图能力不可用')
      return
    }
    try {
      const screenshot = await window.electronAPI.captureScreenshot(payload.format, payload.quality)
      if (!screenshot?.success || !screenshot.dataUrl) {
        connectionStore.sendError(packet.id, 5003, '截图失败')
        return
      }
      const response = await fetch(screenshot.dataUrl)
      const blob = await response.blob()
      const resource = await connectionStore.prepareBinaryResource('image', blob, screenshot.mime)
      connectionStore.sendPacket(packet.op, {
        resource: resource ? {
          rid: resource.rid,
          inline: resource.inline,
          mime: resource.mime,
          size: resource.size
        } : null
      }, packet.id)
    } catch (error) {
      connectionStore.sendError(packet.id, 5005, '截图上传失败')
    }
    return
  }

  if (packet.op.startsWith('desktop.')) {
    connectionStore.sendError(packet.id, 5004, '不支持的桌面指令')
  }
}

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)

  interruptPerform('unmount')

  // 清理气泡跟踪动画
  stopBubbleTracking()

  // 清理气泡定时器
  if (bubbleTimer) {
    window.clearTimeout(bubbleTimer)
    bubbleTimer = null
  }

  // 清理录音资源
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    mediaRecorder.value = null
  }
  
  // 清理音频资源
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
  
  if (currentSpeech) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    currentSpeech = null
  }

  // 清理事件监听器
  cleanupPlayMotion?.()
  cleanupPlayExpression?.()
  cleanupStartRecording?.()
  cleanupStopRecording?.()
  cleanupSettingsChanged?.()

  // 清理资源ID
  if (currentAudioRid) {
    void releaseResourceSafely(currentAudioRid)
    currentAudioRid = null
  }

  // 断开 WebSocket 连接
  connectionStore.disconnect()
  
  // 强制垃圾回收提示（如果可用）
  if (window.gc) {
    window.gc()
  }
})

// 创建节流函数优化气泡跟踪
const createBubbleTracker = () => {
  let lastUpdateTime = 0
  const updateInterval = 16 // 约60fps

  const tick = () => {
    if (bubbleRaf === null) return
    
    const now = performance.now()
    if (now - lastUpdateTime < updateInterval) {
      bubbleRaf = window.requestAnimationFrame(tick)
      return
    }
    
    lastUpdateTime = now
    
    const info = renderer.value?.getModelInfo?.()
    if (!info?.position) {
      bubbleRaf = window.requestAnimationFrame(tick)
      return
    }

    // 假设 model.anchor = (0.5, 0.5) 时：position 为中心点
    const headX = info.position.x
    const headY = info.position.y - info.height * 0.5

    const padding = 12
    const x = clamp(headX, padding, window.innerWidth - padding)
    let y = headY - 12
    if (currentTextPosition.value === 'top') {
      y = headY - info.height * 0.6
    } else if (currentTextPosition.value === 'bottom') {
      y = headY + info.height * 0.6
    }
    y = clamp(y, padding, window.innerHeight - padding)
    
    // 只在位置真正改变时更新
    if (bubblePos.value.x !== x || bubblePos.value.y !== y) {
      bubblePos.value = { x, y }
    }
    
    bubbleRaf = window.requestAnimationFrame(tick)
  }

  return tick
}

const startBubbleTracking = () => {
  if (bubbleRaf !== null) return

  const tick = createBubbleTracker()
  bubbleRaf = window.requestAnimationFrame(tick)
}

const stopBubbleTracking = () => {
  if (bubbleRaf !== null) {
    window.cancelAnimationFrame(bubbleRaf)
    bubbleRaf = null
  }
}

// 气泡悬停处理
const onBubbleHover = (isHovered: boolean) => {
  bubbleHovered.value = isHovered

  if (isHovered) {
    // 鼠标进入时清除定时器并锁定拦截模式
    if (bubbleTimer) {
      window.clearTimeout(bubbleTimer)
      bubbleTimer = null
    }
    renderer.value?.setUiInteracting?.(true)
  } else {
    // 鼠标离开时延迟 1 秒后消失
    if (currentText.value && autoClearText) {
      bubbleTimer = window.setTimeout(() => {
        currentText.value = ''
        currentFullMessage.value = null
        stopBubbleTracking()
        bubbleTimer = null
        // 解锁穿透状态，恢复自动检测
        renderer.value?.setUiInteracting?.(false)
      }, 1000)
    }
  }
}

// 气泡点击处理
const onBubbleClick = () => {
  if (currentText.value && window.electronAPI?.openMessageDetail) {
    // 只传递文本内容，避免序列化错误
    window.electronAPI.openMessageDetail({
      type: 'text',
      content: currentText.value
    })
  }
}

const openModelInput = async (payload: { x: number; y: number }) => {
  const popupWidth = 280 + 12 + 44 + 20 + 44 // input + gaps + buttons + padding（用于边界 clamp 的估算值）
  const popupHeight = 44 + 32 // button + padding
  const padding = 20

  const x = clamp(payload.x, padding + popupWidth / 2, window.innerWidth - padding - popupWidth / 2)
  // 弹在点击点上方一点，更"贴近头部"
  const y = clamp(payload.y - 60, padding, window.innerHeight - padding - popupHeight)

  inputPos.value = { x, y }
  inputVisible.value = true

  // 输入期间锁定拦截，避免穿透导致无法输入
  renderer.value?.setUiInteracting?.(true)
  await window.electronAPI?.setWindowFocusable?.(true)

  await nextTick()
  inputEl.value?.focus()
  
  // 添加输入音效反馈（如果需要）
  if ((window.electronAPI as any)?.playSound) {
    (window.electronAPI as any).playSound('input_open')
  }
}

const closeInput = () => {
  // 延迟关闭，给用户更好的视觉反馈
  setTimeout(() => {
    inputVisible.value = false
    renderer.value?.setUiInteracting?.(false)
    window.electronAPI?.setWindowFocusable?.(false)
  }, 100)
}

const onInputBlur = (e: FocusEvent) => {
  const next = e.relatedTarget as HTMLElement | null
  // 点击弹窗内的按钮会导致 input blur；此时不应关闭弹窗
  if (next && next.closest('.input-popup')) return
  closeInput()
}

const send = async () => {
  const text = inputText.value.trim()
  const hasAttachment = !!attachedImage.value

  if (!text && !hasAttachment) return

  // 禁用发送按钮，防止重复发送
  const sendButton = document.querySelector('.btn') as HTMLButtonElement
  if (sendButton) {
    sendButton.disabled = true
    sendButton.textContent = '发送中...'
  }

  // 构建消息内容
  const content: Array<{ type: string; [key: string]: any }> = []

  if (text) {
    content.push({ type: 'text', text })
  }

  const attachmentFile = attachedImageFile.value
  if (hasAttachment && attachedImageFile.value) {
    content.push({ type: 'image', file: attachedImageFile.value })
  }

  try {
    await connectionStore.sendMessage(content)
    
    // 保存用户消息到本地
    if (text) {
      await saveUserMessage('text', text, { text })
    }
    if (hasAttachment && attachmentFile) {
      await saveUserMessage('image', attachmentFile.name || 'image', {
        name: attachmentFile.name,
        size: attachmentFile.size,
        type: attachmentFile.type
      })
    }

    // 清空输入
    inputText.value = ''
    attachedImage.value = null
    attachedImageFile.value = null
    closeInput()
  } catch (error) {
    logger.error('发送消息失败:', error)
    // 显示错误提示
    if (text) {
      currentText.value = '发送失败，请重试'
      currentTextStyle.value = { color: '#ff6b6b' }
      setTimeout(() => {
        clearText()
      }, 2000)
    }
  } finally {
    // 恢复发送按钮
    if (sendButton) {
      sendButton.disabled = false
      sendButton.textContent = '发送'
    }
  }
}

const onImageLoad = () => {
  logger.debug('图片加载成功')
}

const onImageError = () => {
  logger.error('图片加载失败')
  currentImage.value = null
}

// 触发图片选择
const triggerImageSelect = () => {
  if (!connectionStore.connected) {
    logger.warn('未连接到服务器')
    return
  }
  imageInput.value?.click()
}

// 处理图片选择
const handleImageSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  try {
    const reader = new FileReader()
    reader.onload = () => {
      attachedImage.value = reader.result as string
      attachedImageFile.value = file
      logger.debug('已添加图片附件')
    }

    reader.onerror = () => {
      logger.error('读取图片失败')
    }

    reader.readAsDataURL(file)
  } catch (error) {
    logger.error('处理图片失败:', error)
  } finally {
    target.value = ''
  }
}

// 处理粘贴事件
const handlePaste = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) continue

      const reader = new FileReader()
      reader.onload = () => {
        attachedImage.value = reader.result as string
        attachedImageFile.value = file
        logger.debug('已粘贴图片附件')
      }
      reader.readAsDataURL(file)
      break
    }
  }
}

// 移除附件
const removeAttachment = () => {
  attachedImage.value = null
  attachedImageFile.value = null
}

// 检测浏览器支持的最佳音频格式
const detectBestAudioFormat = (): string => {
  const supportedFormats = [
    'audio/webm;codecs=opus',     // 优先：WebM + Opus（最佳压缩率和质量）
    'audio/ogg;codecs=opus',      // 次选：Ogg + Opus
    'audio/webm',                 // WebM 默认编码
    'audio/mp4',                  // MP4 容器
    'audio/mpeg',                 // MPEG 音频
    'audio/wav',                  // WAV（无损，文件较大）
  ]

  for (const format of supportedFormats) {
    if (MediaRecorder.isTypeSupported(format)) {
      logger.debug(`选择音频格式: ${format}`)
      return format
    }
  }

  // 降级到浏览器默认格式
  logger.warn('未找到支持的音频格式，使用默认格式')
  return ''
}

// 开始录音
const startRecording = async () => {
  if (!connectionStore.connected) {
    logger.warn('未连接到服务器')
    return
  }

  if (isRecording.value) return

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = detectBestAudioFormat()

    // 使用检测到的格式创建 MediaRecorder
    const options = mimeType ? { mimeType } : undefined
    mediaRecorder.value = new MediaRecorder(stream, options)
    audioChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      // 使用 MediaRecorder 实际使用的 mimeType
      const actualMimeType = mediaRecorder.value?.mimeType || mimeType || 'audio/webm'
      const audioBlob = new Blob(audioChunks.value, { type: actualMimeType })
      await sendVoiceMessage(audioBlob)

      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.value.start()
    isRecording.value = true
    logger.info('开始录音，格式:', mediaRecorder.value.mimeType)
  } catch (error) {
    logger.error('启动录音失败:', error)
  }
}

// 停止录音
const stopRecording = () => {
  if (!isRecording.value || !mediaRecorder.value) return

  mediaRecorder.value.stop()
  isRecording.value = false
  logger.info('停止录音')
}

// 发送语音消息
const sendVoiceMessage = async (audioBlob: Blob) => {
  try {
    await connectionStore.sendMessage([
      {
        type: 'voice',
        file: audioBlob,
        sttMode: 'remote'
      }
    ])

    await saveUserMessage('voice', '语音消息', {
      size: audioBlob.size,
      type: audioBlob.type
    })

    logger.info('已发送语音消息')
  } catch (error) {
    logger.error('发送语音消息失败:', error)
  }
}

const initializeConversation = async () => {
  if (!window.electronAPI) return

  try {
    const activeConv = await window.electronAPI.dbGetActiveConversation()
    if (activeConv?.id) {
      currentConversationId.value = activeConv.id
      logger.info(`加载激活对话: ${activeConv.id}`)
    } else {
      const convId = await window.electronAPI.dbCreateConversation('默认对话')
      currentConversationId.value = convId
      logger.info(`创建默认对话: ${convId}`)
    }
  } catch (error) {
    logger.error('初始化对话失败:', error)
  }
}

const getCurrentConversationId = async (): Promise<number> => {
  if (currentConversationId.value !== null) {
    return currentConversationId.value
  }

  if (!window.electronAPI) {
    throw new Error('electronAPI 未初始化')
  }

  const convId = await window.electronAPI.dbCreateConversation('新对话')
  currentConversationId.value = convId
  logger.info(`创建新对话: ${convId}`)
  return convId
}

const buildStatisticsUpdate = (sender: 'user' | 'ai', messageType: string) => {
  const updates: Record<string, number> = {
    total_messages: 1
  }

  if (sender === 'user') {
    updates.user_messages = 1
  } else {
    updates.ai_messages = 1
  }

  if (messageType === 'text') {
    updates.text_messages = 1
  }
  if (messageType === 'image') {
    updates.image_messages = 1
  }
  if (messageType === 'voice') {
    updates.voice_messages = 1
  }

  return updates
}

const updateDailyStatistics = async (updates: Record<string, number>) => {
  if (!window.electronAPI) return

  try {
    const today = new Date().toISOString().split('T')[0]
    await window.electronAPI.dbUpdateStatistics({
      stat_date: today,
      ...updates
    })
  } catch (error) {
    logger.error('更新统计失败:', error)
  }
}

const saveMessage = async (
  sender: 'user' | 'ai',
  messageType: string,
  content: string,
  rawData: Record<string, any>
) => {
  if (!window.electronAPI) {
    return
  }

  try {
    const convId = await getCurrentConversationId()
    const params: SaveMessageParams = {
      conversation_id: convId,
      sender,
      message_type: messageType as SaveMessageParams['message_type'],
      content,
      raw_data: JSON.stringify(rawData ?? {}),
      timestamp: Date.now()
    }

    await window.electronAPI.dbSaveMessage(params)
    await updateDailyStatistics(buildStatisticsUpdate(sender, messageType))
  } catch (error) {
    logger.error('保存消息失败:', error)
  }
}

const saveUserMessage = async (messageType: string, content: string, rawData: Record<string, any>) => {
  await saveMessage('user', messageType, content, rawData)
}

const saveAIMessage = async (messageType: string, content: string, rawData: Record<string, any>) => {
  await saveMessage('ai', messageType, content, rawData)
}

const recordPerformItem = async (item: any) => {
  if (!item?.type) return

  if (item.type === 'text') {
    const textContent = item.content ?? item.text ?? ''
    await saveAIMessage('text', String(textContent || ''), item)
  } else if (item.type === 'image') {
    const imageRes = await resolveResource(item)
    await saveAIMessage('image', imageRes?.url || '', item)
  } else if (item.type === 'motion') {
    const payload = `${item.group ?? ''}:${item.index ?? ''}`
    await saveAIMessage('motion', payload, item)
  } else if (item.type === 'expression') {
    const expressionId = item.id || item.expressionId || ''
    await saveAIMessage('expression', expressionId, item)
  } else if (item.type === 'tts') {
    const ttsContent = item.text || item.url || item.inline || item.rid || ''
    await saveAIMessage('tts', ttsContent, item)
  }
}

</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.input-popup {
  position: fixed;
  display: flex;
  gap: 12px;
  z-index: 1000;
  transform: translateX(-50%);
  animation: slideUp 0.2s ease-out;
  padding: 16px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.75) 100%);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.input {
  width: 280px;
  height: 44px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
  outline: none;
  font-size: 15px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.input:focus {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.btn {
  height: 44px;
  padding: 0 20px;
  min-width: 72px;
  white-space: nowrap;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  outline: none;
}

.btn:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.12) 100%);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.image-display {
  position: fixed;
  z-index: 999;
  pointer-events: none;
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.image-display img {
  display: block;
  border-radius: 16px;
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.25),
    0 4px 12px rgba(0, 0, 0, 0.15);
  object-fit: contain;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}


.btn-attachment {
  height: 44px;
  width: 44px;
  padding: 0;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%);
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  outline: none;
}

.btn-attachment:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.10) 100%);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: rgba(255, 255, 255, 1);
}

.btn-attachment:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.attachment-preview {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 100%);
  border-radius: 16px;
  padding: 12px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(20px);
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.4),
    0 4px 12px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: fadeInUp 0.3s ease-out;
}

.attachment-preview img {
  max-width: 120px;
  max-height: 120px;
  border-radius: 12px;
  object-fit: contain;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-remove {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  outline: none;
}

.btn-remove:hover {
  background: linear-gradient(135deg, rgba(239, 68, 68, 1) 0%, rgba(220, 38, 38, 1) 100%);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.btn-remove:active {
  transform: scale(0.95);
}
</style>
