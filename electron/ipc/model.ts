import { ipcMain, dialog, app } from 'electron'
import { getMainWindow } from '../windows/mainWindow'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { formatCubismAssetIssues, validateCubismModelAssets } from '../utils/cubismAssetManifest'
import { createCubismModelLoadDescriptor } from '../utils/cubismModelDiscovery'
import { buildCatalogForAbsoluteModel, ensureModelAliasConfig } from '../utils/modelCatalog'
import { getAppDataPath } from '../utils/appPaths'
import { createScopedLogger } from '../utils/logger'
import { t } from '../../src/i18n/mainProcess'
import {
  LIVE2D_EXPRESSION_TYPES,
  createEmptyExpressionTypePresets,
  isLive2DExpressionType,
  type Live2DExpressionTypePresetMap
} from '../../src/shared/live2dExpressionTypes'

const logger = createScopedLogger('ipc.model')
const EXPRESSION_PROFILE_FILE_NAME = 'astrbot.live2d.profile.json'

type ExpressionProfilePayload = {
  version?: unknown
  modelId?: unknown
  aliases?: unknown
  tags?: unknown
  semanticPresets?: unknown
}

/**
 * 获取模型存储目录
 */
function getModelsDir(): string {
  const isDev = !app.isPackaged
  if (isDev) {
    return path.join(process.cwd(), 'public', 'models')
  }
  return path.join(getAppDataPath(), 'models')
}

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/')
}

function findModelFiles(rootDir: string, predicate: (name: string) => boolean): string[] {
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

      if (predicate(entry.name.toLowerCase())) {
        results.push(fullPath)
      }
    }
  }

  walk(rootDir)
  return results
}

function findModelJsonFiles(rootDir: string): string[] {
  return findModelFiles(rootDir, lower => lower.endsWith('.model3.json'))
}

function findCubism2ModelJsonFiles(rootDir: string): string[] {
  return findModelFiles(
    rootDir,
    lower => lower.endsWith('.model.json') && !lower.endsWith('.model3.json')
  )
}

export function resolveModelAbsolutePath(modelPath: string): string {
  const normalized = String(modelPath || '').trim()
  if (!normalized) {
    throw new Error(t('error.modelPathEmpty'))
  }

  if (normalized.startsWith('file://')) {
    return fileURLToPath(normalized)
  }

  if (normalized.startsWith('/models/')) {
    const relativePath = normalized.slice('/models/'.length).replace(/\//g, path.sep)
    return path.join(getModelsDir(), relativePath)
  }

  throw new Error(t('error.unsupportedModelPathFormat', { path: normalized }))
}

function resolveModelDirectory(modelAbsolutePath: string): string {
  return path.dirname(modelAbsolutePath)
}

function resolveExpressionProfilePath(modelAbsolutePath: string): string {
  return path.join(resolveModelDirectory(modelAbsolutePath), EXPRESSION_PROFILE_FILE_NAME)
}

async function readExpressionProfile(profilePath: string): Promise<ExpressionProfilePayload> {
  try {
    const text = await fs.promises.readFile(profilePath, 'utf8')
    const payload = JSON.parse(text)
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as ExpressionProfilePayload)
      : {}
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

function normalizeStringArray(value: unknown): string[] {
  const rawItems = Array.isArray(value) ? value : [value]
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of rawItems) {
    if (typeof item !== 'string') {
      continue
    }

    const normalized = item.trim()
    if (!normalized) {
      continue
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(normalized)
  }

  return result
}

function normalizeProfileSemanticPresets(
  value: unknown,
  validExpressionIds: Set<string>
): Live2DExpressionTypePresetMap {
  const presets = createEmptyExpressionTypePresets()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return presets
  }

  for (const [key, rawItems] of Object.entries(value)) {
    const presetKey = key.trim().toLowerCase()
    if (!isLive2DExpressionType(presetKey)) {
      continue
    }

    presets[presetKey] = normalizeStringArray(rawItems).filter(item => validExpressionIds.has(item))
  }

  return presets
}

function normalizeRequestedExpressionPresets(
  value: unknown,
  validExpressionIds: Set<string>
): Live2DExpressionTypePresetMap {
  const presets = createEmptyExpressionTypePresets()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return presets
  }

  for (const [key, rawItems] of Object.entries(value)) {
    const presetKey = key.trim().toLowerCase()
    if (!isLive2DExpressionType(presetKey)) {
      continue
    }

    presets[presetKey] = normalizeStringArray(rawItems).filter(item => validExpressionIds.has(item))
  }

  return presets
}

