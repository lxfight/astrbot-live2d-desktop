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

/**
 * 选择模型文件
 */
ipcMain.handle('model:selectFile', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择 Live2D 模型文件',
      filters: [
        { name: 'Live2D 模型', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    const filePath = result.filePaths[0]
    return { success: true, filePath }
  } catch (error: any) {
    console.error('[IPC] 选择模型文件失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 导入模型
 */
ipcMain.handle('model:import', async (_event, sourcePath: string, modelName: string) => {
  try {
    const sourceDir = path.dirname(sourcePath)
    const fileName = path.basename(sourcePath)

    // 创建目标目录
    const modelsDir = getModelsDir()
    const targetDir = path.join(modelsDir, modelName)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // 复制整个模型目录
    copyDirectory(sourceDir, targetDir)

    const relativePath = `/models/${modelName}/${fileName}`
    return { success: true, modelPath: relativePath }
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
        const files = fs.readdirSync(modelDir)
        const modelFile = files.find(f => f.endsWith('.model.json') || f.endsWith('.model3.json'))

        if (modelFile) {
          models.push({
            name: dir.name,
            path: `/models/${dir.name}/${modelFile}`
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
