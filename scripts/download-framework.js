/**
 * 下载和复制 Cubism Framework 源码
 * 从 Live2D 官方 GitHub 仓库下载固定版本 Framework 到源码目录外
 *
 * 注意：Framework 源码不能放在项目 src/ 中，需要在构建时下载到生成目录
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import https from 'https'
import { readCubismConfig } from './cubism-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_ROOT = path.join(__dirname, '..')
const GENERATED_ROOT = path.join(PROJECT_ROOT, '.generated', 'cubism-framework')
const FRAMEWORK_DIR = path.join(GENERATED_ROOT, 'src')
const LEGACY_FRAMEWORK_DIR = path.join(PROJECT_ROOT, 'src', 'framework')
const TEMP_DIR = path.join(PROJECT_ROOT, '.temp')

const cubismConfig = readCubismConfig()
const FRAMEWORK_REPO = cubismConfig.frameworkRepo
const FRAMEWORK_TAG = cubismConfig.frameworkTag
const FRAMEWORK_COMMIT = cubismConfig.frameworkCommit

// 强制重新下载
const FORCE_DOWNLOAD = process.argv.includes('--force')

/**
 * 下载文件到本地
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)

    console.log(`[下载] ${url}`)

    https
      .get(url, response => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close()
          fs.unlinkSync(dest)
          return downloadFile(response.headers.location, dest).then(resolve).catch(reject)
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
      })
      .on('error', err => {
        file.close()
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        reject(err)
      })
  })
}

/**
 * 从 GitHub tarball 下载并解压 Framework 源码
 */
async function downloadFrameworkFromGitHub() {
  const tarballUrl = `https://github.com/Live2D/CubismWebFramework/archive/${FRAMEWORK_COMMIT}.tar.gz`

  console.log('[下载] 获取固定版本 Cubism Framework tarball...')
  console.log(`[仓库] ${FRAMEWORK_REPO}`)
  console.log(`[版本] ${cubismConfig.sdkBaseline} / commit ${FRAMEWORK_COMMIT.slice(0, 7)}`)

  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }

  const tarballPath = path.join(TEMP_DIR, 'framework.tar.gz')
  const extractDir = path.join(TEMP_DIR, 'extracted')

  try {
    await downloadFile(tarballUrl, tarballPath)
    console.log('[下载] tarball 下载完成')

    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true })
    }
    fs.mkdirSync(extractDir, { recursive: true })

    execSync(`tar -xzf "${tarballPath}" -C "${extractDir}"`, {
      stdio: 'pipe',
      timeout: 60000
    })

    const entries = fs.readdirSync(extractDir)
    const frameworkSrcDir = entries.find(e => e.startsWith('CubismWebFramework-'))
    if (!frameworkSrcDir) {
      throw new Error('无法在解压目录中找到 Framework 源码目录')
    }

    const srcDir = path.join(extractDir, frameworkSrcDir, 'src')
    if (!fs.existsSync(srcDir)) {
      throw new Error('Framework src 目录不存在于解压后的文件中')
    }

    console.log('[下载] 解压完成')
    return srcDir
  } catch (error) {
    console.error('[错误] Framework 下载/解压失败:', error.message)

    if (fs.existsSync(tarballPath)) {
      try {
        fs.unlinkSync(tarballPath)
      } catch {}
    }
    if (fs.existsSync(extractDir)) {
      try {
        fs.rmSync(extractDir, { recursive: true, force: true })
      } catch {}
    }

    return null
  }
}

/**
 * 清理临时目录
 */
function cleanupTempDir() {
  if (fs.existsSync(TEMP_DIR)) {
    console.log('[清理] 删除临时目录...')
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
  }
}

/**
 * 复制目录
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath)
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.vert') || entry.name.endsWith('.frag'))
    ) {
      if (entry.name.endsWith('.ts')) {
        let content = fs.readFileSync(srcPath, 'utf-8')

        if (!content.includes('@ts-nocheck')) {
          content = '// @ts-nocheck\n' + content
        }

        fs.writeFileSync(destPath, content)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

/**
 * 创建入口文件
 */
