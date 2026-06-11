/**
 * 模型信息 v2.0 转换器
 * 将 v1.0 的 StateModelPayload 转换为 v2.0 格式
 */

import type { StateModelPayload } from '@/types/protocol'

/**
 * 自动生成动作别名
 */
function generateMotionAlias(motionId: string): string {
  const patterns: Record<string, string> = {
    Idle: '待机',
    TapBody: '触摸身体',
    TapHead: '触摸头部',
    Shake: '摇晃',
    Pinch: '捏脸',
    Flick: '戳'
  }

  for (const [pattern, alias] of Object.entries(patterns)) {
    if (motionId.startsWith(pattern)) {
      const match = motionId.match(/_(\d+)$/)
      if (match) {
        const index = parseInt(match[1], 10)
        return `${alias}${index + 1}`
      }
      return alias
    }
  }

  return motionId.replace(/_/g, ' ')
}

/**
 * 自动生成表情别名
 */
function generateExpressionAlias(expressionId: string): string {
  const mapping: Record<string, string> = {
    f01: '微笑',
    f02: '惊讶',
    f03: '悲伤',
    f04: '生气',
    f05: '害羞',
    f06: '得意',
    f07: '困惑',
    f08: '无奈'
  }

  return mapping[expressionId] || `表情${expressionId}`
}

export function convertModelInfoToV2(v1Info: StateModelPayload): StateModelPayload {
  const motions: Array<{ id: string; name: string; category: string; duration: number }> = []
  const expressions: Array<{ id: string; name: string }> = []

  // 转换动作
  if (v1Info.motionGroups) {
    for (const [group, items] of Object.entries(v1Info.motionGroups)) {
      for (const item of items) {
        const motionId = `${group}_${item.index.toString().padStart(2, '0')}`
        const category = group.toLowerCase() === 'idle' ? 'idle' : 'action'

        motions.push({
          id: motionId,
          name: generateMotionAlias(motionId),
          category,
          duration: 3000
        })
      }
    }
  }

  // 转换表情
  if (v1Info.expressions && Array.isArray(v1Info.expressions)) {
    for (const exprId of v1Info.expressions) {
      if (typeof exprId === 'string') {
        expressions.push({
          id: exprId,
          name: generateExpressionAlias(exprId)
        })
      }
    }
  }

  console.log('[ModelInfoConverter] v2.0 转换完成:', {
    modelName: v1Info.name,
    motionsCount: motions.length,
    expressionsCount: expressions.length,
    idleCount: motions.filter(m => m.category === 'idle').length,
    actionCount: motions.filter(m => m.category === 'action').length
  })

  return {
    version: '2.0',
    modelName: v1Info.name,
    motions,
    expressions,
    capabilities: {
      idleMode: 'noise+motion',
      llmControlled: true
    }
  }
}

export function shouldUseV2Protocol(): boolean {
  return true
}
