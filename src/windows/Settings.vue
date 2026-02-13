<template>
  <div class="settings-window">
    <div class="window-header window-drag-region">
      <div class="header-title">
        <Settings :size="16" />
        <span>设置</span>
      </div>
      <button class="window-close-btn window-no-drag" @click="handleClose">
        <X :size="16" />
      </button>
    </div>
    <div class="settings-layout">
      <aside class="settings-sidebar">
        <div
          v-for="item in menuItems"
          :key="item.key"
          class="menu-item"
          :class="{ active: activeMenu === item.key }"
          @click="activeMenu = item.key"
        >
          <component :is="item.icon" :size="20" />
          <span class="label">{{ item.label }}</span>
        </div>
      </aside>

      <main class="settings-content">
        <!-- 连接配置 -->
        <div v-if="activeMenu === 'connection'" class="panel">
          <h2>连接配置</h2>
          <n-form label-placement="left" label-width="120">
            <n-form-item label="服务器地址">
              <n-input v-model:value="serverUrl" placeholder="ws://127.0.0.1:9090/astrbot/live2d" />
            </n-form-item>
            <n-form-item label="认证令牌">
              <n-input v-model:value="token" type="password" placeholder="可选" />
            </n-form-item>
            <n-form-item>
              <n-space>
                <n-button type="primary" @click="handleConnect" :disabled="connectionStore.isConnected">
                  {{ connectionStore.isConnected ? '已连接' : '连接' }}
                </n-button>
                <n-button @click="handleDisconnect" :disabled="!connectionStore.isConnected">
                  断开连接
                </n-button>
                <n-tag :type="connectionStore.isConnected ? 'success' : 'default'">
                  {{ connectionStore.isConnected ? '● 已连接' : '○ 未连接' }}
                </n-tag>
              </n-space>
            </n-form-item>
          </n-form>
        </div>

        <!-- 模型管理 -->
        <div v-if="activeMenu === 'model'" class="panel">
          <h2>模型管理</h2>
          <n-space vertical :size="16">
            <n-button type="primary" @click="handleImportModel">
              导入模型
            </n-button>
            <n-list bordered v-if="modelList.length > 0">
              <n-list-item v-for="model in modelList" :key="model.name">
                <n-thing :title="model.name" :description="model.path">
                  <template #header-extra>
                    <n-space>
                      <n-button size="small" @click="handleLoadModel(model.path)">加载</n-button>
                      <n-button size="small" type="error" @click="handleDeleteModel(model.name)">删除</n-button>
                    </n-space>
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
            <n-empty v-else description="暂无模型" />
          </n-space>
        </div>

        <!-- 高级选项 -->
        <div v-if="activeMenu === 'advanced'" class="panel">
          <h2>高级选项</h2>
          <n-form label-placement="left" label-width="140">
            <n-form-item label="启动时自动连接">
              <n-switch v-model:value="advancedSettings.autoConnect" />
            </n-form-item>
            <n-form-item label="基础事件弹窗提示">
              <n-switch v-model:value="advancedSettings.showBaseEventNotifications" />
            </n-form-item>
            <n-form-item label="全局录音快捷键">
              <n-space>
                <n-input
                  v-model:value="advancedSettings.recordingShortcut"
                  placeholder="按下快捷键..."
                  readonly
                  @keydown="handleShortcutKeyDown"
                  style="width: 200px"
                />
                <n-button @click="handleClearShortcut">清除</n-button>
                <n-button type="primary" @click="handleRegisterShortcut">
                  {{ shortcutRegistered ? '已注册' : '注册' }}
                </n-button>
              </n-space>
            </n-form-item>
            <n-form-item label="语音唤醒">
              <n-switch
                :value="advancedSettings.wakeWordEnabled"
                @update:value="handleWakeWordSwitchChange"
              />
            </n-form-item>
            <n-form-item label="唤醒关键词">
              <n-dynamic-tags
                v-model:value="advancedSettings.wakeKeywords"
                :disabled="!advancedSettings.wakeWordEnabled"
                :max="10"
              />
            </n-form-item>
            <n-form-item label="最长录音时长">
              <n-space align="center">
                <n-input-number
                  v-model:value="recordingSecondsValue"
                  :min="1"
                  :max="60"
                  :precision="0"
                  :disabled="!advancedSettings.wakeWordEnabled"
                />
                <span>秒（上限 60 秒）</span>
              </n-space>
            </n-form-item>
            <n-form-item>
              <n-alert type="warning" :show-icon="false">
                全局快捷键用于手动录音；语音唤醒会持续监听麦克风并检测关键词，命中后自动录音并在静音或达到时长后发送。
                启用时会申请麦克风权限，请仅在可信环境使用；该功能每次重启默认关闭，需重新手动开启。
                关闭「基础事件弹窗提示」后，将不再显示模型上方的连接/发送成功等提示（错误/警告提示仍会保留）。
              </n-alert>
            </n-form-item>
            <n-form-item>
              <n-button type="primary" @click="saveAdvancedSettings">
                保存设置
              </n-button>
            </n-form-item>
          </n-form>

          <n-divider />

          <n-space vertical>
            <h3>数据管理</h3>
            <n-space>
              <n-button @click="handleClearCache">
                清除缓存
              </n-button>
              <n-button type="error" @click="handleResetSettings">
                重置所有设置
              </n-button>
            </n-space>
          </n-space>
        </div>

        <!-- 关于 -->
        <div v-if="activeMenu === 'about'" class="panel">
          <h2>关于</h2>
          <n-card>
            <n-space vertical :size="24">
              <div class="about-section">
                <h3>AstrBot Live2D Desktop</h3>
                <p>版本：<strong>v{{ appVersion }}</strong></p>
                <p>一个用于 AstrBot 的 Live2D 桌面客户端，支持模型展示、交互、语音对话等功能。</p>
                <p>作者：<strong>lxfight</strong></p>
              </div>

              <n-divider />

              <div class="about-section">
                <h3>相关项目</h3>
                <n-space vertical>
                  <n-button text tag="a" @click="handleOpenLink('https://github.com/AstrBotDevs/AstrBot')">
                    AstrBot (Github)
                  </n-button>
                  <n-button text tag="a" @click="handleOpenLink('https://github.com/lxfight/astrbot-live2d-desktop')">
                    本项目仓库 (Github)
                  </n-button>
                </n-space>
              </div>

              <n-divider />

              <div class="about-section">
                <h3>版权声明</h3>
                <p class="copyright-text">
                  本软件使用 Live2D Cubism SDK。<br>
                  Live2D 是 Live2D Inc. 的注册商标。<br>
                  This application uses Live2D Cubism SDK. Live2D is a registered trademark of Live2D Inc.
                </p>
              </div>
            </n-space>
          </n-card>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { useConnectionStore } from '@/stores/connection'
