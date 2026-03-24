import fs from 'fs'
import path from 'path'

export type CubismAssetSeverity = 'required' | 'optional'

export type CubismAssetIssue = {
  severity: CubismAssetSeverity
  kind:
    | 'model'
    | 'moc'
    | 'texture'
    | 'motion'
    | 'expression'
    | 'physics'
    | 'pose'
    | 'userData'
  relativePath: string
}

export type CubismAssetManifest = {
  modelFile: string
  moc: string
  textures: string[]
  motions: string[]
  expressions: string[]
  physics?: string
  pose?: string
  userData?: string
}

export type CubismAssetValidationResult = {
  manifest: CubismAssetManifest
  issues: CubismAssetIssue[]
}

type Model3Json = {
  FileReferences?: {
    Moc?: string
    Textures?: string[]
    Physics?: string
    Pose?: string
    UserData?: string
    Motions?: Record<string, Array<{ File?: string }>>
    Expressions?: Array<{ File?: string }>
  }
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '')
}

function createIssue(
  severity: CubismAssetSeverity,
  kind: CubismAssetIssue['kind'],
  relativePath: string
): CubismAssetIssue {
  return {
    severity,
    kind,
    relativePath: normalizeRelativePath(relativePath)
  }
}

function ensureFileExists(rootDir: string, relativePath: string): boolean {
  const absolutePath = path.join(rootDir, relativePath)
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()
}

export function validateCubismModelAssets(modelJsonPath: string): CubismAssetValidationResult {
  const modelAbsolutePath = path.resolve(modelJsonPath)
  const modelDir = path.dirname(modelAbsolutePath)
  const modelFile = path.basename(modelAbsolutePath)
  const relativeModelFile = normalizeRelativePath(modelFile)

  if (!ensureFileExists(modelDir, modelFile)) {
    return {
      manifest: {
        modelFile: relativeModelFile,
        moc: '',
        textures: [],
        motions: [],
        expressions: []
      },
      issues: [createIssue('required', 'model', relativeModelFile)]
    }
  }

  const parsed = JSON.parse(fs.readFileSync(modelAbsolutePath, 'utf8')) as Model3Json
  const refs = parsed.FileReferences ?? {}

  const manifest: CubismAssetManifest = {
    modelFile: relativeModelFile,
    moc: normalizeRelativePath(refs.Moc ?? ''),
    textures: (refs.Textures ?? []).map(normalizeRelativePath),
    motions: [],
    expressions: (refs.Expressions ?? [])
      .map((entry) => entry?.File)
      .filter((value): value is string => Boolean(value))
      .map(normalizeRelativePath),
    physics: refs.Physics ? normalizeRelativePath(refs.Physics) : undefined,
    pose: refs.Pose ? normalizeRelativePath(refs.Pose) : undefined,
    userData: refs.UserData ? normalizeRelativePath(refs.UserData) : undefined
  }

  for (const motions of Object.values(refs.Motions ?? {})) {
    for (const motion of motions) {
      if (motion?.File) {
        manifest.motions.push(normalizeRelativePath(motion.File))
      }
    }
  }

  const issues: CubismAssetIssue[] = []

  if (!manifest.moc || !ensureFileExists(modelDir, manifest.moc)) {
    issues.push(createIssue('required', 'moc', manifest.moc || '[missing-moc-reference]'))
  }

  if (manifest.textures.length === 0) {
    issues.push(createIssue('required', 'texture', '[missing-texture-reference]'))
  }

  for (const texture of manifest.textures) {
    if (!ensureFileExists(modelDir, texture)) {
      issues.push(createIssue('required', 'texture', texture))
    }
  }

  for (const motion of manifest.motions) {
    if (!ensureFileExists(modelDir, motion)) {
      issues.push(createIssue('optional', 'motion', motion))
    }
  }

  for (const expression of manifest.expressions) {
    if (!ensureFileExists(modelDir, expression)) {
      issues.push(createIssue('optional', 'expression', expression))
    }
  }

  if (manifest.physics && !ensureFileExists(modelDir, manifest.physics)) {
    issues.push(createIssue('optional', 'physics', manifest.physics))
  }

  if (manifest.pose && !ensureFileExists(modelDir, manifest.pose)) {
    issues.push(createIssue('optional', 'pose', manifest.pose))
  }

  if (manifest.userData && !ensureFileExists(modelDir, manifest.userData)) {
    issues.push(createIssue('optional', 'userData', manifest.userData))
  }

  return {
    manifest,
    issues
  }
}

export function formatCubismAssetIssues(issues: CubismAssetIssue[]): string[] {
  return issues.map((issue) => `${issue.severity}:${issue.kind}:${issue.relativePath}`)
}
