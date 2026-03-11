import { resolvePerformMediaSource } from './bubbleContent'

export interface HistoryContentElement {
  type?: string
  text?: string
  content?: string
  url?: string
  inline?: string
  rid?: string
}

export type HistoryRenderableItem =
  | { type: 'text'; text: string }
  | { type: 'image'; src: string; alt: string }

export function resolveHistoryImageSource(
  element: Pick<HistoryContentElement, 'url' | 'inline' | 'rid'>,
  resourceBaseUrl?: string
): string | null {
  return resolvePerformMediaSource(element, resourceBaseUrl)
}

export function buildHistoryRenderableItems(
  content: HistoryContentElement[] | null | undefined,
  options: { includeTtsText?: boolean; resourceBaseUrl?: string } = {}
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
      const src = resolveHistoryImageSource(element, options.resourceBaseUrl)
      if (src) {
        items.push({ type: 'image', src, alt: 'History message image' })
      }
    }
  }

  return items
}
