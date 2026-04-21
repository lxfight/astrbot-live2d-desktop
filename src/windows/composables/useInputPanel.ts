import { ref, nextTick, type Ref } from 'vue'
import type { MessageContent } from '@/types/protocol'
import { useConnectionStore } from '@/stores/connection'
import type { AdvancedSettings } from '@/utils/advancedSettings'
import type { FloatingOverlayStyle } from './useBubbleStack'

export type { FloatingOverlayStyle }

type ModelStatusType = 'success' | 'error' | 'info' | 'loading' | 'warning'

interface UseInputPanelOptions {
  connectionStore: ReturnType<typeof useConnectionStore>
  currentUserName: Ref<string>
  advancedSettings: Ref<AdvancedSettings>
  showModelStatus: (text: string, type: ModelStatusType, duration?: number) => void
  showBaseEventStatus: (text: string, type: ModelStatusType, duration?: number) => void
  updateUIPositions: () => void
  generateMessageId: (prefix?: string) => string
}

export function useInputPanel(options: UseInputPanelOptions) {
  const {
    connectionStore,
    currentUserName,
    advancedSettings,
    showModelStatus,
    showBaseEventStatus,
    updateUIPositions,
    generateMessageId,
  } = options

  const showInput = ref(false)
  const inputRef = ref<HTMLInputElement | null>(null)
  const inputStyle = ref<FloatingOverlayStyle>({ left: '0px', top: '0px' })
  const inputText = ref('')
  const selectedImage = ref<{ file: File; preview: string } | null>(null)

  function getImageInlineThresholdBytes(): number {
    return Math.max(64, advancedSettings.value.imageInlineThresholdKb || 256) * 1024
  }

  function getImageMaxSizeBytes(): number {
    return Math.max(1, advancedSettings.value.imageMaxSizeMb || 10) * 1024 * 1024
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function applySelectedImage(file: File, preview: string) {
    selectedImage.value = { file, preview }

    if (!showInput.value) {
      openInput()
      return
    }

    nextTick(() => {
      inputRef.value?.focus()
    })
  }

  function handleSelectImage() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'

    input.onchange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      const file = files[0]
      if (file.size > getImageMaxSizeBytes()) {
        showModelStatus(`图片大小不能超过 ${advancedSettings.value.imageMaxSizeMb}MB`, 'warning')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        applySelectedImage(file, e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }

    input.click()
  }

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

  function clearImage() {
    selectedImage.value = null
  }

  function openInput() {
    showInput.value = true
    updateUIPositions()
    nextTick(() => {
      inputRef.value?.focus()
    })
  }

  function closeInputPanel() {
    showInput.value = false
    inputText.value = ''
    selectedImage.value = null
  }

  async function handleSendMessage() {
    const rawTextToStore = inputText.value.trim()
    if (!rawTextToStore && !selectedImage.value) return

    if (!connectionStore.isConnected) {
      showModelStatus('未连接到服务器', 'error')
      return
    }

    try {
        const content: MessageContent[] = []

      if (rawTextToStore) {
        content.push({ type: 'text', text: rawTextToStore })
      }

      if (selectedImage.value) {
        const file = selectedImage.value.file

        if (file.size < getImageInlineThresholdBytes()) {
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

        try {
          await window.electron.history.saveMessage({
            messageId: generateMessageId(),
            sessionId: connectionStore.sessionId || 'default',
            userId: connectionStore.userId || 'desktop-user',
            userName: currentUserName.value || '桌面用户',
            messageType: 'friend',
            direction: 'outgoing',
            content,
            rawText: rawTextToStore,
            timestamp: Date.now(),
            resourceContext: {
              resourceBaseUrl: connectionStore.resourceBaseUrl,
              resourcePath: connectionStore.resourcePath,
              resourceToken: connectionStore.resourceToken,
            }
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

  return {
    showInput,
    inputRef,
    inputStyle,
    inputText,
    selectedImage,
    handleSelectImage,
    handlePasteEvent,
    clearImage,
    applySelectedImage,
    closeInputPanel,
    openInput,
    handleSendMessage,
    fileToBase64,
  }
}
