# STT 和 TTS 实现方案

## 一、TTS（文字转语音）实现

### 1.1 远程 TTS（已实现 ✅）

**工作流程：**
```
用户发送消息 → AstrBot 处理 → TTS 插件生成音频 →
通过 perform.show 发送 → 桌面端 MediaPlayer 播放
```

**协议格式：**
```typescript
{
  type: 'tts',
  text: '你好',
  url: 'https://example.com/audio.mp3',  // 或
  rid: 'resource-id',                     // 或
  inline: 'data:audio/mp3;base64,...',   // base64
  volume: 1.0,
  speed: 1.0
}
```

**当前状态：** 已完全实现，MediaPlayer.vue 支持播放所有格式。

### 1.2 本地 TTS（待实现 🔧）

使用浏览器 Web Speech API 在客户端本地合成语音。

**优点：**
- 无需网络请求
- 响应速度快
- 节省服务器资源

**实现位置：** `src/utils/LocalTTS.ts`

**API：**
```typescript
class LocalTTS {
  speak(text: string, options?: {
    lang?: string      // 'zh-CN', 'en-US'
    rate?: number      // 0.1-10，默认 1
    pitch?: number     // 0-2，默认 1
    volume?: number    // 0-1，默认 1
    voice?: string     // 语音名称
  }): Promise<void>

  stop(): void
  getVoices(): SpeechSynthesisVoice[]
}
```

---

## 二、STT（语音转文字）实现

### 2.1 架构设计

```
用户按住录音按钮 → 录制音频 →
上传到服务器 → STT 处理 →
返回文字 → 填充到输入框
```

### 2.2 前端实现

#### 2.2.1 录音组件 `src/components/VoiceRecorder.vue`

**功能：**
- 按住录音，松开发送
- 实时显示录音时长
- 音频波形可视化（可选）
- 取消录音（滑动取消）

**API：**
```typescript
interface VoiceRecorderProps {
  maxDuration?: number  // 最大录音时长（秒），默认 60
  format?: 'wav' | 'webm' | 'mp3'  // 音频格式
}

interface VoiceRecorderEmits {
  (e: 'recorded', blob: Blob, duration: number): void
  (e: 'cancel'): void
  (e: 'error', error: Error): void
}
```

#### 2.2.2 录音工具类 `src/utils/AudioRecorder.ts`

```typescript
class AudioRecorder {
  constructor(options?: {
    sampleRate?: number      // 采样率，默认 16000
    channelCount?: number    // 声道数，默认 1（单声道）
    mimeType?: string        // MIME 类型
  })

  async start(): Promise<void>
  stop(): Promise<Blob>
  cancel(): void
  getState(): 'inactive' | 'recording' | 'paused'
  getDuration(): number  // 毫秒
}
```

### 2.3 后端实现

#### 2.3.1 协议扩展

在 L2D-Bridge Protocol 中添加 STT 操作：

```typescript
// electron/protocol/types.ts
export const OP = {
  // ... 现有操作码

  // STT 相关
  STT_TRANSCRIBE: 'stt.transcribe',      // 请求转录
  STT_RESULT: 'stt.result',              // 转录结果
  STT_ERROR: 'stt.error',                // 转录错误
}

// STT 请求载荷
export interface STTTranscribePayload {
  audio: {
    inline?: string    // base64 编码的音频
    url?: string       // 音频 URL
    rid?: string       // 资源 ID
  }
  format: string       // 音频格式：'wav', 'webm', 'mp3'
  language?: string    // 语言代码：'zh-CN', 'en-US'
}

// STT 结果载荷
export interface STTResultPayload {
  text: string         // 识别的文字
  confidence?: number  // 置信度 0-1
  language?: string    // 检测到的语言
}
```

#### 2.3.2 服务端处理

在 `astrbot-live2d-adapter` 中添加 STT 处理：

**文件：** `adapters/stt_handler.py`

