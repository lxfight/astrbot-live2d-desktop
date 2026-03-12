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

export function buildHistoryRenderableItems(
  content: HistoryContentElement[] | null | undefined,
  options: { includeTtsText?: boolean } & ResourceUrlConfig = {}
): HistoryRenderableItem[] {
  const items: HistoryRenderableItem[] = []

  for (const element of content || []) {
    const type = String(element?.type || '')

    if (type === 'text' || (options.includeTtsText && type === 'tts')) {
      const text = typeof element.text === 'string'
        ? element.text
        : typeof element.content === 'string'
          ? element.content
          : ''

      if (text) {
        items.push({ type: 'text', text })
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
