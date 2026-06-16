import fsp from 'fs/promises'
import path from 'path'

import type {
  CubismCompatibilityExpressionEntry,
  CubismCompatibilityManifest,
  CubismCompatibilityMotionEntry,
  CubismModelDiscoveryInfo,
  CubismModelDiscoverySource,
  CubismModelLoadDescriptor
} from '../../src/shared/cubismModelDiscovery'

type Model3Json = {
  FileReferences?: {
    Moc?: string
    Textures?: string[]
    Physics?: string
    Pose?: string
    UserData?: string
    Motions?: Record<string, Array<{ File?: string }>>
    Expressions?: Array<{ Name?: string; File?: string }>
  }
}

type VTubeStudioHotkey = {
  Name?: string
  Action?: string
  File?: string
}

type VTubeStudioJson = {
  FileReferences?: {
    IdleAnimation?: string
    IdleAnimationWhenTrackingLost?: string
  }
  Hotkeys?: VTubeStudioHotkey[]
}

type ScanIndex = {
  motionFiles: string[]
  expressionFiles: string[]
  motionByBasename: Map<string, string[]>
  expressionByBasename: Map<string, string[]>
  companionFiles: string[]
}

type ExpressionBuilderEntry = {
  id: string
  file: string
  aliases: Set<string>
  source: CubismModelDiscoverySource
  priority: number
}

type MotionBuilderEntry = {
  group: string
  file: string
  source: CubismModelDiscoverySource
  priority: number
}

const COMPATIBILITY_MANIFEST_VERSION = 1 as const
const VTUBE_SUFFIX = '.vtube.json'
const EXPRESSION_SUFFIX = '.exp3.json'
const MOTION_SUFFIX = '.motion3.json'
const PROFILE_FILE_NAME = 'astrbot.live2d.profile.json'

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }
    const normalized = value.trim()
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

function stripKnownExtension(fileName: string): string {
  return fileName
    .replace(/\.exp3\.json$/i, '')
    .replace(/\.motion3\.json$/i, '')
    .replace(/\.json$/i, '')
}

function isPathInsideRoot(rootDir: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootDir)
  const resolvedTarget = path.resolve(targetPath)
  const relative = path.relative(resolvedRoot, resolvedTarget)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function tryResolveDeclaredPath(rootDir: string, candidate: string): Promise<string | null> {
  const normalized = normalizeRelativePath(candidate)
  if (!normalized) {
    return null
  }

  const absolute = path.resolve(rootDir, normalized)
  if (!isPathInsideRoot(rootDir, absolute)) {
    return null
  }

  try {
    const stat = await fsp.stat(absolute)
    if (!stat.isFile()) {
      return null
    }
  } catch {
    return null
  }

  return normalizeRelativePath(path.relative(rootDir, absolute))
}

async function ensureFileExists(rootDir: string, relativePath: string): Promise<boolean> {
  const absolutePath = path.join(rootDir, relativePath)
  try {
    const stat = await fsp.stat(absolutePath)
    return stat.isFile()
  } catch {
    return false
  }
}

function pushBasenameIndex(index: Map<string, string[]>, relativePath: string): void {
  const key = path.basename(relativePath).toLowerCase()
  const current = index.get(key) ?? []
  current.push(relativePath)
  index.set(key, current)
}

async function scanModelDirectory(modelDir: string): Promise<ScanIndex> {
  const motionFiles: string[] = []
  const expressionFiles: string[] = []
  const companionFiles: string[] = []
  const motionByBasename = new Map<string, string[]>()
  const expressionByBasename = new Map<string, string[]>()

  async function walk(currentDir: string): Promise<void> {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      const relativePath = normalizeRelativePath(path.relative(modelDir, absolutePath))
      const lowerName = entry.name.toLowerCase()

      if (lowerName.endsWith(MOTION_SUFFIX)) {
        motionFiles.push(relativePath)
        pushBasenameIndex(motionByBasename, relativePath)
      } else if (lowerName.endsWith(EXPRESSION_SUFFIX)) {
        expressionFiles.push(relativePath)
        pushBasenameIndex(expressionByBasename, relativePath)
      } else if (lowerName.endsWith(VTUBE_SUFFIX)) {
        companionFiles.push(relativePath)
      }
    }
  }

  await walk(modelDir)

  motionFiles.sort()
  expressionFiles.sort()
  companionFiles.sort()

  return {
    motionFiles,
    expressionFiles,
    motionByBasename,
    expressionByBasename,
    companionFiles
  }
}

