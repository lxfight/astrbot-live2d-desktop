<template>
  <div class="app-container">
    <Live2DRenderer ref="renderer" />
    <BubbleDialog v-if="currentText || currentImageUrl" :text="currentText" :imageUrl="currentImageUrl" />

    <!-- 连接状态指示器 -->
    <div class="connection-status" :class="{ connected: connectionStore.connected }">
      <span v-if="connectionStore.connected">🟢 已连接</span>
      <span v-else>🔴 未连接</span>
    </div>

    <!-- 图片发送按钮 -->
    <div class="image-send-button" @click="triggerImageSelect" title="发送图片">
      📷
    </div>
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      @change="handleImageSelect"
      style="display: none"
    />

    <!-- 语音录音按钮 -->
    <div
      class="voice-record-button"
      :class="{ recording: isRecording }"
      @mousedown="startRecording"
      @mouseup="stopRecording"
      @mouseleave="stopRecording"
      :title="isRecording ? '松开发送' : '按住录音'"
    >
      🎤
    </div>

    <!-- 调试面板（可选） -->
    <div v-if="showDebug" class="debug-panel">
      <h3>调试信息</h3>
      <p>连接状态: {{ connectionStore.connected ? '已连接' : '未连接' }}</p>
      <p>当前文本: {{ currentText || '无' }}</p>
      <button @click="testMotion">测试动作</button>
      <button @click="testExpression">测试表情</button>
      <button @click="testPerform">测试表演</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConnectionStore } from './stores/connection'
import Live2DRenderer from './components/Live2DRenderer.vue'
import BubbleDialog from './components/BubbleDialog.vue'
import type { SaveMessageParams } from './types/history'

const connectionStore = useConnectionStore()
const renderer = ref()
const currentText = ref('')
const currentImageUrl = ref('')
const showDebug = ref(false)
const imageInput = ref<HTMLInputElement>()
const isRecording = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])
const currentConversationId = ref<number | null>(null)

// 监听键盘事件显示/隐藏调试面板
onMounted(async () => {
  // 初始化当前对话
  await initializeConversation()

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
      e.preventDefault()
      showDebug.value = !showDebug.value
    }
  })

  // 连接到服务器
  connectionStore.connect('ws://localhost:8765/ws', '')

  // 监听表演指令
  connectionStore.onPerform((sequence) => {
    executePerformSequence(sequence)
  })

  // 监听来自设置窗口的播放指令
  if (window.electronAPI?.onPlayMotion) {
    window.electronAPI.onPlayMotion((group, index) => {
      console.log(`[预览] 播放动作: ${group} #${index}`)
      renderer.value?.playMotion(group, index)
    })
  }

  if (window.electronAPI?.onPlayExpression) {
    window.electronAPI.onPlayExpression((expressionId) => {
      console.log(`[预览] 播放表情: ${expressionId}`)
      renderer.value?.setExpression(expressionId)
    })
  }
})

// 初始化当前对话
const initializeConversation = async () => {
  if (!window.electronAPI) return

  try {
    const activeConv = await window.electronAPI.dbGetActiveConversation()
    if (activeConv) {
      currentConversationId.value = activeConv.id
      console.log('[对话] 加载激活对话:', activeConv.id)
    } else {
      // 没有激活对话，创建默认对话
      const convId = await window.electronAPI.dbCreateConversation('默认对话')
      currentConversationId.value = convId
      console.log('[对话] 创建新对话:', convId)
    }
  } catch (error) {
    console.error('[对话] 初始化失败:', error)
  }
}

// 获取当前对话ID（确保存在）
const getCurrentConversationId = async (): Promise<number> => {
  if (currentConversationId.value !== null) {
    return currentConversationId.value
  }

  // 如果没有当前对话，创建一个新对话
  if (!window.electronAPI) {
    throw new Error('electronAPI 未初始化')
  }

  const convId = await window.electronAPI.dbCreateConversation('新对话')
  currentConversationId.value = convId
  console.log('[对话] 创建新对话:', convId)
  return convId
}

