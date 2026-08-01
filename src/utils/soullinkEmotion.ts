import {
  SoullinkRuntime,
  motionStylePresets,
  type EmotionIntent,
  type ExpressionBinding,
  type ModelProfile,
  type RuntimeSnapshot,
  type VADVector
} from '@soullink-emotion/engine'

export type SoullinkEmotionIntent = {
  emotion: string
  variant?: string
  naturalEmotion?: string
  naturalVariant?: string
  naturalVAD?: Partial<VADVector>
  intensity: number
  contextTags?: string[]
  sourceMessage?: string
}

export type SoullinkEmotionFrame = Pick<RuntimeSnapshot, 'live2dParams' | 'nativeAnimation'>

export type SoullinkExpressionCatalogEntry = {
  id: string
  aliases?: string[]
  tags?: string[]
}

export type SoullinkTriggerOptions = {
  allowNativeAnimation?: boolean
}

const NATIVE_EXPRESSION_MATCHERS: Array<{
  emotion: string
  tags: string[]
  keywords: string[]
}> = [
  {
    emotion: 'happy',
    tags: ['happy'],
    keywords: ['happy', 'smile', 'joy', 'laugh', '开心', '高兴', '笑', '星星眼']
  },
  {
    emotion: 'sad',
    tags: ['sad'],
    keywords: ['sad', 'cry', 'tear', '难过', '伤心', '哭', '流泪']
  },
  {
    emotion: 'angry',
    tags: ['angry'],
    keywords: ['angry', 'mad', 'rage', '生气', '愤怒', '黑脸']
  },
  {
    emotion: 'surprised',
    tags: ['surprised'],
    keywords: ['surprise', 'shock', 'wow', '惊讶', '震惊', '星星眼']
  },
  {
    emotion: 'thinking',
    tags: ['thinking'],
    keywords: ['thinking', 'ponder', 'think', '思考', '记笔记']
  },
  {
    emotion: 'anxious',
    tags: ['anxious'],
    keywords: ['anxious', 'nervous', '焦虑', '紧张', '晕晕眼']
  },
  {
    emotion: 'tired',
    tags: ['tired'],
    keywords: ['tired', 'sleepy', '疲惫', '困', '晕晕眼']
  },
  {
    emotion: 'disgusted',
    tags: ['disgusted'],
    keywords: ['disgust', '厌恶', '嫌弃', '黑脸']
  },
  {
    emotion: 'blush',
    tags: ['blush'],
    keywords: ['blush', 'shy', '脸红', '害羞']
  },
  {
    emotion: 'playful',
    tags: ['playful'],
    keywords: ['playful', 'mischief', '调皮', '俏皮', '星星眼']
  }
]

const STANDARD_PARAMETER_MAP: ModelProfile['parameterMap'] = {
  browInnerUp: {
    targets: ['ParamBrowLY', 'ParamBrowRY'],
    mode: 'set',
    scale: 1,
    min: -1,
    max: 1
  },
  browOuterUp: {
    targets: ['ParamBrowLAngle', 'ParamBrowRAngle'],
    mode: 'set',
    scale: 0.9,
    min: -1,
    max: 1
  },
  browDown: {
    targets: ['ParamBrowLForm', 'ParamBrowRForm'],
    mode: 'set',
    scale: -0.85,
    min: -1,
    max: 1
  },
  eyeSmile: {
    targets: ['ParamEyeLSmile', 'ParamEyeRSmile'],
    mode: 'set',
    scale: 0.9,
    min: 0,
    max: 1
  },
  mouthSmile: {
    target: 'ParamMouthForm',
    mode: 'set',
    scale: 1,
    min: -1,
    max: 1
  },
  mouthFrown: {
    target: 'ParamMouthForm',
    mode: 'add',
    scale: -0.9,
    min: -1,
    max: 1
  },
  gazeX: { target: 'ParamEyeBallX', mode: 'set', scale: 0.75, min: -1, max: 1 },
  gazeY: { target: 'ParamEyeBallY', mode: 'set', scale: 0.75, min: -1, max: 1 },
  headX: { target: 'ParamAngleX', mode: 'set', scale: 30, min: -30, max: 30 },
  headY: { target: 'ParamAngleY', mode: 'set', scale: 30, min: -30, max: 30 },
  headZ: { target: 'ParamAngleZ', mode: 'set', scale: 30, min: -30, max: 30 },
  bodyX: { target: 'ParamBodyAngleX', mode: 'set', scale: 12, min: -12, max: 12 },
  bodyY: { target: 'ParamBodyAngleY', mode: 'set', scale: 12, min: -12, max: 12 },
  bodyZ: { target: 'ParamBodyAngleZ', mode: 'set', scale: 12, min: -12, max: 12 },
  blush: { target: 'ParamCheek', mode: 'set', scale: 1, min: 0, max: 1 },
  breath: { target: 'ParamBreath', mode: 'set', scale: 1, min: 0, max: 1 }
}

