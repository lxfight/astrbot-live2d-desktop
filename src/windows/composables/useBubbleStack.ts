import { ref, nextTick, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { useThemeStore } from '@/stores/theme'
import {
  computeBubbleAutoHideDelay,
  type BubbleRenderableItem,
} from '@/utils/bubbleContent'
import type { AdvancedSettings } from '@/utils/advancedSettings'

type BubbleTextItem = {
  id: string
  type: 'text'
  fullText: string
  renderedText: string
}

type BubbleImageItem = {
  id: string
  type: 'image'
  src: string
  alt: string
}

type BubbleItem = BubbleTextItem | BubbleImageItem

export type BubbleEntry = {
  id: string
  items: BubbleItem[]
  offsetX: number
  typingIdx: number
  typingVer: number
  typingDone: boolean
  hideTimerId: number | null
  pinned: boolean
  styleLeft: string
  styleTop: string
  styleMaxHeight: string
}

export type FloatingOverlayStyle = {
  left: string
  top?: string
  bottom?: string
}

const NORMAL_TYPEWRITER_INTERVAL = 50
const TYPEWRITER_LAYOUT_UPDATE_INTERVAL_CHARS = 4
const BUBBLE_EDGE_PADDING = 16
const STATUS_MODEL_GAP = 30
const BUBBLE_GAP = 10
const DEFAULT_BUBBLE_STACK_MAX = 3
const DEFAULT_FOLLOW_UP_WINDOW_MS = 4000
const TIER_VH_FACTORS = [0.18, 0.26, 0.20]

let messageIdSequence = 0

function generateMessageId(prefix = 'msg'): string {
  messageIdSequence += 1
  const randomSegment = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${messageIdSequence}_${randomSegment}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface UseBubbleStackOptions {
  live2dCanvasRef: Ref<any>
  advancedSettings: Ref<AdvancedSettings>
  modelPositionX: { value: number }
  modelPositionY: { value: number }
}

export function useBubbleStack(options: UseBubbleStackOptions) {
  const { live2dCanvasRef, advancedSettings, modelPositionX, modelPositionY } = options

  const bubbleStack = ref<BubbleEntry[]>([])
  const bubbleElMap = new Map<string, HTMLElement>()
  const bubbleContentElMap = new Map<string, HTMLElement>()
  let lastPerformReceiveTime = 0

  function getBubbleStackMax(): number {
    return advancedSettings.value.bubbleStackMax || DEFAULT_BUBBLE_STACK_MAX
  }

  function getBubbleFollowUpWindowMs(): number {
    return advancedSettings.value.bubbleFollowUpWindowMs || DEFAULT_FOLLOW_UP_WINDOW_MS
  }

  // ─── DOM 回调 ──────────────────────────────────────────────

  function setBubbleEl(id: string, el: HTMLElement | null) {
    if (el) {
      bubbleElMap.set(id, el)
    } else {
      bubbleElMap.delete(id)
    }
  }

  function setBubbleContentEl(id: string, el: HTMLElement | null) {
    if (el) {
      bubbleContentElMap.set(id, el)
    } else {
      bubbleContentElMap.delete(id)
    }
  }

  function bubbleTierClass(tier: number): string {
    if (tier === 0) return 'bubble-tier-0'
    if (tier === 1) return 'bubble-tier-1'
    return 'bubble-tier-2'
  }

  // ─── 堆叠定位 ──────────────────────────────────────────────

  function getTierCSSMaxHeight(tier: number, vh: number): number {
    const factor = TIER_VH_FACTORS[Math.min(tier, 2)]
    return Math.min(factor * vh, vh - 32)
  }

  function resolveModelOverlayAnchor() {
    const modelBounds = live2dCanvasRef.value?.getModelOverlayBounds?.()
    if (modelBounds) {
      const statusTop = Math.max(18, modelBounds.topCenterY - STATUS_MODEL_GAP)
      const recordingTop = Math.max(18, statusTop - 44)

      return {
        anchorX: modelBounds.anchorX,
        statusTop,
        recordingTop,
        inputTop: Math.min(modelBounds.bottomCenterY + 22, window.innerHeight - 76),
        bubbleBottom: statusTop,
      }
    }

    return {
      anchorX: modelPositionX.value,
      statusTop: Math.max(18, modelPositionY.value - 280),
      recordingTop: Math.max(18, modelPositionY.value - 330),
      inputTop: Math.min(modelPositionY.value + 150, window.innerHeight - 76),
      bubbleBottom: Math.max(18, modelPositionY.value - 280),
    }
  }

  function updateStackPositions() {
    const stack = bubbleStack.value
    if (!stack.length) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const overlayAnchor = resolveModelOverlayAnchor()
    const anchorX = overlayAnchor.anchorX
    const usableHeight = viewportHeight - 2 * BUBBLE_EDGE_PADDING

    const data = stack.map((entry, i) => {
      const el = bubbleElMap.get(entry.id)
      const contentEl = bubbleContentElMap.get(entry.id)
      const tier = stack.length - 1 - i
      const cssMaxH = getTierCSSMaxHeight(tier, viewportHeight)
      const contentScrollH = contentEl?.scrollHeight ?? 56
      const naturalH = Math.min(contentScrollH + 24, cssMaxH)
      return {
        entry,
        naturalHeight: naturalH,
        width: el?.offsetWidth ?? 300,
      }
    })

    const totalGaps = Math.max(0, stack.length - 1) * BUBBLE_GAP
    const totalNaturalHeight = data.reduce((s, d) => s + d.naturalHeight, 0) + totalGaps
    const idealAnchor = overlayAnchor.bubbleBottom

    let anchorBottom: number
    let finalHeights: number[]

    if (totalNaturalHeight <= idealAnchor - BUBBLE_EDGE_PADDING) {
      anchorBottom = idealAnchor
      finalHeights = data.map(d => d.naturalHeight)
      for (const d of data) d.entry.styleMaxHeight = ''
    } else if (totalNaturalHeight <= usableHeight) {
      anchorBottom = BUBBLE_EDGE_PADDING + totalNaturalHeight
      finalHeights = data.map(d => d.naturalHeight)
      for (const d of data) d.entry.styleMaxHeight = ''
    } else {
      anchorBottom = viewportHeight - BUBBLE_EDGE_PADDING
      const usableForBubbles = Math.max(0, usableHeight - totalGaps)
      const totalNatural = data.reduce((s, d) => s + d.naturalHeight, 0)
      const scale = totalNatural > 0 ? usableForBubbles / totalNatural : 1
      const MIN_BUBBLE_H = 60
      finalHeights = data.map(d => Math.max(MIN_BUBBLE_H, Math.floor(d.naturalHeight * scale)))
      for (let i = 0; i < data.length; i++) {
        data[i].entry.styleMaxHeight = `${finalHeights[i]}px`
      }
    }

    let currentBottom = anchorBottom
    for (let i = data.length - 1; i >= 0; i--) {
      const { entry, width: elW } = data[i]
      const elH = finalHeights[i]
      const halfW = elW / 2
      const minLeft = BUBBLE_EDGE_PADDING + halfW
      const maxLeft = viewportWidth - BUBBLE_EDGE_PADDING - halfW
      const rawLeft = anchorX + entry.offsetX
      const clampedLeft = Math.min(Math.max(rawLeft, minLeft), maxLeft)

      entry.styleLeft = `${clampedLeft}px`
      entry.styleTop = `${currentBottom - elH}px`
      currentBottom = currentBottom - elH - BUBBLE_GAP
    }
  }

  // ─── 打字机 ────────────────────────────────────────────────

  function scheduleBubbleLayoutUpdate() {
    nextTick(() => {
      updateStackPositions()
      const stack = bubbleStack.value
      if (stack.length > 0) {
        const el = bubbleContentElMap.get(stack[stack.length - 1].id)
        if (el) el.scrollTop = el.scrollHeight
      }
    })
  }

  function handleBubbleMediaLoad(entryId: string) {
    nextTick(() => {
      updateStackPositions()
      const el = bubbleContentElMap.get(entryId)
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  async function typeItemChars(item: BubbleTextItem, entry: BubbleEntry, localVer: number) {
    let idx = item.renderedText.length
    let sinceLayout = 0

    while (idx < item.fullText.length) {
      if (entry.typingVer !== localVer) return
      item.renderedText += item.fullText.charAt(idx)
      idx++
      sinceLayout++
      if (sinceLayout >= TYPEWRITER_LAYOUT_UPDATE_INTERVAL_CHARS || idx >= item.fullText.length) {
        sinceLayout = 0
        scheduleBubbleLayoutUpdate()
      }
      await sleep(NORMAL_TYPEWRITER_INTERVAL)
    }
  }

  async function runEntryTypewriter(entry: BubbleEntry) {
    const localVer = entry.typingVer

    while (entry.typingIdx < entry.items.length) {
      if (entry.typingVer !== localVer) return
      const item = entry.items[entry.typingIdx]
      entry.typingIdx++

      if (item.type === 'text') {
        await typeItemChars(item as BubbleTextItem, entry, localVer)
      } else {
        scheduleBubbleLayoutUpdate()
      }
      if (entry.typingVer !== localVer) return
    }

    if (entry.typingVer === localVer) {
      entry.typingDone = true
      startEntryHideTimer(entry)
    }
  }

  function freezeEntry(entry: BubbleEntry) {
    entry.typingVer++
    for (const item of entry.items) {
      if (item.type === 'text') {
        (item as BubbleTextItem).renderedText = (item as BubbleTextItem).fullText
      }
    }
    entry.typingDone = true
  }

  // ─── 自动隐藏 ──────────────────────────────────────────────

  function computeEntryAutoHideDelay(entry: BubbleEntry): number {
    return computeBubbleAutoHideDelay(
      entry.items.map((item) => {
        if (item.type === 'text') return { type: 'text' as const, text: (item as BubbleTextItem).fullText }
        return { type: 'image' as const, src: (item as BubbleImageItem).src, alt: (item as BubbleImageItem).alt }
      })
    )
  }

  function startEntryHideTimer(entry: BubbleEntry) {
    if (entry.pinned) return
    if (entry.hideTimerId !== null) clearTimeout(entry.hideTimerId)
    const delay = computeEntryAutoHideDelay(entry)
    entry.hideTimerId = window.setTimeout(() => {
      removeEntry(entry.id)
    }, delay)
  }

  function removeEntry(id: string) {
    const idx = bubbleStack.value.findIndex((e) => e.id === id)
    if (idx === -1) return
    const entry = bubbleStack.value[idx]
    if (entry.hideTimerId !== null) clearTimeout(entry.hideTimerId)
    entry.typingVer++
    bubbleStack.value.splice(idx, 1)
  }

  function clearAllBubbles() {
    for (const entry of bubbleStack.value) {
      if (entry.hideTimerId !== null) clearTimeout(entry.hideTimerId)
      entry.typingVer++
    }
    bubbleStack.value = []
  }

  // ─── 鼠标交互 ──────────────────────────────────────────────

  function handleBubbleMouseEnter(entry: BubbleEntry) {
    entry.pinned = true
    if (entry.hideTimerId !== null) {
      clearTimeout(entry.hideTimerId)
      entry.hideTimerId = null
    }
  }

  function handleBubbleMouseLeave(entry: BubbleEntry) {
    entry.pinned = false
    if (entry.typingDone) {
      entry.hideTimerId = window.setTimeout(() => removeEntry(entry.id), 3000)
    }
  }

  // ─── 构造气泡项 ────────────────────────────────────────────

  function createBubbleItems(items: BubbleRenderableItem[]): BubbleItem[] {
    return items.map((item) => {
      if (item.type === 'text') {
        return {
          id: generateMessageId('bubble_text'),
          type: 'text' as const,
          fullText: item.text,
          renderedText: '',
        }
      }
      return {
        id: generateMessageId('bubble_image'),
        type: 'image' as const,
        src: item.src,
        alt: item.alt,
      }
    })
  }

  // ─── 主入口：推入新气泡 ────────────────────────────────────

  function pushBubble(bubbleItems: BubbleRenderableItem[], _position: string, interrupt: boolean) {
    if (!bubbleItems.length) return

    if (interrupt) {
      clearAllBubbles()
    }

    if (bubbleStack.value.length >= getBubbleStackMax()) {
      const oldest = bubbleStack.value[0]
      freezeEntry(oldest)
      bubbleStack.value.splice(0, 1)
    }

    const runtimeItems = createBubbleItems(bubbleItems)
    const offsetX = Math.round((Math.random() - 0.5) * 50)
    const entry: BubbleEntry = {
      id: generateMessageId('bubble'),
      items: runtimeItems,
      offsetX,
      typingIdx: 0,
      typingVer: 0,
      typingDone: false,
      hideTimerId: null,
      pinned: false,
      styleLeft: '0px',
      styleTop: '0px',
      styleMaxHeight: '',
    }

    bubbleStack.value.push(entry)
    const reactiveEntry = bubbleStack.value[bubbleStack.value.length - 1]
    nextTick(() => {
      updateStackPositions()
      void runEntryTypewriter(reactiveEntry)
    })
  }

  // ─── 追踪表演时间 ──────────────────────────────────────────

  function checkFollowUp(): { isFollowUp: boolean; lastPerformReceiveTime: number } {
    const now = Date.now()
    const isFollowUp = bubbleStack.value.length > 0 && (now - lastPerformReceiveTime) < getBubbleFollowUpWindowMs()
    lastPerformReceiveTime = now
    return { isFollowUp, lastPerformReceiveTime }
  }

  // ─── watch ─────────────────────────────────────────────────

  watch(bubbleStack, () => {
    nextTick(() => updateStackPositions())
  }, { deep: false })

  return {
    bubbleStack,
    setBubbleEl,
    setBubbleContentEl,
    bubbleTierClass,
    handleBubbleMediaLoad,
    handleBubbleMouseEnter,
    handleBubbleMouseLeave,
    resolveModelOverlayAnchor,
    updateStackPositions,
    pushBubble,
    clearAllBubbles,
    checkFollowUp,
    generateMessageId,
  }
}