function createIndexFile() {
  const indexContent = `/**
 * CubismWebFramework 入口文件
 *
 * 注意：此文件由 download-framework.js 自动生成
 * 基线：Cubism SDK for Web ${cubismConfig.sdkBaseline}
 * 不要手动编辑此文件
 */

// @ts-nocheck

// Framework 核心
export { CubismFramework, Option, Constant } from './live2dcubismframework'

// ID 管理
export { CubismIdManager } from './id/cubismidmanager'
export { CubismId } from './id/cubismid'

// 模型相关
export { CubismMoc } from './model/cubismmoc'
export { CubismModel } from './model/cubismmodel'
export { CubismUserModel } from './model/cubismusermodel'
export { CubismModelSettingJson } from './cubismmodelsettingjson'
export type { ICubismModelSetting } from './icubismmodelsetting'

// 动作相关
export { CubismMotionManager } from './motion/cubismmotionmanager'
export { CubismMotion } from './motion/cubismmotion'
export { CubismExpressionMotionManager } from './motion/cubismexpressionmotionmanager'
export { CubismExpressionMotion } from './motion/cubismexpressionmotion'

// 效果相关
export { CubismEyeBlink } from './effect/cubismeyeblink'
export { CubismBreath } from './effect/cubismbreath'
export { CubismPose } from './effect/cubismpose'

// 物理演算
export { CubismPhysics } from './physics/cubismphysics'

// 数学工具
export { CubismMatrix44 } from './math/cubismmatrix44'
export { CubismModelMatrix } from './math/cubismmodelmatrix'
export { CubismViewMatrix } from './math/cubismviewmatrix'
export { CubismTargetPoint } from './math/cubismtargetpoint'
export { CubismVector2 } from './math/cubismvector2'
export { CubismMath } from './math/cubismmath'

// 渲染器
export { CubismRenderer_WebGL } from './rendering/cubismrenderer_webgl'
export { CubismRenderer } from './rendering/cubismrenderer'

// 工具类
export { CubismModelUserData } from './model/cubismmodeluserdata'

// 配置
export * from './cubismframeworkconfig'
export * from './cubismdefaultparameterid'

// 内存分配器接口
export type { ICubismAllocator } from './icubismallcator'

// 类型定义
export { csmRect } from './type/csmrectf'
export type { csmRect as csmRectF } from './type/csmrectf'

// 工具函数
export { strtod } from './live2dcubismframework'
`

  const indexPath = path.join(FRAMEWORK_DIR, 'index.ts')
  fs.writeFileSync(indexPath, indexContent)
  console.log(`[创建] ${indexPath}`)
}

/**
 * 显示下载错误提示
 */
function showDownloadError() {
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║              Cubism Framework 下载失败                          ║')
  console.log('╠════════════════════════════════════════════════════════════════╣')
  console.log('║                                                                ║')
  console.log('║  无法从 GitHub 下载 Framework，请检查网络连接。                   ║')
  console.log('║                                                                ║')
  console.log('║  手动下载方式：                                                 ║')
  console.log('║  ─────────────────────────────────────                         ║')
  console.log('║  1. 访问: https://www.live2d.com/sdk/download/web/             ║')
  console.log('║  2. 下载 Cubism SDK for Web                                    ║')
  console.log('║  3. 解压后将 Framework/src 复制到 src/framework                 ║')
  console.log('║                                                                ║')
  console.log('║  或者从 GitHub 克隆：                                           ║')
  console.log('║  $ git clone --branch ${FRAMEWORK_TAG} --depth 1 ${FRAMEWORK_REPO} ║')
  console.log('║                                                                ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log('')
}

/**
 * 主函数
 */
async function main() {
  if (fs.existsSync(LEGACY_FRAMEWORK_DIR)) {
    console.log(`[清理] 删除旧源码目录中的 Framework 副本: ${LEGACY_FRAMEWORK_DIR}`)
    fs.rmSync(LEGACY_FRAMEWORK_DIR, { recursive: true, force: true })
  }

  // 如果目标目录已存在且不是强制模式，跳过
  if (fs.existsSync(FRAMEWORK_DIR) && !FORCE_DOWNLOAD) {
    console.log(`[Cubism Framework] Framework 已存在`)
    console.log(`[路径] ${FRAMEWORK_DIR}`)
    return
  }

  // 强制模式下删除已存在的目录
  if (FORCE_DOWNLOAD && fs.existsSync(FRAMEWORK_DIR)) {
    console.log(`[删除] ${FRAMEWORK_DIR}`)
    fs.rmSync(FRAMEWORK_DIR, { recursive: true, force: true })
  }

  console.log(`[Cubism Framework] 开始获取 ${cubismConfig.sdkBaseline} 基线源码...\n`)

  const sourceDir = await downloadFrameworkFromGitHub()

  if (!sourceDir) {
    showDownloadError()

    if (process.env.npm_lifecycle_event === 'postinstall') {
      console.log('[警告] Framework 下载失败，项目可能无法正常运行')
      console.log('[提示] 请在安装完成后运行: pnpm run setup:framework')
      cleanupTempDir()
      return
    }

    cleanupTempDir()
    process.exit(1)
  }

  // 复制 Framework 源码
  console.log(`[复制] 从 ${sourceDir}`)
  console.log(`[复制] 到 ${FRAMEWORK_DIR}`)

  try {
    copyDirectory(sourceDir, FRAMEWORK_DIR)
    createIndexFile()

    console.log('\n[Cubism Framework] 下载并复制完成')
    console.log(`[路径] ${FRAMEWORK_DIR}`)

    cleanupTempDir()
  } catch (error) {
    console.error('[错误] 复制失败:', error)
    cleanupTempDir()
    process.exit(1)
  }
}

// 运行主函数
main().catch(err => {
  console.error('[错误]', err)
  process.exit(1)
})
