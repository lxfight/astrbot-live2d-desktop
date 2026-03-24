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

// 强制重新复制
const FORCE_COPY = process.argv.includes('--force')

/**
 * 从固定版本下载 Framework 源码
 */
function downloadFrameworkFromGitHub() {
  console.log('[下载] 获取固定版本 Cubism Framework...')
  console.log(`[仓库] ${FRAMEWORK_REPO}`)
  console.log(`[版本] ${cubismConfig.sdkBaseline} / tag ${FRAMEWORK_TAG}`)

  // 创建临时目录
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }

  const tempRepoDir = path.join(TEMP_DIR, 'CubismWebSamples')

  try {
    // 如果临时仓库已存在，先删除
    if (fs.existsSync(tempRepoDir)) {
      console.log('[清理] 删除旧的临时仓库...')
      fs.rmSync(tempRepoDir, { recursive: true, force: true })
    }

    // 直接克隆固定 tag，避免 develop / HEAD 漂移
    console.log('[下载] 克隆固定 tag 的 CubismWebFramework 仓库...')
    execSync(
      `git clone --branch ${FRAMEWORK_TAG} --depth 1 ${FRAMEWORK_REPO} "${tempRepoDir}"`,
      { stdio: 'pipe', timeout: 180000 }
    )

    const resolvedCommit = execSync('git rev-parse HEAD', {
      cwd: tempRepoDir,
      stdio: ['ignore', 'pipe', 'pipe']
    }).toString().trim()

    if (resolvedCommit !== FRAMEWORK_COMMIT) {
      throw new Error(`Framework 版本校验失败：期望 ${FRAMEWORK_COMMIT}，实际 ${resolvedCommit}`)
    }

    // 检查 src 目录是否存在
    const frameworkSrc = path.join(tempRepoDir, 'src')
    if (!fs.existsSync(frameworkSrc)) {
      throw new Error('Framework 源码不存在于下载的仓库中')
    }

    console.log('[下载] ✓ 下载完成')
    return frameworkSrc

  } catch (error) {
    console.error('[错误] 下载失败:', error.message)
    
    // 清理临时目录
    if (fs.existsSync(tempRepoDir)) {
      fs.rmSync(tempRepoDir, { recursive: true, force: true })
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
  // 创建目标目录
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  // 读取源目录
  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      // 递归复制子目录
      copyDirectory(srcPath, destPath)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.vert') || entry.name.endsWith('.frag'))) {
      if (entry.name.endsWith('.ts')) {
        // 只为 TypeScript 文件添加 @ts-nocheck
        let content = fs.readFileSync(srcPath, 'utf-8')

        if (!content.includes('@ts-nocheck')) {
          content = '// @ts-nocheck\n' + content
        }

        fs.writeFileSync(destPath, content)
      } else {
        // 保留 shader 原始内容
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

/**
 * 删除目录
 */
function removeDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
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
  console.log('║  $ cd .. && git clone https://github.com/Live2D/CubismWebSamples.git ║')
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
    removeDirectory(LEGACY_FRAMEWORK_DIR)
  }

  // 如果目标目录已存在且不是强制模式，跳过
  if (fs.existsSync(FRAMEWORK_DIR) && !FORCE_DOWNLOAD) {
    console.log(`[Cubism Framework] ✓ Framework 已存在`)
    console.log(`[路径] ${FRAMEWORK_DIR}`)
    return
  }

  // 强制模式下删除已存在的目录
  if (FORCE_DOWNLOAD && fs.existsSync(FRAMEWORK_DIR)) {
    console.log(`[删除] ${FRAMEWORK_DIR}`)
    removeDirectory(FRAMEWORK_DIR)
  }

  console.log(`[Cubism Framework] 开始获取 ${cubismConfig.sdkBaseline} 基线源码...\n`)

  // 从 GitHub 下载 Framework
  const sourceDir = downloadFrameworkFromGitHub()
  
  if (!sourceDir) {
    // 下载失败，显示错误提示
    showDownloadError()
    
    // 在 postinstall 中不报错退出，只显示警告
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

    // 创建入口文件
    createIndexFile()

    console.log('\n[Cubism Framework] ✓ 下载并复制完成')
    console.log(`[路径] ${FRAMEWORK_DIR}`)

    // 清理临时目录
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