function chooseBestBasenameMatch(
  candidates: string[],
  kind: 'motion' | 'expression'
): { match: string | null; ambiguous: boolean } {
  if (candidates.length === 0) {
    return { match: null, ambiguous: false }
  }

  if (candidates.length === 1) {
    return { match: candidates[0], ambiguous: false }
  }

  const sorted = [...candidates].sort((left, right) => {
    const leftDepth = left.split('/').length
    const rightDepth = right.split('/').length
    const leftPreferred =
      kind === 'motion'
        ? left.toLowerCase().includes('/motions/')
          ? 1
          : 0
        : left.split('/').length === 1
          ? 1
          : 0
    const rightPreferred =
      kind === 'motion'
        ? right.toLowerCase().includes('/motions/')
          ? 1
          : 0
        : right.split('/').length === 1
          ? 1
          : 0

    if (leftPreferred !== rightPreferred) {
      return rightPreferred - leftPreferred
    }
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth
    }
    return left.localeCompare(right)
  })

  return {
    match: sorted[0],
    ambiguous: true
  }
}

async function resolveCandidatePath(
  rootDir: string,
  rawFile: string,
  kind: 'motion' | 'expression',
  scanIndex: ScanIndex,
  warnings: string[]
): Promise<string | null> {
  const trimmed = String(rawFile || '').trim()
  if (!trimmed) {
    return null
  }

  const declaredMatch = await tryResolveDeclaredPath(rootDir, trimmed)
  if (declaredMatch) {
    return declaredMatch
  }

  const basenameMatches =
    kind === 'motion'
      ? (scanIndex.motionByBasename.get(path.basename(trimmed).toLowerCase()) ?? [])
      : (scanIndex.expressionByBasename.get(path.basename(trimmed).toLowerCase()) ?? [])
  const resolved = chooseBestBasenameMatch(basenameMatches, kind)

  if (resolved.ambiguous && resolved.match) {
    warnings.push(`兼容清单中的 ${kind} 引用 ${trimmed} 存在多个候选，已选择 ${resolved.match}`)
  }

  return resolved.match
}

function ensureExpressionEntry(
  entries: Map<string, ExpressionBuilderEntry>,
  file: string,
  source: CubismModelDiscoverySource,
  priority: number,
  preferredId: string,
  aliases: string[]
): void {
  const key = file.toLowerCase()
  const normalizedId = preferredId.trim() || stripKnownExtension(path.basename(file))
  const normalizedAliases = uniqueStrings([
    normalizedId,
    stripKnownExtension(path.basename(file)),
    ...aliases
  ])

  const existing = entries.get(key)
  if (!existing) {
    entries.set(key, {
      id: normalizedId,
      file,
      aliases: new Set(normalizedAliases),
      source,
      priority
    })
    return
  }

  normalizedAliases.forEach(alias => existing.aliases.add(alias))
  if (priority < existing.priority) {
    existing.id = normalizedId
    existing.source = source
    existing.priority = priority
  }
}

function ensureMotionEntry(
  entries: Map<string, MotionBuilderEntry>,
  file: string,
  source: CubismModelDiscoverySource,
  priority: number,
  group: string
): void {
  const key = file.toLowerCase()
  const normalizedGroup = group.trim() || stripKnownExtension(path.basename(file))
  const existing = entries.get(key)
  if (!existing) {
    entries.set(key, {
      group: normalizedGroup,
      file,
      source,
      priority
    })
    return
  }

  if (priority < existing.priority) {
    existing.group = normalizedGroup
    existing.source = source
    existing.priority = priority
  }
}

