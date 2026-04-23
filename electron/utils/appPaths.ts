import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 便携模式检测：PORTABLE_EXECUTABLE_DIR 环境变量（electron-builder portable）
 * 或 exe 同级存在 portable.txt 标记文件
 */
export function isPortableMode(): boolean {
  const exeDir = path.dirname(app.getPath('exe'))
  return Boolean(
    process.env.PORTABLE_EXECUTABLE_DIR ||
    fs.existsSync(path.join(exeDir, 'portable.txt'))
  )
}

/**
 * 获取应用数据根目录
 * 安装版：app.getPath('userData')
 * 便携版：exe 同级的 data/ 文件夹
 */
export function getAppDataPath(): string {
  if (isPortableMode()) {
    const dataDir = path.join(path.dirname(app.getPath('exe')), 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    return dataDir
  }
  return app.getPath('userData')
}
