import type { MessageContent } from './types'

export interface PreparedInlineResource {
  mime: string
  buffer: Buffer
}

export interface PrepareMessageContentOptions {
  maxInlineBytes?: number
  uploadInlineResource?: (buffer: Buffer, mime: string) => Promise<string | null>
}

function normalizeInlineLimit(maxInlineBytes: number | undefined): number | null {
  if (!Number.isFinite(maxInlineBytes) || (maxInlineBytes ?? 0) <= 0) {
    return null
  }

  return Math.max(1024, Math.floor(maxInlineBytes as number))
}

export function decodeInlineDataUrl(inline: string): PreparedInlineResource | null {
  if (typeof inline !== 'string' || !inline.startsWith('data:')) {
    return null
  }

  const match = inline.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/)
  if (!match) {
    return null
  }

  try {
    return {
      mime: match[1] || 'application/octet-stream',
      buffer: Buffer.from(match[2], 'base64')
    }
  } catch {
    return null
  }
}

export async function prepareMessageContentForTransport(
  content: MessageContent[],
  options: PrepareMessageContentOptions = {}
): Promise<MessageContent[]> {
  const inlineLimit = normalizeInlineLimit(options.maxInlineBytes)
  if (!inlineLimit) {
    return content
  }

  const preparedContent: MessageContent[] = []

  for (const item of content) {
    const decodedInline = item.inline ? decodeInlineDataUrl(item.inline) : null
    if (!decodedInline || decodedInline.buffer.length <= inlineLimit) {
      preparedContent.push(item)
      continue
    }

    if (!options.uploadInlineResource) {
      throw new Error(`附件大小超过内联限制 (${inlineLimit} bytes)，且服务端未提供资源上传能力`)
    }

    const uploadedUrl = await options.uploadInlineResource(decodedInline.buffer, decodedInline.mime)
    if (!uploadedUrl) {
      throw new Error('资源上传失败，无法发送大附件')
    }

    preparedContent.push({
      ...item,
      url: uploadedUrl,
      inline: undefined,
      rid: undefined,
    })
  }

  return preparedContent
}
