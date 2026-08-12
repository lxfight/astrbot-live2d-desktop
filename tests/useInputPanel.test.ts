/**
 * useInputPanel 测试
 * 覆盖拖拽/粘贴/文件选择图片、大小限制、空闲自动关闭与消息发送流程
 */

import { afterEach, describe, expect, test, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { DEFAULT_ADVANCED_SETTINGS, type AdvancedSettings } from '@/utils/advancedSettings'

const harness = vi.hoisted(() => ({
  connectionStore: {
    isConnected: false,
    userId: 'user-1',
    sessionId: 'session-1',
    resourceBaseUrl: '',
    resourcePath: '',
    resourceToken: '',
    sendMessage: vi.fn(async () => ({ success: true, error: '' }))
  },
  statusCalls: [] as Array<{ text: string; type: string }>,
  saveMessage: vi.fn(async () => ({ success: true }))
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/stores/connection', () => ({
  useConnectionStore: () => harness.connectionStore
}))

const { useInputPanel } = await import('../src/windows/composables/useInputPanel')

class FakeFileReader {
  onload: ((event: { target: FakeFileReader }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  result: string | null = null

  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,fake-content`
    queueMicrotask(() => {
      if (this.onload) this.onload({ target: this })
    })
  }
}

async function flushMicrotasks(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

function createPanel() {
  harness.statusCalls.length = 0
  vi.stubGlobal('FileReader', FakeFileReader)
  return useInputPanel({
    connectionStore: harness.connectionStore as never,
    currentUserName: ref('测试用户'),
    advancedSettings: ref<AdvancedSettings>(structuredClone(DEFAULT_ADVANCED_SETTINGS)),
    showModelStatus: (text: string, type: string) => harness.statusCalls.push({ text, type }),
    showBaseEventStatus: (text: string, type: string) => harness.statusCalls.push({ text, type }),
    updateUIPositions: vi.fn(),
    generateMessageId: (prefix?: string) => `${prefix ?? 'msg'}-1`
  })
}

function makeFile(name: string, byteLength: number, type = 'image/png'): File {
  return new File([new Uint8Array(byteLength)], name, { type })
}

function makeDropEvent(files: File[]) {
  return {
    dataTransfer: { files },
    preventDefault: vi.fn()
  } as unknown as DragEvent
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
  harness.connectionStore.sendMessage.mockReset()
  harness.saveMessage.mockReset()
})

describe('handleDragOver', () => {
  test('包含 Files 类型时阻止默认行为', () => {
    const panel = createPanel()
    const event = {
      dataTransfer: { types: ['Files'] },
      preventDefault: vi.fn()
    } as unknown as DragEvent

    panel.handleDragOver(event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  test('无 Files 类型或 dataTransfer 为空时不处理', () => {
    const panel = createPanel()
    const noFiles = {
      dataTransfer: { types: ['text/plain'] },
      preventDefault: vi.fn()
    } as unknown as DragEvent
    const noTransfer = { preventDefault: vi.fn() } as unknown as DragEvent

    panel.handleDragOver(noFiles)
    panel.handleDragOver(noTransfer)
    expect(noFiles.preventDefault).not.toHaveBeenCalled()
    expect(noTransfer.preventDefault).not.toHaveBeenCalled()
  })
})

describe('handleDrop', () => {
  test('图片文件进入选中流程并打开输入面板', async () => {
    const panel = createPanel()

    panel.handleDrop(makeDropEvent([makeFile('a.png', 100)]))
    await flushMicrotasks()

    expect(panel.selectedImage.value?.file.name).toBe('a.png')
    expect(panel.showInput.value).toBe(true)
  })

  test('非图片文件提示且不选中', () => {
    const panel = createPanel()

    panel.handleDrop(makeDropEvent([makeFile('notes.txt', 10, 'text/plain')]))

    expect(panel.selectedImage.value).toBeNull()
    expect(harness.statusCalls).toContainEqual({
      text: 'main.input.dropImageOnly',
      type: 'warning'
    })
  })

  test('超过大小上限的图片提示且不选中', () => {
    const panel = createPanel()
    const oversized = makeFile('big.png', 10 * 1024 * 1024 + 1)

    panel.handleDrop(makeDropEvent([oversized]))

    expect(panel.selectedImage.value).toBeNull()
    expect(harness.statusCalls.some(call => call.text === 'main.input.imageTooLarge')).toBe(true)
  })

  test('无文件时静默返回', () => {
    const panel = createPanel()

    panel.handleDrop(makeDropEvent([]))
    expect(panel.selectedImage.value).toBeNull()
    expect(harness.statusCalls).toHaveLength(0)
  })
})

describe('handlePasteEvent', () => {
  test('粘贴图片进入选中流程', async () => {
    const panel = createPanel()
    const file = makeFile('pasted.png', 100)
    const event = {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => file }] },
      preventDefault: vi.fn()
    } as unknown as ClipboardEvent

    panel.handlePasteEvent(event)
    await flushMicrotasks()

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(panel.selectedImage.value?.file.name).toBe('pasted.png')
  })

  test('非图片剪贴板内容不处理', () => {
    const panel = createPanel()
    const event = {
      clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] },
      preventDefault: vi.fn()
    } as unknown as ClipboardEvent

    panel.handlePasteEvent(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(panel.selectedImage.value).toBeNull()
  })

  test('无剪贴板数据时静默返回', () => {
    const panel = createPanel()
    const event = { preventDefault: vi.fn() } as unknown as ClipboardEvent

    expect(() => panel.handlePasteEvent(event)).not.toThrow()
  })
})

describe('handleSelectImage', () => {
  test('文件选择器选中图片后进入选中流程', async () => {
    const panel = createPanel()
    const inputElement = {
      type: '',
      accept: '',
      onchange: null as ((event: unknown) => void) | null,
      oncancel: null as (() => void) | null,
      click: vi.fn()
    }
    vi.stubGlobal('document', { createElement: () => inputElement })

    panel.handleSelectImage()
    expect(inputElement.type).toBe('file')
    expect(inputElement.accept).toBe('image/*')
    expect(inputElement.click).toHaveBeenCalledOnce()

    const file = makeFile('picked.png', 100)
    inputElement.onchange?.({ target: { files: [file] } })
    await flushMicrotasks()

    expect(panel.selectedImage.value?.file.name).toBe('picked.png')
  })
})

describe('空闲自动关闭', () => {
  test('空面板 5 秒无指针时自动关闭', async () => {
    vi.useFakeTimers()
    const panel = createPanel()
    panel.openInput()
    expect(panel.showInput.value).toBe(true)

    await vi.advanceTimersByTimeAsync(5000)
    expect(panel.showInput.value).toBe(false)
  })

  test('指针悬停取消空闲关闭', async () => {
    vi.useFakeTimers()
    const panel = createPanel()
    panel.openInput()

    panel.handleInputPanelPointerEnter()
    await vi.advanceTimersByTimeAsync(60000)
    expect(panel.showInput.value).toBe(true)
  })

  test('有草稿内容时不自动关闭', async () => {
    vi.useFakeTimers()
    const panel = createPanel()
    panel.openInput()
    panel.inputText.value = '正在输入'

    panel.handleInputPanelPointerLeave()
    await vi.advanceTimersByTimeAsync(60000)
    expect(panel.showInput.value).toBe(true)
  })
})

describe('handleSendMessage', () => {
  test('无内容时静默返回', async () => {
    const panel = createPanel()

    await panel.handleSendMessage()

    expect(harness.connectionStore.sendMessage).not.toHaveBeenCalled()
  })

  test('未连接时提示错误', async () => {
    const panel = createPanel()
    panel.inputText.value = '你好'

    await panel.handleSendMessage()

    expect(harness.statusCalls).toContainEqual({
      text: 'main.input.notConnected',
      type: 'error'
    })
    expect(harness.connectionStore.sendMessage).not.toHaveBeenCalled()
  })

  test('文本发送成功后保存历史并关闭面板', async () => {
    harness.connectionStore.isConnected = true
    vi.stubGlobal('window', { electron: { history: { saveMessage: harness.saveMessage } } })
    const panel = createPanel()
    panel.inputText.value = '你好'

    await panel.handleSendMessage()

    expect(harness.connectionStore.sendMessage).toHaveBeenCalledWith(
      [{ type: 'text', text: '你好' }],
      expect.objectContaining({ userId: 'user-1', userName: '测试用户' })
    )
    expect(harness.saveMessage).toHaveBeenCalledOnce()
    expect(harness.saveMessage.mock.calls[0][0]).toMatchObject({
      direction: 'outgoing',
      rawText: '你好'
    })
    expect(panel.showInput.value).toBe(false)
    expect(harness.statusCalls).toContainEqual({ text: 'main.input.sent', type: 'success' })
  })

  test('小图片以内联 base64 发送', async () => {
    harness.connectionStore.isConnected = true
    vi.stubGlobal('window', { electron: { history: { saveMessage: harness.saveMessage } } })
    const panel = createPanel()
    panel.applySelectedImage(makeFile('small.png', 100), 'preview-data')

    await panel.handleSendMessage()
    await flushMicrotasks()

    const content = harness.connectionStore.sendMessage.mock.calls[0][0]
    expect(content).toHaveLength(1)
    expect(content[0].type).toBe('image')
    expect(content[0].inline).toContain('base64')
  })

  test('大图片以字节数组发送', async () => {
    harness.connectionStore.isConnected = true
    vi.stubGlobal('window', { electron: { history: { saveMessage: harness.saveMessage } } })
    const panel = createPanel()
    const largeFile = makeFile('large.png', 300 * 1024)
    Object.defineProperty(largeFile, 'arrayBuffer', {
      value: vi.fn(async () => new ArrayBuffer(8))
    })
    panel.applySelectedImage(largeFile, 'preview-data')

    await panel.handleSendMessage()

    const content = harness.connectionStore.sendMessage.mock.calls[0][0]
    expect(content).toHaveLength(1)
    expect(content[0].type).toBe('image')
    expect(content[0].bytes).toBeInstanceOf(Uint8Array)
    expect(content[0].mime).toBe('image/png')
  })

  test('发送失败时提示错误', async () => {
    harness.connectionStore.isConnected = true
    harness.connectionStore.sendMessage.mockResolvedValue({
      success: false,
      error: '服务端拒绝'
    })
    const panel = createPanel()
    panel.inputText.value = '你好'

    await panel.handleSendMessage()

    expect(harness.statusCalls).toContainEqual({
      text: 'main.input.sendingFailed',
      type: 'error'
    })
  })
})

describe('clearImage', () => {
  test('清除选中图片并调度空闲关闭', async () => {
    const panel = createPanel()
    panel.applySelectedImage(makeFile('a.png', 100), 'preview')

    panel.clearImage()
    await nextTick()

    expect(panel.selectedImage.value).toBeNull()
  })
})
