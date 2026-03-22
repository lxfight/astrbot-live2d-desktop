/**
 * 下载和复制 Cubism Framework 源码
 * 从 Live2D 官方 GitHub 仓库复制最新的 Framework 源码
 * 
 * 注意：Framework 源码不能放在项目仓库中，需要在构建时复制
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_ROOT = path.join(__dirname, '..')
const FRAMEWORK_DIR = path.join(PROJECT_ROOT, 'src', 'framework')
const CUBISM_SAMPLES_DIR = path.join(PROJECT_ROOT, '..', 'CubismWebSamples')
const FRAMEWORK_SOURCE_DIR = path.join(CUBISM_SAMPLES_DIR, 'Framework', 'src')
const FRAMEWORK_SOURCE_DIR_ALT = path.join(PROJECT_ROOT, '..', '..', 'CubismWebSamples', 'Framework', 'src')

// 强制重新复制
const FORCE_COPY = process.argv.includes('--force')

/**
 * 检查源目录是否存在
 * 返回找到的源目录路径，如果不存在则返回 null
 */
function findSourceDirectory() {
  // 检查多个可能的路径
  const possiblePaths = [
    FRAMEWORK_SOURCE_DIR,
    FRAMEWORK_SOURCE_DIR_ALT,
    path.join(process.cwd(), '..', 'CubismWebSamples', 'Framework', 'src'),
    path.join(process.cwd(), 'CubismWebSamples', 'Framework', 'src')
  ]

  for (const dirPath of possiblePaths) {
    if (fs.existsSync(dirPath)) {
      return dirPath
    }
  }

  return null
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
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // 只复制 TypeScript 文件，并添加 @ts-nocheck
      let content = fs.readFileSync(srcPath, 'utf-8')
      
      // 如果文件还没有 @ts-nocheck，则添加
      if (!content.includes('@ts-nocheck')) {
        content = '// @ts-nocheck\n' + content
      }
      
      fs.writeFileSync(destPath, content)
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
 * 显示提示信息
 */
function showDownloadInstructions() {
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                    Cubism Framework 未找到                      ║')
  console.log('╠════════════════════════════════════════════════════════════════╣')
  console.log('║                                                                ║')
  console.log('║  项目需要 Cubism Web Framework 才能运行。                        ║')
  console.log('║                                                                ║')
  console.log('║  请选择以下方式之一获取 Framework：                              ║')
  console.log('║                                                                ║')
  console.log('║  方式 1: 从 GitHub 克隆官方仓库                                  ║')
  console.log('║  ─────────────────────────────────────                         ║')
  console.log('║  $ cd ..                                                       ║')
  console.log('║  $ git clone https://github.com/Live2D/CubismWebSamples.git    ║')
  console.log('║                                                                ║')
  console.log('║  方式 2: 下载官方 SDK                                           ║')
  console.log('║  ─────────────────────────────────────                         ║')
  console.log('║  访问: https://www.live2d.com/sdk/download/web/                ║')
  console.log('║  下载后解压，将 Framework/src 复制到 src/framework              ║')
  console.log('║                                                                ║')
  console.log('║  方式 3: 使用已有的本地副本                                      ║')
  console.log('║  ─────────────────────────────────────                         ║')
  console.log('║  如果已有 CubismWebSamples，运行：                               ║')
  console.log('║  $ pnpm run setup:framework                                    ║')
  console.log('║                                                                ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log('')
}

/**
 * 主函数
 */
async function main() {
  // 如果目标目录已存在且不是强制模式，跳过
  if (fs.existsSync(FRAMEWORK_DIR) && !FORCE_COPY) {
    console.log(`[Cubism Framework] ✓ Framework 已存在`)
    console.log(`[路径] ${FRAMEWORK_DIR}`)
    return
  }

  // 强制模式下删除已存在的目录
  if (FORCE_COPY && fs.existsSync(FRAMEWORK_DIR)) {
    console.log(`[删除] ${FRAMEWORK_DIR}`)
    removeDirectory(FRAMEWORK_DIR)
  }

  // 查找源目录
  const sourceDir = findSourceDirectory()
  
  if (!sourceDir) {
    // 源目录不存在，显示提示信息
    showDownloadInstructions()
    
    // 在 postinstall 中不报错退出，只显示警告
    if (process.env.npm_lifecycle_event === 'postinstall') {
      console.log('[警告] Framework 未找到，项目可能无法正常运行')
      console.log('[提示] 请在安装完成后运行: pnpm run setup:framework')
      return
    }
    
    process.exit(1)
  }

  // 复制 Framework 源码
  console.log('[Cubism Framework] 开始复制源码...\n')
  console.log(`[复制] 从 ${sourceDir}`)
  console.log(`[复制] 到 ${FRAMEWORK_DIR}`)

  try {
    copyDirectory(sourceDir, FRAMEWORK_DIR)

    // 创建入口文件
    createIndexFile()

    console.log('\n[Cubism Framework] ✓ 复制完成')
    console.log(`[路径] ${FRAMEWORK_DIR}`)
  } catch (error) {
    console.error('[错误] 复制失败:', error)
    process.exit(1)
  }
}

// 运行主函数
main().catch(err => {
  console.error('[错误]', err)
  process.exit(1)
})
