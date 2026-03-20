/**
 * Cubism SDK 内存分配器
 * 实现官方 SDK 要求的内存管理接口
 */

export interface CubismAllocator {
  /**
   * 分配内存
   */
  allocate(size: number): any;
  
  /**
   * 释放内存
   */
  deallocate(memory: any): void;
  
  /**
   * 分配对齐内存
   */
  allocateAligned(size: number, alignment: number): any;
  
  /**
   * 释放对齐内存
   */
  deallocateAligned(memory: any): void;
}

/**
 * 默认的 Cubism 分配器实现
 * 使用 JavaScript 的内存管理
 */
export class DefaultCubismAllocator implements CubismAllocator {
  /**
   * 分配内存
   */
  allocate(size: number): any {
    return new ArrayBuffer(size);
  }
  
  /**
   * 释放内存
   */
  deallocate(memory: any): void {
    // JavaScript 自动垃圾回收，无需手动释放
    // 但我们可以清除引用
    if (memory instanceof ArrayBuffer) {
      // 无法强制释放 ArrayBuffer，但可以通知 GC
      memory = null;
    }
  }
  
  /**
   * 分配对齐内存
   */
  allocateAligned(size: number, alignment: number): any {
    // JavaScript 中 ArrayBuffer 已经是对齐的
    // 这里我们简单返回一个对齐的缓冲区
    const buffer = new ArrayBuffer(size);
    return buffer;
  }
  
  /**
   * 释放对齐内存
   */
  deallocateAligned(memory: any): void {
    // 与普通内存释放相同
    this.deallocate(memory);
  }
  
  /**
   * 分配 Float32Array
   */
  allocateFloat32Array(size: number): Float32Array {
    return new Float32Array(size);
  }
  
  /**
   * 分配 Uint8Array
   */
  allocateUint8Array(size: number): Uint8Array {
    return new Uint8Array(size);
  }
  
  /**
   * 分配 Int32Array
   */
  allocateInt32Array(size: number): Int32Array {
    return new Int32Array(size);
  }
}

/**
 * 调试分配器，用于内存泄漏检测
 */
export class DebugCubismAllocator implements CubismAllocator {
  private allocations: Map<any, { size: number; stack: string }> = new Map();
  private totalAllocated: number = 0;
  private allocationCount: number = 0;
  
  allocate(size: number): any {
    const memory = new ArrayBuffer(size);
    this.trackAllocation(memory, size);
    return memory;
  }
  
  deallocate(memory: any): void {
    this.untrackAllocation(memory);
    // JavaScript 自动垃圾回收
  }
  
  allocateAligned(size: number, alignment: number): any {
    const memory = new ArrayBuffer(size);
    this.trackAllocation(memory, size);
    return memory;
  }
  
  deallocateAligned(memory: any): void {
    this.untrackAllocation(memory);
  }
  
  private trackAllocation(memory: any, size: number): void {
    this.allocations.set(memory, {
      size,
      stack: new Error().stack || ''
    });
    this.totalAllocated += size;
    this.allocationCount++;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DebugAllocator] 分配 ${size} 字节, 总计: ${this.totalAllocated} 字节, 活跃: ${this.allocationCount}`);
    }
  }
  
  private untrackAllocation(memory: any): void {
    const allocation = this.allocations.get(memory);
    if (allocation) {
      this.totalAllocated -= allocation.size;
      this.allocationCount--;
      this.allocations.delete(memory);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DebugAllocator] 释放 ${allocation.size} 字节, 总计: ${this.totalAllocated} 字节, 活跃: ${this.allocationCount}`);
      }
    }
  }
  
  /**
   * 获取内存统计信息
   */
  getStats(): { totalAllocated: number; allocationCount: number; allocations: Array<{ size: number; stack: string }> } {
    return {
      totalAllocated: this.totalAllocated,
      allocationCount: this.allocationCount,
      allocations: Array.from(this.allocations.values())
    };
  }
  
  /**
   * 检查内存泄漏
   */
  checkLeaks(): void {
    if (this.allocationCount > 0) {
      console.warn(`[DebugAllocator] 检测到 ${this.allocationCount} 个未释放的内存块，总计 ${this.totalAllocated} 字节`);
      
      this.allocations.forEach((allocation, memory) => {
        console.warn(`[DebugAllocator] 未释放: ${allocation.size} 字节`);
        console.warn(`[DebugAllocator] 分配栈:\n${allocation.stack}`);
      });
    } else {
      console.log('[DebugAllocator] 没有检测到内存泄漏');
    }
  }
}

// 根据环境选择分配器
export function createCubismAllocator(): CubismAllocator {
  if (process.env.NODE_ENV === 'development') {
    return new DebugCubismAllocator();
  }
  return new DefaultCubismAllocator();
}