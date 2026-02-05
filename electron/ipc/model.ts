import { ipcMain, dialog, app } from 'electron'
import { getMainWindow } from '../windows/mainWindow'
import fs from 'fs'
import path from 'path'

/**
 * 获取模型存储目录
 */
function getModelsDir(): string {
  const isDev = !app.isPackaged
  if (isDev) {
    return path.join(process.cwd(), 'public', 'models')
  }
  return path.join(app.getPath('userData'), 'models')
}

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/')
}

function findModelJsonFiles(rootDir: string): string[] {
  const results: string[] = []

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue

      const lower = entry.name.toLowerCase()
      if (lower.endsWith('.model3.json') || lower.endsWith('.model.json')) {
        results.push(fullPath)
      }
    }
  }

  walk(rootDir)
  return results
}

function pickBestModelFile(rootDir: string, absoluteFiles: string[]): string {
  const rootName = path.basename(rootDir).toLowerCase()

  function score(filePath: string): number {
    const rel = path.relative(rootDir, filePath)
    const depth = rel.split(path.sep).length - 1
    const base = path.basename(filePath).toLowerCase()
    const isModel3 = base.endsWith('.model3.json')
    const name = base.replace(/\.model3\.json$|\.model\.json$/i, '')

    let s = 0
    s += isModel3 ? 200 : 100
    s += Math.max(0, 30 - depth * 10) // 越靠近根目录越优先

    if (name === rootName) s += 60
    else if (name.includes(rootName)) s += 30

    // 略微偏好更短的相对路径（更像主文件）
    s += Math.max(0, 20 - rel.length / 10)

    return s
  }

  const sorted = [...absoluteFiles].sort((a, b) => {
    const diff = score(b) - score(a)
    if (diff !== 0) return diff
    return path.relative(rootDir, a).localeCompare(path.relative(rootDir, b))
  })

  return sorted[0]
}

/**
 * 选择模型文件夹
 */
ipcMain.handle('model:selectFolder', async () => {
  try {
    const mainWindow = getMainWindow()
    const dialogOptions = {
      title: '选择 Live2D 模型文件夹',
      properties: ['openDirectory'] as Array<'openDirectory'>
    }

    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    const folderPath = result.filePaths[0]
    return { success: true, folderPath }
  } catch (error: any) {
    console.error('[IPC] 选择模型文件夹失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 导入模型
 */
ipcMain.handle('model:import', async (_event, sourceDir: string, modelName: string) => {
  try {
    if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      return { success: false, error: '请选择有效的模型文件夹' }
    }

    // 自动识别模型文件（支持一个文件夹内存在多个 .model3.json / .model.json）
    const modelFiles = findModelJsonFiles(sourceDir)
    if (modelFiles.length === 0) {
      return { success: false, error: '该文件夹内未找到 .model3.json 或 .model.json 模型文件' }
    }
    const chosenModelFile = pickBestModelFile(sourceDir, modelFiles)

    // 创建目标目录
    const modelsDir = getModelsDir()
    const targetDir = path.join(modelsDir, modelName)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // 复制整个模型目录
    const resolvedSource = path.resolve(sourceDir).toLowerCase()
    const resolvedTarget = path.resolve(targetDir).toLowerCase()
    if (resolvedSource !== resolvedTarget) {
      copyDirectory(sourceDir, targetDir)
    }

    const relChosen = toPosixPath(path.relative(sourceDir, chosenModelFile))
    const relativePath = `/models/${modelName}/${relChosen}`
    return {
      success: true,
      modelPath: relativePath,
      chosenFile: relChosen,
      modelFiles: modelFiles.map(f => toPosixPath(path.relative(sourceDir, f)))
    }
  } catch (error: any) {
    console.error('[IPC] 导入模型失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 获取已导入的模型列表
 */
ipcMain.handle('model:getList', async () => {
  try {
    const modelsDir = getModelsDir()
    if (!fs.existsSync(modelsDir)) {
      return { success: true, models: [] }
    }

    const models: Array<{ name: string; path: string }> = []
    const dirs = fs.readdirSync(modelsDir, { withFileTypes: true })

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const modelDir = path.join(modelsDir, dir.name)
        const files = findModelJsonFiles(modelDir)
        const modelFile = files.length > 0 ? pickBestModelFile(modelDir, files) : null

        if (modelFile) {
          const rel = toPosixPath(path.relative(modelDir, modelFile))
          models.push({
            name: dir.name,
            path: `/models/${dir.name}/${rel}`
          })
        }
      }
    }

    return { success: true, models }
  } catch (error: any) {
    console.error('[IPC] 获取模型列表失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 删除模型
 */
ipcMain.handle('model:delete', async (_event, modelName: string) => {
  try {
    const modelDir = path.join(getModelsDir(), modelName)
    if (fs.existsSync(modelDir)) {
      fs.rmSync(modelDir, { recursive: true, force: true })
    }
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 删除模型失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 加载模型到主窗口
 */
ipcMain.handle('model:load', async (_event, modelPath: string) => {
  try {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('model:load', modelPath)
    }
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 加载模型失败:', error)
    return { success: false, error: error.message }
  }
})

function copyDirectory(source: string, target: string) {
  const files = fs.readdirSync(source, { withFileTypes: true })

  for (const file of files) {
    const sourcePath = path.join(source, file.name)
    const targetPath = path.join(target, file.name)

    if (file.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true })
      copyDirectory(sourcePath, targetPath)
    } else {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}
