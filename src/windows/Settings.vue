<template>
  <div class="settings-window">
    <div class="settings-layout">
      <aside class="settings-sidebar">
        <div
          v-for="item in menuItems"
          :key="item.key"
          class="menu-item"
          :class="{ active: activeMenu === item.key }"
          @click="activeMenu = item.key"
        >
          <span class="icon">{{ item.icon }}</span>
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

        <!-- 表演设置 -->
        <div v-if="activeMenu === 'perform'" class="panel">
          <h2>表演设置</h2>
          <n-form label-placement="left" label-width="140">
            <n-form-item label="默认动作组">
              <n-input v-model:value="performSettings.defaultMotionGroup" placeholder="idle" />
            </n-form-item>
            <n-form-item label="文字显示时长">
              <n-input-number v-model:value="performSettings.textDuration" :min="1000" :max="10000" :step="500">
                <template #suffix>毫秒</template>
              </n-input-number>
            </n-form-item>
            <n-form-item label="动作优先级">
              <n-input-number v-model:value="performSettings.motionPriority" :min="0" :max="3" />
            </n-form-item>
            <n-form-item label="自动播放动画">
              <n-switch v-model:value="performSettings.autoPlayMotion" />
            </n-form-item>
            <n-form-item>
              <n-button type="primary" @click="savePerformSettings">
                保存设置
              </n-button>
            </n-form-item>
          </n-form>
        </div>

        <!-- 高级选项 -->
        <div v-if="activeMenu === 'advanced'" class="panel">
          <h2>高级选项</h2>
          <n-form label-placement="left" label-width="140">
            <n-form-item label="窗口置顶">
              <n-switch v-model:value="advancedSettings.alwaysOnTop" @update:value="handleAlwaysOnTopChange" />
            </n-form-item>
            <n-form-item label="鼠标穿透">
              <n-switch v-model:value="advancedSettings.ignoreMouseEvents" @update:value="handleIgnoreMouseChange" />
            </n-form-item>
            <n-form-item label="启动时自动连接">
              <n-switch v-model:value="advancedSettings.autoConnect" />
            </n-form-item>
            <n-form-item label="启动时自动加载模型">
              <n-switch v-model:value="advancedSettings.autoLoadModel" />
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
            <n-form-item>
              <n-alert type="info" :show-icon="false">
                按住快捷键开始录音，松开自动发送。建议使用 Ctrl/Alt/Shift + 字母键组合。
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
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { useConnectionStore } from '@/stores/connection'

const message = useMessage()
const dialog = useDialog()
const connectionStore = useConnectionStore()

const activeMenu = ref('connection')
const serverUrl = ref(connectionStore.serverUrl)
const token = ref(connectionStore.token)
const modelList = ref<Array<{ name: string; path: string }>>([])

// 表演设置
const performSettings = ref({
  defaultMotionGroup: 'idle',
  textDuration: 3000,
  motionPriority: 2,
  autoPlayMotion: true
})

// 高级设置
const advancedSettings = ref({
  alwaysOnTop: false,
  ignoreMouseEvents: false,
  autoConnect: false,
  autoLoadModel: true,
  recordingShortcut: 'Alt+R'
})

const shortcutRegistered = ref(false)

const menuItems = [
  { key: 'connection', icon: '🌐', label: '连接' },
  { key: 'model', icon: '🎭', label: '模型' },
  { key: 'perform', icon: '🎬', label: '表演' },
  { key: 'advanced', icon: '⚙️', label: '高级' }
]

onMounted(() => {
  loadModelList()
  loadSettings()

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
  // 从 localStorage 加载设置
  const savedPerformSettings = localStorage.getItem('performSettings')
  if (savedPerformSettings) {
    performSettings.value = JSON.parse(savedPerformSettings)
  }

  const savedAdvancedSettings = localStorage.getItem('advancedSettings')
  if (savedAdvancedSettings) {
    advancedSettings.value = JSON.parse(savedAdvancedSettings)
  }
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
  const result = await window.electron.model.selectFile()

  if (result.canceled) return

  if (!result.success) {
    message.error(`选择文件失败: ${result.error}`)
    return
  }

  const fileName = result.filePath!.split(/[/\\]/).pop() || 'model'
  const modelName = fileName.replace(/\.(model|model3)\.json$/, '')

  const importResult = await window.electron.model.import(result.filePath!, modelName)

  if (!importResult.success) {
    message.error(`导入模型失败: ${importResult.error}`)
    return
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

function savePerformSettings() {
  localStorage.setItem('performSettings', JSON.stringify(performSettings.value))
  message.success('表演设置已保存')
}

function saveAdvancedSettings() {
  localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings.value))
  message.success('高级设置已保存')
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

// 将 Electron 格式转换为显示格式
function convertToDisplayFormat(shortcut: string): string {
  return shortcut.replace('CommandOrControl', 'Ctrl')
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

async function handleAlwaysOnTopChange(value: boolean) {
  await window.electron.window.setAlwaysOnTop(value)
}

async function handleIgnoreMouseChange(value: boolean) {
  await window.electron.window.setIgnoreMouseEvents(value)
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
      const performSettingsStr = localStorage.getItem('performSettings')
      const advancedSettingsStr = localStorage.getItem('advancedSettings')

      localStorage.clear()

      // 恢复设置
      if (lastModelPath) localStorage.setItem('lastModelPath', lastModelPath)
      if (performSettingsStr) localStorage.setItem('performSettings', performSettingsStr)
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
      performSettings.value = {
        defaultMotionGroup: 'idle',
        textDuration: 3000,
        motionPriority: 2,
        autoPlayMotion: true
      }
      advancedSettings.value = {
        alwaysOnTop: false,
        ignoreMouseEvents: false,
        autoConnect: false,
        autoLoadModel: true,
        recordingShortcut: 'Alt+R'
      }
      message.success('设置已重置')
    }
  })
}
</script>

<style scoped lang="scss">
.settings-window {
  width: 100vw;
  height: 100vh;
  background: var(--color-bg-dark);
  overflow: hidden;
}

.settings-layout {
  display: flex;
  height: 100%;
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

    .icon {
      font-size: 20px;
    }

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
}
</style>
