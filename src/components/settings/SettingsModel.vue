<template>
  <div class="settings-section model-section">
    <div class="model-header">
      <h2>模型设置</h2>
      <div class="model-tabs">
        <button
          v-for="tab in modelTabs"
          :key="tab.key"
          type="button"
          :class="['model-tab', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="model-content">
      <section v-show="activeTab === 'display'" class="model-panel">
        <div class="model-info-card">
          <h3>模型显示</h3>
          <div class="setting-item">
            <label>模型缩放</label>
            <input
              type="range"
              v-model.number="settings.modelScale"
              @change="triggerSave"
              min="0.5"
              max="2.0"
              step="0.1"
            />
            <span class="value">{{ settings.modelScale.toFixed(1) }}x</span>
          </div>

          <div class="setting-item">
            <label>水平偏移</label>
            <input
              type="range"
              v-model.number="settings.modelX"
              @change="triggerSave"
              min="-200"
              max="200"
              step="5"
            />
            <span class="value">{{ Math.round(settings.modelX) }}px</span>
          </div>

          <div class="setting-item">
            <label>垂直偏移</label>
            <input
              type="range"
              v-model.number="settings.modelY"
              @change="triggerSave"
              min="-200"
              max="200"
              step="5"
            />
            <span class="value">{{ Math.round(settings.modelY) }}px</span>
          </div>

          <div class="setting-item">
            <label>恢复缩放</label>
            <button class="btn btn-secondary" type="button" @click="resetModelScale">恢复</button>
          </div>

          <div class="setting-item">
            <label>重置位置</label>
            <button class="btn btn-secondary" type="button" @click="resetModelPosition">重置</button>
          </div>
        </div>
      </section>

      <section v-show="activeTab === 'interaction'" class="model-panel">
        <div class="model-info-card">
          <h3>模型交互</h3>
          <div class="setting-item">
            <label>视线跟随</label>
            <input
              type="checkbox"
              v-model="settings.eyeTracking"
              @change="triggerSave"
            />
          </div>

          <div class="setting-item">
            <label>点击反馈</label>
            <input
              type="checkbox"
              v-model="settings.clickFeedback"
              @change="triggerSave"
            />
          </div>

          <div class="setting-item">
            <label>拖拽移动</label>
            <input
              type="checkbox"
              v-model="settings.dragEnabled"
              @change="triggerSave"
            />
          </div>
        </div>
      </section>

      <section v-show="activeTab === 'passthrough'" class="model-panel">
        <div class="model-info-card">
          <h3>鼠标穿透</h3>
          <div class="setting-item">
            <label>启用智能穿透</label>
            <input
              type="checkbox"
              v-model="settings.passthroughEnabled"
              @change="triggerSave"
            />
          </div>

          <div class="setting-item" v-if="settings.passthroughEnabled">
            <label>Alpha 阈值</label>
            <input
              type="range"
              v-model.number="settings.alphaThreshold"
              @change="triggerSave"
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
              @change="triggerSave"
              min="10"
              max="200"
              step="10"
            />
            <span class="value">{{ settings.debounceMs }}ms</span>
          </div>
        </div>
      </section>

      <section v-show="activeTab === 'info'" class="model-panel">
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
      </section>

      <section v-show="activeTab === 'motions'" class="model-panel">
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
                    type="button"
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
      </section>

      <section v-show="activeTab === 'expressions'" class="model-panel">
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
                type="button"
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
      </section>

      <section v-show="activeTab === 'manage'" class="model-panel">
        <div class="model-info-card">
          <h3>导入新模型</h3>
          <div class="import-section">
            <p class="import-hint">支持 Live2D Cubism 3.x 格式的模型</p>
            <button @click="importModel" :disabled="importing" class="btn btn-primary" type="button">
              {{ importing ? '导入中...' : '选择模型文件夹' }}
            </button>
            <p v-if="importError" class="error-text">{{ importError }}</p>
          </div>
        </div>

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
                  type="button"
                >
                  切换
                </button>
                <button
                  v-if="model.isDeletable"
                  @click="deleteModel(model.name)"
                  :disabled="deleting"
                  class="btn-delete"
                  type="button"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
          <div v-else class="loading-text">无可用模型</div>
        </div>
      </section>
    </div>

    <div v-if="previewToast.show" :class="['preview-toast', previewToast.type]">
      {{ previewToast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, toRef, type Ref } from 'vue'
import type { AppSettings } from '../../composables/useSettings'
import { getModelInfo as getModelDetails, type ParsedModelInfo } from '../../utils/modelLoader'

const props = defineProps<{
  settings: AppSettings
  defaultSettings: AppSettings
}>()

const emit = defineEmits<{
  (e: 'save'): void
}>()

const modelTabs = [
  { key: 'display', label: '显示' },
  { key: 'interaction', label: '交互' },
  { key: 'passthrough', label: '穿透' },
  { key: 'info', label: '信息' },
  { key: 'motions', label: '动作' },
  { key: 'expressions', label: '表情' },
  { key: 'manage', label: '管理' }
]

const activeTab = ref('display')

const settings = toRef(props, 'settings') as Ref<AppSettings>
const defaultSettings = toRef(props, 'defaultSettings') as Ref<AppSettings>

const availableModels = ref<Array<{ name: string; path: string; isDeletable: boolean }>>([])
const currentModelInfo = ref<ParsedModelInfo | null>(null)
const loadingModels = ref(false)
const modelError = ref('')
const importing = ref(false)
const importError = ref('')
const deleting = ref(false)
const previewToast = ref({ show: false, message: '', type: 'success' as 'success' | 'error' })

const triggerSave = () => emit('save')

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  previewToast.value = { show: true, message, type }
  setTimeout(() => {
    previewToast.value.show = false
  }, 2000)
}

