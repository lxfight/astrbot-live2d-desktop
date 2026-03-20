/**
 * Windows 平台原生窗口事件监听器
 * 
 * 使用 Windows API 的 SetWinEventHook 实现事件驱动的窗口监听
 * 相比轮询方案，响应延迟从 2 秒降低到 <10ms
 */

import { screen } from 'electron'
import { createRequire } from 'module'
import type { 
  PlatformWatcher, 
  WindowInfo, 
  WindowEvent, 
  WindowEventType 
} from './windowWatcher'
import { isWindowFullscreen } from './windowWatcher'

const require = createRequire(import.meta.url)

// Windows API 常量
const EVENT_SYSTEM_FOREGROUND = 0x0003
const EVENT_SYSTEM_MOVESIZESTART = 0x000A
const EVENT_SYSTEM_MOVESIZEEND = 0x000B
const EVENT_OBJECT_CREATE = 0x8000
const EVENT_OBJECT_DESTROY = 0x8001
const EVENT_OBJECT_LOCATIONCHANGE = 0x800B
const EVENT_OBJECT_STATECHANGE = 0x800A
const EVENT_OBJECT_SHOW = 0x8002
const EVENT_OBJECT_HIDE = 0x8003

const WINEVENT_OUTOFCONTEXT = 0x0000
const WINEVENT_SKIPOWNPROCESS = 0x0002

// 进程信息
interface ProcessInfo {
  name: string
  path: string
}

// 窗口句柄类型
type HWND = bigint

// 缓存进程信息，避免重复查询
const processCache = new Map<number, ProcessInfo>()

// 窗口状态缓存
const windowCache = new Map<string, WindowInfo>()

// 上一个活跃窗口
let previousActiveWindow: WindowInfo | null = null

// 回调函数引用（防止 GC）
let eventCallback: ((event: WindowEvent) => void) | null = null
let hookHandle: bigint | null = null

// FFI 库
let user32: any = null
let kernel32: any = null
let ntdll: any = null

/**
 * 初始化 Windows API
 */
function initWindowsApi(): boolean {
  try {
    const ffi = require('ffi-napi')
    const ref = require('ref-napi')
    const Struct = require('ref-struct-napi')
    
    // 定义回调函数类型
    const WinEventProc = ffi.Function(ref.types.void, [
      ref.types.int,      // HWINEVENTHOOK
      ref.types.uint32,   // event
      ref.types.int64,    // hwnd
      ref.types.int32,    // idObject
      ref.types.int32,    // idChild
      ref.types.uint32,   // idEventThread
      ref.types.uint32,   // dwmsEventTime
    ])
    
    user32 = new ffi.Library('user32', {
      'SetWinEventHook': [
        ref.types.int64,  // HWINEVENTHOOK
        [
          ref.types.uint32,  // eventMin
          ref.types.uint32,  // eventMax
          ref.types.int64,   // hmodWinEventProc (HMODULE)
          WinEventProc,      // lpfnWinEventProc
          ref.types.uint32,  // idProcess
          ref.types.uint32,  // idThread
          ref.types.uint32,  // dwFlags
        ]
      ],
      'UnhookWinEvent': [
        ref.types.int,
        [ref.types.int64]  // hWinEventHook
      ],
      'GetForegroundWindow': [
        ref.types.int64,
        []
      ],
      'GetWindowTextW': [
        ref.types.int32,
        [ref.types.int64, 'string', ref.types.int32]
      ],
      'GetWindowTextLengthW': [
        ref.types.int32,
        [ref.types.int64]
      ],
      'GetWindowThreadProcessId': [
        ref.types.uint32,
        [ref.types.int64, ref.refType(ref.types.uint32)]
      ],
      'GetWindowRect': [
        ref.types.int,
        [ref.types.int64, 'void*']
      ],
      'IsWindowVisible': [
        ref.types.int,
        [ref.types.int64]
      ],
      'IsIconic': [
        ref.types.int,
        [ref.types.int64]
      ],
      'IsZoomed': [
        ref.types.int,
        [ref.types.int64]
      ],
      'GetClassNameW': [
        ref.types.int32,
        [ref.types.int64, 'string', ref.types.int32]
      ],
    })
    
    kernel32 = new ffi.Library('kernel32', {
      'OpenProcess': [
        ref.types.int64,
        [ref.types.uint32, ref.types.int, ref.types.uint32]
      ],
      'CloseHandle': [
        ref.types.int,
        [ref.types.int64]
      ],
      'GetModuleFileNameExW': [
        ref.types.uint32,
        [ref.types.int64, ref.types.int64, 'string', ref.types.uint32]
      ],
    })
    
    return true
  } catch (error) {
    console.error('[窗口监听] 初始化 Windows API 失败:', error)
    return false
  }
}

