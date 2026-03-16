<template>
  <div class="settings-window">
    <header class="settings-titlebar window-drag-region" @dblclick="handleTitleBarDoubleClick">
      <div class="settings-titlebar__brand">
        <span class="settings-titlebar__identity">
          <span class="settings-theme-swatch settings-theme-swatch--title" :style="themeDotStyle"></span>
          <span class="settings-titlebar__name">AstrBot Live2D Desktop</span>
        </span>
        <span class="settings-titlebar__divider"></span>
        <span class="settings-titlebar__model">{{ currentModelDisplay }}</span>
      </div>

      <div class="settings-titlebar__actions window-no-drag">
        <button class="settings-titlebar__button" type="button" aria-label="最小化" @click="handleMinimizeWindow">
          <Minus :size="16" />
        </button>
        <button
          class="settings-titlebar__button"
          type="button"
          :aria-label="isWindowMaximized ? '还原' : '最大化'"
          @click="handleToggleWindowMaximize"
        >
          <component :is="isWindowMaximized ? Copy : Square" :size="14" />
        </button>
        <button
          class="settings-titlebar__button settings-titlebar__button--close"
          type="button"
          aria-label="关闭"
          @click="handleCloseWindow"
        >
          <X :size="16" />
        </button>
      </div>
    </header>

    <div class="settings-workspace">
      <aside class="settings-sidebar">
        <div class="settings-sidebar__section settings-sidebar__section--brand">
          <div class="settings-sidebar__brand">
            <strong>AstrBot Live2D Desktop</strong>
            <span v-if="appVersion" class="settings-sidebar__version">v{{ appVersion }}</span>
          </div>

          <div class="settings-sidebar__status">
            <span class="status-pill" :class="isConnected ? 'status-pill--success' : 'status-pill--warning'">
              {{ isConnected ? '已连接' : '未连接' }}
            </span>
            <span class="settings-theme-chip">
              <span class="settings-theme-swatch" :style="themeDotStyle"></span>
              <span>{{ sourceColor.toUpperCase() }}</span>
            </span>
          </div>
        </div>

        <div class="settings-sidebar__section settings-sidebar__section--model">
          <span class="settings-sidebar__label">当前模型</span>
          <strong class="settings-sidebar__model-name">{{ currentModelDisplay }}</strong>
          <span class="settings-sidebar__platform">{{ platformDisplayName }}</span>
          <code v-if="currentModelPath" class="settings-inline-path">{{ currentModelPath }}</code>
          <span v-else class="settings-sidebar__empty">主窗口尚未加载模型</span>
        </div>

        <nav class="settings-nav">
          <button
            v-for="item in menuItems"
            :key="item.key"
            class="settings-nav__item"
            :class="{ 'settings-nav__item--active': activeMenu === item.key }"
            type="button"
            @click="activeMenu = item.key"
          >
            <component :is="item.icon" :size="18" />
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <div class="settings-sidebar__meta">
          <span>{{ isConnected ? 'Bridge 已连接' : 'Bridge 未连接' }}</span>
          <span>主题色 {{ sourceColor.toUpperCase() }}</span>
        </div>
      </aside>

      <main class="settings-main">
      <template v-if="activeMenu === 'connection'">
        <div class="settings-panel-grid">
          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <h2>Bridge 连接</h2>
              <span class="status-pill" :class="isConnected ? 'status-pill--success' : 'status-pill--warning'">
                {{ isConnected ? '已连接' : '未连接' }}
              </span>
            </div>

            <n-form label-placement="top">
              <n-form-item label="服务器地址">
                <n-input
                  v-model:value="serverUrl"
                  placeholder="ws://127.0.0.1:9090/astrbot/live2d"
                />
              </n-form-item>
              <n-form-item label="认证令牌">
                <n-input
                  v-model:value="token"
                  type="password"
                  show-password-on="click"
                  placeholder="必填，需与 AstrBot 适配器 auth_token 一致"
                />
              </n-form-item>
            </n-form>

            <div class="settings-card__actions">
              <n-button type="primary" @click="handleConnect" :disabled="isConnected || !token.trim()">
                {{ isConnected ? '已连接' : '连接服务器' }}
              </n-button>
              <n-button @click="handleDisconnect" :disabled="!isConnected">
                断开连接
              </n-button>
            </div>
          </section>

          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <h2>工作区状态</h2>
            </div>

            <div class="settings-summary-list">
              <div class="settings-summary-row">
                <span>状态</span>
                <strong>{{ isConnected ? '在线' : '离线' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>用户 ID</span>
                <strong>{{ connectionStore.userId || '尚未分配' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>会话 ID</span>
                <strong>{{ connectionStore.sessionId || '尚未建立' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>资源地址</span>
                <strong>{{ connectionStore.resourceBaseUrl || '自动跟随连接地址' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>资源路径</span>
                <strong>{{ connectionStore.resourcePath || '/resources' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>当前模型</span>
                <strong>{{ currentModelDisplay }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>主题色</span>
                <strong>{{ sourceColor.toUpperCase() }}</strong>
              </div>
            </div>
          </section>

          <section class="panel-card settings-card settings-card--span-2">
            <div class="settings-card__header">
              <h2>资源服务</h2>
            </div>

            <n-alert type="info" :show-icon="false">
              默认情况下，图片、音频、视频和文件资源会自动复用与 WebSocket 相同的服务地址、端口和认证令牌。
            </n-alert>

            <n-form label-placement="top" class="settings-form-grid">
              <n-form-item label="资源服务地址">
                <n-input
                  v-model:value="resourceServerUrl"
                  placeholder="留空时自动跟随连接地址"
                />
              </n-form-item>
              <n-form-item label="资源路径">
                <n-input
                  v-model:value="resourceServerPath"
                  placeholder="默认沿用握手路径或 /resources"
                />
              </n-form-item>
              <n-form-item label="资源访问令牌">
                <n-input
                  v-model:value="resourceAccessToken"
                  type="password"
                  show-password-on="click"
                  placeholder="留空时复用 WebSocket 认证令牌"
                />
              </n-form-item>
            </n-form>
          </section>
        </div>
      </template>

      <template v-else-if="activeMenu === 'model'">
        <div class="settings-panel-grid">
          <section class="panel-card settings-card current-model-card">
            <div class="settings-card__header">
              <h2>当前使用模型</h2>
              <span class="status-pill" :class="currentModelStatusClass">
                {{ currentModelStatusLabel }}
              </span>
            </div>

            <template v-if="currentModelPath">
              <div class="current-model-card__body">
                <div class="current-model-card__preview" :style="themeSwatchStyle">
                  <span>{{ currentModelInitial }}</span>
                </div>
                <div class="current-model-card__meta">
                  <strong>{{ currentModelDisplay }}</strong>
                  <span>{{ sourceColor.toUpperCase() }}</span>
                  <code class="settings-inline-path">{{ currentModelPath }}</code>
                </div>
              </div>
            </template>
            <n-empty v-else description="当前未加载模型" />
          </section>

          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <h2>模型状态</h2>
              <n-button type="primary" @click="handleImportModel">导入模型</n-button>
            </div>

            <div class="settings-summary-list">
              <div class="settings-summary-row">
                <span>模型总数</span>
                <strong>{{ modelList.length }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>已选模型</span>
                <strong>{{ currentModelDisplay }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>主题同步</span>
                <strong>{{ currentModelPath ? '跟随当前模型' : '等待模型加载' }}</strong>
              </div>
            </div>
          </section>

          <section class="panel-card settings-card settings-card--span-2">
            <div class="settings-card__header">
              <h2>模型库</h2>
            </div>

            <div v-if="modelList.length > 0" class="model-grid">
              <article
                v-for="model in modelList"
                :key="model.name"
                class="model-card"
                :class="{ 'model-card--active': currentModelPath === model.path }"
              >
                <div class="model-card__top">
                  <div class="model-card__preview" :style="getModelPreviewStyle(model.path)">
                    <span>{{ model.name.slice(0, 1).toUpperCase() }}</span>
                  </div>
                  <span v-if="currentModelPath === model.path" class="model-card__badge">当前使用</span>
                </div>
                <div class="model-card__body">
                  <strong>{{ model.name }}</strong>
                  <p>{{ model.path }}</p>
                </div>
                <div class="model-card__actions">
                  <n-button size="small" type="primary" @click="handleLoadModel(model.path)">
                    {{ currentModelPath === model.path ? '重新加载' : '加载' }}
                  </n-button>
                  <n-button size="small" tertiary type="error" @click="handleDeleteModel(model.name)">删除</n-button>
                </div>
              </article>
            </div>
            <n-empty v-else description="暂无模型" />
          </section>
        </div>
      </template>

      <template v-else-if="activeMenu === 'advanced'">
        <div class="settings-panel-grid">
          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <h2>行为配置</h2>
            </div>

            <n-form label-placement="top">
              <n-form-item label="启动时自动连接">
                <n-switch v-model:value="advancedSettings.autoConnect" />
              </n-form-item>
              <n-form-item label="基础事件弹窗提示">
                <n-switch v-model:value="advancedSettings.showBaseEventNotifications" />
              </n-form-item>
              <n-form-item label="日志级别">
                <n-radio-group v-model:value="advancedSettings.logLevel">
                  <n-space>
                    <n-radio-button value="info">Info（默认）</n-radio-button>
                    <n-radio-button value="debug">Debug（调试）</n-radio-button>
                  </n-space>
                </n-radio-group>
              </n-form-item>
              <n-form-item label="全局录音快捷键">
                <div class="shortcut-row">
                  <n-input
                    v-model:value="advancedSettings.recordingShortcut"
                    placeholder="按下快捷键..."
                    readonly
                    @keydown="handleShortcutKeyDown"
                  />
                  <n-button @click="handleClearShortcut">清除</n-button>
                  <n-button type="primary" @click="handleRegisterShortcut">
                    {{ shortcutRegistered ? '已注册' : '注册' }}
                  </n-button>
                </div>
              </n-form-item>
              <n-form-item label="最长录音时长">
                <n-space align="center">
                  <n-input-number
                    v-model:value="recordingSecondsValue"
                    :min="1"
                    :max="60"
                    :precision="0"
                  />
                  <span>秒（上限 60 秒）</span>
                </n-space>
              </n-form-item>
            </n-form>

            <n-alert type="warning" :show-icon="false">
              全局快捷键用于手动录音；语音唤醒功能已暂时移除。关闭基础事件提示后，不再显示连接成功等常规提示，但错误提示仍会保留。
            </n-alert>

            <div class="settings-card__actions">
              <n-button type="primary" @click="saveAdvancedSettings">保存设置</n-button>
            </div>
          </section>

          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <h2>平台能力</h2>
            </div>

            <div class="settings-summary-list">
              <div class="settings-summary-row">
                <span>当前平台</span>
                <strong>{{ platformDisplayName }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>自动检测全屏应用</span>
                <strong>{{ gameModeCapabilityLabel }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>动态穿透</span>
                <strong>{{ passThroughCapabilityLabel }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>置顶层级策略</span>
                <strong>{{ alwaysOnTopLevelLabel }}</strong>
              </div>
            </div>

            <n-alert v-if="platformCompatibilityNotice" :type="platformCompatibilityNotice.type" :show-icon="false">
              {{ platformCompatibilityNotice.text }}
            </n-alert>
          </section>

          <section class="panel-card settings-card settings-card--span-2">
            <div class="settings-card__header">
              <h2>数据管理</h2>
            </div>

            <div class="settings-card__actions">
              <n-button @click="handleOpenLogs">打开日志目录</n-button>
              <n-button @click="handleClearCache">清除缓存</n-button>
              <n-button type="error" @click="handleResetSettings">重置所有设置</n-button>
            </div>
          </section>
        </div>
      </template>

      <template v-else>
        <div class="settings-panel-grid">
          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <h2>AstrBot Live2D Desktop</h2>
            </div>

            <div class="settings-summary-list">
              <div class="settings-summary-row">
                <span>版本</span>
                <strong>v{{ appVersion }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>更新状态</span>
                <strong>{{ updateStatusLabel }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>作者</span>
                <strong>lxfight</strong>
              </div>
            </div>

            <div class="settings-card__actions">
              <n-button :loading="checkingUpdate" @click="handleCheckUpdates">检查更新</n-button>
              <n-button v-if="canInstallUpdate" type="primary" @click="handleInstallUpdate">重启并安装</n-button>
            </div>
          </section>

          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <h2>相关项目</h2>
            </div>

            <div class="link-stack">
              <button class="ghost-button" type="button" @click="handleOpenLink('https://github.com/AstrBotDevs/AstrBot')">
                AstrBot
              </button>
              <button class="ghost-button" type="button" @click="handleOpenLink('https://github.com/lxfight/astrbot-live2d-desktop')">
                本项目仓库
              </button>
              <button class="ghost-button" type="button" @click="handleOpenLink('https://github.com/lxfight/astrbot_plugin_live2d_adapter')">
                平台适配器插件
              </button>
            </div>
          </section>

          <section class="panel-card settings-card settings-card--span-2">
            <div class="settings-card__header">
              <h2>版权声明</h2>
            </div>
            <div class="settings-card__note">
              本软件使用 Live2D Cubism SDK。Live2D 是 Live2D Inc. 的注册商标。
            </div>
          </section>
        </div>
      </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDialog, useMessage } from 'naive-ui'
import { Copy, Drama, Globe, Info, Minus, Settings, Square, X } from 'lucide-vue-next'
import { useConnectionStore } from '@/stores/connection'
import { useThemeStore } from '@/stores/theme'
import {
  DEFAULT_ADVANCED_SETTINGS,
  clampMaxRecordingSeconds,
  loadAdvancedSettings,
  normalizeAdvancedSettings,
  saveAdvancedSettings as persistAdvancedSettings,
} from '@/utils/advancedSettings'

const message = useMessage()
const dialog = useDialog()
const connectionStore = useConnectionStore()
const themeStore = useThemeStore()
const { currentModelPath, resolvedModelName, palette, sourceColor } = storeToRefs(themeStore)
const { isConnected } = storeToRefs(connectionStore)

const activeMenu = ref('connection')
const serverUrl = ref(connectionStore.serverUrl)
const token = ref(connectionStore.token)
const resourceServerUrl = ref(connectionStore.customResourceBaseUrl)
const resourceServerPath = ref(connectionStore.customResourcePath)
const resourceAccessToken = ref(connectionStore.customResourceToken)
const modelList = ref<Array<{ name: string; path: string }>>([])
const appVersion = ref('')
const platformCapabilities = ref<PlatformCapabilities | null>(null)
const updateState = ref<UpdateState | null>(null)
const checkingUpdate = ref(false)
const advancedSettings = ref({
  ...DEFAULT_ADVANCED_SETTINGS,
})
const shortcutRegistered = ref(false)
const isWindowMaximized = ref(false)

const menuItems = [
  { key: 'connection', icon: Globe, label: '连接' },
  { key: 'model', icon: Drama, label: '模型' },
  { key: 'advanced', icon: Settings, label: '高级' },
  { key: 'about', icon: Info, label: '关于' },
]

const recordingSecondsValue = computed({
  get: () => advancedSettings.value.maxRecordingSeconds,
  set: (value: number | null) => {
    advancedSettings.value.maxRecordingSeconds = clampMaxRecordingSeconds(
      value ?? DEFAULT_ADVANCED_SETTINGS.maxRecordingSeconds,
    )
  },
})

const themeSwatchStyle = computed(() => ({
  background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
  boxShadow: `0 12px 24px ${palette.value.shadowColor}`,
}))

const themeDotStyle = computed(() => ({
  background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
  boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.16), 0 0 14px ${palette.value.shadowColor}`,
}))

const inactiveModelSwatchStyle = computed(() => ({
  background: 'linear-gradient(135deg, rgba(var(--color-accent-rgb), 0.18), rgba(255, 255, 255, 0.04))',
  boxShadow: 'none',
}))

const currentModelDisplay = computed(() => resolvedModelName.value || '尚未加载模型')
const currentModelInitial = computed(() => (currentModelDisplay.value || 'A').slice(0, 1).toUpperCase())
const currentModelStatusLabel = computed(() => (currentModelPath.value ? '使用中' : '未加载'))
const currentModelStatusClass = computed(() => (
  currentModelPath.value ? 'status-pill--accent' : 'status-pill--warning'
))

const platformDisplayName = computed(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return '未知'

  if (capabilities.platform === 'win32') return 'Windows'
  if (capabilities.platform === 'darwin') return 'macOS'
  if (capabilities.platform === 'linux') {
    return capabilities.linuxSessionType === 'n/a'
      ? 'Linux'
      : `Linux (${capabilities.linuxSessionType})`
  }

  return capabilities.platform
})

const gameModeCapabilityLabel = computed(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return '未知'
  if (!capabilities.gameMode.supported) {
    return `不可用（${capabilities.gameMode.reason || '当前平台暂不支持'}）`
  }

  return capabilities.gameMode.mode === 'native-window-manager'
    ? '可用（原生窗口管理器）'
    : '可用（活跃窗口启发式）'
})

const passThroughCapabilityLabel = computed(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return '未知'
  return capabilities.mousePassthroughForward
    ? '支持完整动态穿透'
    : '仅基础穿透，不启用动态转发'
})

const alwaysOnTopLevelLabel = computed(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return '未知'
  return capabilities.alwaysOnTopLevel === 'screen-saver' ? 'screen-saver' : 'default'
})

const platformCompatibilityNotice = computed<null | { type: 'info' | 'warning'; text: string }>(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return null

  if (capabilities.platform === 'linux') {
    if (capabilities.linuxSessionType === 'wayland') {
      return {
        type: 'warning',
        text: 'Wayland 会话下将关闭动态穿透，并禁用自动检测全屏应用；建议在支持 X11 的环境中使用以获得更完整体验。',
      }
    }

    return {
      type: 'info',
      text: 'Linux 会话下动态穿透会降级为基础穿透，自动更新需通过 Releases 手动下载。',
    }
  }

  if (capabilities.platform === 'win32' && !capabilities.gameMode.supported) {
    return {
      type: 'info',
      text: `当前 Windows 平台已关闭自动检测全屏应用：${capabilities.gameMode.reason || '能力不可用'}`,
    }
  }

  return null
})

const updateStatusLabel = computed(() => {
  if (!updateState.value) {
    return '更新状态未知'
  }

  if (updateState.value.status === 'downloading' && typeof updateState.value.progress === 'number') {
    return `${updateState.value.message}（${Math.round(updateState.value.progress)}%）`
  }

  return updateState.value.message
})

const canInstallUpdate = computed(() => updateState.value?.status === 'downloaded')

watch([serverUrl, token], ([nextUrl, nextToken]) => {
  connectionStore.setConnectionConfig(nextUrl, nextToken)
})

watch([resourceServerUrl, resourceServerPath, resourceAccessToken], ([nextUrl, nextPath, nextToken]) => {
  connectionStore.setResourceConfig(nextUrl, nextPath, nextToken)
})

onMounted(async () => {
  await loadModelList()
  loadSettings()
  themeStore.syncFromStorage()

  try {
    isWindowMaximized.value = await window.electron.window.isMaximizedCurrent()
  } catch {
    isWindowMaximized.value = false
  }

  try {
    platformCapabilities.value = await window.electron.window.getPlatformCapabilities()
  } catch {
    platformCapabilities.value = null
  }

  appVersion.value = await window.electron.window.getAppVersion()

  try {
    updateState.value = await window.electron.update.getState()
  } catch {
    updateState.value = null
  }

  window.electron.update.onStateChanged((state: UpdateState) => {
    updateState.value = state
  })

  window.electron.window.onMaximizedChanged((maximized: boolean) => {
    isWindowMaximized.value = maximized
  })

  await checkShortcutRegistration()

  window.electron.bridge.onConnected((payload: any) => {
    connectionStore.isConnected = true
    connectionStore.applySessionState(payload)
  })

  window.electron.bridge.onDisconnected(() => {
    connectionStore.resetSessionState()
  })

  await connectionStore.checkConnection()
})

async function checkShortcutRegistration() {
  if (!advancedSettings.value.recordingShortcut) {
    shortcutRegistered.value = false
    return
  }

  const electronFormat = convertToElectronFormat(advancedSettings.value.recordingShortcut)
  shortcutRegistered.value = await window.electron.shortcut.isRegistered(electronFormat)
}

async function applyLogLevelSetting(level: 'info' | 'debug') {
  try {
    await window.electron.log.setLevel(level)
  } catch (error) {
    console.warn('[设置] 应用日志级别失败:', error)
  }
}

function loadSettings() {
  advancedSettings.value = loadAdvancedSettings()
  void applyLogLevelSetting(advancedSettings.value.logLevel)
}

async function loadModelList() {
  const result = await window.electron.model.getList()
  if (result.success && result.models) {
    modelList.value = result.models
  }
}

async function handleConnect() {
  const targetUrl = serverUrl.value.trim()
  const authToken = token.value.trim()

  if (!authToken) {
    message.error('请先填写认证密钥')
    return
  }

  if (authToken.length < 16) {
    message.error('认证密钥长度至少 16 位')
    return
  }

  token.value = authToken
  const result = await connectionStore.connect(targetUrl, authToken)
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
  const importResult = await window.electron.model.import(result.folderPath!, folderName)

  if (!importResult.success) {
    message.error(`导入模型失败: ${importResult.error}`)
    return
  }

  if (importResult.modelFiles && importResult.modelFiles.length > 1 && importResult.chosenFile) {
    message.info(`检测到多个模型文件，已自动选择：${importResult.chosenFile}`)
  }

  message.success('模型导入成功')
  await loadModelList()
}

async function handleLoadModel(modelPath: string) {
  await window.electron.model.load(modelPath)
  message.success('模型加载指令已发送')
}

async function handleDeleteModel(modelName: string) {
  const result = await window.electron.model.delete(modelName)
  if (result.success) {
    message.success('模型已删除')
    await loadModelList()
  } else {
    message.error(`删除失败: ${result.error}`)
  }
}

async function saveAdvancedSettings() {
  advancedSettings.value = persistAdvancedSettings(advancedSettings.value)
  await applyLogLevelSetting(advancedSettings.value.logLevel)
  message.success('高级设置已保存')
}

function getModelPreviewStyle(modelPath: string) {
  return modelPath === currentModelPath.value
    ? themeSwatchStyle.value
    : inactiveModelSwatchStyle.value
}

function handleShortcutKeyDown(event: KeyboardEvent) {
  event.preventDefault()

  const keys: string[] = []
  if (event.ctrlKey || event.metaKey) keys.push('Ctrl')
  if (event.altKey) keys.push('Alt')
  if (event.shiftKey) keys.push('Shift')

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

function convertToElectronFormat(shortcut: string): string {
  return shortcut.replace('Ctrl', 'CommandOrControl')
}

async function handleClearShortcut() {
  await window.electron.shortcut.unregister()
  advancedSettings.value.recordingShortcut = ''
  shortcutRegistered.value = false
  message.success('快捷键已清除')
}

async function handleRegisterShortcut() {
  if (!advancedSettings.value.recordingShortcut) {
    message.warning('请先设置快捷键')
    return
  }

  const electronFormat = convertToElectronFormat(advancedSettings.value.recordingShortcut)
  const result = await window.electron.shortcut.register(electronFormat)

  if (result.success) {
    shortcutRegistered.value = true
    await saveAdvancedSettings()
    message.success('快捷键注册成功')
  } else {
    message.error(`注册失败: ${result.error}`)
  }
}

async function handleOpenLogs() {
  const result = await window.electron.log.openDirectory()
  if (result.success) {
    message.success(`已打开日志目录: ${result.path}`)
    return
  }

  message.error(`打开日志目录失败: ${result.error || '未知错误'}`)
}

async function handleCheckUpdates() {
  checkingUpdate.value = true
  try {
    const result = await window.electron.update.check()
    if (result.success) {
      message.info(result.message)
    } else {
      message.warning(result.message)
    }
  } catch (error: any) {
    message.error(`检查更新失败: ${error?.message || String(error)}`)
  } finally {
    checkingUpdate.value = false
  }
}

async function handleInstallUpdate() {
  try {
    const result = await window.electron.update.quitAndInstall()
    if (!result.success) {
      message.warning(result.message)
    }
  } catch (error: any) {
    message.error(`安装更新失败: ${error?.message || String(error)}`)
  }
}

function handleClearCache() {
  dialog.warning({
    title: '清除缓存',
    content: '确定要清除所有缓存数据吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      const lastModelPath = localStorage.getItem('lastModelPath')
      const advancedSettingsStr = localStorage.getItem('advancedSettings')
      const connectionSettingsStr = localStorage.getItem('connectionSettings')
      const themeStateStr = localStorage.getItem('rendererThemeState')

      localStorage.clear()

      if (lastModelPath) localStorage.setItem('lastModelPath', lastModelPath)
      if (advancedSettingsStr) localStorage.setItem('advancedSettings', advancedSettingsStr)
      if (connectionSettingsStr) localStorage.setItem('connectionSettings', connectionSettingsStr)
      if (themeStateStr) localStorage.setItem('rendererThemeState', themeStateStr)

      message.success('缓存已清除')
    },
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
      void applyLogLevelSetting(advancedSettings.value.logLevel)
      shortcutRegistered.value = false
      message.success('设置已重置')
    },
  })
}

async function handleMinimizeWindow() {
  const result = await window.electron.window.minimizeCurrent()
  if (!result.success) {
    message.error(result.error || '最小化失败')
  }
}

async function handleToggleWindowMaximize() {
  const result = await window.electron.window.toggleMaximizeCurrent()
  if (!result.success) {
    message.error(result.error || '切换窗口状态失败')
    return
  }

  isWindowMaximized.value = Boolean(result.maximized)
}

async function handleCloseWindow() {
  const result = await window.electron.window.closeCurrent()
  if (!result.success) {
    message.error(result.error || '关闭窗口失败')
  }
}

function handleTitleBarDoubleClick() {
  void handleToggleWindowMaximize()
}

function handleOpenLink(url: string) {
  void window.electron.window.openExternal(url)
}
</script>

<style scoped lang="scss">
.settings-window {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(var(--color-accent-rgb), 0.14), transparent 18%),
    linear-gradient(180deg, rgba(38, 30, 25, 0.98), var(--settings-bg-base) 38%, rgba(17, 14, 13, 1));
}

.settings-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 32px;
  padding: 0 8px 0 14px;
  background: rgba(23, 18, 16, 0.96);
  border-bottom: 1px solid var(--settings-border-subtle);
}

.settings-titlebar__brand,
.settings-titlebar__identity,
.settings-titlebar__actions {
  display: flex;
  align-items: center;
}

.settings-titlebar__brand {
  gap: 10px;
  min-width: 0;
}

.settings-titlebar__identity {
  gap: 8px;
  min-width: 0;
}

.settings-titlebar__name,
.settings-titlebar__model {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-titlebar__name {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 245, 236, 0.88);
}

.settings-titlebar__divider {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.12);
}

.settings-titlebar__model {
  min-width: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.settings-titlebar__actions {
  gap: 6px;
  flex-shrink: 0;
}

.settings-titlebar__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 245, 236, 0.78);
  transition: background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }

  &:focus-visible {
    outline: 1px solid rgba(var(--color-accent-rgb), 0.42);
    outline-offset: 1px;
  }

  &--close:hover {
    background: rgba(198, 78, 65, 0.88);
    color: #fff5ef;
  }
}

.settings-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(252px, var(--settings-sidebar-width)) minmax(0, 1fr);
}

.settings-sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 18px;
  background: linear-gradient(180deg, rgba(42, 33, 28, 0.98), rgba(32, 24, 21, 0.99) 48%, var(--settings-bg-sidebar));
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0 14px 14px 0;
}

.settings-sidebar__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-sidebar__section--model {
  padding: 16px;
  border: 1px solid var(--settings-border-subtle);
  border-radius: var(--settings-radius-card);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 38%), rgba(255, 255, 255, 0.02);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.settings-sidebar__brand {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;

  strong {
    font-size: 20px;
    line-height: 1.1;
    letter-spacing: -0.04em;
  }
}

.settings-sidebar__version {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.48);
}

.settings-sidebar__status {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.settings-theme-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--settings-border-subtle);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary);
}

.settings-sidebar__model-name {
  font-size: 18px;
  line-height: 1.25;
  letter-spacing: -0.03em;
}

.settings-sidebar__label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

.settings-sidebar__platform,
.settings-sidebar__empty {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.settings-inline-path {
  display: block;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.14);
  border: 1px solid var(--settings-border-subtle);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--settings-radius-control);
  background: var(--settings-bg-soft);
  border: 1px solid var(--settings-border-subtle);
  color: var(--color-text-secondary);
  text-align: left;
  transition: background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.08);
    border-color: rgba(var(--color-accent-rgb), 0.2);
    color: var(--color-text-primary);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  &--active {
    background: rgba(var(--color-accent-rgb), 0.16);
    border-color: rgba(var(--color-accent-rgb), 0.32);
    color: var(--color-text-primary);
  }
}

.settings-sidebar__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
}

.settings-main {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: var(--settings-main-padding);
  background:
    linear-gradient(180deg, rgba(28, 22, 19, 0.7), rgba(17, 14, 13, 0.88)),
    radial-gradient(circle at top right, rgba(var(--color-accent-rgb), 0.08), transparent 26%);
}

.panel-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 28%), var(--settings-bg-surface);
  border: 1px solid var(--settings-border-subtle);
  border-radius: var(--settings-radius-card);
  box-shadow: var(--settings-card-shadow);
  backdrop-filter: none;
}

.settings-panel-grid {
  display: grid;
  gap: var(--settings-card-gap);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}

.settings-card {
  padding: var(--settings-card-padding);
  display: flex;
  flex-direction: column;
  gap: var(--settings-card-gap);
}

.settings-card--span-2 {
  grid-column: 1 / -1;
}

.settings-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: -0.03em;
  }
}

.settings-card__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.settings-card__note {
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.settings-form-grid {
  display: grid;
  gap: var(--settings-card-gap);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.settings-summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: var(--settings-radius-control);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);

  span {
    color: var(--color-text-secondary);
  }

  strong {
    max-width: 60%;
    text-align: right;
    word-break: break-word;
  }
}

.settings-theme-swatch {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-block;
  flex: 0 0 auto;
}

.shortcut-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.shortcut-row :deep(.n-input) {
  flex: 1 1 220px;
}

.current-model-card__body {
  display: grid;
  gap: 16px;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: flex-start;
}

.current-model-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  color: var(--theme-accent-contrast);
  font-size: 26px;
  font-weight: 700;
}

.current-model-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;

  strong {
    font-size: 18px;
    line-height: 1.25;
  }

  span {
    color: var(--color-text-secondary);
  }
}

.model-grid {
  display: grid;
  gap: var(--settings-card-gap);
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: var(--settings-card-gap);
  padding: var(--settings-card-padding-compact);
  border-radius: var(--settings-radius-card);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 34%), rgba(255, 255, 255, 0.02);
  border: 1px solid var(--settings-border-subtle);
  box-shadow: var(--settings-card-shadow);
  transition: border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(var(--color-accent-rgb), 0.22);
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.2);
  }

  &--active {
    border-color: rgba(var(--color-accent-rgb), 0.32);
    box-shadow: inset 0 0 0 1px rgba(var(--color-accent-rgb), 0.18), 0 10px 26px rgba(0, 0, 0, 0.2);
  }
}

.model-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.model-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--settings-radius-control);
  color: var(--theme-accent-contrast);
  font-size: 22px;
  font-weight: 700;
}

.model-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.14);
  border: 1px solid rgba(var(--color-accent-rgb), 0.28);
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 600;
}

.model-card__body {
  strong {
    display: block;
    margin-bottom: 6px;
    font-size: 16px;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
    word-break: break-word;
  }
}

.model-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.link-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ghost-button {
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--settings-radius-control);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--settings-border-subtle);

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.12);
    border-color: rgba(var(--color-accent-rgb), 0.2);
  }
}

@media (max-width: 960px) {
  .settings-workspace {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 0;
  }

  .settings-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .settings-nav__item {
    width: auto;
    flex: 1 1 160px;
  }

  .settings-sidebar__meta {
    margin-top: 0;
  }

  .settings-main {
    padding: 20px;
  }

  .settings-card__header,
  .settings-summary-row,
  .model-card__top {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings-panel-grid {
    grid-template-columns: 1fr;
  }

  .settings-card--span-2 {
    grid-column: auto;
  }

  .current-model-card__body {
    grid-template-columns: 1fr;
  }

  .settings-summary-row strong {
    max-width: none;
    text-align: left;
  }

  .settings-nav__item {
    width: 100%;
    flex-basis: 100%;
  }
}

@media (max-width: 720px) {
  .settings-titlebar {
    padding-left: 10px;
  }

  .settings-titlebar__model,
  .settings-titlebar__divider {
    display: none;
  }

  .settings-titlebar__name {
    max-width: 160px;
  }
}
</style>
