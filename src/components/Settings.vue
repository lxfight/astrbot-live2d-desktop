<template>
  <div class="settings-container">
    <!-- 顶部栏 -->
    <header class="window-header">
      <div class="window-drag-bar">
        <div class="app-title">
          <span class="project-name">AstrBot Live2D Desktop</span>
          <span class="author">by lxfight</span>
        </div>
      </div>

      <!-- 右上角关闭按钮 -->
      <button @click="closeSettings" class="window-close-btn" title="关闭设置">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M 1,1 L 11,11 M 11,1 L 1,11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </header>

    <!-- 主体区域（左右布局） -->
    <div class="settings-body">
      <!-- 左侧导航 -->
      <aside class="settings-sidebar">
        <div class="sidebar-header">
          <h1>设置</h1>
        </div>
        <nav class="sidebar-nav">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['nav-item', { active: activeTab === tab.key }]"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>
      </aside>

      <!-- 右侧内容区 -->
      <main class="settings-main">
      <div class="settings-content">
        <!-- 基础设置 -->
        <section v-show="activeTab === 'basic'" class="settings-section">
          <h2>基础设置</h2>

          <div class="setting-item">
            <label>窗口置顶</label>
            <input
              type="checkbox"
              v-model="settings.alwaysOnTop"
              @change="saveSettings"
            />
          </div>

          <div class="setting-item">
            <label>透明窗口</label>
            <input
              type="checkbox"
              v-model="settings.transparent"
              @change="saveSettings"
              disabled
              title="需要重启应用生效"
            />
            <span class="hint">需要重启应用生效</span>
          </div>

          <div class="setting-item">
            <label>模型缩放</label>
            <input
              type="range"
              v-model.number="settings.modelScale"
              @change="saveSettings"
              min="0.5"
              max="2.0"
              step="0.1"
            />
            <span class="value">{{ settings.modelScale.toFixed(1) }}x</span>
          </div>
        </section>

        <!-- 鼠标穿透设置 -->
        <section v-show="activeTab === 'passthrough'" class="settings-section">
          <h2>鼠标穿透设置</h2>

          <div class="setting-item">
            <label>启用智能穿透</label>
            <input
              type="checkbox"
              v-model="settings.passthroughEnabled"
              @change="saveSettings"
            />
          </div>

          <div class="setting-item" v-if="settings.passthroughEnabled">
            <label>Alpha 阈值</label>
            <input
              type="range"
              v-model.number="settings.alphaThreshold"
              @change="saveSettings"
              min="0"
              max="255"
              step="5"
            />
            <span class="value">{{ settings.alphaThreshold }}</span>
          </div>

          <div class="setting-item" v-if="settings.passthroughEnabled">
            <label>防抖延迟 (ms)</label>
            <input
              type="range"
              v-model.number="settings.debounceMs"
              @change="saveSettings"
              min="10"
              max="200"
              step="10"
            />
            <span class="value">{{ settings.debounceMs }}ms</span>
          </div>
        </section>

        <!-- 交互设置 -->
        <section v-show="activeTab === 'interaction'" class="settings-section">
          <h2>交互设置</h2>

          <div class="setting-item">
            <label>视线跟随</label>
            <input
              type="checkbox"
              v-model="settings.eyeTracking"
              @change="saveSettings"
            />
          </div>

          <div class="setting-item">
            <label>点击反馈</label>
            <input
              type="checkbox"
              v-model="settings.clickFeedback"
              @change="saveSettings"
            />
          </div>

          <div class="setting-item">
            <label>拖拽移动</label>
            <input
              type="checkbox"
              v-model="settings.dragEnabled"
              @change="saveSettings"
            />
          </div>
        </section>

        <!-- WebSocket 设置 -->
        <section v-show="activeTab === 'websocket'" class="settings-section">
          <h2>WebSocket 设置</h2>

          <div class="setting-item">
            <label>服务器地址</label>
            <input
              type="text"
              v-model="settings.wsUrl"
              @change="saveSettings"
              placeholder="ws://localhost:8765/ws"
            />
          </div>

          <div class="setting-item">
            <label>连接令牌</label>
            <input
              type="password"
              v-model="settings.token"
              @change="saveSettings"
              placeholder="（可选）"
            />
          </div>
        </section>

        <!-- 模型管理 -->
        <section v-show="activeTab === 'model'" class="settings-section">
          <h2>模型管理</h2>

          <!-- 当前模型信息 -->
          <div class="model-info-card">
            <h3>当前模型信息</h3>
            <div v-if="currentModelInfo" class="model-details">
              <div class="detail-item">
                <span class="label">模型名称：</span>
                <span class="value">{{ settings.currentModel }}</span>
              </div>
              <div class="detail-item">
                <span class="label">模型版本：</span>
                <span class="value">Cubism {{ currentModelInfo.version }}</span>
              </div>
              <div class="detail-item">
                <span class="label">纹理数量：</span>
                <span class="value">{{ currentModelInfo.textureCount }}</span>
              </div>
              <div class="detail-item">
                <span class="label">动作组数：</span>
                <span class="value">{{ currentModelInfo.motionGroups.length }}</span>
              </div>
              <div class="detail-item">
                <span class="label">表情数量：</span>
                <span class="value">{{ currentModelInfo.expressions.length }}</span>
              </div>
              <div class="detail-item">
                <span class="label">物理效果：</span>
                <span class="value">{{ currentModelInfo.hasPhysics ? '是' : '否' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">姿势配置：</span>
                <span class="value">{{ currentModelInfo.hasPose ? '是' : '否' }}</span>
              </div>
            </div>
            <div v-else class="loading-text">加载中...</div>
          </div>

          <!-- 动画列表 -->
          <div class="model-info-card">
            <h3>动作列表</h3>
            <div v-if="currentModelInfo && currentModelInfo.motionGroups.length > 0" class="motion-groups">
              <div v-for="group in currentModelInfo.motionGroups" :key="group.groupName" class="motion-group">
                <div class="group-header">
                  <span class="group-name">{{ group.groupName }}</span>
                  <span class="group-count">{{ group.motions.length }} 个动作</span>
                </div>
                <div class="motion-list">
                  <div v-for="(motion, index) in group.motions" :key="index" class="motion-item">
                    <div class="motion-info">
                      <span class="motion-file">{{ motion.File }}</span>
                      <span class="motion-fade" v-if="motion.FadeInTime || motion.FadeOutTime">
                        淡入: {{ motion.FadeInTime || 0 }}s / 淡出: {{ motion.FadeOutTime || 0 }}s
                      </span>
                    </div>
                    <button
                      @click="previewMotion(group.groupName, index)"
                      class="btn-preview"
                      title="预览此动作"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style="margin-right: 4px;">
                        <path d="M2 1 L2 11 L10 6 Z"/>
                      </svg>
                      播放
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="loading-text">无动作数据</div>
          </div>

          <!-- 表情列表 -->
          <div class="model-info-card">
            <h3>表情列表</h3>
            <div v-if="currentModelInfo && currentModelInfo.expressions.length > 0" class="expression-list">
              <div v-for="expr in currentModelInfo.expressions" :key="expr.Name" class="expression-item">
                <div class="expr-info">
                  <span class="expr-name">{{ expr.Name }}</span>
                  <span class="expr-file">{{ expr.File }}</span>
                </div>
                <button
                  @click="previewExpression(expr.Name)"
                  class="btn-preview"
                  title="预览此表情"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style="margin-right: 4px;">
                    <path d="M2 1 L2 11 L10 6 Z"/>
                  </svg>
                  播放
                </button>
              </div>
            </div>
            <div v-else class="loading-text">无表情数据</div>
          </div>

          <!-- 模型导入 -->
          <div class="model-info-card">
            <h3>导入新模型</h3>
            <div class="import-section">
              <p class="import-hint">支持 Live2D Cubism 3.x 格式的模型</p>
              <button @click="importModel" :disabled="importing" class="btn btn-primary">
                {{ importing ? '导入中...' : '选择模型文件夹' }}
              </button>
              <p v-if="importError" class="error-text">{{ importError }}</p>
            </div>
          </div>

          <!-- 已安装模型列表 -->
          <div class="model-info-card">
            <h3>已安装模型</h3>
            <div v-if="loadingModels" class="loading-text">加载中...</div>
            <div v-else-if="modelError" class="error-text">{{ modelError }}</div>
            <div v-else-if="availableModels.length > 0" class="models-grid">
              <div
                v-for="model in availableModels"
                :key="model.name"
                :class="['model-card', { active: model.name === settings.currentModel }]"
              >
                <div class="model-card-header">
                  <span class="model-card-name">{{ model.name }}</span>
                  <span v-if="model.name === settings.currentModel" class="current-badge">当前</span>
                </div>
                <div class="model-card-actions">
                  <button
                    v-if="model.name !== settings.currentModel"
                    @click="switchModel(model.name)"
                    class="btn-switch"
                  >
                    切换
                  </button>
                  <button
                    v-if="model.isDeletable"
                    @click="deleteModel(model.name)"
                    :disabled="deleting"
                    class="btn-delete"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="loading-text">无可用模型</div>
          </div>
        </section>

        <!-- 对话历史 -->
        <section v-show="activeTab === 'history'" class="settings-section history-section">
          <ConversationHistory />
        </section>

        <!-- 数据统计 -->
        <section v-show="activeTab === 'statistics'" class="settings-section statistics-section">
          <StatisticsView />
        </section>

        <!-- 系统设置 -->
        <section v-show="activeTab === 'system'" class="settings-section">
          <h2>系统设置</h2>

          <div class="setting-item">
            <label>开机自启动</label>
            <input
              type="checkbox"
              v-model="settings.autoLaunch"
              @change="saveSettings"
              disabled
              title="暂未实现"
            />
            <span class="hint">暂未实现</span>
          </div>

          <div class="setting-item">
            <label>录音快捷键</label>
            <input
              type="text"
              v-model="settings.recordHotkey"
              @keydown="captureHotkey"
              @change="saveSettings"
              placeholder="按下快捷键组合..."
              readonly
              :class="{ 'hotkey-conflict': hotkeyConflict }"
            />
            <span class="hint">按住快捷键录音,松开发送</span>
            <span v-if="hotkeyConflict" class="error-hint">快捷键冲突</span>
          </div>
        </section>

        <!-- 关于 -->
        <section v-show="activeTab === 'about'" class="settings-section about-section">
          <h2>关于</h2>

          <div class="about-content">
            <div class="about-item">
              <h3>项目信息</h3>
              <p><strong>项目名称：</strong>AstrBot Live2D Desktop</p>
              <p><strong>作者：</strong>lxfight</p>
              <p><strong>版本：</strong>1.0.0</p>
            </div>

            <div class="about-item">
              <h3>版权声明</h3>
              <p>© 2024-2025 lxfight. All rights reserved.</p>
              <p>本项目使用 MIT 协议开源。</p>
            </div>

            <div class="about-item">
              <h3>Live2D® 版权声明</h3>
              <p>Live2D Cubism® 是 Live2D 公司的注册商标。</p>
              <p>本应用使用 Live2D Cubism Core 和 Live2D Cubism SDK。</p>
              <p>Live2D Cubism Core: © Live2D Inc.</p>
              <p>关于 Live2D® 的更多信息，请访问：<a href="https://www.live2d.com" target="_blank" rel="noopener noreferrer">https://www.live2d.com</a></p>
            </div>

            <div class="about-item">
              <h3>第三方库</h3>
              <p>本项目使用以下开源库：</p>
              <ul>
                <li>Vue 3 - MIT License</li>
                <li>Electron - MIT License</li>
                <li>PixiJS - MIT License</li>
                <li>pixi-live2d-display - MIT License</li>
                <li>Pinia - MIT License</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div class="settings-footer">
        <button @click="resetSettings" class="btn btn-secondary">恢复默认</button>
        <button @click="saveSettings" class="btn btn-primary">保存设置</button>
      </div>
    </main>
    </div>

    <!-- 保存成功提示 -->
    <div v-if="showSaveSuccess" class="save-success">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
        <path d="M13.5 3 L6 10.5 L2.5 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      设置已保存
    </div>

    <!-- 预览反馈 Toast -->
    <div v-if="previewToast.show" :class="['preview-toast', previewToast.type]">
      {{ previewToast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ParsedModelInfo } from '../utils/modelLoader'
import ConversationHistory from './ConversationHistory.vue'
import StatisticsView from './StatisticsView.vue'

// 标签页定义
const tabs = [
  { key: 'basic', label: '基础设置' },
  { key: 'passthrough', label: '鼠标穿透' },
  { key: 'interaction', label: '交互设置' },
  { key: 'websocket', label: 'WebSocket' },
  { key: 'model', label: '模型管理' },
  { key: 'history', label: '对话历史' },
  { key: 'statistics', label: '数据统计' },
  { key: 'system', label: '系统设置' },
  { key: 'about', label: '关于' }
]

const activeTab = ref('basic')

// 默认设置
const defaultSettings = {
  wsUrl: 'ws://localhost:8765/ws',
  token: '',
  alwaysOnTop: true,
  transparent: true,
  modelScale: 1.0,
  modelX: 0,
  modelY: 0,
  passthroughEnabled: true,
  alphaThreshold: 10,
  debounceMs: 50,
  eyeTracking: true,
  clickFeedback: true,
  dragEnabled: true,
  autoLaunch: false,
  currentModel: 'default',
  recordHotkey: 'CommandOrControl+T'
}

const settings = ref({ ...defaultSettings })
const showSaveSuccess = ref(false)
const previewToast = ref({ show: false, message: '', type: 'success' }) // 预览反馈 Toast
const hotkeyConflict = ref(false) // 快捷键冲突标记

// 模型管理状态
const availableModels = ref<Array<{ name: string; path: string; isDeletable: boolean }>>([])
const currentModelInfo = ref<ParsedModelInfo | null>(null)
const loadingModels = ref(false)
const modelError = ref('')
const importing = ref(false)
const importError = ref('')
const deleting = ref(false)

onMounted(async () => {
  // 从 Electron 加载设置
  if (window.electronAPI?.getSettings) {
    try {
      const savedSettings = await window.electronAPI.getSettings()
      settings.value = { ...defaultSettings, ...savedSettings }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }

  // 加载可用模型列表
  await loadAvailableModels()

  // 加载当前模型信息
  await loadCurrentModelInfo()

  // 监听快捷键冲突
  if (window.electronAPI?.onHotkeyConflict) {
    window.electronAPI.onHotkeyConflict((hotkey) => {
      hotkeyConflict.value = true
      showToast(`快捷键 ${hotkey} 已被其他应用占用，请更换`, 'error')
    })
  }
})

// 加载可用模型列表
const loadAvailableModels = async () => {
  if (!window.electronAPI?.getAvailableModels) return

  loadingModels.value = true
  try {
    const result = await window.electronAPI.getAvailableModels()
    if (result.success) {
      availableModels.value = result.models || []
    } else {
      modelError.value = result.error || '加载模型列表失败'
    }
  } catch (error) {
    console.error('加载模型列表失败:', error)
    modelError.value = '加载模型列表失败'
  } finally {
    loadingModels.value = false
  }
}

// 加载当前模型信息
const loadCurrentModelInfo = async () => {
  try {
    const { getModelInfo } = await import('../utils/modelLoader')
    const modelPath = `/models/${settings.value.currentModel}/model3.json`
    currentModelInfo.value = await getModelInfo(modelPath)
  } catch (error) {
    console.error('加载模型信息失败:', error)
  }
}

// 选择并导入模型
const importModel = async () => {
  if (!window.electronAPI?.selectModelFolder) return

  importing.value = true
  importError.value = ''

  try {
    // 选择文件夹
    const selectResult = await window.electronAPI.selectModelFolder()
    if (selectResult.canceled || !selectResult.folderPath) {
      importing.value = false
      return
    }

    const folderPath = selectResult.folderPath

    // 验证模型
    const validateResult = await window.electronAPI.validateModel(folderPath)
    if (!validateResult.valid || !validateResult.modelName) {
      importError.value = validateResult.error || '模型验证失败'
      importing.value = false
      return
    }

    // 导入模型
    const importResult = await window.electronAPI.importModel(folderPath, validateResult.modelName)
    if (!importResult.success) {
      importError.value = importResult.error || '模型导入失败'
      importing.value = false
      return
    }

    // 重新加载模型列表
    await loadAvailableModels()

    importing.value = false
    alert(`模型 "${validateResult.modelName}" 导入成功！`)
  } catch (error) {
    console.error('导入模型失败:', error)
    importError.value = '导入模型失败'
    importing.value = false
  }
}

// 切换模型
const switchModel = async (modelName: string) => {
  if (modelName === settings.value.currentModel) {
    return
  }

  settings.value.currentModel = modelName
  await saveSettings()

  // 重新加载当前模型信息
  await loadCurrentModelInfo()

  alert(`已切换到模型 "${modelName}"，请重新打开主窗口以生效。`)
}

// 删除模型
const deleteModel = async (modelName: string) => {
  if (!window.electronAPI?.deleteModel) return

  if (!confirm(`确定要删除模型 "${modelName}" 吗？此操作不可恢复。`)) {
    return
  }

  deleting.value = true

  try {
    const result = await window.electronAPI.deleteModel(modelName)
    if (!result.success) {
      alert(`删除失败: ${result.error}`)
      deleting.value = false
      return
    }

    // 如果删除的是当前模型，切换到默认模型
    if (modelName === settings.value.currentModel) {
      settings.value.currentModel = 'default'
      await saveSettings()
      await loadCurrentModelInfo()
    }

    // 重新加载模型列表
    await loadAvailableModels()

    deleting.value = false
    alert(`模型 "${modelName}" 已删除`)
  } catch (error) {
    console.error('删除模型失败:', error)
    alert('删除模型失败')
    deleting.value = false
  }
}

// 显示 Toast 提示
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  previewToast.value = { show: true, message, type }
  setTimeout(() => {
    previewToast.value.show = false
  }, 2000)
}

// 预览动作
const previewMotion = async (group: string, index: number) => {
  if (!window.electronAPI?.previewMotion) {
    showToast('预览功能不可用', 'error')
    return
  }

  try {
    const result = await window.electronAPI.previewMotion(group, index)
    if (!result.success) {
      showToast(result.error || '预览失败', 'error')
    } else {
      showToast(`正在播放: ${group} #${index}`, 'success')
    }
  } catch (error) {
    console.error('[Settings] 预览动作失败:', error)
    showToast('预览动作失败', 'error')
  }
}

// 预览表情
const previewExpression = async (expressionName: string) => {
  if (!window.electronAPI?.previewExpression) {
    showToast('预览功能不可用', 'error')
    return
  }

  try {
    const result = await window.electronAPI.previewExpression(expressionName)
    if (!result.success) {
      showToast(result.error || '预览失败', 'error')
    } else {
      showToast(`正在播放: ${expressionName}`, 'success')
    }
  } catch (error) {
    console.error('[Settings] 预览表情失败:', error)
    showToast('预览表情失败', 'error')
  }
}

// 捕获快捷键
const captureHotkey = (event: KeyboardEvent) => {
  event.preventDefault()

  const keys: string[] = []

  if (event.ctrlKey || event.metaKey) {
    keys.push('CommandOrControl')
  }
  if (event.shiftKey) {
    keys.push('Shift')
  }
  if (event.altKey) {
    keys.push('Alt')
  }

  // 获取主键
  const mainKey = event.key.toUpperCase()
  if (mainKey.length === 1 && /[A-Z0-9]/.test(mainKey)) {
    keys.push(mainKey)
  } else if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(event.key)) {
    keys.push(event.key)
  }

  if (keys.length > 1) {
    hotkeyConflict.value = false
    settings.value.recordHotkey = keys.join('+')
    saveSettings()
  }
}

// 保存设置
const saveSettings = async () => {
  if (window.electronAPI?.setSettings) {
    try {
      const result = await window.electronAPI.setSettings(settings.value)

      if (result.conflict) {
        hotkeyConflict.value = true
        showToast(`快捷键 ${settings.value.recordHotkey} 已被其他应用占用，请更换`, 'error')
        return
      }

      hotkeyConflict.value = false

      // 显示保存成功提示
      showSaveSuccess.value = true
      setTimeout(() => {
        showSaveSuccess.value = false
      }, 2000)

      console.log('设置已保存:', settings.value)
    } catch (error) {
      console.error('保存设置失败:', error)
    }
  }
}

// 恢复默认设置
const resetSettings = () => {
  if (confirm('确定要恢复默认设置吗？')) {
    settings.value = { ...defaultSettings }
    saveSettings()
  }
}

// 关闭设置窗口
const closeSettings = () => {
  window.close()
}
</script>

<style scoped>
.settings-container {
  width: 100%;
  height: 100vh;
  background: #1a1a1a;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 顶部栏 */
.window-header {
  width: 100%;
  height: 42px;
  background: #222;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  position: relative;
}

/* 拖动区域 */
.window-drag-bar {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 16px;
  -webkit-app-region: drag;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 12px;
  -webkit-app-region: no-drag;
}

.project-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.3px;
}

.author {
  font-size: 11px;
  color: #999;
  font-weight: 400;
}

/* 右上角关闭按钮 */
.window-close-btn {
  width: 46px;
  height: 100%;
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.1s ease;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.window-close-btn:hover {
  background: #e81123;
}

.window-close-btn:active {
  background: #f1707a;
  color: #000;
}

.window-close-btn svg {
  width: 10px;
  height: 10px;
}

/* 主体区域 */
.settings-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

/* 左侧导航栏 */
.settings-sidebar {
  width: 200px;
  background: #222;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid #333;
}

.sidebar-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.nav-item {
  width: 100%;
  padding: 14px 20px;
  background: transparent;
  border: none;
  color: #b0b0b0;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: #2a2a2a;
  color: #fff;
}

.nav-item.active {
  background: #2a2a2a;
  color: #fff;
  border-left-color: #fff;
  font-weight: 600;
}

/* 右侧主内容区 */
.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
}

.settings-section {
  background: #222;
  border-radius: 16px;
  padding: 28px 32px;
  border: 1px solid #333;
  transition: all 0.3s ease;
}

.settings-section h2 {
  margin: 0 0 24px 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid #333;
  padding-bottom: 14px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #2a2a2a;
  transition: all 0.2s ease;
}

.setting-item:hover {
  padding-left: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  margin: 0 -8px;
  padding-right: 8px;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item label {
  flex: 0 0 150px;
  font-size: 14px;
  color: #b0b0b0;
  font-weight: 500;
}

.setting-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #fff;
  transition: transform 0.2s ease;
}

.setting-item input[type="checkbox"]:hover {
  transform: scale(1.1);
}

.setting-item input[type="range"] {
  flex: 1;
  margin: 0 15px;
  cursor: pointer;
  height: 4px;
  border-radius: 2px;
  accent-color: #fff;
  transition: all 0.2s ease;
}

.setting-item input[type="range"]:hover {
  height: 6px;
}

.setting-item input[type="text"],
.setting-item input[type="password"] {
  flex: 1;
  padding: 10px 14px;
  background: #2a2a2a;
  border: 1px solid #333;
  border-radius: 10px;
  color: #e0e0e0;
  font-size: 14px;
  transition: all 0.2s ease;
}

.setting-item input[type="text"]:focus,
.setting-item input[type="password"]:focus {
  outline: none;
  border-color: #555;
  background: #2d2d2d;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
}

.setting-item input[type="text"]::placeholder,
.setting-item input[type="password"]::placeholder {
  color: #666;
}

.setting-item .value {
  flex: 0 0 60px;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.setting-item .hint {
  font-size: 12px;
  color: #666;
  margin-left: 10px;
}

.setting-item .error-hint {
  font-size: 12px;
  color: #ff6b6b;
  margin-left: 10px;
  font-weight: 600;
}

.setting-item input.hotkey-conflict {
  border-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}

/* 模型管理样式 */
.model-info-card {
  background: #222;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.model-info-card h3 {
  font-size: 16px;
  color: #e0e0e0;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}

.model-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.detail-item .label {
  font-size: 14px;
  color: #999;
  margin-right: 8px;
}

.detail-item .value {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}

.loading-text {
  text-align: center;
  color: #666;
  padding: 20px;
  font-size: 14px;
}

.motion-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.motion-group {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 12px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid #2a2a2a;
}

.group-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.group-count {
  font-size: 12px;
  color: #666;
  background: #2a2a2a;
  padding: 2px 8px;
  border-radius: 10px;
}

.motion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.motion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: #222;
  border-radius: 6px;
  transition: background 0.2s ease;
  gap: 12px;
}

.motion-item:hover {
  background: #2a2a2a;
}

.motion-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.motion-file {
  font-size: 13px;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.motion-fade {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
}

.btn-preview {
  padding: 6px 12px;
  background: #fff;
  color: #1a1a1a;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.btn-preview:hover {
  background: #f0f0f0;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2);
}

.btn-preview:active {
  transform: translateY(0);
}

.expression-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.expression-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  transition: all 0.2s ease;
  gap: 12px;
}

.expression-item:hover {
  background: #222;
  border-color: #333;
}

.expr-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.expr-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expr-file {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.import-hint {
  font-size: 13px;
  color: #999;
  margin: 0;
}

.error-text {
  color: #ff6b6b;
  font-size: 13px;
  margin: 0;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.model-card {
  background: #1a1a1a;
  border: 2px solid #2a2a2a;
  border-radius: 10px;
  padding: 16px;
  transition: all 0.2s ease;
}

.model-card:hover {
  background: #222;
  border-color: #333;
}

.model-card.active {
  border-color: #fff;
  background: #252525;
}

.model-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.model-card-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.current-badge {
  font-size: 11px;
  background: #fff;
  color: #1a1a1a;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.model-card-actions {
  display: flex;
  gap: 8px;
}

.btn-switch,
.btn-delete {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-switch {
  background: #fff;
  color: #1a1a1a;
}

.btn-switch:hover {
  background: #f0f0f0;
  transform: translateY(-1px);
}

.btn-delete {
  background: transparent;
  color: #ff6b6b;
  border: 1px solid #ff6b6b;
}

.btn-delete:hover {
  background: #ff6b6b;
  color: #fff;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 32px;
  background: #222;
  border-top: 1px solid #333;
  animation: slideUp 0.3s ease-out;
}

.btn {
  padding: 11px 28px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.3px;
}

.btn-primary {
  background: #fff;
  color: #1a1a1a;
}

.btn-primary:hover {
  background: #f0f0f0;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 255, 255, 0.2);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  background: transparent;
  color: #999;
  border: 1px solid #444;
}

.btn-secondary:hover {
  background: #2a2a2a;
  color: #fff;
  border-color: #555;
}

.save-success {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  color: #1a1a1a;
  padding: 18px 36px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: successPop 2s ease-in-out;
  display: flex;
  align-items: center;
}

.preview-toast {
  position: fixed;
  top: 80px;
  right: 32px;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  animation: slideInRight 0.3s ease-out, slideOutRight 0.3s ease-in 1.7s;
  z-index: 2000;
}

.preview-toast.success {
  background: #4caf50;
  color: #fff;
}

.preview-toast.error {
  background: #f44336;
  color: #fff;
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideOutRight {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100px);
  }
}

@keyframes successPop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  10% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.05);
  }
  15% {
    transform: translate(-50%, -50%) scale(0.98);
  }
  20% {
    transform: translate(-50%, -50%) scale(1);
  }
  90% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
}

/* 滚动条样式 */
.settings-content::-webkit-scrollbar {
  width: 8px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 4px;
}

.settings-content::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: #444;
}

/* 关于页样式 */
.about-section {
  max-width: 800px;
}

.about-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.about-item {
  background: #222;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 24px;
  transition: all 0.2s ease;
}

.about-item:hover {
  background: #252525;
  border-color: #444;
}

.about-item h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid #333;
  padding-bottom: 12px;
}

.about-item p {
  margin: 8px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #b0b0b0;
}

.about-item strong {
  color: #fff;
  font-weight: 600;
}

.about-item a {
  color: #6eb4ff;
  text-decoration: none;
  transition: color 0.2s ease;
}

.about-item a:hover {
  color: #8fc9ff;
  text-decoration: underline;
}

.about-item ul {
  margin: 12px 0;
  padding-left: 20px;
}

.about-item li {
  margin: 6px 0;
  font-size: 14px;
  color: #b0b0b0;
  line-height: 1.6;
}

/* 对话历史样式 */
.history-section {
  padding: 0 !important;
  height: calc(100vh - 80px);
  overflow: hidden;
}
</style>