```python
async def handle_stt_transcribe(payload: dict, config: dict) -> dict:
    """处理 STT 转录请求"""
    audio_data = payload.get('audio', {})
    audio_format = payload.get('format', 'wav')
    language = payload.get('language', 'zh-CN')

    # 1. 获取音频数据
    if audio_data.get('inline'):
        # 解码 base64
        audio_bytes = base64.b64decode(audio_data['inline'].split(',')[1])
    elif audio_data.get('url'):
        # 下载音频
        audio_bytes = await download_audio(audio_data['url'])
    elif audio_data.get('rid'):
        # 从资源管理器获取
        audio_bytes = await resource_manager.get(audio_data['rid'])
    else:
        raise ValueError('No audio data provided')

    # 2. 保存临时文件
    temp_path = save_temp_audio(audio_bytes, audio_format)

    # 3. 调用 STT Provider
    stt_provider = get_stt_provider(config)
    text = await stt_provider.get_text(temp_path)

    # 4. 清理临时文件
    os.remove(temp_path)

    return {
        'text': text,
        'language': language
    }
```

### 2.4 UI 集成

#### 2.4.1 在输入面板添加录音按钮

修改 `src/windows/Main.vue`：

```vue
<div class="input-toolbar">
  <n-button text size="small" @click="handleSelectImage">
    <template #icon><span>🖼️</span></template>
  </n-button>
  <n-button text size="small" @click="handlePaste">
    <template #icon><span>📋</span></template>
  </n-button>
  <!-- 新增：录音按钮 -->
  <n-button
    text
    size="small"
    @mousedown="startRecording"
    @mouseup="stopRecording"
    @mouseleave="cancelRecording"
  >
    <template #icon><span>🎤</span></template>
  </n-button>
</div>

<!-- 录音状态提示 -->
<div v-if="isRecording" class="recording-indicator">
  <span class="recording-dot"></span>
  <span>录音中... {{ recordingDuration }}s</span>
</div>
```

#### 2.4.2 录音逻辑

```typescript
const isRecording = ref(false)
const recordingDuration = ref(0)
let audioRecorder: AudioRecorder | null = null
let recordingTimer: NodeJS.Timeout | null = null

async function startRecording() {
  try {
    audioRecorder = new AudioRecorder({
      sampleRate: 16000,
      channelCount: 1
    })

    await audioRecorder.start()
    isRecording.value = true
    recordingDuration.value = 0

    // 更新录音时长
    recordingTimer = setInterval(() => {
      recordingDuration.value = Math.floor(audioRecorder!.getDuration() / 1000)
    }, 100)

  } catch (error: any) {
    message.error(`录音失败: ${error.message}`)
  }
}

async function stopRecording() {
  if (!audioRecorder || !isRecording.value) return

  try {
    const audioBlob = await audioRecorder.stop()
    isRecording.value = false

    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }

    // 发送 STT 请求
    await transcribeAudio(audioBlob)

  } catch (error: any) {
    message.error(`停止录音失败: ${error.message}`)
  }
}

function cancelRecording() {
  if (!audioRecorder || !isRecording.value) return

  audioRecorder.cancel()
  isRecording.value = false

  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
}

async function transcribeAudio(audioBlob: Blob) {
  try {
    message.info('正在识别语音...')

    // 转换为 base64
    const base64 = await blobToBase64(audioBlob)

    // 发送 STT 请求
    const result = await window.electron.bridge.transcribeAudio({
      audio: { inline: base64 },
      format: 'webm',
      language: 'zh-CN'
    })

    if (result.success && result.text) {
      // 填充到输入框
      inputText.value += result.text
      message.success('语音识别成功')
    } else {
      message.error('语音识别失败')
    }

  } catch (error: any) {
    message.error(`语音识别失败: ${error.message}`)
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
```

---

## 三、实现优先级

