/**
 * Windows 平台原生窗口事件监听器
 * 
 * 使用 Windows API 的 SetWinEventHook 实现事件驱动的窗口监听
 * 相比轮询方案，响应延迟从 2 秒降低到 <10ms
 * 
 * FFI 层使用 koffi（预编译二进制，无需 node-gyp 编译）
 */

import { screen } from 'electron'
import type { 
  PlatformWatcher, 
  WindowInfo
} from './windowWatcher'
import { isWindowFullscreen } from './windowWatcher'

// Windows API 常量
const EVENT_SYSTEM_FOREGROUND = 0x0003
const EVENT_OBJECT_CREATE = 0x8000
const EVENT_OBJECT_DESTROY = 0x8001
const EVENT_OBJECT_LOCATIONCHANGE = 0x800B
const EVENT_OBJECT_STATECHANGE = 0x800A

const WINEVENT_OUTOFCONTEXT = 0x0000
const WINEVENT_SKIPOWNPROCESS = 0x0002

// 进程信息
interface ProcessInfo {
  name: string
  path: string
}

// 缓存进程信息，避免重复查询
const processCache = new Map<number, ProcessInfo>()

// 窗口状态缓存
const windowCache = new Map<string, WindowInfo>()

// 上一个活跃窗口
let previousActiveWindow: WindowInfo | null = null

// koffi 实例（延迟加载）
let koffi: any = null

// FFI 库
let user32: any = null
let kernel32: any = null

// 已注册的回调（防止 GC）
let registeredCallback: any = null
let hookHandle: bigint | null = null

/**
 * 初始化 Windows API（koffi）
 */
function initWindowsApi(): boolean {
  try {
    koffi = require('koffi')

    // 回调类型：WINEVENTPROC
    // void CALLBACK WinEventProc(HWINEVENTHOOK, DWORD, HWND, LONG, LONG, DWORD, DWORD)
    koffi.proto(
      'void WinEventProc(int64 hWinEventHook, uint32 event, int64 hwnd, int idObject, int idChild, uint32 idEventThread, uint32 dwmsEventTime)'
    )

    // user32.dll
    const lib = koffi.load('user32.dll')

    const SetWinEventHook = lib.func('int64 SetWinEventHook(uint32 eventMin, uint32 eventMax, int64 hmodWinEventProc, WinEventProc *lpfnWinEventProc, uint32 idProcess, uint32 idThread, uint32 dwFlags)')
    const UnhookWinEvent = lib.func('int UnhookWinEvent(int64 hWinEventHook)')
    const GetForegroundWindow = lib.func('int64 GetForegroundWindow()')
    const GetWindowTextLengthW = lib.func('int GetWindowTextLengthW(int64 hWnd)')
    const GetWindowTextW = lib.func('int GetWindowTextW(int64 hWnd, str16 lpString, int nMaxCount)')
    const GetWindowThreadProcessId = lib.func('uint32 GetWindowThreadProcessId(int64 hWnd, uint32 *lpdwProcessId)')
    const GetWindowRect = lib.func('int GetWindowRect(int64 hWnd, void *lpRect)')
    const IsWindowVisible = lib.func('int IsWindowVisible(int64 hWnd)')
    const IsIconic = lib.func('int IsIconic(int64 hWnd)')
    const IsZoomed = lib.func('int IsZoomed(int64 hWnd)')
    const GetClassNameW = lib.func('int GetClassNameW(int64 hWnd, str16 lpClassName, int nMaxCount)')

    // kernel32.dll
    const k32 = koffi.load('kernel32.dll')
    const OpenProcess = k32.func('int64 OpenProcess(uint32 dwDesiredAccess, int bInheritHandle, uint32 dwProcessId)')
    const CloseHandle = k32.func('int CloseHandle(int64 hObject)')
    const GetModuleFileNameExW = (() => {
      const psapi = koffi.load('Psapi.dll')
      return psapi.func('uint32 GetModuleFileNameExW(int64 hProcess, int64 hModule, void *lpFilename, uint32 nSize)')
    })()

    user32 = { SetWinEventHook, UnhookWinEvent, GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, GetWindowRect, IsWindowVisible, IsIconic, IsZoomed, GetClassNameW }
    kernel32 = { OpenProcess, CloseHandle, GetModuleFileNameExW }

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
    return user32.GetWindowTextW(hwnd, '', length + 1) || ''
  } catch {
    return ''
  }
}

