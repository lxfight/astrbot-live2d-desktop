import type { PerformElement, PerformSequence } from '@/types/protocol'

/**
 * 表演序列日志摘要与表情使用统计工具（从 Main.vue 抽出的纯函数）
 */

export function summarizeLogString(value: string, maxLength = 160): string {
  if (!value) {
    return value
  }

  if (value.startsWith('data:')) {
    const separatorIndex = value.indexOf(',')
    const header = separatorIndex >= 0 ? value.slice(0, separatorIndex + 1) : value
    return `${header}<省略 ${Math.max(0, value.length - header.length)} 字符>`
  }

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...(总长 ${value.length} 字符)`
}

export function summarizePerformElementForLog(element: PerformElement): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    type: element.type
  }

  if (typeof element.position === 'string' && element.position) {
    summary.position = element.position
  }
  if (typeof element.duration === 'number') {
    summary.duration = element.duration
  }
  if (typeof element.content === 'string' && element.content) {
    summary.content = summarizeLogString(element.content, 120)
  }
  if (typeof element.text === 'string' && element.text) {
    summary.text = summarizeLogString(element.text, 120)
  }
  if (typeof element.url === 'string' && element.url) {
    summary.url = summarizeLogString(element.url, 200)
  }
  if (typeof element.inline === 'string' && element.inline) {
    summary.inline = summarizeLogString(element.inline, 200)
  }
  if (typeof element.rid === 'string' && element.rid) {
    summary.rid = element.rid
  }
  if (typeof element.ttsMode === 'string' && element.ttsMode) {
    summary.ttsMode = element.ttsMode
  }
  if (typeof element.volume === 'number') {
    summary.volume = element.volume
  }
  if (typeof element.speed === 'number') {
    summary.speed = element.speed
  }
  if (typeof element.group === 'string' && element.group) {
    summary.group = element.group
  }
  if (typeof element.motionType === 'string' && element.motionType) {
    summary.motionType = element.motionType
  }
  if (typeof element.index === 'number') {
    summary.index = element.index
  }
  if ((typeof element.id === 'string' && element.id) || typeof element.id === 'number') {
    summary.id = element.id
  }
  if (Array.isArray(element.combo) && element.combo.length > 0) {
    summary.combo = element.combo.map(item => ({
      id: item.id,
      weight: item.weight
    }))
  }
  if (Array.isArray(element.semantic) && element.semantic.length > 0) {
    summary.semantic = element.semantic.map(item => ({
      tag: item.tag,
      weight: item.weight
    }))
  }
  if (typeof element.fade === 'number') {
    summary.fade = element.fade
  }
  if (typeof element.holdMs === 'number') {
    summary.holdMs = element.holdMs
  }
  if (typeof element.resetPolicy === 'string' && element.resetPolicy) {
    summary.resetPolicy = element.resetPolicy
  }

  return summary
}

export function summarizePerformPayloadForLog(payload: PerformSequence): Record<string, unknown> {
  return {
    interrupt: payload.interrupt,
    interruptible: payload.interruptible ?? true,
    sequenceLength: Array.isArray(payload.sequence) ? payload.sequence.length : 0,
    sequencePreview: Array.isArray(payload.sequence)
      ? payload.sequence.map(element => summarizePerformElementForLog(element))
      : []
  }
}

export function collectExpressionUsageKeys(
  element: PerformElement & { expressionId?: string | number }
): string[] {
  if (Array.isArray(element.combo) && element.combo.length > 0) {
    return element.combo.map(item => String(item.id || '').trim()).filter(value => Boolean(value))
  }

  const explicitExpressionId = element.expressionId ?? element.id
  if (explicitExpressionId !== undefined && explicitExpressionId !== null) {
    const normalized = String(explicitExpressionId).trim()
    return normalized ? [normalized] : []
  }

  if (!Array.isArray(element.semantic) || element.semantic.length === 0) {
    return []
  }

  const seen = new Set<string>()
  const keys: string[] = []
  for (const item of element.semantic) {
    const normalizedTag = String(item.tag || '')
      .trim()
      .toLowerCase()
    if (!normalizedTag) {
      continue
    }
    const key = `semantic:${normalizedTag}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    keys.push(key)
  }
  return keys
}