const loadAvailableModels = async () => {
  if (!window.electronAPI?.getAvailableModels) return

  loadingModels.value = true
  modelError.value = ''

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

const loadCurrentModelInfo = async () => {
  const modelName = settings.value.currentModel || defaultSettings.value.currentModel || 'default'
  if (!modelName) return

  try {
    const modelPath = `/models/${modelName}/model3.json`
    currentModelInfo.value = await getModelDetails(modelPath)
  } catch (error) {
    console.error('加载模型信息失败:', error)
  }
}

const importModel = async () => {
  if (!window.electronAPI?.selectModelFolder) return

  importing.value = true
  importError.value = ''

  try {
    const selectResult = await window.electronAPI.selectModelFolder()
    if (selectResult.canceled || !selectResult.folderPath) {
      importing.value = false
      return
    }

    const folderPath = selectResult.folderPath

    const validateResult = await window.electronAPI.validateModel(folderPath)
    if (!validateResult.valid || !validateResult.modelName) {
      importError.value = validateResult.error || '模型验证失败'
      importing.value = false
      return
    }

    const importResult = await window.electronAPI.importModel(folderPath, validateResult.modelName)
    if (!importResult.success) {
      importError.value = importResult.error || '模型导入失败'
      importing.value = false
      return
    }

    await loadAvailableModels()
    showToast(`模型 "${validateResult.modelName}" 导入成功！`, 'success')
  } catch (error) {
    console.error('导入模型失败:', error)
    importError.value = '导入模型失败'
    showToast('导入模型失败', 'error')
  } finally {
    importing.value = false
  }
}

const switchModel = async (modelName: string) => {
  if (modelName === settings.value.currentModel) return

  settings.value.currentModel = modelName
  triggerSave()

  await loadCurrentModelInfo()
  showToast(`已切换到模型 "${modelName}"，主窗口正在加载`, 'success')
}

const deleteModel = async (modelName: string) => {
  if (!window.electronAPI?.deleteModel) return

  if (!confirm(`确定要删除模型 "${modelName}" 吗？此操作不可恢复。`)) {
    return
  }

  deleting.value = true

  try {
    const result = await window.electronAPI.deleteModel(modelName)
    if (!result.success) {
      showToast(`删除失败: ${result.error}`, 'error')
      return
    }

    if (modelName === settings.value.currentModel) {
      settings.value.currentModel = defaultSettings.value.currentModel || 'default'
      triggerSave()
      await loadCurrentModelInfo()
    }

    await loadAvailableModels()
    showToast(`模型 "${modelName}" 已删除`, 'success')
  } catch (error) {
    console.error('删除模型失败:', error)
    showToast('删除模型失败', 'error')
  } finally {
    deleting.value = false
  }
}

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
    console.error('[SettingsModel] 预览动作失败:', error)
    showToast('预览动作失败', 'error')
  }
}

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
    console.error('[SettingsModel] 预览表情失败:', error)
    showToast('预览表情失败', 'error')
  }
}