/**
 * 获取窗口类名
 */
function getWindowClassName(hwnd: bigint): string {
  try {
    return user32.GetClassNameW(hwnd, '', 256) || ''
  } catch {
    return ''
  }
}

/**
 * 获取窗口位置和大小
 */
function getWindowBounds(hwnd: bigint): { x: number; y: number; width: number; height: number } | null {
  try {
    const rect = Buffer.alloc(16)  // RECT 结构体：4 个 LONG
    const result = user32.GetWindowRect(hwnd, rect)
    if (result === 0) return null

    return {
      x: rect.readInt32LE(0),
      y: rect.readInt32LE(4),
      width: rect.readInt32LE(8) - rect.readInt32LE(0),
      height: rect.readInt32LE(12) - rect.readInt32LE(4),
    }
  } catch {
    return null
  }
}

/**
 * 获取进程信息
 */
function getProcessInfo(pid: number): ProcessInfo {
  if (processCache.has(pid)) {
    return processCache.get(pid)!
  }

  const info: ProcessInfo = { name: '', path: '' }

  try {
    const PROCESS_QUERY_INFORMATION = 0x0400
    const PROCESS_VM_READ = 0x0010
    const processHandle = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid)

    if (processHandle !== 0n) {
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

  processCache.set(pid, info)

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
    const pidRef = [0]
    user32.GetWindowThreadProcessId(hwnd, pidRef)
    return pidRef[0]
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
    if (user32.IsWindowVisible(hwnd) === 0) {
      return null
    }

    const id = hwndToString(hwnd)
    const title = getWindowTitle(hwnd)
    const className = getWindowClassName(hwnd)
    const bounds = getWindowBounds(hwnd)
    const pid = getWindowProcessId(hwnd)
    const processInfo = getProcessInfo(pid)

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
 * Windows 平台监听器实现
 */
export class WindowsWatcher implements PlatformWatcher {
  private eventCallback: ((rawEvent: any) => void) | null = null
  private eventTypeMap = new Map([
    [EVENT_SYSTEM_FOREGROUND, 'focus' as const],
    [EVENT_OBJECT_CREATE, 'create' as const],
    [EVENT_OBJECT_DESTROY, 'destroy' as const],
    [EVENT_OBJECT_LOCATIONCHANGE, 'move' as const],
    [EVENT_OBJECT_STATECHANGE, 'resize' as const],
  ])
  private isRunning = false

  start(callback: (rawEvent: any) => void): void {
    if (this.isRunning) {
      console.warn('[窗口监听] 监听器已在运行')
      return
    }

    if (!initWindowsApi()) {
      console.error('[窗口监听] 无法启动监听器')
      return
    }

    this.eventCallback = callback

    // 创建事件处理回调
    const handleEvent = (_hWinEventHook: bigint, event: number, hwnd: bigint, _idObject: number, _idChild: number, _idEventThread: number, _dwmsEventTime: number) => {
      if (!this.eventCallback) return

      const type = this.eventTypeMap.get(event)
      if (!type) return

      const windowInfo = getWindowInfo(hwnd)
      if (!windowInfo) return

      this.eventCallback({
        type,
        timestamp: Date.now(),
        window: windowInfo,
        previousWindow: type === 'focus' ? previousActiveWindow : undefined,
      })

      if (type === 'focus') {
        previousActiveWindow = windowInfo
      }
    }

    try {
      // 注册回调（防止 GC + 允许异步调用）
      registeredCallback = koffi.register(handleEvent, 'WinEventProc *')

      // 设置事件钩子
      hookHandle = user32.SetWinEventHook(
        EVENT_SYSTEM_FOREGROUND,
        EVENT_OBJECT_STATECHANGE,
        0n,
        registeredCallback,
        0,
        0,
        WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
      )

      if (hookHandle === 0n) {
        console.error('[窗口监听] SetWinEventHook 失败')
        return
      }

      this.isRunning = true
      console.log('[窗口监听] Windows 原生事件监听已启动 (koffi)')

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

      if (registeredCallback) {
        koffi.unregister(registeredCallback)
        registeredCallback = null
      }

      this.isRunning = false
      this.eventCallback = null

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
    return Array.from(windowCache.values())
  }
}
