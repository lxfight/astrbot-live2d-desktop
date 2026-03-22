/**
 * Cubism SDK 核心数据结构
 * 
 * 这些类是 Live2D Cubism SDK 的基础数据结构
 */

// ============================================================================
// CubismIdHandle - ID 句柄
// ============================================================================

/**
 * Cubism ID 句柄类型
 * 用于标识模型中的参数、部件、绘制对象等
 */
export type CubismIdHandle = string

/**
 * Cubism ID 管理器
 * 用于管理和缓存 ID 句柄
 */
export class CubismIdManager {
  private ids: Map<string, CubismIdHandle> = new Map()

  /**
   * 获取 ID 句柄
   */
  getId(id: string): CubismIdHandle {
    if (!this.ids.has(id)) {
      this.ids.set(id, id)
    }
    return this.ids.get(id)!
  }

  /**
   * 注册 ID
   */
  registerId(id: string): CubismIdHandle {
    return this.getId(id)
  }

  /**
   * 检查 ID 是否存在
   */
  isExist(id: string): boolean {
    return this.ids.has(id)
  }
}

// ============================================================================
// csmVector - 向量容器
// ============================================================================

/**
 * Cubism 向量容器
 * 类似于 std::vector，用于存储动态数组
 */
export class csmVector<T> {
  private _data: T[] = []
  private _size: number = 0
  private _capacity: number = 0

  /**
   * 构造函数
   */
  constructor(initialCapacity: number = 0) {
    this._capacity = initialCapacity
  }

  /**
   * 获取大小
   */
  getSize(): number {
    return this._size
  }

  /**
   * 获取容量
   */
  getCapacity(): number {
    return this._capacity
  }

  /**
   * 是否为空
   */
  isEmpty(): boolean {
    return this._size === 0
  }

  /**
   * 设置大小
   */
  prepareCapacity(newCapacity: number): void {
    if (newCapacity > this._capacity) {
      if (this._capacity === 0) {
        this._capacity = newCapacity
      } else {
        while (this._capacity < newCapacity) {
          this._capacity *= 2
        }
      }
    }
  }

  /**
   * 重新设置大小
   */
  resize(newSize: number, value: T): void {
    this.prepareCapacity(newSize)
    for (let i = this._size; i < newSize; i++) {
      this._data[i] = value
    }
    this._size = newSize
  }

  /**
   * 添加元素到末尾
   */
  pushBack(value: T): void {
    if (this._size >= this._capacity) {
      this.prepareCapacity(this._capacity === 0 ? 1 : this._capacity * 2)
    }
    this._data[this._size] = value
    this._size++
  }

  /**
   * 移除末尾元素
   */
  popBack(): T | undefined {
    if (this._size > 0) {
      this._size--
      const value = this._data[this._size]
      this._data[this._size] = undefined as any
      return value
    }
    return undefined
  }

  /**
   * 获取指定位置的元素
   */
  at(index: number): T {
    if (index < 0 || index >= this._size) {
      throw new Error(`Index out of bounds: ${index}`)
    }
    return this._data[index]
  }

  /**
   * 设置指定位置的元素
   */
  set(index: number, value: T): void {
    if (index < 0 || index >= this._size) {
      throw new Error(`Index out of bounds: ${index}`)
    }
    this._data[index] = value
  }

  /**
   * 移除指定位置的元素
   */
  remove(index: number): void {
    if (index < 0 || index >= this._size) {
      throw new Error(`Index out of bounds: ${index}`)
    }
    for (let i = index; i < this._size - 1; i++) {
      this._data[i] = this._data[i + 1]
    }
    this._size--
    this._data[this._size] = undefined as any
  }

  /**
   * 清空所有元素
   */
  clear(): void {
    for (let i = 0; i < this._size; i++) {
      this._data[i] = undefined as any
    }
    this._size = 0
  }

  /**
   * 获取内部数据数组
   */
  get(offset: number = 0): T[] {
    return this._data.slice(offset, this._size)
  }

  /**
   * 迭代器
   */
  [Symbol.iterator](): Iterator<T> {
    let index = 0
    const data = this._data
    const size = this._size
    return {
      next(): IteratorResult<T> {
        if (index < size) {
          return { value: data[index++], done: false }
        }
        return { value: undefined as any, done: true }
      }
    }
  }

  /**
   * forEach 方法
   */
  forEach(callback: (value: T, index: number) => void): void {
    for (let i = 0; i < this._size; i++) {
      callback(this._data[i], i)
    }
  }

  /**
   * map 方法
   */
  map<U>(callback: (value: T, index: number) => U): csmVector<U> {
    const result = new csmVector<U>(this._size)
    for (let i = 0; i < this._size; i++) {
      result.pushBack(callback(this._data[i], i))
    }
    return result
  }

  /**
   * filter 方法
   */
  filter(callback: (value: T, index: number) => boolean): csmVector<T> {
    const result = new csmVector<T>()
    for (let i = 0; i < this._size; i++) {
      if (callback(this._data[i], i)) {
        result.pushBack(this._data[i])
      }
    }
    return result
  }
}