import { Globe, Drama, Settings, X, Info } from 'lucide-vue-next'
import {
  DEFAULT_ADVANCED_SETTINGS,
  clampMaxRecordingSeconds,
  loadAdvancedSettings,
  normalizeAdvancedSettings,
  saveAdvancedSettings as persistAdvancedSettings
} from '@/utils/advancedSettings'

const message = useMessage()
const dialog = useDialog()
const connectionStore = useConnectionStore()

const activeMenu = ref('connection')
const serverUrl = ref(connectionStore.serverUrl)
const token = ref(connectionStore.token)
const modelList = ref<Array<{ name: string; path: string }>>([])
const appVersion = ref('')

// 高级设置
const advancedSettings = ref({
  ...DEFAULT_ADVANCED_SETTINGS,
  wakeKeywords: [...DEFAULT_ADVANCED_SETTINGS.wakeKeywords]
})

const recordingSecondsValue = computed({
  get: () => advancedSettings.value.maxRecordingSeconds,
  set: (value: number | null) => {
    advancedSettings.value.maxRecordingSeconds = clampMaxRecordingSeconds(
      value ?? DEFAULT_ADVANCED_SETTINGS.maxRecordingSeconds
    )
  }
})

const shortcutRegistered = ref(false)
const WAKE_WORD_SECURITY_NOTICE = '启用后会持续监听麦克风，可能采集到周围对话内容，请确认使用环境安全。'

const menuItems = [
  { key: 'connection', icon: Globe, label: '连接' },
  { key: 'model', icon: Drama, label: '模型' },
  { key: 'advanced', icon: Settings, label: '高级' },
  { key: 'about', icon: Info, label: '关于' }
]