// 保存AI消息
const saveAIMessage = async (messageType: string, content: string, rawData: any) => {
  if (!window.electronAPI) {
    console.warn('[消息] electronAPI 未初始化，无法保存消息')
    return
  }

  try {
    const convId = await getCurrentConversationId()
    const params: SaveMessageParams = {
      conversation_id: convId,
      sender: 'ai',
      message_type: messageType as any,
      content,
      raw_data: JSON.stringify(rawData),
      timestamp: Date.now()
    }

    await window.electronAPI.dbSaveMessage(params)
    console.log(`[消息] 保存AI消息成功: 类型=${messageType}, 对话ID=${convId}`)

    // 更新统计
    await updateDailyStatistics({
      ai_messages: 1,
      total_messages: 1,
      [`${messageType}_messages`]: 1
    })
  } catch (error) {
    console.error('[消息] 保存AI消息失败:', error)
  }
}

// 保存用户消息
const saveUserMessage = async (messageType: string, content: string, rawData: any) => {
  if (!window.electronAPI) {
    console.warn('[消息] electronAPI 未初始化，无法保存消息')
    return
  }

  try {
    const convId = await getCurrentConversationId()
    const params: SaveMessageParams = {
      conversation_id: convId,
      sender: 'user',
      message_type: messageType as any,
      content,
      raw_data: JSON.stringify(rawData),
      timestamp: Date.now()
    }

    await window.electronAPI.dbSaveMessage(params)
    console.log(`[消息] 保存用户消息成功: 类型=${messageType}, 对话ID=${convId}`)

    // 更新统计
    await updateDailyStatistics({
      user_messages: 1,
      total_messages: 1,
      [`${messageType}_messages`]: 1
    })
  } catch (error) {
    console.error('[消息] 保存用户消息失败:', error)
  }
}

// 更新每日统计
const updateDailyStatistics = async (updates: Record<string, number>) => {
  if (!window.electronAPI) return

  try {
    const today = new Date().toISOString().split('T')[0]
    await window.electronAPI.dbUpdateStatistics({
      stat_date: today,
      ...updates
    })
  } catch (error) {
    console.error('[统计] 更新统计失败:', error)
  }
}

// 执行表演序列
const executePerformSequence = async (sequence: any[]) => {
  for (const item of sequence) {
    if (item.type === 'text') {
      currentText.value = item.content
      // 保存文本消息
      await saveAIMessage('text', item.content || '', item)
      await delay(item.duration || 3000)
      currentText.value = ''
    }

    if (item.type === 'image') {
      currentImageUrl.value = item.url
      // 保存图片消息
      await saveAIMessage('image', item.url || '', item)
      await delay(item.duration || 5000)
      currentImageUrl.value = ''
    }

    if (item.type === 'motion') {
      renderer.value?.playMotion(item.group, item.index)
      // 保存动作消息
      await saveAIMessage('motion', `${item.group}:${item.index}`, item)
    }

    if (item.type === 'expression') {
      renderer.value?.setExpression(item.id)
      // 保存表情消息
      await saveAIMessage('expression', item.id || '', item)
    }

    if (item.type === 'tts') {
      await playTTS(item)
      // 保存TTS消息
      await saveAIMessage('tts', item.text || item.url || '', item)
    }
  }
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 播放TTS音频
const playTTS = async (item: any) => {
  const ttsMode = item.ttsMode || 'remote'

  if (ttsMode === 'remote' && item.url) {
    // 远程TTS模式:播放音频URL
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(item.url)
      audio.volume = item.volume || 1.0
      audio.playbackRate = item.speed || 1.0

      audio.onended = () => resolve()
      audio.onerror = (e) => {
        console.error('[TTS] 音频播放失败:', e)
        reject(e)
      }

      audio.play().catch(e => {
        console.error('[TTS] 音频播放失败:', e)
        reject(e)
      })
    })
  } else if (ttsMode === 'local' && item.text) {
    // 本地TTS模式:使用Web Speech API
    return new Promise<void>((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        console.error('[TTS] 浏览器不支持Web Speech API')
        reject(new Error('浏览器不支持Web Speech API'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(item.text)
      utterance.voice = item.voice || null
      utterance.volume = item.volume || 1.0
      utterance.rate = item.speed || 1.0

      utterance.onend = () => resolve()
      utterance.onerror = (e) => {
        console.error('[TTS] 语音合成失败:', e)
        reject(e)
      }

      window.speechSynthesis.speak(utterance)
    })
  } else {
    console.warn('[TTS] 无效的TTS配置:', item)
  }
}

// 触发图片选择
const triggerImageSelect = () => {
  if (!connectionStore.connected) {
    console.warn('[图片] 未连接到服务器')
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
    // 读取图片并转换为Base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64Data = reader.result as string
      const messageData = {
        type: 'image',
        data: base64Data
      }

      // 发送图片消息
      connectionStore.sendMessage([messageData])

      // 保存用户消息
      await saveUserMessage('image', base64Data.substring(0, 100) + '...', messageData)

      console.log('[图片] 已发送图片')
    }

    reader.onerror = () => {
      console.error('[图片] 读取图片失败')
    }

    reader.readAsDataURL(file)
  } catch (error) {
    console.error('[图片] 处理图片失败:', error)
  } finally {
    // 清空input,允许重复选择同一文件
    target.value = ''
  }
}

