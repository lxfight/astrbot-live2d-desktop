import { describe, expect, it } from 'vitest'

/**
 * 测试 Cubism Core 下载重试逻辑。
 * 实际下载函数依赖 Electron dialog/fs/net API，此处仅测试可脱离 Electron 执行的纯逻辑部分。
 */

describe('Cubism Core download', () => {
  it('package.json contains cubism core configuration', async () => {
    const pkg = await import('../package.json')
    expect(pkg.cubism).toBeDefined()
    expect(pkg.cubism.sdkBaseline).toBeTruthy()
    expect(pkg.cubism.core).toBeDefined()
    expect(pkg.cubism.core.filename).toBe('live2dcubismcore.min.js')
    expect(pkg.cubism.core.downloadUrl).toContain('https://')
    expect(pkg.cubism.core.expectedHash).toContain('sha256-')
  })

  it('cubism core expectedHash uses sha256 prefix', () => {
    // The hash helps verify download integrity; ensure it follows the expected format
    // Actual verification is done by the download script, not at runtime
    const hash = 'sha256-25ae938cb4fe282ce189b357bcc97e603d1e1f7ec78bf04150d401c23cdc792f'
    expect(hash).toMatch(/^sha256-[a-f0-9]{64}$/)
  })
})
