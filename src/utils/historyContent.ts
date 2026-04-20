import { resolveResourceSource, type ResourceUrlConfig } from './resourceUrl'

export interface HistoryContentElement {
  type?: string
  text?: string
  content?: string
  url?: string
  inline?: string
  rid?: string
  name?: string
}

export type HistoryRenderableItem =
  | { type: 'text'; text: string }
  | { type: 'image'; src: string; alt: string }
  | { type: 'audio'; src: string; label: string }
  | { type: 'video'; src: string; label: string }
  | { type: 'file'; src: string; label: string; name: string }

function normalizeHistoryText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getHistoryElementText(element: HistoryContentElement | null | undefined): string {
  if (typeof element?.text === 'string') {
    return element.text
  }
  if (typeof element?.content === 'string') {
    return element.content
  }
  return ''
}

function appendHistoryTextItem(items: HistoryRenderableItem[], text: string): void {
  const normalizedText = normalizeHistoryText(text)
  if (!normalizedText) {
    return
  }

  const lastItem = items[items.length - 1]
  if (lastItem?.type === 'text' && normalizeHistoryText(lastItem.text) === normalizedText) {
    return
  }

  items.push({ type: 'text', text })
}

export function setLruCacheEntry<T>(cache: Map<string, T>, key: string, value: T, limit: number): T {
  if (cache.has(key)) {
    cache.delete(key)
  } else if (cache.size >= limit) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }

  cache.set(key, value)
  return value
}

export function getLruCacheEntry<T>(cache: Map<string, T>, key: string): T | undefined {
  const cached = cache.get(key)
  if (cached === undefined) {
    return undefined
  }

  cache.delete(key)
  cache.set(key, cached)
  return cached
}

export function parseHistoryContent(
  content: string,
  cache: Map<string, HistoryContentElement[]>,
  cacheLimit = 1000,
): HistoryContentElement[] {
  const cached = getLruCacheEntry(cache, content)
  if (cached !== undefined) {
    return cached
  }

  try {
    const parsed = JSON.parse(content)
    const result = Array.isArray(parsed)
      ? parsed as HistoryContentElement[]
      : [parsed as HistoryContentElement]
    return setLruCacheEntry(cache, content, result, cacheLimit)
  } catch {
    const fallback: HistoryContentElement[] = [{ type: 'text', text: String(content) }]
    return setLruCacheEntry(cache, content, fallback, cacheLimit)
  }
}

export function resolveHistoryMediaSource(
  element: Pick<HistoryContentElement, 'url' | 'inline' | 'rid'>,
  resourceConfig: ResourceUrlConfig = {}
): string | null {
  return resolveResourceSource(element, resourceConfig)
}

export function resolveHistoryImageSource(
  element: Pick<HistoryContentElement, 'url' | 'inline' | 'rid'>,
  resourceConfig: ResourceUrlConfig = {}
): string | null {
  return resolveHistoryMediaSource(element, resourceConfig)
}

export function extractHistoryRawText(
  content: HistoryContentElement[] | null | undefined,
): string {
  const parts: string[] = []

  for (const element of content || []) {
    const type = String(element?.type || '')
    if (type !== 'text' && type !== 'tts') {
      continue
    }

    const text = normalizeHistoryText(getHistoryElementText(element))
    if (!text) {
      continue
    }

    if (parts[parts.length - 1] === text) {
      continue
    }

    parts.push(text)
  }

  return parts.join('\n')
}

export function buildHistoryRenderableItems(
  content: HistoryContentElement[] | null | undefined,
  options: { includeTtsText?: boolean } & ResourceUrlConfig = {}
): HistoryRenderableItem[] {
  const items: HistoryRenderableItem[] = []

  for (const element of content || []) {
    const type = String(element?.type || '')
    const text = getHistoryElementText(element)

    if (type === 'text') {
      appendHistoryTextItem(items, text)
      continue
    }

    if (type === 'tts') {
      if (options.includeTtsText) {
        appendHistoryTextItem(items, text)
      }

      const src = resolveHistoryMediaSource(element, options)
      if (src) {
        items.push({ type: 'audio', src, label: element.name || '语音消息' })
      }
      continue
    }

    if (type === 'image') {
      const src = resolveHistoryImageSource(element, options)
      if (src) {
        items.push({ type: 'image', src, alt: 'History message image' })
      }
      continue
    }

    if (type === 'audio') {
      const src = resolveHistoryMediaSource(element, options)
      if (src) {
        items.push({ type: 'audio', src, label: element.name || '语音消息' })
      }
      continue
    }

    if (type === 'video') {
      const src = resolveHistoryMediaSource(element, options)
      if (src) {
        items.push({ type: 'video', src, label: element.name || '视频' })
      }
      continue
    }

    if (type === 'file') {
      const src = resolveHistoryMediaSource(element, options)
      if (src) {
        const name = element.name || 'file.bin'
        items.push({ type: 'file', src, label: name, name })
      }
    }
  }

  return items
}