onMounted(async () => {
  loadModelList()
  loadSettings()
  
  // 获取应用版本
  appVersion.value = await window.electron.window.getAppVersion()

  // 检查快捷键是否已注册
  checkShortcutRegistration()

  // 监听连接状态变化
  window.electron.bridge.onConnected((payload: any) => {
    connectionStore.isConnected = true
    if (payload.sessionId) {
      connectionStore.sessionId = payload.sessionId
    }
    if (payload.userId) {
      connectionStore.userId = payload.userId
    }
  })

  window.electron.bridge.onDisconnected(() => {
    connectionStore.isConnected = false
    connectionStore.sessionId = ''
    connectionStore.userId = ''
  })

  // 检查初始连接状态
  connectionStore.checkConnection()
})

async function checkShortcutRegistration() {
  if (advancedSettings.value.recordingShortcut) {
    // 转换为 Electron 格式检查
    const electronFormat = convertToElectronFormat(advancedSettings.value.recordingShortcut)
    const registered = await window.electron.shortcut.isRegistered(electronFormat)
    shortcutRegistered.value = registered
  }
}

function loadSettings() {
  advancedSettings.value = loadAdvancedSettings()
}

async function loadModelList() {
  const result = await window.electron.model.getList()
  if (result.success && result.models) {
    modelList.value = result.models
  }
}

async function handleConnect() {
  const result = await connectionStore.connect(serverUrl.value, token.value)
  if (result.success) {
    message.success('连接成功')
  } else {
    message.error(`连接失败: ${result.error}`)
  }
}

async function handleDisconnect() {
  const result = await connectionStore.disconnect()
  if (result.success) {
    message.success('已断开连接')
  } else {
    message.error(`断开失败: ${result.error}`)
  }
}

async function handleImportModel() {
  const result = await window.electron.model.selectFolder()

  if (result.canceled) return

  if (!result.success) {
    message.error(`选择文件夹失败: ${result.error}`)
    return
  }

  const folderName = result.folderPath!.split(/[/\\]/).pop() || 'model'
  const modelName = folderName

  const importResult = await window.electron.model.import(result.folderPath!, modelName)

  if (!importResult.success) {
    message.error(`导入模型失败: ${importResult.error}`)
    return
  }

  if (importResult.modelFiles && importResult.modelFiles.length > 1 && importResult.chosenFile) {
    message.info(`检测到多个模型文件，已自动选择：${importResult.chosenFile}`)
  }

  message.success('模型导入成功')
  loadModelList()
}

async function handleLoadModel(modelPath: string) {
  await window.electron.model.load(modelPath)
  message.success('模型加载指令已发送')
}

async function handleDeleteModel(modelName: string) {
  const result = await window.electron.model.delete(modelName)
  if (result.success) {
    message.success('模型已删除')
    loadModelList()
  } else {
    message.error(`删除失败: ${result.error}`)
  }
}

function saveAdvancedSettings() {
  advancedSettings.value = persistAdvancedSettings(advancedSettings.value)
  message.success('高级设置已保存')
}

async function requestWakeWordMicrophonePermission(): Promise<boolean> {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    message.warning('当前环境不支持麦克风权限请求')
    return false
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch (error) {
    console.warn('[设置] 麦克风权限申请失败:', error)
    return false
  }
}

function handleWakeWordSwitchChange(enabled: boolean) {
  if (!enabled) {
    advancedSettings.value.wakeWordEnabled = false
    return
  }

  dialog.warning({
    title: '语音唤醒安全提示',
    content: `${WAKE_WORD_SECURITY_NOTICE} 该功能每次重启默认关闭，开启时会再次申请麦克风权限。`,
    positiveText: '我已了解并开启',
    negativeText: '取消',
    onPositiveClick: async () => {
      const granted = await requestWakeWordMicrophonePermission()
      if (!granted) {
        advancedSettings.value.wakeWordEnabled = false
        message.warning('未授予麦克风权限，语音唤醒未开启')
        return
      }

      advancedSettings.value.wakeWordEnabled = true
      message.success('语音唤醒已开启，请记得点击“保存设置”')
    },
    onNegativeClick: () => {
      advancedSettings.value.wakeWordEnabled = false
    }
  })
}