const resetModelScale = () => {
  settings.value.modelScale = defaultSettings.value.modelScale ?? 1.0
  triggerSave()
}

const resetModelPosition = () => {
  settings.value.modelX = defaultSettings.value.modelX ?? 0
  settings.value.modelY = defaultSettings.value.modelY ?? 0
  triggerSave()
}

onMounted(() => {
  loadAvailableModels()
})

watch(
  () => settings.value.currentModel,
  () => {
    loadCurrentModelInfo()
  },
  { immediate: true }
)
</script>

<style scoped>
.model-section {
  max-width: 920px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.model-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.model-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.model-tab {
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--surface-color);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.model-tab:hover {
  transform: translateY(-1px);
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.model-tab.active {
  transform: translateY(-1px);
  background: var(--primary-color);
  color: var(--primary-fg);
  border-color: var(--primary-color);
}

.model-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.model-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.model-info-card {
  border-radius: 16px;
  padding: 20px;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
}

.model-info-card h3 {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0 0 16px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item label {
  font-size: 14px;
  color: var(--text-primary);
  min-width: 120px;
}

.setting-item input[type="range"] {
  flex: 1;
  margin: 0 16px;
  max-width: 300px;
}

.setting-item .value {
  min-width: 60px;
  text-align: right;
  font-size: 14px;
  color: var(--text-secondary);
}

.model-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-item .label {
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-item .value {
  font-size: 13px;
  color: var(--text-primary);
}

.loading-text {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
  font-size: 14px;
}

.motion-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.motion-group {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 12px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.group-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.group-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--hover-bg);
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
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  gap: 12px;
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
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.motion-fade {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.expression-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expression-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  gap: 12px;
}

.expr-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expr-name {
  font-size: 13px;
  color: var(--text-primary);
}

.expr-file {
  font-size: 11px;
  color: var(--text-secondary);
}

.import-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.import-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.model-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 12px;
  transition: all 0.2s ease;
}

.model-card:hover {
    border-color: var(--text-secondary);
}

.model-card.active {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 1px var(--primary-color-alpha);
}

.model-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.model-card-name {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
}

.current-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--primary-color);
  color: var(--primary-fg);
}

.model-card-actions {
  display: flex;
  gap: 8px;
}

.btn-preview {
  padding: 6px 12px;
  border: none;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s ease;
  background: var(--surface-color);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-preview:hover {
  transform: translateY(-1px);
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.btn-switch,
.btn-delete {
  flex: 1;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
  background: transparent;
  color: var(--text-secondary);
}

.btn-switch:hover,
.btn-delete:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  color: var(--text-primary);
}

.btn:hover {
    background: var(--hover-bg);
}

.btn-primary {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border-color: var(--primary-color);
}
.btn-primary:hover {
    opacity: 0.9;
}

.btn-secondary {
    background: var(--surface-color);
    color: var(--text-secondary);
}

.error-text {
  color: var(--danger-color);
  font-size: 13px;
  margin: 0;
}

.preview-toast {
  position: fixed;
  top: 60px;
  right: 32px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  background: var(--surface-color);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
.preview-toast.success {
    border-left: 4px solid #10b981;
}
.preview-toast.error {
    border-left: 4px solid var(--danger-color);
}
</style>