// 开始录音
const startRecording = async () => {
  if (!connectionStore.connected) {
    console.warn('[录音] 未连接到服务器')
    return
  }

  if (isRecording.value) return

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    audioChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' })
      await sendVoiceMessage(audioBlob)

      // 停止所有音频轨道
      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.value.start()
    isRecording.value = true
    console.log('[录音] 开始录音')
  } catch (error) {
    console.error('[录音] 启动录音失败:', error)
  }
}

// 停止录音
const stopRecording = () => {
  if (!isRecording.value || !mediaRecorder.value) return

  mediaRecorder.value.stop()
  isRecording.value = false
  console.log('[录音] 停止录音')
}

// 发送语音消息
const sendVoiceMessage = async (audioBlob: Blob) => {
  try {
    // 转换为Base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64Data = reader.result as string
      const messageData = {
        type: 'voice',
        data: base64Data,
        sttMode: 'remote'
      }

      // 发送语音消息
      connectionStore.sendMessage([messageData])

      // 保存用户消息
      await saveUserMessage('voice', `语音消息 (${audioBlob.size} bytes)`, messageData)

      console.log('[录音] 已发送语音消息')
    }

    reader.onerror = () => {
      console.error('[录音] 读取音频失败')
    }

    reader.readAsDataURL(audioBlob)
  } catch (error) {
    console.error('[录音] 发送语音消息失败:', error)
  }
}

// 测试函数
const testMotion = () => {
  renderer.value?.playMotion('Idle', 0)
}

const testExpression = () => {
  renderer.value?.setExpression('f01')
}

const testPerform = () => {
  executePerformSequence([
    { type: 'text', content: '你好！这是一个测试消息。', duration: 2000 },
    { type: 'motion', group: 'Idle', index: 0 },
    { type: 'expression', id: 'f01' }
  ])
}
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.connection-status {
  position: fixed;
  top: 10px;
  right: 10px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 20px;
  font-size: 14px;
  z-index: 1000;
  transition: all 0.3s;
}

.connection-status.connected {
  background: rgba(0, 128, 0, 0.7);
}

.debug-panel {
  position: fixed;
  bottom: 20px;
  left: 20px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  border-radius: 10px;
  z-index: 1000;
  max-width: 300px;
}

.debug-panel h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.debug-panel p {
  margin: 5px 0;
  font-size: 12px;
}

.debug-panel button {
  margin: 5px 5px 0 0;
  padding: 5px 10px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.debug-panel button:hover {
  background: #45a049;
}

.image-send-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  transition: all 0.3s;
  z-index: 1000;
}

.image-send-button:hover {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.image-send-button:active {
  transform: scale(0.95);
}

.voice-record-button {
  position: fixed;
  bottom: 20px;
  right: 90px;
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  transition: all 0.3s;
  z-index: 1000;
  user-select: none;
}

.voice-record-button:hover {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.voice-record-button.recording {
  background: rgba(255, 0, 0, 0.9);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
</style>
