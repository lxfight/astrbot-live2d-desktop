export interface BubblePerformElement {
  type?: string
  content?: string
  position?: string
  url?: string
  inline?: string
  rid?: string
}

export type BubbleRenderableItem =
  | { type: 'text'; text: string }
  | { type: 'image'; src: string; alt: string }

export interface BubbleSequenceSplitResult {
  position: string
  bubbleItems: BubbleRenderableItem[]
  remainingSequence: BubblePerformElement[]
}

const DEFAULT_RESOURCE_BASE_URL = 'http://localhost:9091'

function normalizeResourceBaseUrl(resourceBaseUrl?: string): string {
  const baseUrl = (resourceBaseUrl || DEFAULT_RESOURCE_BASE_URL).trim()
  return baseUrl.replace(/\/+$/, '')
}

export function resolvePerformMediaSource(
  element: Pick<BubblePerformElement, 'url' | 'inline' | 'rid'>,
  resourceBaseUrl?: string
): string | null {
  const inline = typeof element.inline === 'string' ? element.inline.trim() : ''
  if (inline) {
    return inline
  }

  const url = typeof element.url === 'string' ? element.url.trim() : ''
  if (url) {
    return url
  }

  const rid = typeof element.rid === 'string' ? element.rid.trim() : ''
  if (!rid) {
    return null
  }

  return `${normalizeResourceBaseUrl(resourceBaseUrl)}/resources/${rid}`
}

export function splitPerformSequenceForBubble(
  sequence: BubblePerformElement[] | null | undefined,
  options: { resourceBaseUrl?: string } = {}
): BubbleSequenceSplitResult {
  const bubbleItems: BubbleRenderableItem[] = []
  const remainingSequence: BubblePerformElement[] = []
  let position = 'center'
  let hasBubblePosition = false

  for (const element of sequence || []) {
    const type = String(element?.type || '')

    if (!hasBubblePosition && (type === 'text' || type === 'image')) {
      const nextPosition = typeof element.position === 'string' ? element.position.trim() : ''
      position = nextPosition || 'center'
      hasBubblePosition = true
    }

    if (type === 'text') {
      const text = typeof element.content === 'string' ? element.content : ''
      if (text) {
        bubbleItems.push({ type: 'text', text })
        continue
      }
    }

    if (type === 'image') {
      const src = resolvePerformMediaSource(element, options.resourceBaseUrl)
      if (src) {
        bubbleItems.push({ type: 'image', src, alt: 'AstrBot message image' })
        continue
      }
    }

    remainingSequence.push(element)
  }

  return {
    position,
    bubbleItems,
    remainingSequence,
  }
}

export function computeBubbleAutoHideDelay(items: BubbleRenderableItem[]): number {
  const textLength = items.reduce((total, item) => {
    return item.type === 'text' ? total + item.text.length : total
  }, 0)
  const imageCount = items.reduce((total, item) => {
    return item.type === 'image' ? total + 1 : total
  }, 0)

  return Math.max(5000, textLength * 100, imageCount * 2500)
}
