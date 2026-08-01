import { OP as OPS } from './types'

/**
 * 协议日志脱敏工具（从 client.ts 抽出的纯函数）
 *
 * 对发往日志的数据包载荷做截断、敏感字段掩码与循环引用防护，
 * perform:show 载荷按表演元素结构生成精简摘要。
 */

function summarizePerformElementForLog(element: any): Record<string, unknown> {
  if (!element || typeof element !== 'object') {
    return { type: typeof element }
  }

  const summary: Record<string, unknown> = {
    type: element.type
  }
  const summarizeText = (value: string): string => {
    const MAX_STRING_LEN = 200
    if (value.length <= MAX_STRING_LEN) {
      return value
    }
    return value.slice(0, MAX_STRING_LEN) + '...'
  }

  for (const key of ['content', 'text', 'url', 'inline']) {
    if (typeof element[key] === 'string' && element[key]) {
      summary[key] = summarizeText(element[key])
    }
  }
  for (const key of ['rid', 'ttsMode', 'position', 'group', 'motionType', 'resetPolicy']) {
    if (typeof element[key] === 'string' && element[key]) {
      summary[key] = element[key]
    }
  }
  for (const key of ['duration', 'volume', 'speed', 'index', 'priority', 'fade', 'holdMs']) {
    if (typeof element[key] === 'number') {
      summary[key] = element[key]
    }
  }
  if ((typeof element.id === 'string' && element.id) || typeof element.id === 'number') {
    summary.id = element.id
  }
  if (Array.isArray(element.combo)) {
    summary.combo = element.combo.map((item: any) => ({
      id: item?.id,
      weight: item?.weight
    }))
  }
  if (Array.isArray(element.semantic)) {
    summary.semantic = element.semantic.map((item: any) => ({
      tag: item?.tag,
      weight: item?.weight
    }))
  }

  return summary
}

function summarizePerformShowForLog(payload: any): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return { payload }
  }

  return {
    interrupt: payload.interrupt,
    interruptible: payload.interruptible ?? true,
    sequenceLength: Array.isArray(payload.sequence) ? payload.sequence.length : 0,
    sequencePreview: Array.isArray(payload.sequence)
      ? payload.sequence.map((element: any) => summarizePerformElementForLog(element))
      : []
  }
}

export function sanitizeForLog(payload: any, op?: string): any {
  if (op === OPS.PERFORM_SHOW) {
    return summarizePerformShowForLog(payload)
  }

  if (!payload || typeof payload !== 'object') return payload
  const sensitiveKeys = ['token', 'password', 'secret', 'apiKey', 'accessKey']
  const MAX_STRING_LEN = 200
  const MAX_PREVIEW_ITEMS = 3
  const MAX_DEPTH = 4

  const sanitize = (obj: any, seen: WeakSet<object>, depth: number): any => {
    if (!obj || typeof obj !== 'object') {
      if (typeof obj === 'string' && obj.length > MAX_STRING_LEN) {
        return obj.slice(0, MAX_STRING_LEN) + '...'
      }
      return obj
    }

    if (seen.has(obj)) {
      return '[Circular]'
    }

    if (depth >= MAX_DEPTH) {
      if (Array.isArray(obj)) {
        return `[Array:${obj.length}]`
      }
      return '[Object]'
    }

    seen.add(obj)
    if (Array.isArray(obj)) {
      const preview = obj.slice(0, MAX_PREVIEW_ITEMS).map(item => sanitize(item, seen, depth + 1))
      const result = {
        __type: 'array',
        length: obj.length,
        preview
      }
      seen.delete(obj)
      return result
    }

    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        result[key] = '***'
      } else {
        result[key] = sanitize(value, seen, depth + 1)
      }
    }
    seen.delete(obj)
    return result
  }

  return sanitize(payload, new WeakSet<object>(), 0)
}