export function createStandardSoullinkProfile(
  modelPath: string,
  displayName: string
): ModelProfile {
  return {
    modelId: modelPath,
    displayName: displayName || 'Live2D Model',
    version: '1.0.0',
    schemaVersion: 2,
    modelPath,
    parameterMap: STANDARD_PARAMETER_MAP,
    idleConfig: {}
  }
}

function normalizeCatalogText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function findNativeExpression(
  catalog: SoullinkExpressionCatalogEntry[],
  tags: string[],
  keywords: string[]
): string | null {
  const normalizedTags = new Set(tags.map(normalizeCatalogText))
  const tagged = catalog.find(entry =>
    (entry.tags ?? []).some(tag => normalizedTags.has(normalizeCatalogText(tag)))
  )
  if (tagged) {
    return tagged.id
  }

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeCatalogText(keyword)
    const matched = catalog.find(entry =>
      [entry.id, ...(entry.aliases ?? [])].some(value =>
        normalizeCatalogText(value).includes(normalizedKeyword)
      )
    )
    if (matched) {
      return matched.id
    }
  }

  return null
}

export function addDiscoveredSoullinkExpressions(
  profile: ModelProfile,
  catalog: SoullinkExpressionCatalogEntry[] | null | undefined
): ModelProfile {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return profile
  }

  const inferred: Record<string, ExpressionBinding> = {}
  for (const matcher of NATIVE_EXPRESSION_MATCHERS) {
    const expression = findNativeExpression(catalog, matcher.tags, matcher.keywords)
    if (expression) {
      inferred[matcher.emotion] = { expression, minIntensity: 0.5 }
    }
  }

  if (Object.keys(inferred).length === 0) {
    return profile
  }

  return {
    ...profile,
    expressionMap: {
      ...inferred,
      ...(profile.expressionMap ?? {})
    }
  }
}

function normalizeIntent(intent: SoullinkEmotionIntent): EmotionIntent | null {
  const emotion = intent.emotion.trim()
  if (!emotion) {
    return null
  }

  return {
    emotion,
    variant: intent.variant?.trim() || undefined,
    naturalEmotion: intent.naturalEmotion?.trim() || undefined,
    naturalVariant: intent.naturalVariant?.trim() || undefined,
    naturalVAD: intent.naturalVAD,
    intensity: Number.isFinite(intent.intensity)
      ? Math.min(1, Math.max(0, intent.intensity))
      : 0.65,
    contextTags: Array.isArray(intent.contextTags)
      ? intent.contextTags
          .filter(tag => typeof tag === 'string' && tag.trim())
          .map(tag => tag.trim())
      : [],
    sourceMessage: intent.sourceMessage?.trim() || undefined
  }
}

export class SoullinkEmotionController {
  private runtime: SoullinkRuntime | null = null
  private enabled = true
  private nativeAnimationAllowed = true
  private startedAtMs = 0
  private previousFrameMs = 0

  configure(profile: ModelProfile): void {
    this.runtime = new SoullinkRuntime({
      profile,
      motionStyle: motionStylePresets.lively
    })
    this.runtime.setParameterGain(1.15)
    this.runtime.setBodyMotionGain(1.1)
    // The host already provides model-native blinking and real audio lip sync.
    this.runtime.setLipSyncEnabled(false)
    this.nativeAnimationAllowed = true
    this.startedAtMs = performance.now()
    this.previousFrameMs = this.startedAtMs
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  triggerMessage(message: string, options: SoullinkTriggerOptions = {}): EmotionIntent | null {
    const normalized = message.trim()
    if (!this.enabled || !this.runtime || !normalized) {
      return null
    }
    this.nativeAnimationAllowed = options.allowNativeAnimation !== false
    return this.runtime.sendMessage(normalized, this.currentTimeSeconds())
  }

  triggerIntent(intent: SoullinkEmotionIntent, options: SoullinkTriggerOptions = {}): boolean {
    const normalized = normalizeIntent(intent)
    if (!this.enabled || !this.runtime || !normalized) {
      return false
    }
    this.nativeAnimationAllowed = options.allowNativeAnimation !== false
    this.runtime.triggerIntent(normalized, this.currentTimeSeconds())
    return true
  }

  update(timestampMs: number): SoullinkEmotionFrame | null {
    if (!this.enabled || !this.runtime) {
      return null
    }

    const currentMs = Number.isFinite(timestampMs) ? timestampMs : performance.now()
    const timeSeconds = Math.max(0, (currentMs - this.startedAtMs) / 1000)
    const deltaSeconds = Math.min(0.1, Math.max(0, (currentMs - this.previousFrameMs) / 1000))
    this.previousFrameMs = currentMs
    const snapshot = this.runtime.update(timeSeconds, deltaSeconds)
    return {
      live2dParams: snapshot.live2dParams,
      nativeAnimation: this.nativeAnimationAllowed ? snapshot.nativeAnimation : null
    }
  }

  reset(): void {
    this.runtime = null
    this.nativeAnimationAllowed = true
    this.startedAtMs = 0
    this.previousFrameMs = 0
  }

  private currentTimeSeconds(): number {
    return this.startedAtMs > 0 ? Math.max(0, (performance.now() - this.startedAtMs) / 1000) : 0
  }
}
