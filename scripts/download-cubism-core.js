/**
 * 下载 Cubism Core 文件
 * 在构建时执行，不将 Core 文件提交到仓库
 */

import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PUBLIC_LIB_DIR = path.join(__dirname, '..', 'public', 'lib')

// 确保目录存在
if (!fs.existsSync(PUBLIC_LIB_DIR)) {
  fs.mkdirSync(PUBLIC_LIB_DIR, { recursive: true })
}

// 需要下载的文件
const files = [
  {
    name: 'live2d.min.js',
    url: 'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
    description: 'Cubism 2 Core'
  },
  {
    name: 'live2dcubismcore.min.js',
    url: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    description: 'Cubism 4 Core'
  }
]

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
  console.log('[Cubism Core] 开始下载...\n')

  for (const file of files) {
    const destPath = path.join(PUBLIC_LIB_DIR, file.name)

    // 如果文件已存在，跳过
    if (fs.existsSync(destPath)) {
      console.log(`[跳过] ${file.name} 已存在`)
      continue
    }

    try {
      await downloadFile(file.url, destPath)
    } catch (error) {
      console.error(`[错误] 下载 ${file.description} 失败:`, error.message)
      process.exit(1)
    }
  }

  console.log('\n[Cubism Core] 下载完成')
}

main().catch(err => {
  console.error('[错误]', err)
  process.exit(1)
})
