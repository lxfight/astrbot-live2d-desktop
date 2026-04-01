/**
 * 下载 Cubism Core 文件
 * 在构建时执行，不将 Core 文件提交到仓库
 * 支持 Cubism 4 和 Cubism 5.3
 */

import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { readCubismConfig } from './cubism-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cubismConfig = readCubismConfig()

const PUBLIC_LIB_DIR = path.join(__dirname, '..', 'public', 'lib')
const CORE_METADATA_PATH = path.join(PUBLIC_LIB_DIR, 'live2dcubismcore.version.json')

// 确保目录存在
if (!fs.existsSync(PUBLIC_LIB_DIR)) {
  fs.mkdirSync(PUBLIC_LIB_DIR, { recursive: true })
}

// 需要下载的文件
// Cubism 5.3 使用与 Cubism 4 相同的 Core 文件名
// 官方 CDN 会自动提供最新版本
const files = [
  {
    name: cubismConfig.core.filename,
    url: cubismConfig.core.downloadUrl,
    description: `Cubism Core (${cubismConfig.sdkBaseline})`
  }
]

// 强制重新下载（删除已存在的文件）
const FORCE_DOWNLOAD = process.argv.includes('--force')

/**
 * 计算文件 SHA256 哈希
 */
function computeFileHash(filePath) {
  const data = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * 校验文件完整性
 */
function verifyIntegrity(filePath, expectedHash) {
  if (!expectedHash) {
    console.log('[校验] 未配置 expectedHash，跳过完整性校验')
    return true
  }

  const prefix = 'sha256-'
  if (!expectedHash.startsWith(prefix)) {
    console.error(`[校验] expectedHash 格式错误，应以 "${prefix}" 开头`)
    return false
  }

  const expected = expectedHash.slice(prefix.length)
  const actual = computeFileHash(filePath)

  if (actual !== expected) {
    console.error(`[校验] 哈希不匹配!`)
    console.error(`  期望: ${expected}`)
    console.error(`  实际: ${actual}`)
    return false
  }

  console.log(`[校验] SHA256 验证通过`)
  return true
}

/**
 * 下载文件
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)

    console.log(`[下载] ${url}`)

    protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        return downloadFile(response.headers.location, dest)
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
        console.log(`[完成] ${path.basename(dest)}`)
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      fs.unlinkSync(dest)
      reject(err)
    })
  })
}

/**
 * 主函数
 */
async function main() {
  console.log(`[Cubism Core] 开始下载 ${cubismConfig.sdkBaseline} 基线 Core...\n`)

  // 清理已停用的 Cubism 2 Core 文件，避免被打包再分发
  const deprecatedCorePath = path.join(PUBLIC_LIB_DIR, 'live2d.min.js')
  if (fs.existsSync(deprecatedCorePath)) {
    fs.unlinkSync(deprecatedCorePath)
    console.log('[清理] 已移除停用文件: live2d.min.js')
  }

  for (const file of files) {
    const destPath = path.join(PUBLIC_LIB_DIR, file.name)

    // 如果文件已存在且不是强制模式，校验后跳过
    if (fs.existsSync(destPath) && !FORCE_DOWNLOAD) {
      if (!verifyIntegrity(destPath, cubismConfig.core.expectedHash)) {
        console.log(`[重试] ${file.name} 校验失败，重新下载...`)
        fs.unlinkSync(destPath)
        try {
          await downloadFile(file.url, destPath)
          if (!verifyIntegrity(destPath, cubismConfig.core.expectedHash)) {
            fs.unlinkSync(destPath)
            console.error(`[错误] ${file.name} 重新下载后仍校验失败`)
            process.exit(1)
          }
        } catch (error) {
          console.error(`[错误] 重新下载 ${file.description} 失败:`, error.message)
          process.exit(1)
        }
      } else {
        console.log(`[跳过] ${file.name} 已存在 (使用 --force 强制重新下载)`)
      }
      continue
    }

    // 强制模式下删除已存在的文件
    if (FORCE_DOWNLOAD && fs.existsSync(destPath)) {
      fs.unlinkSync(destPath)
      console.log(`[删除] ${file.name}`)
    }

    try {
      await downloadFile(file.url, destPath)
    } catch (error) {
      console.error(`[错误] 下载 ${file.description} 失败:`, error.message)
      process.exit(1)
    }

    // 完整性校验
    if (!verifyIntegrity(destPath, cubismConfig.core.expectedHash)) {
      fs.unlinkSync(destPath)
      console.error(`[错误] ${file.name} 完整性校验失败，文件已删除`)
      process.exit(1)
    }
  }

  fs.writeFileSync(CORE_METADATA_PATH, JSON.stringify({
    sdkBaseline: cubismConfig.sdkBaseline,
    frameworkTag: cubismConfig.frameworkTag,
    frameworkCommit: cubismConfig.frameworkCommit,
    samplesTag: cubismConfig.samplesTag,
    samplesCommit: cubismConfig.samplesCommit,
    downloadUrl: cubismConfig.core.downloadUrl,
    runtimeSource: cubismConfig.core.runtimeSource,
    generatedAt: new Date().toISOString()
  }, null, 2))

  console.log(`[写入] ${path.basename(CORE_METADATA_PATH)}`)

  console.log('\n[Cubism Core] 下载完成')
}

main().catch(err => {
  console.error('[错误]', err)
  process.exit(1)
})
