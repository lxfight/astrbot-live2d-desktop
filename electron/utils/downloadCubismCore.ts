import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { app, dialog, net, protocol } from 'electron'

const CUBISM_PROTOCOL_SCHEME = 'cubism'

type CubismRuntimeConfig = {
  sdkBaseline: string
  core: {
    filename: string
    downloadUrl: string
  }
}

let cachedCubismConfig: CubismRuntimeConfig | null = null

function getPackageJsonPath(): string {
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'package.json')
  }

  return path.join(app.getAppPath(), 'package.json')
}

function getCubismRuntimeConfig(): CubismRuntimeConfig {
  if (cachedCubismConfig) {
    return cachedCubismConfig
  }

  const packageJsonPath = getPackageJsonPath()
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    cubism?: CubismRuntimeConfig
  }

  if (!packageJson.cubism?.core?.filename || !packageJson.cubism?.core?.downloadUrl) {
    throw new Error(`package.json 中缺少 cubism.core 配置: ${packageJsonPath}`)
  }

  cachedCubismConfig = packageJson.cubism
  return cachedCubismConfig
}

function getCubismCoreFilename(): string {
  return getCubismRuntimeConfig().core.filename
}

function getCubismCoreDownloadUrl(): string {
  return getCubismRuntimeConfig().core.downloadUrl
}

function getCubismCoreProtocolRuntimeUrl(): string {
  return `${CUBISM_PROTOCOL_SCHEME}://core/${getCubismCoreFilename()}`
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: CUBISM_PROTOCOL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

let cubismProtocolRegistered = false

function isPortableMode(): boolean {
  const exePath = path.dirname(app.getPath('exe'))
  const portableMarker = path.join(exePath, 'portable.txt')
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR || fs.existsSync(portableMarker))
}

function getPortableDataDir(): string {
  const exePath = path.dirname(app.getPath('exe'))
  return path.join(exePath, 'data')
}

function getLegacyPackagedCubismCorePath(): string | null {
  if (!app.isPackaged) {
    return null
  }

  return path.join(app.getAppPath(), 'dist', 'lib', getCubismCoreFilename())
}

function getCubismCoreCandidatePaths(): string[] {
  const candidates = [getCubismCorePath()]
  const legacyPath = getLegacyPackagedCubismCorePath()
  if (legacyPath) {
    candidates.push(legacyPath)
  }
  return Array.from(new Set(candidates))
}

function resolveExistingCubismCorePath(): string | null {
  for (const candidate of getCubismCoreCandidatePaths()) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function ensureDestinationDirectory(dest: string): void {
  const dir = path.dirname(dest)
  if (fs.existsSync(dir)) {
    const stat = fs.statSync(dir)
    if (!stat.isDirectory()) {
      throw new Error(`目标路径的父级不是目录: ${dir}`)
    }
    return
  }

  fs.mkdirSync(dir, { recursive: true })
}

/**
 * 获取 Cubism Core 文件下载目标路径
 */
export function getCubismCorePath(): string {
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'public', 'lib', getCubismCoreFilename())
  }

  if (isPortableMode()) {
    return path.join(getPortableDataDir(), 'lib', getCubismCoreFilename())
  }

  return path.join(app.getPath('userData'), 'lib', getCubismCoreFilename())
}

export function getCubismCoreProtocolUrl(): string {
  return getCubismCoreProtocolRuntimeUrl()
}

export function registerCubismCoreProtocol(): void {
  if (cubismProtocolRegistered) {
    return
  }

  cubismProtocolRegistered = true
  protocol.handle(CUBISM_PROTOCOL_SCHEME, async () => {
    const corePath = resolveExistingCubismCorePath()
    if (!corePath) {
      return new Response('Cubism Core not found', { status: 404 })
    }

    try {
      return await net.fetch(pathToFileURL(corePath).toString())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return new Response(message, { status: 500 })
    }
  })
}

/**
 * 检查 Cubism Core 是否存在
 */
export function checkCubismCoreExists(): boolean {
  return resolveExistingCubismCorePath() !== null
}

const MAX_REDIRECTS = 5

/**
 * 下载文件
 */
function downloadFile(url: string, dest: string, maxRedirects: number = MAX_REDIRECTS): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocolClient = url.startsWith('https') ? https : http

    try {
      ensureDestinationDirectory(dest)
    } catch (error) {
      reject(error)
      return
    }

    const file = fs.createWriteStream(dest)

    protocolClient.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest)
        }
        if (maxRedirects <= 0) {
          return reject(new Error('重定向次数超过上限'))
        }
        const redirectUrl = new URL(response.headers.location || '', url).toString()
        return downloadFile(redirectUrl, dest, maxRedirects - 1)
          .then(resolve)
          .catch(reject)
      }

      if (response.statusCode !== 200) {
        file.close()
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest)
        }
        return reject(new Error(`下载失败: ${response.statusCode}`))
      }

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        resolve()
      })

      file.on('error', (err) => {
        file.close()
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest)
        }
        reject(err)
      })
    }).on('error', (err) => {
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest)
      }
      reject(err)
    })
  })
}

/**
 * 下载 Cubism Core
 */
export async function downloadCubismCore(): Promise<void> {
  const corePath = getCubismCorePath()
  await downloadFile(getCubismCoreDownloadUrl(), corePath)
}

/**
 * 显示下载提示对话框
 */
export async function showDownloadDialog(): Promise<boolean> {
  const result = await dialog.showMessageBox({
     type: 'info',
     title: 'Live2D SDK 下载',
     message: '首次使用需要下载 Live2D Cubism SDK',
     detail: `应用需要下载 Live2D Cubism Core 文件才能正常运行。\n\n当前基线：${getCubismRuntimeConfig().sdkBaseline}\n来源：${getCubismCoreDownloadUrl()}\n\n点击"确定"开始下载（约 200KB）。`,
     buttons: ['确定', '取消'],
    defaultId: 0,
    cancelId: 1
  })

  return result.response === 0
}

/**
 * 显示下载进度对话框
 */
export async function downloadWithProgress(): Promise<boolean> {
  try {
    await downloadCubismCore()

    await dialog.showMessageBox({
      type: 'info',
      title: '下载完成',
      message: 'Live2D SDK 下载成功',
      detail: '应用将继续启动。',
      buttons: ['确定']
    })

    return true
  } catch (error) {
    await dialog.showMessageBox({
      type: 'error',
      title: '下载失败',
      message: 'Live2D SDK 下载失败',
      detail: `错误信息: ${error instanceof Error ? error.message : String(error)}\n\n请检查网络连接后重试。`,
      buttons: ['确定']
    })

    return false
  }
}
