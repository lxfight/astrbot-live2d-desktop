import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { app, dialog } from 'electron'

const CUBISM_CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
const CUBISM_CORE_FILENAME = 'live2dcubismcore.min.js'

/**
 * 获取 Cubism Core 文件路径
 */
export function getCubismCorePath(): string {
  const isDev = !app.isPackaged
  if (isDev) {
    return path.join(process.cwd(), 'public', 'lib', CUBISM_CORE_FILENAME)
  } else {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'lib', CUBISM_CORE_FILENAME)
  }
}

/**
 * 检查 Cubism Core 是否存在
 */
export function checkCubismCoreExists(): boolean {
  const corePath = getCubismCorePath()
  return fs.existsSync(corePath)
}

/**
 * 下载文件
 */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const dir = path.dirname(dest)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const file = fs.createWriteStream(dest)

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        return downloadFile(response.headers.location!, dest)
          .then(resolve)
          .catch(reject)
      }

      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`下载失败: ${response.statusCode}`))
      }

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        resolve()
      })

      file.on('error', (err) => {
        file.close()
        fs.unlinkSync(dest)
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
  await downloadFile(CUBISM_CORE_URL, corePath)
}

/**
 * 显示下载提示对话框
 */
export async function showDownloadDialog(): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Live2D SDK 下载',
    message: '首次使用需要下载 Live2D Cubism SDK',
    detail: '应用需要下载 Live2D Cubism Core 文件才能正常运行。\n\n该文件来自 Live2D 官方网站，仅用于本地渲染。\n\n点击"确定"开始下载（约 200KB）。',
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
