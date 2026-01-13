import { logger } from './logger'

export interface MotionDefinition {
  File: string
  FadeInTime?: number
  FadeOutTime?: number
  Sound?: string
}

export interface MotionGroup {
  groupName: string
  motions: MotionDefinition[]
}

export interface ExpressionDefinition {
  Name: string
  File: string
}

export interface ModelFileReferences {
  Moc?: string
  Textures?: string[]
  Physics?: string
  Pose?: string
  UserData?: string
  DisplayInfo?: string
  Expressions?: ExpressionDefinition[]
  Motions?: Record<string, MotionDefinition[]>
}

export interface ModelConfig {
  Version: number
  FileReferences: ModelFileReferences
  Groups?: Array<{ Target: string; Name: string; Ids: string[] }>
  Motions?: Record<string, MotionDefinition[]>
}

export interface ParsedModelInfo {
  version: number
  motionGroups: MotionGroup[]
  expressions: ExpressionDefinition[]
  textureCount: number
  hasPhysics: boolean
  hasPose: boolean
}

export async function loadModelConfig(modelPath: string): Promise<ModelConfig> {
  try {
    const response = await fetch(modelPath)
    if (!response.ok) {
      throw new Error(`加载模型配置失败: ${response.statusText}`)
    }
    const config: ModelConfig = await response.json()
    return config
  } catch (error) {
    logger.error('加载模型配置出错:', error)
    throw error
  }
}

export function parseMotions(config: ModelConfig): MotionGroup[] {
  const motionGroups: MotionGroup[] = []

  // Cubism 3.x: Motions 在 FileReferences 下
  let motionsData = config.FileReferences?.Motions || config.Motions

  if (motionsData) {
    for (const [groupName, motions] of Object.entries(motionsData)) {
      motionGroups.push({
        groupName,
        motions: motions || []
      })
    }
  }

  return motionGroups
}

export function parseExpressions(config: ModelConfig): ExpressionDefinition[] {
  if (config.FileReferences.Expressions) {
    return config.FileReferences.Expressions
  }
  return []
}

export async function getModelInfo(modelPath: string): Promise<ParsedModelInfo> {
  const config = await loadModelConfig(modelPath)

  return {
    version: config.Version,
    motionGroups: parseMotions(config),
    expressions: parseExpressions(config),
    textureCount: config.FileReferences.Textures?.length || 0,
    hasPhysics: !!config.FileReferences.Physics,
    hasPose: !!config.FileReferences.Pose
  }
}
