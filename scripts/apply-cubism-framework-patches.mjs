import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = process.cwd()

const patches = [
  {
    name: 'cubismmotion-effect-ids',
    file: 'src/framework/motion/cubismmotion.ts',
    replacements: [
      {
        oldString: '    this._eyeBlinkParameterIds = null;\n    this._lipSyncParameterIds = null;\n',
        newString: '    this._eyeBlinkParameterIds = [];\n    this._lipSyncParameterIds = [];\n'
      }
    ]
  }
]

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n')
}

function applyPatch(patch) {
  const filePath = resolve(projectRoot, patch.file)

  if (!existsSync(filePath)) {
    console.warn(`[CubismPatch] 跳过 ${patch.name}：文件不存在 ${patch.file}`)
    return false
  }

  const originalContent = readFileSync(filePath, 'utf8')
  let content = normalizeLineEndings(originalContent)
  let changed = false

  for (const replacement of patch.replacements) {
    const oldString = normalizeLineEndings(replacement.oldString)
    const newString = normalizeLineEndings(replacement.newString)

    if (content.includes(newString)) {
      continue
    }

    if (!content.includes(oldString)) {
      throw new Error(`[CubismPatch] 无法应用 ${patch.name}：未找到目标片段 ${patch.file}`)
    }

    content = content.replace(oldString, newString)
    changed = true
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf8')
    console.log(`[CubismPatch] 已应用 ${patch.name}`)
  } else {
    console.log(`[CubismPatch] 已跳过 ${patch.name}（已应用）`)
  }

  return changed
}

let changedCount = 0
for (const patch of patches) {
  if (applyPatch(patch)) {
    changedCount += 1
  }
}

console.log(`[CubismPatch] 完成，共变更 ${changedCount} 个 patch`)