function buildPresetAliasTags(presets: Live2DExpressionTypePresetMap): Record<string, string[]> {
  const tags: Record<string, string[]> = {}

  for (const type of LIVE2D_EXPRESSION_TYPES) {
    for (const expressionId of presets[type]) {
      if (!tags[expressionId]) {
        tags[expressionId] = []
      }
      if (!tags[expressionId].includes(type)) {
        tags[expressionId].push(type)
      }
    }
  }

  return tags
}

function normalizeModelName(
  rawName: unknown
): { success: true; value: string } | { success: false; error: string } {
  if (typeof rawName !== 'string' || !rawName.trim()) {
    return { success: false, error: t('error.modelNameEmpty') }
  }

  const trimmed = rawName.trim()
  const normalized = path.basename(trimmed)
  if (normalized !== trimmed || normalized === '.' || normalized === '..') {
    return { success: false, error: t('error.modelNameIllegal') }
  }

  return { success: true, value: normalized }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function isRetryableDeleteError(error: unknown): boolean {
  const code =
    typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : ''
  return code === 'ENOTEMPTY' || code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
}

async function removeDirectoryWithRetry(targetDir: string): Promise<void> {
  const maxAttempts = 6

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fs.promises.rm(targetDir, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 120
      })

      if (!fs.existsSync(targetDir)) {
        return
      }

      const remainingEntries = await fs.promises.readdir(targetDir)
      if (remainingEntries.length === 0) {
        await fs.promises.rmdir(targetDir).catch(() => {})
        return
      }

      const error = new Error(`目录仍包含未删除条目: ${remainingEntries.slice(0, 5).join(', ')}`)
      ;(error as NodeJS.ErrnoException).code = 'ENOTEMPTY'
      throw error
    } catch (error) {
      if (!isRetryableDeleteError(error) || attempt === maxAttempts) {
        throw error
      }

      await delay(attempt * 180)
    }
  }
}

