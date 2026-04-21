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

function normalizeBinaryPayload(bytes: unknown): Buffer | null {
  if (!bytes) {
    return null
  }

  try {
    if (bytes instanceof ArrayBuffer) {
      return Buffer.from(bytes)
    }

    if (ArrayBuffer.isView(bytes)) {
      return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    }

    if (Array.isArray(bytes)) {
      return Buffer.from(bytes)
    }

    if (typeof bytes === 'object') {
      const entries = Object.entries(bytes as Record<string, unknown>)
        .filter(([key]) => /^\d+$/.test(key))
        .sort((a, b) => Number(a[0]) - Number(b[0]))

      if (entries.length > 0) {
        return Buffer.from(entries.map(([, value]) => Number(value) & 0xff))
      }
    }
  } catch {
    return null
  }

  return null
}

export function decodeBinaryPayload(item: MessageContent): PreparedInlineResource | null {
  const bytes = item.bytes
  if (!bytes) {
    return null
  }

  const buffer = normalizeBinaryPayload(bytes)
  if (!buffer) {
    return null
  }

  return {
    mime: item.mime || 'application/octet-stream',
    buffer,
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