function isExpressionHotkeyAction(action: string): boolean {
  return action.includes('expression')
}

function isMotionHotkeyAction(action: string): boolean {
  return action.includes('animation') || action.includes('motion')
}

function inferFallbackMotionGroup(relativePath: string): string {
  const baseName = stripKnownExtension(path.basename(relativePath))
  const normalizedBase = baseName.toLowerCase()
  if (
    normalizedBase.includes('idle') ||
    normalizedBase.includes('default') ||
    normalizedBase.includes('standby') ||
    baseName.includes('待机')
  ) {
    return 'Idle'
  }
  return baseName
}

async function appendStandardDeclarations(
  modelDir: string,
  modelJson: Model3Json,
  expressionEntries: Map<string, ExpressionBuilderEntry>,
  motionEntries: Map<string, MotionBuilderEntry>,
  warnings: string[]
): Promise<{ expressionCount: number; motionGroupCount: number }> {
  const refs = modelJson.FileReferences ?? {}
  let expressionCount = 0
  let motionGroupCount = 0

  for (const expressionRef of refs.Expressions ?? []) {
    const file = typeof expressionRef?.File === 'string' ? expressionRef.File : ''
    const resolved = await tryResolveDeclaredPath(modelDir, file)
    if (!resolved) {
      if (file) {
        warnings.push(`标准模型声明的表情文件不存在: ${normalizeRelativePath(file)}`)
      }
      continue
    }
    expressionCount += 1
    const rawName = typeof expressionRef?.Name === 'string' ? expressionRef.Name.trim() : ''
    const baseName = stripKnownExtension(path.basename(resolved))
    ensureExpressionEntry(
      expressionEntries,
      resolved,
      'model3',
      0,
      rawName || baseName,
      uniqueStrings([rawName, baseName])
    )
  }

  for (const [groupName, items] of Object.entries(refs.Motions ?? {})) {
    let groupHasMotion = false
    for (const item of items ?? []) {
      const file = typeof item?.File === 'string' ? item.File : ''
      const resolved = await tryResolveDeclaredPath(modelDir, file)
      if (!resolved) {
        if (file) {
          warnings.push(`标准模型声明的动作文件不存在: ${normalizeRelativePath(file)}`)
        }
        continue
      }
      groupHasMotion = true
      ensureMotionEntry(motionEntries, resolved, 'model3', 0, groupName)
    }
    if (groupHasMotion) {
      motionGroupCount += 1
    }
  }

  return {
    expressionCount,
    motionGroupCount
  }
}

async function appendVTubeStudioDeclarations(
  modelDir: string,
  companionRelativePath: string,
  scanIndex: ScanIndex,
  expressionEntries: Map<string, ExpressionBuilderEntry>,
  motionEntries: Map<string, MotionBuilderEntry>,
  warnings: string[]
): Promise<void> {
  const absolutePath = path.join(modelDir, companionRelativePath)
  let parsed: VTubeStudioJson

  try {
    parsed = JSON.parse(await fsp.readFile(absolutePath, 'utf8')) as VTubeStudioJson
  } catch (error) {
    warnings.push(
      `伴生清单解析失败 ${companionRelativePath}: ${error instanceof Error ? error.message : String(error)}`
    )
    return
  }

  const idleAnimation = parsed.FileReferences?.IdleAnimation
  const idleResolved = idleAnimation
    ? await resolveCandidatePath(modelDir, idleAnimation, 'motion', scanIndex, warnings)
    : null
  if (idleResolved) {
    ensureMotionEntry(motionEntries, idleResolved, 'companion', 1, 'Idle')
  }

  const idleLostAnimation = parsed.FileReferences?.IdleAnimationWhenTrackingLost
  const idleLostResolved = idleLostAnimation
    ? await resolveCandidatePath(modelDir, idleLostAnimation, 'motion', scanIndex, warnings)
    : null
  if (idleLostResolved) {
    ensureMotionEntry(motionEntries, idleLostResolved, 'companion', 1, 'IdleTrackingLost')
  }

  for (const hotkey of parsed.Hotkeys ?? []) {
    const rawFile = typeof hotkey?.File === 'string' ? hotkey.File : ''
    const rawName = typeof hotkey?.Name === 'string' ? hotkey.Name.trim() : ''
    const action = typeof hotkey?.Action === 'string' ? hotkey.Action.trim().toLowerCase() : ''

    if (!rawFile) {
      continue
    }

    const lowerFile = rawFile.toLowerCase()
    if (lowerFile.endsWith(EXPRESSION_SUFFIX) || isExpressionHotkeyAction(action)) {
      const resolved = await resolveCandidatePath(
        modelDir,
        rawFile,
        'expression',
        scanIndex,
        warnings
      )
      if (!resolved) {
        warnings.push(`伴生清单声明的表情文件不存在: ${rawFile}`)
        continue
      }
      const baseName = stripKnownExtension(path.basename(resolved))
      ensureExpressionEntry(
        expressionEntries,
        resolved,
        'companion',
        1,
        rawName || baseName,
        uniqueStrings([rawName, baseName])
      )
      continue
    }

    if (lowerFile.endsWith(MOTION_SUFFIX) || isMotionHotkeyAction(action)) {
      const resolved = await resolveCandidatePath(modelDir, rawFile, 'motion', scanIndex, warnings)
      if (!resolved) {
        warnings.push(`伴生清单声明的动作文件不存在: ${rawFile}`)
        continue
      }
      const groupName = rawName || stripKnownExtension(path.basename(resolved))
      ensureMotionEntry(motionEntries, resolved, 'companion', 1, groupName)
    }
  }
}