function pickBestModelFile(rootDir: string, absoluteFiles: string[]): string {
  const rootName = path.basename(rootDir).toLowerCase()

  function score(filePath: string): number {
    const rel = path.relative(rootDir, filePath)
    const depth = rel.split(path.sep).length - 1
    const base = path.basename(filePath).toLowerCase()
    const name = base.replace(/\.model3\.json$/i, '')

    let s = 0
    s += 200
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
  const timer = logger.timer('select_folder')
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
      timer.done({ canceled: true })
      return { success: false, canceled: true }
    }

    const folderPath = result.filePaths[0]
    timer.done({ canceled: false, folderPath })
    return { success: true, folderPath }
  } catch (error: any) {
    console.error('[IPC] 选择模型文件夹失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 导入模型
 */
ipcMain.handle('model:import', async (_event, sourceDir: string, modelName: string) => {
  const timer = logger.timer('import', { sourceDir, modelName })
  try {
    const normalizedModelName = normalizeModelName(modelName)
    if (!normalizedModelName.success) {
      timer.done({ success: false, reason: 'invalid_model_name', error: normalizedModelName.error })
      return { success: false, error: normalizedModelName.error }
    }

    if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      timer.done({ success: false, reason: 'invalid_source_dir' })
      return { success: false, error: t('error.selectValidModelFolder') }
    }

    // 自动识别模型文件（仅支持 .model3.json）
    const modelFiles = findModelJsonFiles(sourceDir)
    if (modelFiles.length === 0) {
      const cubism2Files = findCubism2ModelJsonFiles(sourceDir)
      if (cubism2Files.length > 0) {
        timer.done({
          success: false,
          reason: 'cubism2_model_detected',
          cubism2ModelCount: cubism2Files.length
        })
        return { success: false, error: t('error.cubism2ModelUnsupported') }
      }
      timer.done({ success: false, reason: 'model3_not_found' })
      return { success: false, error: t('error.model3NotFound') }
    }
    const chosenModelFile = pickBestModelFile(sourceDir, modelFiles)
    logger.debug('import.model_file_selected', {
      sourceDir,
      modelFileCount: modelFiles.length,
      chosenModelFile
    })
    const validationResult = validateCubismModelAssets(chosenModelFile)
    const requiredIssues = validationResult.issues.filter(issue => issue.severity === 'required')
    const optionalIssues = validationResult.issues.filter(issue => issue.severity === 'optional')

    if (requiredIssues.length > 0) {
      timer.done({
        success: false,
        reason: 'required_assets_missing',
        chosenModelFile,
        requiredIssues: formatCubismAssetIssues(requiredIssues),
        optionalIssueCount: optionalIssues.length
      })
      return {
        success: false,
        error: `${t('error.modelResourceIncomplete')}：${formatCubismAssetIssues(requiredIssues).join(', ')}`
      }
    }

    // 创建目标目录
    const modelsDir = getModelsDir()
    const targetDir = path.join(modelsDir, normalizedModelName.value)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // 复制整个模型目录
    const resolvedSource = path.resolve(sourceDir).toLowerCase()
    const resolvedTarget = path.resolve(targetDir).toLowerCase()
    if (resolvedSource !== resolvedTarget) {
      logger.info('import.copy.start', { sourceDir, targetDir })
      await copyDirectory(sourceDir, targetDir)
      logger.info('import.copy.success', { sourceDir, targetDir })
    }

    const relChosen = toPosixPath(path.relative(sourceDir, chosenModelFile))
    const modelPath = app.isPackaged
      ? pathToFileURL(path.join(targetDir, relChosen)).toString()
      : `/models/${normalizedModelName.value}/${relChosen}`
    const response = {
      success: true,
      modelPath,
      chosenFile: relChosen,
      modelFiles: modelFiles.map(f => toPosixPath(path.relative(sourceDir, f))),
      warnings: [...formatCubismAssetIssues(optionalIssues), ...validationResult.discoveryWarnings],
      manifest: validationResult.manifest
    }
    timer.done({
      success: true,
      modelName: normalizedModelName.value,
      sourceDir,
      targetDir,
      chosenFile: relChosen,
      modelFileCount: modelFiles.length,
      optionalIssueCount: optionalIssues.length,
      discoveryWarningCount: validationResult.discoveryWarnings.length
    })
    return response
  } catch (error: any) {
    console.error('[IPC] 导入模型失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 获取已导入的模型列表
 */
ipcMain.handle('model:getList', async () => {
  const timer = logger.timer('get_list')
  try {
    const modelsDir = getModelsDir()
    if (!fs.existsSync(modelsDir)) {
      timer.done({ modelsDir, count: 0, exists: false })
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
            path: app.isPackaged
              ? pathToFileURL(modelFile).toString()
              : `/models/${dir.name}/${rel}`
          })
        }
      }
    }

    timer.done({ modelsDir, count: models.length })
    return { success: true, models }
  } catch (error: any) {
    console.error('[IPC] 获取模型列表失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 删除模型
 */
ipcMain.handle('model:delete', async (_event, modelName: string) => {
  const timer = logger.timer('delete', { modelName })
  try {
    const normalizedModelName = normalizeModelName(modelName)
    if (!normalizedModelName.success) {
      timer.done({ success: false, reason: 'invalid_model_name', error: normalizedModelName.error })
      return { success: false, error: normalizedModelName.error }
    }

    const modelDir = path.join(getModelsDir(), normalizedModelName.value)
    if (fs.existsSync(modelDir)) {
      logger.info('delete.directory.start', { modelDir })
      await removeDirectoryWithRetry(modelDir)
      logger.info('delete.directory.success', { modelDir })
    }
    timer.done({ success: true, modelName: normalizedModelName.value, modelDir })
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 删除模型失败:', error)
    timer.fail(error)
    const code = typeof error?.code === 'string' ? `[${error.code}] ` : ''
    return { success: false, error: `${code}${error?.message || String(error)}` }
  }
})

/**
 * 解析模型加载描述
 */
ipcMain.handle('model:prepareLoad', async (_event, modelPath: string) => {
  const timer = logger.timer('prepare_load', { modelPath })
  try {
    const modelAbsolutePath = resolveModelAbsolutePath(modelPath)
    const validationResult = validateCubismModelAssets(modelAbsolutePath)
    if (validationResult.fatalError) {
      throw new Error(validationResult.fatalError)
    }

    const requiredIssues = validationResult.issues.filter(issue => issue.severity === 'required')
    if (requiredIssues.length > 0) {
      throw new Error(
        `${t('error.modelResourceIncomplete')}：${formatCubismAssetIssues(requiredIssues).join(', ')}`
      )
    }

    const descriptor = createCubismModelLoadDescriptor(modelPath, modelAbsolutePath)
    descriptor.warnings = [
      ...formatCubismAssetIssues(
        validationResult.issues.filter(issue => issue.severity === 'optional')
      ),
      ...descriptor.warnings
    ]
    descriptor.manifest = validationResult.manifest
    timer.done({
      modelPath,
      discoveryMode: descriptor.compatibilityManifest.discovery.mode,
      sourceCount: descriptor.compatibilityManifest.discovery.sources.length,
      warningCount: descriptor.warnings.length
    })
    return {
      success: true,
      descriptor
    }
  } catch (error: any) {
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 读取当前模型的固定表情类型分配。
 */
ipcMain.handle('model:getExpressionTypes', async (_event, modelPath: string) => {
  const timer = logger.timer('get_expression_types', { modelPath })
  try {
    const modelAbsolutePath = resolveModelAbsolutePath(modelPath)
    const descriptor = createCubismModelLoadDescriptor(modelPath, modelAbsolutePath)
    const expressions = descriptor.compatibilityManifest.expressions.map(entry => ({
      id: entry.id,
      file: entry.file,
      aliases: entry.aliases,
      source: entry.source
    }))
    const validExpressionIds = new Set(expressions.map(entry => entry.id))
    const profilePath = resolveExpressionProfilePath(modelAbsolutePath)
    const profile = await readExpressionProfile(profilePath)
    const presets = normalizeProfileSemanticPresets(profile.semanticPresets, validExpressionIds)

    timer.done({
      modelPath,
      expressionCount: expressions.length,
      assignedTypeCount: LIVE2D_EXPRESSION_TYPES.filter(type => presets[type].length > 0).length,
      profilePath
    })
    return {
      success: true,
      modelPath,
      profilePath,
      expressions,
      presets
    }
  } catch (error: any) {
    console.error('[IPC] 读取模型表情类型失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 保存当前模型的固定表情类型分配。
 */
ipcMain.handle(
  'model:saveExpressionTypes',
  async (_event, modelPath: string, rawPresets: unknown) => {
    const timer = logger.timer('save_expression_types', { modelPath })
    try {
      const modelAbsolutePath = resolveModelAbsolutePath(modelPath)
      const descriptor = createCubismModelLoadDescriptor(modelPath, modelAbsolutePath)
      const validExpressionIds = new Set(
        descriptor.compatibilityManifest.expressions.map(entry => entry.id)
      )
      const presets = normalizeRequestedExpressionPresets(rawPresets, validExpressionIds)
      const profilePath = resolveExpressionProfilePath(modelAbsolutePath)
      const profile = await readExpressionProfile(profilePath)
      const nextProfile: ExpressionProfilePayload = {
        ...profile,
        version: typeof profile.version === 'number' ? Math.max(profile.version, 2) : 2,
        semanticPresets: presets,
        tags: {
          ...(profile.tags && typeof profile.tags === 'object' && !Array.isArray(profile.tags)
            ? (profile.tags as Record<string, unknown>)
            : {}),
          ...buildPresetAliasTags(presets)
        }
      }

      await fs.promises.writeFile(profilePath, `${JSON.stringify(nextProfile, null, 2)}\n`, 'utf8')

      timer.done({
        modelPath,
        profilePath,
        assignedTypeCount: LIVE2D_EXPRESSION_TYPES.filter(type => presets[type].length > 0).length
      })
      return {
        success: true,
        profilePath
      }
    } catch (error: any) {
      console.error('[IPC] 保存模型表情类型失败:', error)
      timer.fail(error)
      return { success: false, error: error.message }
    }
  }
)

/**
 * 设置页用：从磁盘 manifest 生成动作/表情目录（不依赖主窗口 canvas）
 */
ipcMain.handle('model:getCatalog', async (_event, modelPath: string) => {
  const timer = logger.timer('get_catalog', { modelPath })
  try {
    const modelAbsolutePath = resolveModelAbsolutePath(modelPath)
    const catalog = buildCatalogForAbsoluteModel(modelPath, modelAbsolutePath)
    const motionGroups: Record<string, number> = {}
    for (const motion of catalog.motions) {
      motionGroups[motion.group] = (motionGroups[motion.group] ?? 0) + 1
    }
    timer.done({
      motionCount: catalog.motions.length,
      expressionCount: catalog.expressions.length,
      motionGroups
    })
    return { success: true, catalog }
  } catch (error: any) {
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 加载模型后若无别名配置则自动生成并保存
 */
ipcMain.handle(
  'modelConfig:ensure',
  async (_event, payload: { modelPath: string; motionDurations?: Record<string, number> }) => {
    const modelPath = payload?.modelPath
    if (!modelPath) {
      return { success: false, error: 'modelPath is required' }
    }
    try {
      const modelAbsolutePath = resolveModelAbsolutePath(modelPath)
      const result = await ensureModelAliasConfig(
        modelPath,
        modelAbsolutePath,
        payload.motionDurations
      )
      return { success: true, config: result.config, created: result.created }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
)

/**
 * 加载模型到主窗口
 */
ipcMain.handle('model:load', async (_event, modelPath: string) => {
  const timer = logger.timer('load', { modelPath })
  try {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('model:load', modelPath)
    }
    timer.done({ dispatched: Boolean(mainWindow), windowId: mainWindow?.id })
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 加载模型失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

async function copyDirectory(source: string, target: string): Promise<void> {
  const entries = await fs.promises.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const targetPath = path.join(target, entry.name)

    if (entry.isDirectory()) {
      await fs.promises.mkdir(targetPath, { recursive: true })
      await copyDirectory(sourcePath, targetPath)
    } else {
      await fs.promises.copyFile(sourcePath, targetPath)
    }
  }
}
