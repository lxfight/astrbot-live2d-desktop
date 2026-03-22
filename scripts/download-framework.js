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

// 强制重新复制
const FORCE_COPY = process.argv.includes('--force')

/**
 * 检查源目录是否存在
 */
function checkSourceDirectory() {
  if (!fs.existsSync(FRAMEWORK_SOURCE_DIR)) {
    console.error('[错误] CubismWebSamples Framework 源码目录不存在')
    console.error(`[错误] 路径: ${FRAMEWORK_SOURCE_DIR}`)
    console.error('[错误] 请确保 CubismWebSamples 仓库在项目父目录中')
    console.error('[错误] 或者从 GitHub 克隆: git clone https://github.com/Live2D/CubismWebSamples.git ..')
    return false
  }
  return true
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
 * 主函数
 */
async function main() {
  console.log('[Cubism Framework] 开始复制源码...\n')

  // 检查源目录
  if (!checkSourceDirectory()) {
    process.exit(1)
  }

  // 如果目标目录已存在且不是强制模式，跳过
  if (fs.existsSync(FRAMEWORK_DIR) && !FORCE_COPY) {
    console.log(`[跳过] Framework 目录已存在 (使用 --force 强制重新复制)`)
    console.log(`[路径] ${FRAMEWORK_DIR}`)
    return
  }

  // 强制模式下删除已存在的目录
  if (FORCE_COPY && fs.existsSync(FRAMEWORK_DIR)) {
    console.log(`[删除] ${FRAMEWORK_DIR}`)
    removeDirectory(FRAMEWORK_DIR)
  }

  // 复制 Framework 源码
  console.log(`[复制] 从 ${FRAMEWORK_SOURCE_DIR}`)
  console.log(`[复制] 到 ${FRAMEWORK_DIR}`)

  try {
    copyDirectory(FRAMEWORK_SOURCE_DIR, FRAMEWORK_DIR)

    // 创建入口文件
    createIndexFile()

    console.log('\n[Cubism Framework] 复制完成')
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
