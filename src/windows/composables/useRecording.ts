import { ref, computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@/stores/connection'
import { AudioRecorder } from '@/utils/AudioRecorder'
import {
  clampMaxRecordingSeconds,
  type AdvancedSettings,
  type RecordingMode
} from '@/utils/advancedSettings'

type RecordingSource = 'manual' | 'shortcut'
type StopReason = 'manual' | 'shortcut' | 'max-duration'
type ModelStatusType = 'success' | 'error' | 'info' | 'loading' | 'warning'

interface UseRecordingOptions {
  connectionStore: ReturnType<typeof useConnectionStore>
  currentUserName: Ref<string>
  advancedSettings: Ref<AdvancedSettings>
  showModelStatus: (text: string, type: ModelStatusType, duration?: number) => void
  showBaseEventStatus: (text: string, type: ModelStatusType, duration?: number) => void
  updateUIPositions: () => void
  generateMessageId: (prefix?: string) => string
  syncRecordingState?: (recording: boolean) => void | Promise<void>
}

export function useRecording(options: UseRecordingOptions) {
  const {
    connectionStore,
    currentUserName,
    advancedSettings,
    showModelStatus,
    showBaseEventStatus,
    updateUIPositions,
    generateMessageId,
    syncRecordingState
  } = options

  const { t } = useI18n()

  const isRecording = ref(false)
  const recordingDuration = ref(0)
  const currentRecordingSource = ref<RecordingSource>('manual')
  const recordingHintText = computed(() => {
    if (currentRecordingSource.value === 'shortcut') {
      return t('main.recording.hintShortcut')
    }
    return t('main.recording.hintManual')
  })

  let audioRecorder: AudioRecorder | null = null
  let recordingTimer: NodeJS.Timeout | null = null
  let isStoppingRecording = false

  function notifyRecordingState(recording: boolean) {
    if (!syncRecordingState) {
      return
    }

    try {
      const result = syncRecordingState(recording)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        ;(result as Promise<void>).catch(error => {
          console.warn('[主窗口] 同步录音状态失败:', error)
        })
      }
    } catch (error) {
      console.warn('[主窗口] 同步录音状态失败:', error)
    }
  }

  function clearRecordingTimer() {
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
  }

  function getMaxRecordingSeconds(): number {
    return clampMaxRecordingSeconds(advancedSettings.value.maxRecordingSeconds)
  }

  interface StartRecordingOptions {
    source?: RecordingSource
  }

  interface StopRecordingOptions {
    reason?: StopReason
  }

  async function startRecording(opts: StartRecordingOptions | MouseEvent = {}) {
    if (isRecording.value || isStoppingRecording) {
      return
    }

    if (!AudioRecorder.isSupported()) {
      showModelStatus(t('main.recording.notSupported'), 'error')
      return
    }

    const source =
      (typeof opts === 'object' && opts !== null && 'source' in opts
        ? (opts as StartRecordingOptions).source
        : 'manual') || 'manual'
    const maxRecordingSeconds = getMaxRecordingSeconds()

    try {
      audioRecorder = new AudioRecorder({
        sampleRate: 16000,
        channelCount: 1,
        silenceDetection: {
          enabled: advancedSettings.value.silenceDetectionEnabled
        }
      })

      audioRecorder.onSilenceDetected(() => {
        void stopRecording({ reason: 'max-duration' })
      })

      await audioRecorder.start()
      isRecording.value = true
      notifyRecordingState(true)
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
      showModelStatus(t('main.recording.failed', { message: error.message }), 'error')
      isRecording.value = false
      notifyRecordingState(false)
      recordingDuration.value = 0
      currentRecordingSource.value = 'manual'
      audioRecorder = null
      clearRecordingTimer()
    }
  }

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
        showModelStatus(t('main.recording.short'), 'warning')
        return
      }

      if (!connectionStore.isConnected) {
        showModelStatus(t('main.recording.notConnected'), 'error')
        return
      }

      await sendAudioMessage(audioBlob)
    } catch (error: any) {
      showModelStatus(t('main.recording.stopFailed', { message: error.message }), 'error')
    } finally {
      isRecording.value = false
      notifyRecordingState(false)
      recordingDuration.value = 0
      currentRecordingSource.value = 'manual'
      audioRecorder = null
      isStoppingRecording = false
    }
  }

  function cancelRecordingIfActive() {
    if (!audioRecorder || !isRecording.value) {
      return
    }

    audioRecorder.cancel()
    isRecording.value = false
    notifyRecordingState(false)
    recordingDuration.value = 0
    currentRecordingSource.value = 'manual'
    audioRecorder = null
    isStoppingRecording = false
    clearRecordingTimer()

    console.log('[主窗口] 录音已取消')
  }

  async function sendAudioMessage(audioBlob: Blob) {
    try {
      showBaseEventStatus(t('main.recording.sending'), 'info')

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
        userName: currentUserName.value || t('main.defaultUserName'),
        sessionId: connectionStore.sessionId,
        messageType: 'friend'
      })

      if (result.success) {
        showBaseEventStatus(t('main.recording.sent'), 'success')

        try {
          await window.electron.history.saveMessage({
            messageId: generateMessageId(),
            sessionId: connectionStore.sessionId || 'default',
            userId: connectionStore.userId || 'desktop-user',
            userName: currentUserName.value || t('main.defaultUserName'),
            messageType: 'friend',
            direction: 'outgoing',
            content,
            rawText: t('main.recording.voiceMessage'),
            timestamp: Date.now(),
            resourceContext: {
              resourceBaseUrl: connectionStore.resourceBaseUrl,
              resourcePath: connectionStore.resourcePath,
              resourceToken: connectionStore.resourceToken
            }
          })
        } catch (error) {
          console.error('[主窗口] 保存语音消息记录失败:', error)
        }
      } else {
        showModelStatus(t('main.recording.sendFailed', { message: result.error }), 'error')
      }
    } catch (error: any) {
      showModelStatus(t('main.recording.sendFailed', { message: error.message }), 'error')
    }
  }

  function cleanup() {
    clearRecordingTimer()
    if (audioRecorder && isRecording.value) {
      audioRecorder.cancel()
      audioRecorder = null
      isRecording.value = false
      notifyRecordingState(false)
    }
  }

  async function toggleRecording() {
    if (isRecording.value) {
      await stopRecording({ reason: 'manual' })
    } else {
      await startRecording({ source: 'manual' })
    }
  }

  const recordingMode = computed<RecordingMode>(() => advancedSettings.value.recordingMode)

  return {
    isRecording,
    recordingDuration,
    recordingHintText,
    recordingMode,
    startRecording,
    stopRecording,
    toggleRecording,
    cancelRecordingIfActive,
    sendAudioMessage,
    cleanup
  }
}