function appendScanFallbackDeclarations(
  scanIndex: ScanIndex,
  expressionEntries: Map<string, ExpressionBuilderEntry>,
  motionEntries: Map<string, MotionBuilderEntry>
): void {
  for (const expressionFile of scanIndex.expressionFiles) {
    ensureExpressionEntry(
      expressionEntries,
      expressionFile,
      'scan',
      2,
      stripKnownExtension(path.basename(expressionFile)),
      []
    )
  }

  for (const motionFile of scanIndex.motionFiles) {
    ensureMotionEntry(motionEntries, motionFile, 'scan', 2, inferFallbackMotionGroup(motionFile))
  }
}

function buildDiscoveryInfo(
  expressions: CubismCompatibilityExpressionEntry[],
  motions: Record<string, CubismCompatibilityMotionEntry[]>,
  companionFiles: string[],
  standardDeclaredExpressions: number,
  standardDeclaredMotionGroups: number,
  scanIndex: ScanIndex,
  warnings: string[]
): CubismModelDiscoveryInfo {
  const sourceSet = new Set<CubismModelDiscoverySource>()
  expressions.forEach(entry => sourceSet.add(entry.source))
  Object.values(motions).forEach(items => items.forEach(entry => sourceSet.add(entry.source)))

  const sources = [...sourceSet.values()]
  const usesCompatibilitySource = sources.some(source => source !== 'model3')

  let mode: CubismModelDiscoveryInfo['mode'] = 'standard'
  if (usesCompatibilitySource) {
    const usesStandardDeclarations =
      standardDeclaredExpressions > 0 || standardDeclaredMotionGroups > 0
    mode = usesStandardDeclarations ? 'hybrid' : 'compatibility'
  }

  return {
    mode,
    sources,
    companionFiles,
    standardDeclaredExpressions,
    standardDeclaredMotionGroups,
    discoveredExpressions: expressions.length,
    discoveredMotionGroups: Object.keys(motions).length,
    scannedExpressionCount: scanIndex.expressionFiles.length,
    scannedMotionCount: scanIndex.motionFiles.length,
    warnings: [...warnings]
  }
}

function ensureUniqueExpressionIds(
  expressions: CubismCompatibilityExpressionEntry[]
): CubismCompatibilityExpressionEntry[] {
  const usedIds = new Map<string, number>()

  return expressions.map(entry => {
    const baseId = entry.id.trim() || stripKnownExtension(path.basename(entry.file))
    const key = baseId.toLowerCase()
    const currentCount = usedIds.get(key) ?? 0
    usedIds.set(key, currentCount + 1)

    if (currentCount === 0) {
      return entry
    }

    const dedupedId = `${baseId}_${currentCount + 1}`
    return {
      ...entry,
      id: dedupedId,
      aliases: uniqueStrings([baseId, ...entry.aliases])
    }
  })
}