/**
 * 获取窗口标题
 */
function getWindowTitle(hwnd: bigint): string {
  try {
    const length = user32.GetWindowTextLengthW(hwnd)
    if (length === 0) return ''
    
    const buffer = Buffer.alloc((length + 1) * 2)  // UTF-16
    user32.GetWindowTextW(hwnd, buffer, length + 1)
    return buffer.toString('utf16le').replace(/\0+$/, '')
  } catch {
    return ''
  }
}

/**
 * 获取窗口类名
 */
function getWindowClassName(hwnd: bigint): string {
  try {
    const buffer = Buffer.alloc(256 * 2)
    const length = user32.GetClassNameW(hwnd, buffer, 256)
    if (length === 0) return ''
    return buffer.toString('utf16le', 0, length * 2)
  } catch {
    return ''
  }
}

/**
 * 获取窗口位置和大小
 */
function getWindowBounds(hwnd: bigint): { x: number; y: number; width: number; height: number } | null {
  try {
    const rect = Buffer.alloc(16)  // RECT 结构体
    const result = user32.GetWindowRect(hwnd, rect)
    if (result === 0) return null
    
    const left = rect.readInt32LE(0)
    const top = rect.readInt32LE(4)
    const right = rect.readInt32LE(8)
    const bottom = rect.readInt32LE(12)
    
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    }
  } catch {
    return null
  }
}

/**
 * 获取进程信息
 */
function getProcessInfo(pid: number): ProcessInfo {
  // 检查缓存
  if (processCache.has(pid)) {
    return processCache.get(pid)!
  }
  
  const info: ProcessInfo = { name: '', path: '' }
  
  try {
    // 打开进程
    const PROCESS_QUERY_INFORMATION = 0x0400
    const PROCESS_VM_READ = 0x0010
    const processHandle = kernel32.OpenProcess(
      PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
      0,
      pid
    )
    
    if (processHandle !== 0n) {
      // 获取进程路径
      const buffer = Buffer.alloc(1024 * 2)
      const size = kernel32.GetModuleFileNameExW(processHandle, 0n, buffer, 1024)
      
      if (size > 0) {
        info.path = buffer.toString('utf16le', 0, size * 2)
        info.name = info.path.split('\\').pop() || ''
      }
      
      kernel32.CloseHandle(processHandle)
    }
  } catch (error) {
    console.warn('[窗口监听] 获取进程信息失败:', error)
  }
  
  // 缓存结果
  processCache.set(pid, info)
  
  // 定期清理缓存
  if (processCache.size > 1000) {
    const keys = Array.from(processCache.keys())
    for (let i = 0; i < keys.length / 2; i++) {
      processCache.delete(keys[i])
    }
  }
  
  return info
}

/**
 * 获取窗口进程 ID
 */
function getWindowProcessId(hwnd: bigint): number {
  try {
    const pidBuffer = Buffer.alloc(4)
    user32.GetWindowThreadProcessId(hwnd, pidBuffer)
    return pidBuffer.readUInt32LE(0)
  } catch {
    return 0
  }
}

/**
 * 将 HWND 转换为字符串 ID
 */
function hwndToString(hwnd: bigint): string {
  return hwnd.toString(16)
}

/**
 * 从窗口句柄获取完整窗口信息
 */
function getWindowInfo(hwnd: bigint): WindowInfo | null {
  try {
    // 检查窗口是否可见
    if (user32.IsWindowVisible(hwnd) === 0) {
      return null
    }
    
    const id = hwndToString(hwnd)
    const title = getWindowTitle(hwnd)
    const className = getWindowClassName(hwnd)
    const bounds = getWindowBounds(hwnd)
    const pid = getWindowProcessId(hwnd)
    const processInfo = getProcessInfo(pid)
    
    // 获取屏幕尺寸以判断全屏
    const primaryDisplay = screen.getPrimaryDisplay()
    const screenWidth = primaryDisplay.bounds.width
    const screenHeight = primaryDisplay.bounds.height
    
    const isMinimized = user32.IsIconic(hwnd) !== 0
    const isMaximized = user32.IsZoomed(hwnd) !== 0
    const isFullscreen = bounds ? isWindowFullscreen(bounds, screenWidth, screenHeight) : false
    
    return {
      id,
      title,
      processName: processInfo.name,
      processPath: processInfo.path,
      processId: pid,
      bounds: bounds || { x: 0, y: 0, width: 0, height: 0 },
      isFullscreen,
      isMinimized,
      isMaximized,
      className,
    }
  } catch (error) {
    console.warn('[窗口监听] 获取窗口信息失败:', error)
    return null
  }
}

