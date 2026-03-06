import type { MessageContent } from './types'

export interface PreparedInlineResource {
  mime: string
  buffer: Buffer
}

const DEFAULT_INLINE_LIMIT_BYTES = 256 * 1024

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

function encodeInlineDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString('base64')}`
}

export function decodeBinaryPayload(item: MessageContent): PreparedInlineResource | null {
  const bytes = item.bytes
  if (!bytes) {
    return null
  }

  try {
    const buffer = bytes instanceof ArrayBuffer
      ? Buffer.from(bytes)
      : Buffer.from(bytes as Uint8Array | number[])

    return {
      mime: item.mime || 'application/octet-stream',
      buffer,
    }
  } catch {
    return null
  }
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
  const inlineLimit = normalizeInlineLimit(options.maxInlineBytes) ?? DEFAULT_INLINE_LIMIT_BYTES

  const preparedContent: MessageContent[] = []

  for (const item of content) {
    const preparedResource = item.inline
      ? decodeInlineDataUrl(item.inline)
      : decodeBinaryPayload(item)

    if (!preparedResource) {
      preparedContent.push(item)
      continue
    }

    if (preparedResource.buffer.length <= inlineLimit) {
      preparedContent.push({
        ...item,
        inline: item.inline || encodeInlineDataUrl(preparedResource.buffer, preparedResource.mime),
        bytes: undefined,
        mime: undefined,
      })
      continue
    }

    if (!options.uploadInlineResource) {
      throw new Error(`附件大小超过内联限制 (${inlineLimit} bytes)，且服务端未提供资源上传能力`)
    }

    const uploadedUrl = await options.uploadInlineResource(preparedResource.buffer, preparedResource.mime)
    if (!uploadedUrl) {
      throw new Error('资源上传失败，无法发送大附件')
    }

    preparedContent.push({
      ...item,
      url: uploadedUrl,
      inline: undefined,
      rid: undefined,
      bytes: undefined,
      mime: undefined,
    })
  }

  return preparedContent
}
