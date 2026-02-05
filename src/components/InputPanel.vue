<template>
  <div class="input-panel">
    <div class="input-area">
      <!-- 文本输入框 -->
      <n-input
        v-model:value="inputText"
        type="textarea"
        placeholder="输入消息..."
        :autosize="{ minRows: 1, maxRows: 4 }"
        @keydown.enter.exact="handleSend"
      />

      <!-- 工具栏 -->
      <div class="toolbar">
        <n-space :size="8">
          <n-button text @click="handleSelectImage">
            <template #icon>
              <ImageIcon :size="18" />
            </template>
          </n-button>
          <n-button text @click="handleSelectAudio">
            <template #icon>
              <Music :size="18" />
            </template>
          </n-button>
          <n-button text @click="handleSelectVideo">
            <template #icon>
              <Video :size="18" />
            </template>
          </n-button>
          <n-button type="primary" @click="handleSend" :disabled="!canSend">
            发送
          </n-button>
        </n-space>
      </div>
    </div>

    <!-- 附件预览 -->
    <div v-if="attachments.length > 0" class="attachments">
      <div v-for="(item, index) in attachments" :key="index" class="attachment-item">
        <span class="attachment-icon">
          <component :is="getAttachmentIcon(item.type)" :size="16" />
        </span>
        <span class="attachment-name">{{ item.name }}</span>
        <n-button text size="small" @click="removeAttachment(index)">
          <template #icon>
            <X :size="14" color="white" />
          </template>
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { Image as ImageIcon, Music, Video, X, Paperclip } from 'lucide-vue-next'
import type { MessageContent } from '@/types/protocol'

const message = useMessage()

const inputText = ref('')
const attachments = ref<Array<{
  type: 'image' | 'audio' | 'video'
  name: string
  file: File
}>>([])

const canSend = computed(() => {
  return inputText.value.trim().length > 0 || attachments.value.length > 0
})

const emit = defineEmits<{
  send: [content: MessageContent[]]
}>()

/**
 * 选择图片
 */
async function handleSelectImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true

  input.onchange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > 10 * 1024 * 1024) {
        message.warning(`图片 ${file.name} 超过 10MB，已跳过`)
        continue
      }
      attachments.value.push({
        type: 'image',
        name: file.name,
        file
      })
    }
  }

  input.click()
}

/**
 * 选择音频
 */
async function handleSelectAudio() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'audio/*'

  input.onchange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    const file = files[0]
    if (file.size > 20 * 1024 * 1024) {
      message.warning('音频文件超过 20MB')
      return
    }

    attachments.value.push({
      type: 'audio',
      name: file.name,
      file
    })
  }

  input.click()
}

/**
 * 选择视频
 */
async function handleSelectVideo() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'

  input.onchange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    const file = files[0]
    if (file.size > 50 * 1024 * 1024) {
      message.warning('视频文件超过 50MB')
      return
    }

    attachments.value.push({
      type: 'video',
      name: file.name,
      file
    })
  }

  input.click()
}

/**
 * 移除附件
 */
function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

/**
 * 发送消息
 */
async function handleSend() {
  if (!canSend.value) return

  const content: MessageContent[] = []

  // 添加文本
  if (inputText.value.trim()) {
    content.push({
      type: 'text',
      text: inputText.value.trim()
    })
  }

  // 添加附件（转换为 base64 或上传）
  for (const attachment of attachments.value) {
    const file = attachment.file

    // 小文件使用 inline base64
    if (file.size < 256 * 1024) {
      const base64 = await fileToBase64(file)
      content.push({
        type: attachment.type,
        inline: base64
      })
    } else {
      // 大文件需要上传到资源服务器
      message.info(`正在上传 ${file.name}...`)
      try {
        const rid = await uploadFile(file)
        content.push({
          type: attachment.type,
          rid
        })
        message.success(`${file.name} 上传成功`)
      } catch (error: any) {
        message.error(`${file.name} 上传失败: ${error.message}`)
        return
      }
    }
  }

  // 发送
  emit('send', content)

  // 清空输入
  inputText.value = ''
  attachments.value = []
}

/**
 * 文件转 base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 上传文件到资源服务器
 */
async function uploadFile(file: File): Promise<string> {
  // 1. 申请上传
  const prepareResponse = await window.electron.bridge.sendMessage({
    content: [],
    metadata: {
      userId: 'user',
      sessionId: 'session',
      messageType: 'friend'
    }
  })

  // TODO: 实现完整的资源上传流程
  // 这里需要调用 resource.prepare, 上传文件, resource.commit
  throw new Error('资源上传功能待实现')
}

/**
 * 获取附件图标
 */
function getAttachmentIcon(type: string) {
  switch (type) {
    case 'image': return ImageIcon
    case 'audio': return Music
    case 'video': return Video
    default: return Paperclip
  }
}
</script>

<style scoped lang="scss">
.input-panel {
  padding: var(--spacing-sm);
  background: var(--color-bg-light);
  border-top: 1px solid var(--color-border);
}

.input-area {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.attachments {
  margin-top: var(--spacing-sm);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-bg-dark);
  border-radius: 4px;
  font-size: 12px;
}

.attachment-icon {
  font-size: 16px;
}

.attachment-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
