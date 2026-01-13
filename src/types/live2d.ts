/**
 * PixiJS 和 Live2D 相关类型定义
 */

import type { Application, Renderer } from 'pixi.js'

// PixiJS Application 类型
export type PixiApplication = Application<Renderer>

// Live2D 模型信息
export interface Live2DModelInfo {
  position: {
    x: number
    y: number
  }
  width: number
  height: number
  scale: number
}

// Live2D 模型配置
export interface Live2DModelConfig {
  Version?: number
  FileReferences?: {
    Moc: string
    Textures: string[]
    Physics?: string
    Pose?: string
    DisplayInfo?: string
    Motions?: Record<string, Array<{ File: string }>>
    Expressions?: Array<{ Name: string; File: string }>
  }
  Motions?: Record<string, Array<{ File: string }>>
  Expressions?: Array<{ Name: string; File: string }>
  HitAreas?: Array<{
    Name: string
    Id: string
  }>
}

// 解析后的模型信息
export interface ParsedModelInfo {
  name: string
  version: number
  textureCount: number
  motionGroups: string[]
  motionCount: number
  expressions: string[]
  hitAreas: string[]
}

// Live2D 模型实例（简化类型）
export interface Live2DModel {
  x: number
  y: number
  scale: {
    x: number
    y: number
    set: (value: number) => void
  }
  width: number
  height: number
  anchor: {
    x: number
    y: number
    set: (x: number, y: number) => void
  }
  internalModel: {
    motionManager: {
      groups: Record<string, unknown[]>
      startMotion: (group: string, index: number, priority?: number) => Promise<unknown>
    }
    coreModel: {
      setParameterValueById: (id: string, value: number) => void
      getParameterValueById: (id: string) => number
    }
  }
  motion: (group: string, index?: number, priority?: number) => Promise<unknown>
  expression: (expressionId: string) => void
  focus: (x: number, y: number, instant?: boolean) => void
  tap: (x: number, y: number) => void
  hitTest: (x: number, y: number) => string[]
}

// 鼠标穿透配置
export interface MousePassthroughOptions {
  enabled: boolean
  alphaThreshold: number
  debounceMs: number
}

// HitTest 配置
export interface HitTestOptions {
  debounceMs: number
  alphaThreshold: number
}

// HitTest 结果
export interface HitTestResult {
  isHit: boolean
  hitAreas: string[]
  alpha: number
}