// ============================================================================
// csmMap - 映射容器
// ============================================================================

/**
 * Cubism 映射容器
 * 类似于 std::map，用于存储键值对
 */
export class csmMap<K, V> {
  private _map: Map<K, V> = new Map()

  /**
   * 构造函数
   */
  constructor() {}

  /**
   * 获取大小
   */
  getSize(): number {
    return this._map.size
  }

  /**
   * 是否为空
   */
  isEmpty(): boolean {
    return this._map.size === 0
  }

  /**
   * 检查键是否存在
   */
  isExist(key: K): boolean {
    return this._map.has(key)
  }

  /**
   * 获取指定键的值
   */
  getValue(key: K): V {
    if (!this._map.has(key)) {
      throw new Error(`Key not found: ${key}`)
    }
    return this._map.get(key)!
  }

  /**
   * 设置键值对
   */
  setValue(key: K, value: V): void {
    this._map.set(key, value)
  }

  /**
   * 移除指定键
   */
  remove(key: K): boolean {
    return this._map.delete(key)
  }

  /**
   * 清空所有元素
   */
  clear(): void {
    this._map.clear()
  }

  /**
   * 获取所有键
   */
  getKeys(): csmVector<K> {
    const keys = new csmVector<K>()
    for (const key of this._map.keys()) {
      keys.pushBack(key)
    }
    return keys
  }

  /**
   * 获取所有值
   */
  getValues(): csmVector<V> {
    const values = new csmVector<V>()
    for (const value of this._map.values()) {
      values.pushBack(value)
    }
    return values
  }

  /**
   * 迭代器
   */
  [Symbol.iterator](): Iterator<[K, V]> {
    return this._map[Symbol.iterator]()
  }

  /**
   * forEach 方法
   */
  forEach(callback: (value: V, key: K) => void): void {
    this._map.forEach(callback)
  }
}

// ============================================================================
// CubismMatrix44 - 4x4 矩阵
// ============================================================================

/**
 * 4x4 矩阵类
 * 用于模型变换和渲染
 */
export class CubismMatrix44 {
  private _tr: Float32Array = new Float32Array(16)

  /**
   * 构造函数
   */
  constructor() {
    this.loadIdentity()
  }

  /**
   * 加载单位矩阵
   */
  loadIdentity(): void {
    const a = this._tr
    a[0] = 1; a[1] = 0; a[2] = 0; a[3] = 0
    a[4] = 0; a[5] = 1; a[6] = 0; a[7] = 0
    a[8] = 0; a[9] = 0; a[10] = 1; a[11] = 0
    a[12] = 0; a[13] = 0; a[14] = 0; a[15] = 1
  }

  /**
   * 设置矩阵
   */
  setMatrix(a: Float32Array): void {
    if (a.length !== 16) {
      throw new Error('Matrix must have 16 elements')
    }
    for (let i = 0; i < 16; i++) {
      this._tr[i] = a[i]
    }
  }

  /**
   * 获取矩阵数组
   */
  getArray(): Float32Array {
    return this._tr
  }

  /**
   * 获取指定位置的元素
   */
  get(row: number, col: number): number {
    return this._tr[row * 4 + col]
  }

  /**
   * 设置指定位置的元素
   */
  set(row: number, col: number, value: number): void {
    this._tr[row * 4 + col] = value
  }

  /**
   * 设置单位矩阵
   */
  identity(): void {
    this.loadIdentity()
  }

  /**
   * 缩放
   */
  scale(scaleX: number, scaleY?: number): void {
    if (scaleY === undefined) {
      scaleY = scaleX
    }
    this._tr[0] *= scaleX
    this._tr[5] *= scaleY
  }

  /**
   * X 轴平移
   */
  translateX(x: number): void {
    this._tr[12] += x
  }

  /**
   * Y 轴平移
   */
  translateY(y: number): void {
    this._tr[13] += y
  }

  /**
   * 平移
   */
  translate(x: number, y: number): void {
    this._tr[12] += x
    this._tr[13] += y
  }

  /**
   * 旋转（弧度）
   */
  rotate(angle: number): void {
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    const a = this._tr

    const a0 = a[0]; const a1 = a[1]; const a4 = a[4]; const a5 = a[5]
    a[0] = a0 * cos + a4 * sin
    a[1] = a1 * cos + a5 * sin
    a[4] = a0 * -sin + a4 * cos
    a[5] = a1 * -sin + a5 * cos
  }