export async function discoverCubismModelCompatibility(
  modelJsonPath: string
): Promise<CubismCompatibilityManifest> {
  const modelAbsolutePath = path.resolve(modelJsonPath)
  const modelDir = path.dirname(modelAbsolutePath)
  const modelFile = normalizeRelativePath(path.basename(modelAbsolutePath))
  const expressionProfileAbsolutePath = path.join(modelDir, PROFILE_FILE_NAME)
  const warnings: string[] = []
  const scanIndex = await scanModelDirectory(modelDir)
  const expressionEntries = new Map<string, ExpressionBuilderEntry>()
  const motionEntries = new Map<string, MotionBuilderEntry>()

  let modelJson: Model3Json = {}
  try {
    modelJson = JSON.parse(await fsp.readFile(modelAbsolutePath, 'utf8')) as Model3Json
  } catch (error) {
    warnings.push(`标准模型配置解析失败: ${error instanceof Error ? error.message : String(error)}`)
  }

  const standardSummary = await appendStandardDeclarations(
    modelDir,
    modelJson,
    expressionEntries,
    motionEntries,
    warnings
  )

  for (const companionFile of scanIndex.companionFiles) {
    await appendVTubeStudioDeclarations(
      modelDir,
      companionFile,
      scanIndex,
      expressionEntries,
      motionEntries,
      warnings
    )
  }

  appendScanFallbackDeclarations(scanIndex, expressionEntries, motionEntries)

  const expressions = ensureUniqueExpressionIds(
    [...expressionEntries.values()]
      .sort((left, right) => left.id.localeCompare(right.id) || left.file.localeCompare(right.file))
      .map<CubismCompatibilityExpressionEntry>(entry => ({
        id: entry.id,
        file: entry.file,
        aliases: uniqueStrings([...entry.aliases.values()]),
        source: entry.source
      }))
  )

  const motions = [...motionEntries.values()]
    .sort(
      (left, right) => left.group.localeCompare(right.group) || left.file.localeCompare(right.file)
    )
    .reduce<Record<string, CubismCompatibilityMotionEntry[]>>((groups, entry) => {
      if (!groups[entry.group]) {
        groups[entry.group] = []
      }
      groups[entry.group].push({
        file: entry.file,
        source: entry.source
      })
      return groups
    }, {})

  const hasExpressionProfile = await ensureFileExists(modelDir, PROFILE_FILE_NAME)

  return {
    version: COMPATIBILITY_MANIFEST_VERSION,
    modelFile,
    expressionProfileFile: hasExpressionProfile
      ? normalizeRelativePath(path.relative(modelDir, expressionProfileAbsolutePath))
      : null,
    expressions,
    motions,
    discovery: buildDiscoveryInfo(
      expressions,
      motions,
      scanIndex.companionFiles,
      standardSummary.expressionCount,
      standardSummary.motionGroupCount,
      scanIndex,
      warnings
    )
  }
}

export async function createCubismModelLoadDescriptor(
  modelPath: string,
  modelJsonPath: string
): Promise<CubismModelLoadDescriptor> {
  const compatibilityManifest = await discoverCubismModelCompatibility(modelJsonPath)
  return {
    modelPath,
    compatibilityManifest,
    warnings: [...compatibilityManifest.discovery.warnings],
    manifest: {
      modelFile: compatibilityManifest.modelFile,
      moc: '',
      textures: [],
      motions: compatibilityManifest.motions
        ? Object.values(compatibilityManifest.motions)
            .flat()
            .map(item => normalizeRelativePath(item.file))
        : [],
      expressions: compatibilityManifest.expressions.map(item => normalizeRelativePath(item.file)),
      physics: undefined,
      pose: undefined,
      userData: undefined
    }
  }
}
