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

// 合并连续互补的 image 元素（服务端常将同一张图片拆成 inline + url/rid 两个元素发送）
function mergeConsecutiveImages(sequence: BubblePerformElement[]): BubblePerformElement[] {
  const result: BubblePerformElement[] = []
  for (const el of sequence) {
    const prev = result[result.length - 1]
    if (
      String(el?.type || '') === 'image' &&
      prev && String(prev.type) === 'image'
    ) {
      const prevHasInline = Boolean(typeof prev.inline === 'string' && prev.inline.trim())
      const elHasInline = Boolean(typeof el.inline === 'string' && el.inline?.trim())
      // 一个有 inline 一个只有 url/rid → 同一张图的两种传输方式，合并
      if (prevHasInline !== elHasInline) {
        if (!prev.inline && el.inline) prev.inline = el.inline
        if (!prev.url && el.url) prev.url = el.url
        if (!prev.rid && el.rid) prev.rid = el.rid
        continue
      }
    }
    result.push({ ...el })
  }
  return result
}

export function splitPerformSequenceForBubble(
  sequence: BubblePerformElement[] | null | undefined,
  options: ResourceUrlConfig = {}
): BubbleSequenceSplitResult {
  const bubbleItems: BubbleRenderableItem[] = []
  const remainingSequence: BubblePerformElement[] = []
  let position = 'center'
  let hasBubblePosition = false

  for (const element of mergeConsecutiveImages(sequence || [])) {
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
