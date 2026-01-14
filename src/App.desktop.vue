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

const renderer = ref()
const connectionStore = useConnectionStore()

const inputText = ref('')
const currentText = ref('')
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

// 事件监听器清理函数
let cleanupPlayMotion: (() => void) | null = null
let cleanupPlayExpression: (() => void) | null = null
let cleanupStartRecording: (() => void) | null = null
let cleanupStopRecording: (() => void) | null = null

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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
      const wsUrl = settings?.wsUrl || 'ws://localhost:8765/ws'
      const token = settings?.token || ''
      connectionStore.connect(wsUrl, token)
    })
  } else {
    connectionStore.connect('ws://localhost:8765/ws', '')
  }

  // 监听连接状态变化，通知主进程更新托盘菜单
  if (window.electronAPI?.updateConnectionStatus) {
    connectionStore.$subscribe((_mutation, state) => {
      window.electronAPI?.updateConnectionStatus(state.connected)
    })
  }

  connectionStore.onPerform((sequence) => {
    void handlePerformSequence(sequence)
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
})

const handlePerformSequence = async (sequence: any[]) => {
  const firstText = sequence?.find?.((x: any) => x?.type === 'text')
  const textContent = firstText?.content ?? firstText?.text
  if (textContent) {
    currentText.value = String(textContent)
    currentFullMessage.value = sequence  // 保存完整消息内容

    // 显示气泡期间，持续跟随模型头部
    startBubbleTracking()

    // 立即锁定拦截模式，使气泡可点击和滚动
    renderer.value?.setUiInteracting?.(true)

    // 清除之前的定时器
    if (bubbleTimer) {
      window.clearTimeout(bubbleTimer)
    }

    // 设置新的定时器
    bubbleTimer = window.setTimeout(() => {
      if (!bubbleHovered.value) {  // 只有未悬停时才消失
        currentText.value = ''
        currentFullMessage.value = null
        stopBubbleTracking()
        bubbleTimer = null
        // 解锁穿透状态，恢复自动检测
        renderer.value?.setUiInteracting?.(false)
      }
    }, firstText.duration || BUBBLE_DURATION)
  }

  const firstImage = sequence?.find?.((x: any) => x?.type === 'image')
  if (firstImage) {
    resolveResourceUrl(firstImage).then((url) => {
      if (!url) return
      currentImage.value = {
        url,
        duration: firstImage.duration || 5000,
        position: firstImage.position || 'center',
        size: firstImage.size
      }

      window.setTimeout(() => {
        currentImage.value = null
      }, firstImage.duration || 5000)
    })
  }

  for (const item of sequence ?? []) {
    if (item.type === 'motion') {
      renderer.value?.playMotion(item.group, item.index)
    }
    if (item.type === 'expression') {
      const expressionId = item.id || item.expressionId
      if (expressionId) {
        renderer.value?.setExpression(expressionId)
      }
    }
    if (item.type === 'tts') {
      playTTS(item)
    }
    await recordPerformItem(item)
  }
}

onUnmounted(() => {
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

  // 清理事件监听器
  cleanupPlayMotion?.()
  cleanupPlayExpression?.()
  cleanupStartRecording?.()
  cleanupStopRecording?.()

  // 断开 WebSocket 连接
  connectionStore.disconnect()
})

const startBubbleTracking = () => {
  if (bubbleRaf !== null) return

  const tick = () => {
    bubbleRaf = window.requestAnimationFrame(tick)
    const info = renderer.value?.getModelInfo?.()
    if (!info?.position) return

    // 假设 model.anchor = (0.5, 0.5) 时：position 为中心点
    const headX = info.position.x
    const headY = info.position.y - info.height * 0.5

    const padding = 12
    const x = clamp(headX, padding, window.innerWidth - padding)
    const y = clamp(headY - 12, padding, window.innerHeight - padding)
    bubblePos.value = { x, y }
  }

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
    if (currentText.value) {
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
  const popupWidth = 280 + 8 + 64 // input + gap + button（用于边界 clamp 的估算值）
  const popupHeight = 36
  const padding = 12

  const x = clamp(payload.x, padding + popupWidth / 2, window.innerWidth - padding - popupWidth / 2)
  // 弹在点击点上方一点，更“贴近头部”
  const y = clamp(payload.y - 48, padding, window.innerHeight - padding - popupHeight)

  inputPos.value = { x, y }
  inputVisible.value = true

  // 输入期间锁定拦截，避免穿透导致无法输入
  renderer.value?.setUiInteracting?.(true)
  await window.electronAPI?.setWindowFocusable?.(true)

  await nextTick()
  inputEl.value?.focus()
}

const closeInput = () => {
  inputVisible.value = false
  renderer.value?.setUiInteracting?.(false)
  window.electronAPI?.setWindowFocusable?.(false)
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

  // 构建消息内容
  const content: Array<{ type: string; [key: string]: any }> = []

  if (text) {
    content.push({ type: 'text', text })
  }

  const attachmentFile = attachedImageFile.value
  if (hasAttachment && attachedImageFile.value) {
    content.push({ type: 'image', file: attachedImageFile.value })
  }

  await connectionStore.sendMessage(content)
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

  inputText.value = ''
  attachedImage.value = null
  attachedImageFile.value = null
  closeInput()
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
    const imageUrl = await resolveResourceUrl(item)
    await saveAIMessage('image', imageUrl || '', item)
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

const resolveResourceUrl = async (item: any) => {
  if (item.url) return item.url
  if (item.inline) return item.inline
  if (item.rid) {
    const resource = await connectionStore.getResource(item.rid)
    return resource?.url || resource?.inline || ''
  }
  return ''
}

const playTTS = async (item: any) => {
  const ttsMode = item.ttsMode || 'remote'
  if (ttsMode === 'remote') {
    const audioUrl = item.url || item.inline || (await resolveResourceUrl(item))
    if (!audioUrl) return
    const audio = new Audio(audioUrl)
    audio.volume = item.volume || 1.0
    audio.playbackRate = item.speed || 1.0
    audio.play().catch((e) => {
      logger.error('TTS 播放失败', e)
    })
  } else if (ttsMode === 'local' && item.text) {
    if (!('speechSynthesis' in window)) {
      logger.error('浏览器不支持Web Speech API')
      return
    }
    const utterance = new SpeechSynthesisUtterance(item.text)
    utterance.voice = item.voice || null
    utterance.volume = item.volume || 1.0
    utterance.rate = item.speed || 1.0
    window.speechSynthesis.speak(utterance)
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
  gap: 8px;
  z-index: 1000;
  transform: translateX(-50%);
}

.input {
  width: 280px;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.9);
  outline: none;
}

.btn {
  height: 36px;
  padding: 0 14px;
  min-width: 64px;
  white-space: nowrap;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.9);
}

.image-display {
  position: fixed;
  z-index: 999;
  pointer-events: none;
}

.image-display img {
  display: block;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  object-fit: contain;
}


.btn-attachment {
  height: 36px;
  width: 36px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-attachment:hover {
  background: rgba(0, 0, 0, 0.7);
  border-color: rgba(255, 255, 255, 0.4);
}

.attachment-preview {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 8px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
}

.attachment-preview img {
  max-width: 100px;
  max-height: 100px;
  border-radius: 4px;
  object-fit: contain;
}

.btn-remove {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-remove:hover {
  background: rgba(255, 0, 0, 1);
  transform: scale(1.1);
}
</style>
