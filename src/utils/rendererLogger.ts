type RendererLogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOGGER_PATCH_FLAG = '__astrbot_renderer_logger_patched__'

function forwardRendererLog(level: RendererLogLevel, args: unknown[]): void {
  try {
    const logger = window.electron?.log
    if (!logger) {
      return
    }
    logger[level](...args)
  } catch {
    // ignore logger forwarding failures to keep renderer stable
  }
}

function formatErrorReason(reason: unknown): unknown {
  if (reason instanceof Error) {
    return reason.stack || `${reason.name}: ${reason.message}`
  }
  return reason
}

export function setupRendererLogging(): void {
  const win = window as any
  if (win[LOGGER_PATCH_FLAG]) {
    return
  }
  win[LOGGER_PATCH_FLAG] = true

  const originalDebug = console.debug.bind(console)
  const originalLog = console.log.bind(console)
  const originalInfo = console.info.bind(console)
  const originalWarn = console.warn.bind(console)
  const originalError = console.error.bind(console)

  console.debug = (...args: any[]) => {
    forwardRendererLog('debug', args)
    originalDebug(...args)
  }

  console.log = (...args: any[]) => {
    forwardRendererLog('info', args)
    originalLog(...args)
  }

  console.info = (...args: any[]) => {
    forwardRendererLog('info', args)
    originalInfo(...args)
  }

  console.warn = (...args: any[]) => {
    forwardRendererLog('warn', args)
    originalWarn(...args)
  }

  console.error = (...args: any[]) => {
    forwardRendererLog('error', args)
    originalError(...args)
  }

  window.addEventListener('error', (event) => {
    const reason = event.error || event.message || 'unknown error'
    forwardRendererLog('error', ['[renderer] 捕获未处理错误:', formatErrorReason(reason)])
  })

  window.addEventListener('unhandledrejection', (event) => {
    forwardRendererLog('error', ['[renderer] 捕获未处理 Promise 拒绝:', formatErrorReason(event.reason)])
  })

  console.info('[日志] 渲染进程日志已启用')
}
