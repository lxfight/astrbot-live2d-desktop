/**
 * performElementSummary 测试
 * 覆盖表演序列日志摘要、敏感字段截断、表情使用键提取
 */

import { describe, expect, test } from 'vitest'
import type { PerformElement, PerformSequence } from '../src/types/protocol'
import {
  collectExpressionUsageKeys,
  summarizeLogString,
  summarizePerformElementForLog,
  summarizePerformPayloadForLog
} from '../src/windows/composables/performElementSummary'

describe('summarizeLogString', () => {
  test('空值原样返回', () => {
    expect(summarizeLogString('')).toBe('')
  })

  test('data URL 截断为头部摘要', () => {
    const dataUrl = `data:image/png;base64,${'A'.repeat(500)}`
    const result = summarizeLogString(dataUrl)

    expect(result).toContain('data:image/png;base64,')
    expect(result).toContain('省略 500 字符')
    expect(result.length).toBeLessThan(100)
  })

  test('超长文本截断并附总长', () => {
    const long = 'x'.repeat(300)
    const result = summarizeLogString(long, 100)

    expect(result).toContain('x'.repeat(100))
    expect(result).toContain('总长 300 字符')
  })

  test('未超长文本原样返回', () => {
    expect(summarizeLogString('短文本')).toBe('短文本')
  })
})

describe('summarizePerformElementForLog', () => {
  test('只保留存在的字段', () => {
    const element = { type: 'text', text: 'hello' } as unknown as PerformElement

    expect(summarizePerformElementForLog(element)).toEqual({ type: 'text', text: 'hello' })
  })

  test('combo 与 semantic 数组被简化映射', () => {
    const element = {
      type: 'expression',
      combo: [
        { id: 'E1', weight: 0.5 },
        { id: 0, weight: 1 }
      ],
      semantic: [{ tag: 'happy', weight: 0.7 }]
    } as unknown as PerformElement

    const summary = summarizePerformElementForLog(element)

    expect(summary.combo).toEqual([
      { id: 'E1', weight: 0.5 },
      { id: 0, weight: 1 }
    ])
    expect(summary.semantic).toEqual([{ tag: 'happy', weight: 0.7 }])
  })

  test('空 combo/semantic 数组不进入摘要', () => {
    const element = {
      type: 'motion',
      group: 'idle',
      combo: [],
      semantic: []
    } as unknown as PerformElement

    const summary = summarizePerformElementForLog(element)

    expect(summary).toEqual({ type: 'motion', group: 'idle' })
  })

  test('数值字段为 0 时保留', () => {
    const element = { type: 'motion', index: 0, duration: 0 } as unknown as PerformElement

    expect(summarizePerformElementForLog(element)).toEqual({
      type: 'motion',
      index: 0,
      duration: 0
    })
  })
})

describe('summarizePerformPayloadForLog', () => {
  test('汇总序列长度与元素预览', () => {
    const payload = {
      interrupt: true,
      sequence: [
        { type: 'text', text: 'hi' },
        { type: 'motion', group: 'idle' }
      ]
    } as unknown as PerformSequence

    const summary = summarizePerformPayloadForLog(payload)

    expect(summary.interrupt).toBe(true)
    expect(summary.interruptible).toBe(true)
    expect(summary.sequenceLength).toBe(2)
    expect(summary.sequencePreview).toHaveLength(2)
  })

  test('interruptible 缺省为 true，空序列得到空预览', () => {
    const payload = {} as unknown as PerformSequence

    const summary = summarizePerformPayloadForLog(payload)

    expect(summary.interruptible).toBe(true)
    expect(summary.sequenceLength).toBe(0)
    expect(summary.sequencePreview).toEqual([])
  })
})

describe('collectExpressionUsageKeys', () => {
  test('combo 优先于其他来源', () => {
    const element = {
      combo: [{ id: 'A' }, { id: 'B' }],
      expressionId: 'ignored'
    } as never

    expect(collectExpressionUsageKeys(element)).toEqual(['A', 'B'])
  })

  test('combo 中空 id 被过滤', () => {
    const element = { combo: [{ id: 'A' }, { id: '' }, { id: '  ' }] } as never

    expect(collectExpressionUsageKeys(element)).toEqual(['A'])
  })

  test('无 combo 时回退到 expressionId，再回退到 id', () => {
    expect(collectExpressionUsageKeys({ expressionId: 'E9' } as never)).toEqual(['E9'])
    expect(collectExpressionUsageKeys({ id: 7 } as never)).toEqual(['7'])
  })

  test('semantic 标签转小写并去重', () => {
    const element = {
      semantic: [{ tag: 'Happy' }, { tag: 'happy' }, { tag: '  Sad  ' }, { tag: '' }]
    } as never

    expect(collectExpressionUsageKeys(element)).toEqual(['semantic:happy', 'semantic:sad'])
  })

  test('无任何表情来源时返回空数组', () => {
    expect(collectExpressionUsageKeys({ type: 'text' } as never)).toEqual([])
    expect(collectExpressionUsageKeys({ semantic: [] } as never)).toEqual([])
  })
})
