import { app, net, protocol } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs'

const MODEL_PROTOCOL_SCHEME = 'model'

/**
 * 获取模型存储目录
 */
function getModelsDir(): string {
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'public', 'models')
  }
  return path.join(app.getPath('userData'), 'models')
}

/**
 * 注册 model:// 协议处理器
 */
export function registerModelProtocol(): void {
  protocol.handle(MODEL_PROTOCOL_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      console.log('[ModelProtocol] Request URL:', request.url)
      
      // 更加稳健的路径解析：直接去掉协议头
      const urlPart = request.url.slice(MODEL_PROTOCOL_SCHEME.length + 3) // 去掉 'model://'
      let relativePath = decodeURIComponent(urlPart)
      // 去掉开头的斜杠
      relativePath = relativePath.replace(/^\/+/, '')
      
      if (!relativePath) {
        return new Response('Empty path', { status: 400 })
      }
      
      const modelsDir = getModelsDir()
      const fullPath = path.normalize(path.join(modelsDir, relativePath))
      
      console.log('[ModelProtocol] Resolved path:', fullPath)

      // 安全检查：确保路径在模型目录下
      if (!fullPath.toLowerCase().startsWith(modelsDir.toLowerCase())) {
        return new Response('Access denied', { status: 403 })
      }

      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        console.warn('[ModelProtocol] Asset not found:', fullPath)
        return new Response('Model asset not found', { status: 404 })
      }

      // 使用 net.fetch 代理本地文件读取，能够正确处理 MIME 类型
      return await net.fetch(pathToFileURL(fullPath).toString())
    } catch (error) {
      console.error('[ModelProtocol] Error handling request:', error)
      const message = error instanceof Error ? error.message : String(error)
      return new Response(message, { status: 500 })
    }
  })
}