  /**
   * 矩阵乘法
   */
  multiplyByMatrix(m: CubismMatrix44): void {
    const a = this._tr
    const b = m._tr
    const c = new Float32Array(16)

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        c[i * 4 + j] = 0
        for (let k = 0; k < 4; k++) {
          c[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j]
        }
      }
    }

    for (let i = 0; i < 16; i++) {
      a[i] = c[i]
    }
  }

  /**
   * 从另一个矩阵复制
   */
  copyFrom(m: CubismMatrix44): void {
    for (let i = 0; i < 16; i++) {
      this._tr[i] = m._tr[i]
    }
  }

  /**
   * 克隆矩阵
   */
  clone(): CubismMatrix44 {
    const m = new CubismMatrix44()
    m.copyFrom(this)
    return m
  }

  /**
   * 转换为 JSON 对象
   */
  toJson(): number[] {
    return Array.from(this._tr)
  }

  /**
   * 从 JSON 对象加载
   */
  fromJson(json: number[]): void {
    if (json.length !== 16) {
      throw new Error('JSON array must have 16 elements')
    }
    for (let i = 0; i < 16; i++) {
      this._tr[i] = json[i]
    }
  }

  /**
   * 打印矩阵（调试用）
   */
  printMatrix(): void {
    const a = this._tr
    console.log(`[${a[0].toFixed(3)}, ${a[1].toFixed(3)}, ${a[2].toFixed(3)}, ${a[3].toFixed(3)}]`)
    console.log(`[${a[4].toFixed(3)}, ${a[5].toFixed(3)}, ${a[6].toFixed(3)}, ${a[7].toFixed(3)}]`)
    console.log(`[${a[8].toFixed(3)}, ${a[9].toFixed(3)}, ${a[10].toFixed(3)}, ${a[11].toFixed(3)}]`)
    console.log(`[${a[12].toFixed(3)}, ${a[13].toFixed(3)}, ${a[14].toFixed(3)}, ${a[15].toFixed(3)}]`)
  }
}

// ============================================================================
// CubismTargetPoint - 注视点
// ============================================================================

/**
 * 注视点管理器
 * 用于计算模型眼睛应该注视的位置
 */
export class CubismTargetPoint {
  private _x: number = 0
  private _y: number = 0
  private _userTimeSeconds: number = 0
  private _faceTargetX: number = 0
  private _faceTargetY: number = 0
  private _faceX: number = 0
  private _faceY: number = 0
  private _faceVX: number = 0
  private _faceVY: number = 0

  /**
   * 构造函数
   */
  constructor() {}

  /**
   * 更新
   */
  update(deltaTimeSeconds: number): void {
    // 目标时间
    const timeToReachOneSecond = 0.5
    const curTimeToWeight = timeToReachOneSecond / deltaTimeSeconds

    // 面部跟踪
    this._faceTargetX = this._x
    this._faceTargetY = this._y

    // 缓动
    this._faceVX = (this._faceTargetX - this._faceX) / curTimeToWeight
    this._faceVY = (this._faceTargetY - this._faceY) / curTimeToWeight

    // 更新面部位置
    this._faceX += this._faceVX
    this._faceY += this._faceVY

    // 更新时间
    this._userTimeSeconds += deltaTimeSeconds
  }

  /**
   * 获取 X 坐标
   */
  getX(): number {
    return this._faceX
  }

  /**
   * 获取 Y 坐标
   */
  getY(): number {
    return this._faceY
  }

  /**
   * 设置目标坐标
   */
  set(x: number, y: number): void {
    this._x = x
    this._y = y
  }

  /**
   * 获取目标 X 坐标
   */
  getTargetX(): number {
    return this._x
  }

  /**
   * 获取目标 Y 坐标
   */
  getTargetY(): number {
    return this._y
  }

  /**
   * 重置
   */
  reset(): void {
    this._x = 0
    this._y = 0
    this._faceX = 0
    this._faceY = 0
    this._faceVX = 0
    this._faceVY = 0
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检查字符串是否为 Cubism 3 模型
 */
export function isCubism3Model(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith('.model3.json')
}

/**
 * 检查字符串是否为 Cubism 2 模型
 */
export function isCubism2Model(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith('.model.json') && 
         !modelPath.toLowerCase().endsWith('.model3.json')
}

/**
 * 获取模型名称
 */
export function getModelName(modelPath: string): string {
  return modelPath.split('/').filter(Boolean).pop()?.replace(/\.(model|model3)\.json$/, '') || 'unknown'
}

/**
 * 规范化模型路径
 */
export function normalizeModelPath(modelPath: string): string {
  if (!modelPath.startsWith('/')) {
    return '/' + modelPath
  }
  return modelPath
}

/**
 * 获取纹理路径
 */
export function getTexturePath(modelPath: string, textureFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + textureFileName
}

/**
 * 获取动作路径
 */
export function getMotionPath(modelPath: string, motionFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + motionFileName
}

/**
 * 获取表情路径
 */
export function getExpressionPath(modelPath: string, expressionFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + expressionFileName
}

/**
 * 获取物理路径
 */
export function getPhysicsPath(modelPath: string, physicsFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + physicsFileName
}

/**
 * 获取姿势路径
 */
export function getPosePath(modelPath: string, poseFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1)
  return modelDir + poseFileName
}