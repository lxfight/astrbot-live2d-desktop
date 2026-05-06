export type ExpressionBlendType = 'add' | 'multiply' | 'overwrite'

export type ExpressionParameterOp = {
  parameterId: string
  blend: ExpressionBlendType
  value: number
}

export type ParsedExpressionFile = {
  id: string
  file: string
  parameters: ExpressionParameterOp[]
  parameterIds: string[]
  blendSummary: {
    additive: number
    multiply: number
    overwrite: number
  }
  parseWarnings: string[]
}

type RawExpressionParameter = {
  Id?: string
  Value?: number
  Blend?: string
}

type RawExp3Json = {
  Parameters?: RawExpressionParameter[]
}

function normalizeBlendType(rawBlend: unknown): ExpressionBlendType {
  const normalized = typeof rawBlend === 'string' ? rawBlend.trim().toLowerCase() : ''
  if (normalized === 'multiply') {
    return 'multiply'
  }
  if (normalized === 'overwrite' || normalized === 'set') {
    return 'overwrite'
  }
  return 'add'
}

export function parseExp3Text(text: string, id: string, file: string): ParsedExpressionFile {
  const parseWarnings: string[] = []
  const parameters: ExpressionParameterOp[] = []

  let parsed: RawExp3Json = {}
  try {
    parsed = JSON.parse(text) as RawExp3Json
  } catch (error) {
    parseWarnings.push(
      `表情文件解析失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!Array.isArray(parsed.Parameters)) {
    parseWarnings.push('表情文件缺少 Parameters 数组')
  } else {
    for (const item of parsed.Parameters) {
      const parameterId = typeof item?.Id === 'string' ? item.Id.trim() : ''
      if (!parameterId) {
        parseWarnings.push('发现缺少 Id 的表情参数项')
        continue
      }

      const value = typeof item?.Value === 'number' && Number.isFinite(item.Value)
        ? item.Value
        : 0
      const blend = normalizeBlendType(item?.Blend)

      parameters.push({
        parameterId,
        blend,
        value
      })
    }
  }

  const parameterIds = [...new Set(parameters.map(item => item.parameterId))]

  return {
    id,
    file,
    parameters,
    parameterIds,
    blendSummary: {
      additive: parameters.filter(item => item.blend === 'add').length,
      multiply: parameters.filter(item => item.blend === 'multiply').length,
      overwrite: parameters.filter(item => item.blend === 'overwrite').length
    },
    parseWarnings
  }
}
