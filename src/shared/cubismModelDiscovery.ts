export type CubismModelDiscoverySource = 'model3' | 'companion' | 'scan'

export type CubismCompatibilityExpressionEntry = {
  id: string
  file: string
  aliases: string[]
  source: CubismModelDiscoverySource
}

export type CubismCompatibilityMotionEntry = {
  file: string
  source: CubismModelDiscoverySource
}

export type CubismModelDiscoveryInfo = {
  mode: 'standard' | 'hybrid' | 'compatibility'
  sources: CubismModelDiscoverySource[]
  companionFiles: string[]
  standardDeclaredExpressions: number
  standardDeclaredMotionGroups: number
  discoveredExpressions: number
  discoveredMotionGroups: number
  scannedExpressionCount: number
  scannedMotionCount: number
  warnings: string[]
}

export type CubismCompatibilityManifest = {
  version: 1
  modelFile: string
  expressionProfileFile: string | null
  expressions: CubismCompatibilityExpressionEntry[]
  motions: Record<string, CubismCompatibilityMotionEntry[]>
  discovery: CubismModelDiscoveryInfo
}

export type CubismModelLoadDescriptor = {
  modelPath: string
  compatibilityManifest: CubismCompatibilityManifest
  warnings: string[]
}
