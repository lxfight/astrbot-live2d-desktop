import type { PerformElement, PerformExpressionResetPolicy } from '@/types/protocol'
import type { CubismExpressionRequest } from '@/utils/cubism'

type ExpressionAliasResolver = {
  getExpressionId(name: string): string | undefined
}

function resolveExpressionId(
  value: string | number | undefined,
  aliasResolver: ExpressionAliasResolver
): string | number | undefined {
  if (typeof value === 'number') {
    return value
  }
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return undefined
  }
  return aliasResolver.getExpressionId(normalized) || normalized
}

export function normalizePerformExpressionResetPolicy(
  value: PerformElement['resetPolicy']
): PerformExpressionResetPolicy {
  switch (value) {
    case 'previous':
    case undefined:
      return 'previous'
    case 'keep':
    case 'hold':
      return 'keep'
    case 'neutral':
    case 'default':
    case 'fadeOut':
    default:
      return 'neutral'
  }
}

export function createPerformExpressionRequest(
  element: PerformElement,
  aliasResolver: ExpressionAliasResolver
): CubismExpressionRequest {
  const id = resolveExpressionId(element.name ?? element.id, aliasResolver)
  const combo = Array.isArray(element.combo)
    ? element.combo
        .map(item => {
          const resolvedId = resolveExpressionId(item.id, aliasResolver)
          return typeof resolvedId === 'string' ? { ...item, id: resolvedId } : null
        })
        .filter((item): item is { id: string; weight?: number } => Boolean(item))
    : undefined

  return {
    id,
    combo,
    semantic: element.semantic,
    fade: element.fade,
    holdMs: element.holdMs,
    resetPolicy: normalizePerformExpressionResetPolicy(element.resetPolicy),
    motionType: element.motionType
  }
}
