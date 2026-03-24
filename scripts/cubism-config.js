import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJsonPath = path.join(__dirname, '..', 'package.json')

export function readCubismConfig() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const cubism = packageJson.cubism

  if (!cubism) {
    throw new Error('package.json 中缺少 cubism 基线配置')
  }

  if (!cubism.frameworkTag || !cubism.frameworkCommit || !cubism.samplesTag) {
    throw new Error('cubism 基线配置不完整：缺少 frameworkTag/frameworkCommit/samplesTag')
  }

  if (!cubism.core?.filename || !cubism.core?.downloadUrl) {
    throw new Error('cubism.core 配置不完整：缺少 filename/downloadUrl')
  }

  return cubism
}
