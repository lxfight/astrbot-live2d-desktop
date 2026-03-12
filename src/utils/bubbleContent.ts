import { resolveResourceSource, type ResourceUrlConfig } from './resourceUrl'

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

export function resolvePerformMediaSource(
  element: Pick<BubblePerformElement, 'url' | 'inline' | 'rid'>,
  resourceConfig: ResourceUrlConfig = {}
): string | null {
  return resolveResourceSource(element, resourceConfig)
}

export function splitPerformSequenceForBubble(
  sequence: BubblePerformElement[] | null | undefined,
  options: ResourceUrlConfig = {}
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
      const src = resolvePerformMediaSource(element, options)
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