// 处理快捷键输入
function handleShortcutKeyDown(event: KeyboardEvent) {
  event.preventDefault()

  const keys: string[] = []

  // 修饰键（使用常见缩写）
  if (event.ctrlKey || event.metaKey) keys.push('Ctrl')
  if (event.altKey) keys.push('Alt')
  if (event.shiftKey) keys.push('Shift')

  // 主键
  const key = event.key.toUpperCase()
  if (key.length === 1 && /[A-Z0-9]/.test(key)) {
    keys.push(key)
  } else if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(event.key)) {
    keys.push(event.key)
  }

  if (keys.length > 1) {
    advancedSettings.value.recordingShortcut = keys.join('+')
    shortcutRegistered.value = false
  }
}

// 将显示格式转换为 Electron 格式
function convertToElectronFormat(shortcut: string): string {
  return shortcut.replace('Ctrl', 'CommandOrControl')
}



// 清除快捷键
async function handleClearShortcut() {
  await window.electron.shortcut.unregister()
  advancedSettings.value.recordingShortcut = ''
  shortcutRegistered.value = false
  message.success('快捷键已清除')
}

// 注册快捷键
async function handleRegisterShortcut() {
  if (!advancedSettings.value.recordingShortcut) {
    message.warning('请先设置快捷键')
    return
  }

  // 转换为 Electron 格式
  const electronFormat = convertToElectronFormat(advancedSettings.value.recordingShortcut)
  const result = await window.electron.shortcut.register(electronFormat)

  if (result.success) {
    shortcutRegistered.value = true
    message.success('快捷键注册成功')
    // 保存设置
    saveAdvancedSettings()
  } else {
    message.error(`注册失败: ${result.error}`)
  }
}

function handleClearCache() {
  dialog.warning({
    title: '清除缓存',
    content: '确定要清除所有缓存数据吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      // 清除 localStorage 中的缓存数据（保留设置）
      const lastModelPath = localStorage.getItem('lastModelPath')
      const advancedSettingsStr = localStorage.getItem('advancedSettings')

      localStorage.clear()

      // 恢复设置
      if (lastModelPath) localStorage.setItem('lastModelPath', lastModelPath)
      if (advancedSettingsStr) localStorage.setItem('advancedSettings', advancedSettingsStr)

      message.success('缓存已清除')
    }
  })
}

function handleResetSettings() {
  dialog.error({
    title: '重置设置',
    content: '确定要重置所有设置吗？此操作不可恢复！',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      localStorage.clear()
      advancedSettings.value = normalizeAdvancedSettings(DEFAULT_ADVANCED_SETTINGS)
      persistAdvancedSettings(advancedSettings.value)
      shortcutRegistered.value = false
      message.success('设置已重置')
    }
  })
}

function handleClose() {
  window.electron.window.closeSettings()
}

function handleOpenLink(url: string) {
  (window.electron.window as any).openExternal(url)
}
</script>

<style scoped lang="scss">
.settings-window {
  width: 100vw;
  height: 100vh;
  background: var(--color-bg-dark);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.window-header {
  height: 32px;
  background: var(--color-bg-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .window-close-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary);
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 77, 79, 0.1);
      color: var(--color-error);
    }
  }
}

.settings-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-sidebar {
  width: 200px;
  background: var(--color-bg-light);
  padding: var(--spacing-md);
  border-right: 1px solid var(--color-border);

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s;

    .label {
      font-size: 14px;
    }

    &:hover {
      background: rgba(100, 108, 255, 0.1);
    }

    &.active {
      background: rgba(100, 108, 255, 0.2);
      color: var(--color-accent);
    }
  }
}

.settings-content {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;

  .panel {
    max-width: 800px;

    h2 {
      margin-bottom: var(--spacing-md);
      font-size: 20px;
      font-weight: 600;
    }

    h3 {
      margin-bottom: var(--spacing-sm);
      font-size: 16px;
      font-weight: 600;
    }
  }

  .about-section {
    h3 {
      margin-bottom: 12px;
      color: var(--color-text-primary);
    }
    
    p {
      color: var(--color-text-secondary);
      line-height: 1.6;
    }

    .copyright-text {
      font-size: 12px;
      opacity: 0.8;
    }
  }
}
</style>
