/**
 * Live2D Cubism Core 类型定义
 */

declare global {
  interface Window {
    Live2DCubismCore: {
      Version: {
        csmGetVersion(): number
      }
      Logging: {
        csmGetLogFunction(): Function
        csmSetLogFunction(handler: Function): void
      }
      Memory: {
        csmGetDeserializedSizeInBytes(moc: ArrayBuffer): number
        csmReviveMocInPlace(moc: ArrayBuffer, size: number): any
      }
      Moc: {
        csmGetLatestMocVersion(): number
        csmGetMocVersion(moc: ArrayBuffer): number
      }
      Model: {
        csmGetParameterCount(model: any): number
        csmGetParameterIds(model: any): string[]
        csmGetParameterValues(model: any): Float32Array
        csmGetPartCount(model: any): number
        csmGetPartIds(model: any): string[]
        csmGetPartOpacities(model: any): Float32Array
        csmGetDrawableCount(model: any): number
        csmGetDrawableIds(model: any): string[]
        csmGetDrawableTextureIndices(model: any): Int32Array
        csmGetDrawableVertexCounts(model: any): Int32Array
        csmGetDrawableVertexPositions(model: any, index: number): Float32Array
        csmGetDrawableVertexUvs(model: any, index: number): Float32Array
        csmGetDrawableIndices(model: any, index: number): Uint16Array
        csmGetDrawableOpacities(model: any): Float32Array
        csmResetDrawableDynamicFlags(model: any): void
        csmUpdateModel(model: any): void
      }
    }
  }
}

export {}
