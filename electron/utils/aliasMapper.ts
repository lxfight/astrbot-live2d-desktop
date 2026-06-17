/**
 * 别名映射器 - 将用户配置的动作/表情别名映射到原始 ID
 */

import type { StateModelPayload } from '../../src/types/protocol'
import type { ModelAliasConfigV2 } from '../../src/shared/modelConfigFactory'

export interface MotionAlias {
  id: string
  name: string
  category: 'idle' | 'action'
  description?: string
  duration: number
  enabled: boolean
}

export interface ExpressionAlias {
  id: string
  name: string
  description?: string
  thumbnail?: string
  enabled: boolean
}

export type ModelConfig = ModelAliasConfigV2

export class AliasMapper {
  private motionMap = new Map<string, { id: string; category: string }>()
  private expressionMap = new Map<string, string>()
  private config: ModelConfig | null = null

  loadFromConfig(config: ModelConfig) {
    this.config = config
    this.motionMap.clear()
    this.expressionMap.clear()

    config.motionAliases
      .filter(m => m.enabled)
      .forEach(m => {
        this.motionMap.set(m.name, {
          id: m.id,
          category: m.category
        })
      })

    config.expressionAliases
      .filter(e => e.enabled)
      .forEach(e => {
        this.expressionMap.set(e.name, e.id)
      })

    console.log(
      `[AliasMapper] Loaded: ${this.motionMap.size} motions, ${this.expressionMap.size} expressions`
    )
  }

  getMotionId(name: string): string | undefined {
    return this.motionMap.get(name)?.id
  }

  getMotionCategory(name: string): string | undefined {
    return this.motionMap.get(name)?.category
  }

  getExpressionId(name: string): string | undefined {
    return this.expressionMap.get(name)
  }

  getIdleMotions(): string[] {
    if (!this.config) return []

    return this.config.motionAliases.filter(m => m.enabled && m.category === 'idle').map(m => m.id)
  }

  hasConfig(): boolean {
    return this.config !== null
  }

  private getEnabledExpressionIdSet(): Set<string> | null {
    if (!this.config) {
      return null
    }
    return new Set(
      this.config.expressionAliases
        .filter(expression => expression.enabled)
        .map(expression => expression.id)
    )
  }

  private exportExpressionCatalog(
    baseModelInfo?: StateModelPayload | null
  ): StateModelPayload['expressionCatalog'] {
    const enabledExpressionIds = this.getEnabledExpressionIdSet()
    if (!enabledExpressionIds) {
      return baseModelInfo?.expressionCatalog
    }
    return baseModelInfo?.expressionCatalog?.filter(entry => enabledExpressionIds.has(entry.id))
  }

  private exportSemanticPresets(
    baseModelInfo?: StateModelPayload | null
  ): StateModelPayload['semanticPresets'] {
    const enabledExpressionIds = this.getEnabledExpressionIdSet()
    if (!enabledExpressionIds || !baseModelInfo?.semanticPresets) {
      return baseModelInfo?.semanticPresets
    }

    const presets = Object.entries(baseModelInfo.semanticPresets).reduce<Record<string, string[]>>(
      (result, [key, expressionIds]) => {
        const filtered = expressionIds.filter(expressionId =>
          enabledExpressionIds.has(expressionId)
        )
        if (filtered.length > 0) {
          result[key] = filtered
        }
        return result
      },
      {}
    )

    return Object.keys(presets).length > 0 ? presets : undefined
  }

  private exportCapabilities(
    baseModelInfo: StateModelPayload | null | undefined,
    expressionCatalog: StateModelPayload['expressionCatalog'],
    semanticPresets: StateModelPayload['semanticPresets']
  ) {
    const capabilities = {
      idleMode: 'noise+motion',
      llmControlled: true,
      ...(baseModelInfo?.capabilities ?? {})
    }

    if (this.config && 'expressionCombo' in capabilities) {
      capabilities.expressionCombo = Boolean(expressionCatalog?.some(entry => entry.supportsCombo))
    }
    if (this.config && 'semanticExpression' in capabilities) {
      capabilities.semanticExpression = Boolean(
        semanticPresets && Object.values(semanticPresets).some(items => items.length > 0)
      )
    }

    return capabilities
  }

  exportForAdapter(modelName: string, baseModelInfo?: StateModelPayload | null): StateModelPayload {
    if (!this.config) {
      const expressionCatalog = this.exportExpressionCatalog(baseModelInfo)
      const semanticPresets = this.exportSemanticPresets(baseModelInfo)
      return {
        version: '2.0',
        modelName,
        motions: [],
        expressions: [],
        capabilities: this.exportCapabilities(baseModelInfo, expressionCatalog, semanticPresets),
        expressionCatalog,
        semanticPresets,
        discovery: baseModelInfo?.discovery
      }
    }

    const motions = Array.from(this.motionMap.entries()).map(([name, info]) => ({
      id: info.id,
      name,
      category: info.category,
      duration: this.config!.motionAliases.find(m => m.id === info.id)?.duration || 3000
    }))

    const expressions = Array.from(this.expressionMap.entries()).map(([name, id]) => ({
      id,
      name
    }))
    const expressionCatalog = this.exportExpressionCatalog(baseModelInfo)
    const semanticPresets = this.exportSemanticPresets(baseModelInfo)

    return {
      version: '2.0',
      modelName,
      motions,
      expressions,
      capabilities: this.exportCapabilities(baseModelInfo, expressionCatalog, semanticPresets),
      expressionCatalog,
      semanticPresets,
      discovery: baseModelInfo?.discovery
    }
  }
}

export {
  generateMotionAliasFromId as generateMotionAlias,
  generateExpressionAliasFromId as generateExpressionAlias
} from '../../src/shared/modelConfigFactory'
