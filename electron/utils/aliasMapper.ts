/**
 * 别名映射器 - 将用户配置的动作/表情别名映射到原始 ID
 */

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

  exportForAdapter(modelName: string): any {
    if (!this.config) {
      return {
        version: '2.0',
        modelName,
        motions: [],
        expressions: [],
        capabilities: {
          idleMode: 'noise+motion',
          llmControlled: true
        }
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

    return {
      version: '2.0',
      modelName,
      motions,
      expressions,
      capabilities: {
        idleMode: 'noise+motion',
        llmControlled: true
      }
    }
  }
}

export {
  generateMotionAliasFromId as generateMotionAlias,
  generateExpressionAliasFromId as generateExpressionAlias
} from '../../src/shared/modelConfigFactory'
