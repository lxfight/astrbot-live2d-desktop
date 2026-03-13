/**
 * 直接加载 active-win 的 native binding，绕过 @mapbox/node-pre-gyp 解析链。
 * 打包后 ASAR 中不含 @mapbox/node-pre-gyp 及其大量传递依赖，
 * 导致 active-win/lib/windows-binding.js 静默降级为空函数。
 *
 * 这里复制了 node-pre-gyp 对 active-win 的路径计算逻辑，
 * 直接 require() 解包后的 .node 文件。
 */

import { createRequire } from 'module'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const nodeRequire = createRequire(import.meta.url)

let cachedBinding: any = null
let loadAttempted = false

function findBindingPath(): string | null {
  const platform = process.platform
  const arch = process.arch
  // active-win 的 package.json binary.napi_versions = [3, 6]，实际预构建用 napi-6
  const dir = `napi-6-${platform}-unknown-${arch}`
  const fileName = 'node-active-win.node'

  const appPath = app.getAppPath()
  // asarUnpack: ["**/*.node"] 将 .node 文件提取到 app.asar.unpacked/
  const unpackedBase = appPath.replace('app.asar', 'app.asar.unpacked')

  const candidates = [
    // 打包后（ASAR 解包目录）
    path.join(unpackedBase, 'node_modules', 'active-win', 'lib', 'binding', dir, fileName),
    // 开发模式（项目根目录下）
    path.join(appPath, 'node_modules', 'active-win', 'lib', 'binding', dir, fileName),
  ]

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {
      // ASAR 内 existsSync 可能抛异常，忽略
    }
  }
  return null
}

function loadBinding(): any {
  if (loadAttempted) return cachedBinding
  loadAttempted = true

  const bindingPath = findBindingPath()
  if (!bindingPath) {
    console.warn('[active-win] native binding 未找到，窗口检测不可用')
    return null
  }

  try {
    cachedBinding = nodeRequire(bindingPath)
    console.log('[active-win] native binding 加载成功:', bindingPath)
  } catch (err) {
    console.warn('[active-win] native binding 加载失败:', err)
  }

  return cachedBinding
}

/**
 * 获取当前活跃窗口信息，返回值与 active-win 包一致
 */
export async function getActiveWindow(): Promise<any | undefined> {
  const binding = loadBinding()
  if (!binding?.getActiveWindow) return undefined
  try {
    return binding.getActiveWindow()
  } catch {
    return undefined
  }
}

/**
 * 安全版本：出错时返回 null
 */
export async function safeGetActiveWindow(): Promise<any | null> {
  try {
    return (await getActiveWindow()) ?? null
  } catch {
    return null
  }
}