### Phase 1: 本地 TTS（简单）
1. 创建 `LocalTTS.ts` 工具类
2. 在 MediaPlayer 中集成本地 TTS
3. 在设置页添加 TTS 模式切换（远程/本地）

### Phase 2: STT 基础功能（中等）
1. 创建 `AudioRecorder.ts` 录音工具
2. 在输入面板添加录音按钮
3. 实现录音 UI 和交互

### Phase 3: STT 服务端集成（复杂）
1. 扩展 L2D-Bridge 协议（添加 STT 操作码）
2. 在 Electron 主进程添加 STT 请求处理
3. 在服务端适配器添加 STT 处理逻辑
4. 集成 AstrBot 的 STT Provider

### Phase 4: 优化和增强
1. 音频波形可视化
2. 降噪处理
3. VAD（语音活动检测）
4. 多语言支持
5. 离线 STT（使用 Web Speech API）

---

## 四、技术选型

### 4.1 录音技术

**方案 1: MediaRecorder API（推荐）**
- 浏览器原生支持
- 支持多种格式（webm, mp4）
- 兼容性好（Chrome, Firefox, Edge）

**方案 2: Web Audio API + AudioWorklet**
- 更底层的控制
- 可以实时处理音频（降噪、增益）
- 需要手动编码（WAV, MP3）

### 4.2 STT 技术

**服务端 STT（推荐）：**
- Xinference + Whisper（高精度）
- Azure Speech Services
- Google Cloud Speech-to-Text
- 阿里云语音识别

**客户端 STT（备选）：**
- Web Speech API（Chrome 支持）
- 离线模型（Whisper.cpp + WASM）

### 4.3 TTS 技术

**服务端 TTS（推荐）：**
- Edge TTS（免费，质量好）
- Azure TTS（高质量）
- OpenAI TTS（自然）

**客户端 TTS（备选）：**
- Web Speech API（浏览器原生）
- 离线模型（Piper TTS）

---

## 五、配置示例

### 5.1 桌面端配置

```typescript
// src/stores/settings.ts
interface AudioSettings {
  // TTS 设置
  tts: {
    mode: 'remote' | 'local'           // TTS 模式
    localVoice: string                 // 本地语音名称
    volume: number                     // 音量 0-1
    rate: number                       // 语速 0.1-10
    pitch: number                      // 音调 0-2
  }

  // STT 设置
  stt: {
    enabled: boolean                   // 是否启用 STT
    language: string                   // 语言 'zh-CN', 'en-US'
    maxDuration: number                // 最大录音时长（秒）
    autoSend: boolean                  // 识别后自动发送
  }
}
```

### 5.2 服务端配置

```yaml
# AstrBot 配置
provider_stt_settings:
  enable: true
  provider: "xinference_stt"

provider_tts_settings:
  enable: true
  provider: "edge_tts"
  voice: "zh-CN-XiaoxiaoNeural"
```

---

## 六、测试计划

### 6.1 TTS 测试
- [ ] 远程 TTS 播放（URL）
- [ ] 远程 TTS 播放（base64）
- [ ] 本地 TTS 合成
- [ ] 音量、语速、音调调节
- [ ] 中断和停止

### 6.2 STT 测试
- [ ] 录音功能（按住录音）
- [ ] 取消录音（滑动取消）
- [ ] 音频上传（base64）
- [ ] 语音识别准确性
- [ ] 多语言识别
- [ ] 错误处理

---

## 七、注意事项

1. **权限请求：** 录音需要麦克风权限，需要在首次使用时请求
2. **音频格式：** 不同浏览器支持的格式不同，需要做兼容处理
3. **文件大小：** 长时间录音会产生大文件，需要限制最大时长
4. **网络延迟：** STT 请求可能较慢，需要显示加载状态
5. **隐私保护：** 音频数据敏感，需要安全传输（HTTPS/WSS）
6. **降噪处理：** 环境噪音会影响识别准确率，可以考虑前端降噪