/**
 * 处理窗口事件
 */
function handleWindowEvent(
  eventType: number,
  hwnd: bigint,
  eventTypeMap: Map<number, WindowEventType>
): void {
  if (!eventCallback) return
  
  const type = eventTypeMap.get(eventType)
  if (!type) return
  
  const windowInfo = getWindowInfo(hwnd)
  if (!windowInfo) return
  
  // 更新缓存
  if (type === 'destroy') {
    windowCache.delete(windowInfo.id)
  } else {
    windowCache.set(windowInfo.id, windowInfo)
  }
  
  const event: WindowEvent = {
    type,
    timestamp: Date.now(),
    window: windowInfo,
    previousWindow: type === 'focus' ? previousActiveWindow : undefined,
  }
  
  // 更新上一个活跃窗口
  if (type === 'focus') {
    previousActiveWindow = windowInfo
  }
  
  // 触发回调
  eventCallback(event)
}

/**
 * 创建事件类型映射
 */
function createEventTypeMap(): Map<number, WindowEventType> {
  return new Map([
    [EVENT_SYSTEM_FOREGROUND, 'focus'],
    [EVENT_OBJECT_CREATE, 'create'],
    [EVENT_OBJECT_DESTROY, 'destroy'],
    [EVENT_OBJECT_LOCATIONCHANGE, 'move'],
    [EVENT_OBJECT_STATECHANGE, 'resize'],
  ])
}

/**
 * Windows 平台监听器实现
 */
export class WindowsWatcher implements PlatformWatcher {
  private eventCallback: ((rawEvent: any) => void) | null = null
  private eventTypeMap = createEventTypeMap()
  private isRunning = false
  
  start(callback: (rawEvent: any) => void): void {
    if (this.isRunning) {
      console.warn('[窗口监听] 监听器已在运行')
      return
    }
    
    // 初始化 Windows API
    if (!initWindowsApi()) {
      console.error('[窗口监听] 无法启动监听器')
      return
    }
    
    this.eventCallback = callback
    
    // 创建回调函数
    const winEventProc = (
      _hWinEventHook: number,
      event: number,
      hwnd: bigint,
      _idObject: number,
      _idChild: number,
      _idEventThread: number,
      _dwmsEventTime: number
    ) => {
      handleWindowEvent(event, hwnd, this.eventTypeMap)
      
      // 调用外部回调
      if (this.eventCallback) {
        const type = this.eventTypeMap.get(event)
        if (type) {
          const windowInfo = getWindowInfo(hwnd)
          if (windowInfo) {
            this.eventCallback({
              type,
              timestamp: Date.now(),
              window: windowInfo,
            })
          }
        }
      }
    }
    
    // 设置事件钩子
    try {
      hookHandle = user32.SetWinEventHook(
        EVENT_SYSTEM_FOREGROUND,
        EVENT_OBJECT_STATECHANGE,
        0n,                    // 所有模块
        winEventProc,
        0,                     // 所有进程
        0,                     // 所有线程
        WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
      )
      
      if (hookHandle === 0n) {
        console.error('[窗口监听] SetWinEventHook 失败')
        return
      }
      
      this.isRunning = true
      console.log('[窗口监听] Windows 原生事件监听已启动')
      
      // 获取当前活跃窗口
      const activeHwnd = user32.GetForegroundWindow()
      if (activeHwnd !== 0n) {
        const windowInfo = getWindowInfo(activeHwnd)
        if (windowInfo) {
          previousActiveWindow = windowInfo
          this.eventCallback?.({
            type: 'focus',
            timestamp: Date.now(),
            window: windowInfo,
          })
        }
      }
    } catch (error) {
      console.error('[窗口监听] 启动监听失败:', error)
    }
  }
  
  stop(): void {
    if (!this.isRunning) return
    
    try {
      if (hookHandle !== null && hookHandle !== 0n) {
        user32.UnhookWinEvent(hookHandle)
        hookHandle = null
      }
      
      this.isRunning = false
      this.eventCallback = null
      eventCallback = null
      
      console.log('[窗口监听] Windows 原生事件监听已停止')
    } catch (error) {
      console.error('[窗口监听] 停止监听失败:', error)
    }
  }
  
  getActiveWindow(): WindowInfo | null {
    try {
      if (!user32) {
        if (!initWindowsApi()) return null
      }
      
      const hwnd = user32.GetForegroundWindow()
      if (hwnd === 0n) return null
      
      return getWindowInfo(hwnd)
    } catch {
      return null
    }
  }
  
  getAllWindows(): WindowInfo[] {
    // 返回缓存的所有窗口
    return Array.from(windowCache.values())
  }
}
