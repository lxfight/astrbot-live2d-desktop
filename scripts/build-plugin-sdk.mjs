/**
 * 构建插件 SDK 包（@astrbot/plugin-sdk）
 * 用仓库内 typescript 编译 packages/plugin-sdk 入口到 dist/，
 * 产物自包含（类型声明 + ESM 运行时），可发布或 file: 依赖引用。
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sdkRoot = path.join(__dirname, '..', 'packages', 'plugin-sdk')
const tscBin = path.join(__dirname, '..', 'node_modules', '.bin', 'tsc')

if (!fs.existsSync(tscBin)) {
  console.error('[SDK 构建] 未找到 tsc，请先执行 pnpm install')
  process.exit(1)
}

// 清理旧产物
const distRoot = path.join(sdkRoot, 'dist')
if (fs.existsSync(distRoot)) {
  fs.rmSync(distRoot, { recursive: true, force: true })
}

execFileSync(tscBin, ['-p', path.join(sdkRoot, 'tsconfig.sdk.json')], {
  stdio: 'inherit'
})

const entry = path.join(distRoot, 'packages', 'plugin-sdk', 'src', 'index.js')
if (!fs.existsSync(entry)) {
  console.error('[SDK 构建] 产物缺失，编译可能失败')
  process.exit(1)
}

console.log('[SDK 构建] 完成:', path.relative(process.cwd(), entry))
