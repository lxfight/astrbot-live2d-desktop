/**
 * Live2D Cubism Core 类型声明
 * 
 * 这个文件声明了 live2dcubismcore.js 的全局类型
 * Cubism Core 是一个 JavaScript/WASM 库，通过全局变量访问
 */

declare namespace Live2DCubismCore {
  // ============================================================================
  // 版本信息
  // ============================================================================
  
  namespace Version {
    /**
     * 获取 Cubism Core 版本号
     */
    function csmGetVersion(): number
    
    /**
     * 获取最新支持的 Moc 版本
     */
    function csmGetLatestMocVersion(): number
    
    /**
     * 获取 Moc 文件版本
     */
    function csmGetMocVersion(mocBytes: ArrayBuffer): number
  }
  
  // ============================================================================
  // 日志系统
  // ============================================================================
  
  type csmLogFunction = (message: string) => void
  
  namespace Logging {
    /**
     * 设置日志函数
     */
    function csmSetLogFunction(logFunction: csmLogFunction): void
    
    /**
     * 获取日志函数
     */
    function csmGetLogFunction(): csmLogFunction
  }
  
  // ============================================================================
  // 内存管理
  // ============================================================================
  
  namespace Memory {
    /**
     * 初始化内存大小
     */
    function initializeAmountOfMemory(size: number): void
    
    /**
     * 获取内存分配器
     */
    function getAllocator(): any
  }
  
  // ============================================================================
  // Moc 类
  // ============================================================================
  
  class Moc {
    /**
     * 从 ArrayBuffer 创建 Moc
     */
    static fromArrayBuffer(mocBytes: ArrayBuffer): Moc | null
    
    /**
     * 检查 Moc 一致性
     */
    static prototype: {
      hasMocConsistency(mocBytes: ArrayBuffer): boolean
    }
    
    /**
     * 释放 Moc
     */
    _release(): void
  }
  
  // ============================================================================
  // Model 类
  // ============================================================================
  
  class Model {
    /**
     * 从 Moc 创建 Model
     */
    static fromMoc(moc: Moc): Model | null
    
    // 参数相关
    getParameterCount(): number
    getParameterId(index: number): string
    getParameterIndex(id: string): number
    getParameterValueById(id: string): number
    setParameterValueById(id: string, value: number, weight?: number): void
    addParameterValueById(id: string, value: number, weight?: number): void
    getParameterValue(index: number): number
    setParameterValue(index: number, value: number, weight?: number): void
    getParameterMinimumValue(index: number): number
    getParameterMaximumValue(index: number): number
    getParameterDefaultValue(index: number): number
    
    // Part 相关
    getPartCount(): number
    getPartId(index: number): string
    getPartIndex(id: string): number
    getPartOpacityByIndex(index: number): number
    setPartOpacityByIndex(index: number, opacity: number): void
    getPartOpacityById(id: string): number
    setPartOpacityById(id: string, opacity: number): void
    
    // Drawable 相关
    getDrawableCount(): number
    getDrawableId(index: number): string
    getDrawableIndex(id: string): number
    getDrawableRenderOrders(): Int32Array
    getDrawableTextureIndices(index: number): number
    getDrawableVertexUvs(index: number): Float32Array
    getDrawableVertexPositions(index: number): Float32Array
    getDrawableVertexIndices(index: number): Uint16Array
    getDrawableVertexIndexCount(index: number): number
    getDrawableConstantFlag(index: number): number
    getDrawableDynamicFlag(index: number): number
    getDrawableCulling(index: number): number
    getDrawableBlendMode(index: number): number
    getDrawableInvertedMask(index: number): number
    getDrawableMasks(index: number): Int32Array
    getDrawableMaskCounts(): Int32Array
    
    // 画布相关
    getCanvasWidth(): number
    getCanvasHeight(): number
    getCanvasWidthPixel(): number
    getCanvasHeightPixel(): number
    
    // 保存/恢复参数
    saveParameters(): void
    loadParameters(): void
    
    // 更新
    update(): void
    
    // 释放
    _release(): void
  }
  
  // ============================================================================
  // 颜色混合类型
  // ============================================================================
  
  const ColorBlendType_Normal: number
  const ColorBlendType_Additive: number
  const ColorBlendType_Multiplicative: number
}

// 全局变量声明
declare const Live2DCubismCore: typeof Live2DCubismCore
