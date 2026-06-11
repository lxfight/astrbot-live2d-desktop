import {
  buildModelConfigFromCatalog,
  type ModelAliasConfigV2,
  type ModelCatalogPayload
} from './modelConfigFactory'

/**
 * 解析动作 ID（格式：{group}_{index}，index 为末尾数字，group 可含下划线）
 */
export function parseMotionIdParts(motionId: string): { group: string; index: number } {
  const match = motionId.match(/^(.*)_(\d+)$/)
  if (!match) {
    return { group: motionId, index: 0 }
  }
  return { group: match[1], index: parseInt(match[2], 10) || 0 }
}

/** 已保存配置与磁盘 catalog 合并，补全缺失动作/表情（按文件去重后的 manifest 可能多于旧配置） */
export function mergeAliasConfigWithCatalog(
  saved: ModelAliasConfigV2,
  catalog: ModelCatalogPayload
): ModelAliasConfigV2 {
  const fromCatalog = buildModelConfigFromCatalog(catalog)
  const motionById = new Map(saved.motionAliases.map(m => [m.id, m]))
  for (const motion of fromCatalog.motionAliases) {
    if (!motionById.has(motion.id)) {
      motionById.set(motion.id, motion)
    }
  }
  const exprById = new Map(saved.expressionAliases.map(e => [e.id, e]))
  for (const expr of fromCatalog.expressionAliases) {
    if (!exprById.has(expr.id)) {
      exprById.set(expr.id, expr)
    }
  }
  return {
    ...saved,
    motionAliases: [...motionById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    expressionAliases: [...exprById.values()].sort((a, b) => a.id.localeCompare(b.id))
  }
}
