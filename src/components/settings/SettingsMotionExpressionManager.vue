<template>
  <div class="motion-expression-manager" :data-theme="props.theme">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">动作与表情管理</h2>
        <span class="subtitle">点击卡片展开,为每个动作类型分配可执行的动作和表情</span>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-icon" @click="scanMotions" :disabled="scanning" title="扫描模型动作">
          <AppIcon name="refresh-cw" :size="20" :class="{ 'spin': scanning }" />
          <span>{{ scanning ? '扫描中...' : '扫描动作' }}</span>
        </button>
        <button class="btn btn-icon" @click="exportConfig" title="导出配置">
          <AppIcon name="download" :size="16" />
        </button>
        <button class="btn btn-icon" @click="showImportDialog = true" title="导入配置">
          <AppIcon name="upload" :size="16" />
        </button>
        <button class="btn btn-icon btn-danger" @click="clearAllAssignments" title="清空全部">
          <AppIcon name="trash" :size="16" />
        </button>
      </div>
    </div>

    <!-- 动作类型网格 -->
    <div class="motion-types-grid">
      <div
        v-for="motionType in visibleMotionTypes"
        :key="motionType.id"
        class="motion-type-card"
        :class="{
          active: selectedTypeId === motionType.id,
          expanded: selectedTypeId === motionType.id
        }"
      >
        <!-- 卡片头部 - 可点击 -->
        <div class="card-clickable" @click="toggleType(motionType.id)">
          <div class="card-header">
            <div class="icon-wrapper" :style="{ backgroundColor: motionType.color + '20', color: motionType.color }">
              <AppIcon :name="motionType.iconKey || motionType.id" :size="24" />
            </div>
            <div class="card-info">
              <h3 class="type-name">{{ motionType.name }}</h3>
              <p class="type-desc">{{ motionType.description }}</p>
            </div>
          </div>
          <div class="card-footer">
            <div class="stat-item">
              <span class="stat-label">动作</span>
              <span class="stat-value">{{ getTypeMotionCount(motionType.id) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">表情</span>
              <span class="stat-value">{{ getTypeExpressionCount(motionType.id) }}</span>
            </div>
            <div class="expand-icon" :class="{ rotated: selectedTypeId === motionType.id }">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- 展开的详细内容 -->
        <Transition name="expand">
          <div v-if="selectedTypeId === motionType.id" class="card-expanded-content" @click.stop>
            <div class="expanded-header">
              <button class="btn btn-primary btn-sm" @click="openAddDialog">
                <AppIcon name="plus" :size="16" />
                <span>添加动作/表情</span>
              </button>
            </div>

            <!-- 动作列表 -->
            <div class="expanded-section">
              <h4 class="section-title">
                <span>动作</span>
                <span class="count">{{ assignedMotions.length }}</span>
              </h4>
              <TransitionGroup name="item-list" tag="div" class="items-list">
                <div
                  v-for="motion in assignedMotions"
                  :key="motion.motionId"
                  class="item-row"
                >
                  <div class="item-content">
                    <input
                      v-model="motionAliases[motion.motionId]"
                      @blur="saveMotionAlias(motion.motionId)"
                      class="item-name-input"
                      :placeholder="motion.motionName"
                    />
                    <span class="item-meta">{{ motion.groupId }} #{{ motion.index }}</span>
                  </div>
                  <div class="item-actions">
                    <button
                      class="btn-icon-small"
                      @click="previewMotion(motion)"
                      title="预览"
                    >
                      <AppIcon name="play" :size="16" />
                    </button>
                    <button
                      class="btn-icon-small btn-danger"
                      @click="removeMotion(motion.motionId)"
                      title="移除"
                    >
                      <AppIcon name="trash" :size="16" />
                    </button>
                  </div>
                </div>
              </TransitionGroup>
              <div v-if="assignedMotions.length === 0" class="empty-hint">
                暂无动作,点击上方"添加"按钮开始配置
              </div>
            </div>

            <!-- 表情列表 -->
            <div class="expanded-section">
              <h4 class="section-title">
                <span>表情</span>
                <span class="count">{{ assignedExpressions.length }}</span>
              </h4>
              <TransitionGroup name="item-list" tag="div" class="items-list">
                <div
                  v-for="expression in assignedExpressions"
                  :key="expression.motionId"
                  class="item-row"
                >
                  <div class="item-content">
                    <input
                      v-model="expressionAliases[expression.motionId]"
                      @blur="saveExpressionAlias(expression.motionId)"
                      class="item-name-input"
                      :placeholder="expression.motionName"
                    />
                    <span class="item-meta">{{ expression.motionId }}</span>
                  </div>
                  <div class="item-actions">
                    <button
                      class="btn-icon-small"
                      @click="previewExpression(expression)"
                      title="预览"
                    >
                      <AppIcon name="play" :size="16" />
                    </button>
                    <button
                      class="btn-icon-small btn-danger"
                      @click="removeExpression(expression.motionId)"
                      title="移除"
                    >
                      <AppIcon name="trash" :size="16" />
                    </button>
                  </div>
                </div>
              </TransitionGroup>
              <div v-if="assignedExpressions.length === 0" class="empty-hint">
                暂无表情,点击上方"添加"按钮开始配置
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 添加对话框 -->
    <Transition name="modal">
      <div v-if="showAddDialog" class="modal-overlay" @click="closeAddDialog">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>添加到 {{ selectedType?.name }}</h3>
            <button class="btn-close" @click="closeAddDialog">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-tabs">
            <button
              class="modal-tab"
              :class="{ active: addDialogTab === 'motions' }"
              @click="addDialogTab = 'motions'"
            >
              动作
            </button>
            <button
              class="modal-tab"
              :class="{ active: addDialogTab === 'expressions' }"
              @click="addDialogTab = 'expressions'"
            >
              表情
            </button>
          </div>

          <div class="modal-search">
            <AppIcon name="search" :size="18" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索..."
              class="search-input"
            />
          </div>

          <div class="modal-body">
            <!-- 动作列表 -->
            <div v-if="addDialogTab === 'motions'" class="modal-items">
              <div
                v-for="motion in filteredAvailableMotions"
                :key="`${motion.group}:${motion.index}`"
                class="modal-item"
                :class="{ disabled: isMotionAssigned(motion) }"
              >
                <div class="modal-item-info">
                  <span class="modal-item-name">{{ getMotionDisplayName(motion) }}</span>
                  <span class="modal-item-meta">{{ motion.group }} #{{ motion.index }}</span>
                </div>
                <button
                  class="btn btn-sm"
                  :disabled="isMotionAssigned(motion)"
                  @click="addMotion(motion)"
                >
                  {{ isMotionAssigned(motion) ? '已添加' : '添加' }}
                </button>
              </div>
            </div>

            <!-- 表情列表 -->
            <div v-else class="modal-items">
              <div
                v-for="expression in filteredAvailableExpressions"
                :key="expression.id"
                class="modal-item"
                :class="{ disabled: isExpressionAssigned(expression) }"
              >
                <div class="modal-item-info">
                  <span class="modal-item-name">{{ getExpressionDisplayName(expression) }}</span>
                  <span class="modal-item-meta">{{ expression.id }}</span>
                </div>
                <button
                  class="btn btn-sm"
                  :disabled="isExpressionAssigned(expression)"
                  @click="addExpression(expression)"
                >
                  {{ isExpressionAssigned(expression) ? '已添加' : '添加' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <!-- 导入配置对话框 -->
    <Transition name="modal">
      <div v-if="showImportDialog" class="modal-overlay" @click="showImportDialog = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>导入配置</h3>
            <button class="btn-close" @click="showImportDialog = false">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <textarea
              v-model="importConfigText"
              class="import-textarea"
              placeholder="在这里粘贴从其他地方导出的 JSON 配置..."
            ></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showImportDialog = false">取消</button>
            <button class="btn btn-primary" @click="importConfig" :disabled="!importConfigText.trim()">导入</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { motionService } from '../../services/motionManagement'
import { MOTION_TYPES, type Live2DMotion, type Live2DExpression, type MotionAssignment } from '../../types/motionManagement'
import AppIcon from '../icons/AppIcon.vue'
import { logger } from '../../utils/logger'

// Props
interface Props {
  theme?: 'light' | 'dark'
}

const props = withDefaults(defineProps<Props>(), {
  theme: 'light'
})

// 状态
const scanning = ref(false)
const selectedTypeId = ref<string | null>(null)
const showAddDialog = ref(false)
const addDialogTab = ref<'motions' | 'expressions'>('motions')
const searchQuery = ref('')
const showImportDialog = ref(false)
const importConfigText = ref('')

// 别名映射
const motionAliases = ref<Record<string, string>>({})
const expressionAliases = ref<Record<string, string>>({})

// 计算属性
const selectedType = computed(() =>
  MOTION_TYPES.find(t => t.id === selectedTypeId.value)
)

const visibleMotionTypes = computed(() => 
  MOTION_TYPES.filter(t => t.id !== 'idle')
)

const assignedMotions = computed(() => {
  if (!selectedTypeId.value) return []
  return motionService.getMotionTypeInfo().motions[selectedTypeId.value] || []
})

const assignedExpressions = computed(() => {
  if (!selectedTypeId.value) return []
  return motionService.getMotionTypeInfo().expressions[selectedTypeId.value] || []
})

const availableMotions = computed(() => motionService.getAllMotions())
const availableExpressions = computed(() => motionService.getAllExpressions())

const filteredAvailableMotions = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return availableMotions.value
  return availableMotions.value.filter(m => {
    const displayName = getMotionDisplayName(m).toLowerCase()
    return displayName.includes(query) || m.group.toLowerCase().includes(query)
  })
})

const filteredAvailableExpressions = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return availableExpressions.value
  return availableExpressions.value.filter(e => {
    const displayName = getExpressionDisplayName(e).toLowerCase()
    return displayName.includes(query) || e.id.toLowerCase().includes(query)
  })
})

// 方法
const toggleType = (typeId: string) => {
  selectedTypeId.value = selectedTypeId.value === typeId ? null : typeId
}

const getTypeMotionCount = (typeId: string) => {
  return (motionService.getMotionTypeInfo().motions[typeId] || []).length
}

const getTypeExpressionCount = (typeId: string) => {
  return (motionService.getMotionTypeInfo().expressions[typeId] || []).length
}

const getMotionDisplayName = (motion: Live2DMotion) => {
  const id = `${motion.group}:${motion.index}`
  return motionAliases.value[id] || motion.name
}

const getExpressionDisplayName = (expression: Live2DExpression) => {
  return expressionAliases.value[expression.id] || expression.name
}

const isMotionAssigned = (motion: Live2DMotion) => {
  if (!selectedTypeId.value) return false
  return motionService.isMotionAssignedToType(motion, selectedTypeId.value)
}

const isExpressionAssigned = (expression: Live2DExpression) => {
  if (!selectedTypeId.value) return false
  return motionService.isExpressionAssignedToType(expression, selectedTypeId.value)
}

const openAddDialog = () => {
  showAddDialog.value = true
  addDialogTab.value = 'motions'
  searchQuery.value = ''
}

const closeAddDialog = () => {
  showAddDialog.value = false
  searchQuery.value = ''
}

const addMotion = (motion: Live2DMotion) => {
  if (!selectedTypeId.value) return
  motionService.assignMotionToType(motion, selectedTypeId.value)
}

const addExpression = (expression: Live2DExpression) => {
  if (!selectedTypeId.value) return
  motionService.assignExpressionToType(expression, selectedTypeId.value)
}

const removeMotion = (motionId: string) => {
  if (!selectedTypeId.value) return
  motionService.removeMotionFromType(motionId, selectedTypeId.value)
}

const removeExpression = (expressionId: string) => {
  if (!selectedTypeId.value) return
  motionService.removeExpressionFromType(expressionId, selectedTypeId.value)
}

const saveMotionAlias = (motionId: string) => {
  const alias = motionAliases.value[motionId]?.trim()
  motionService.setMotionAlias(motionId, alias || '')
}

const saveExpressionAlias = (expressionId: string) => {
  const alias = expressionAliases.value[expressionId]?.trim()
  motionService.setExpressionAlias(expressionId, alias || '')
}

const previewMotion = async (motion: MotionAssignment) => {
  await motionService.previewMotion(motion.groupId, motion.index)
}

const previewExpression = async (expression: MotionAssignment) => {
  await motionService.previewExpression(expression.motionId)
}

const scanMotions = async () => {
  scanning.value = true
  try {
    await motionService.scanFromCurrentModel()
    loadAliases()
    logger.info('动作扫描完成')
  } catch (error) {
    logger.error('扫描失败', error)
  } finally {
    scanning.value = false
  }
}

const exportConfig = () => {
  try {
    const config = motionService.exportConfig()
    const blob = new Blob([config], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `motion-config-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    logger.info('配置导出成功')
  } catch (error) {
    logger.error('导出配置失败:', error)
  }
}

const importConfig = () => {
  try {
    const success = motionService.importConfig(importConfigText.value)
    if (success) {
      showImportDialog.value = false
      importConfigText.value = ''
      logger.info('配置导入成功')
    } else {
      logger.error('配置导入失败：无效的配置格式')
      alert('导入失败，请检查配置格式是否正确。')
    }
  } catch (error) {
    logger.error('导入配置失败:', error)
    alert('导入失败，发生未知错误。')
  }
}

const clearAllAssignments = () => {
  if (confirm('确定要清空所有动作分配吗？此操作不可恢复。')) {
    motionService.clearAllAssignments()
    logger.info('已清空所有动作分配')
  }
}

const loadAliases = () => {
  const motions: Record<string, string> = {}
  const expressions: Record<string, string> = {}

  for (const m of availableMotions.value) {
    const id = `${m.group}:${m.index}`
    const alias = motionService.getMotionAlias(id)
    if (alias) motions[id] = alias
  }

  for (const e of availableExpressions.value) {
    const alias = motionService.getExpressionAlias(e.id)
    if (alias) expressions[e.id] = alias
  }

  motionAliases.value = motions
  expressionAliases.value = expressions
}

onMounted(() => {
  loadAliases()
})
</script>

<style scoped>
.motion-expression-manager {
  --bg-primary: transparent;
  --bg-secondary: var(--surface-color);
  --bg-tertiary: var(--hover-bg);
  --text-primary: var(--text-primary);
  --text-secondary: var(--text-secondary);
  --text-tertiary: var(--text-tertiary);
  --border-color: var(--border-color);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.15);
  --primary-color: var(--primary-color);
  --primary-hover: var(--primary-color);
  --danger-color: var(--danger-color);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 0;
  transition: var(--transition);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid var(--border-color);
}

.toolbar-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.subtitle {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.toolbar-right {
  display: flex;
  gap: 0.75rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--btn-bg);
  color: var(--btn-fg);
  border: 1px solid var(--primary-color);
}

.btn-icon {
  padding: 0.625rem 1rem;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.875rem;
}

.btn-icon-small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.btn-icon-small:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-icon-small.btn-danger:hover {
  background: var(--danger-color);
  color: white;
}

.motion-types-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

.motion-type-card {
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: var(--transition);
  box-shadow: var(--shadow-sm);
}

.motion-type-card:hover {
  box-shadow: var(--shadow-md);
}

.motion-type-card.active {
  border-color: var(--primary-color);
}

.card-clickable {
  cursor: pointer;
  padding: 1.5rem;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.card-info {
  flex: 1;
  min-width: 0;
}

.type-name {
  margin: 0 0 0.25rem 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.type-desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
}

.expand-icon {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  color: var(--text-secondary);
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

.card-expanded-content {
  padding: 0 1.5rem 1.5rem 1.5rem;
  background: var(--bg-primary);
}

.expanded-header {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 1rem;
}

.expanded-section {
  margin-bottom: 1.5rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.section-title .count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 0.5rem;
  border-radius: 12px;
  background: var(--primary-color);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.item-row:hover {
  border-color: var(--primary-color);
  box-shadow: var(--shadow-sm);
}

.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 500;
  transition: var(--transition);
}

.item-name-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.item-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.item-actions {
  display: flex;
  gap: 0.25rem;
}

.empty-hint {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-style: italic;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.btn-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-tabs {
  display: flex;
  padding: 1rem 1.5rem 0 1.5rem;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-tab {
  padding: 0.75rem 1.5rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.modal-tab:hover {
  color: var(--text-primary);
}

.modal-tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.modal-search {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.search-input {
  flex: 1;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: var(--transition);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
}

.modal-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: var(--transition);
}

.modal-item:hover:not(.disabled) {
  border-color: var(--primary-color);
  box-shadow: var(--shadow-sm);
}

.modal-item.disabled {
  opacity: 0.5;
}

.modal-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.modal-item-name {
  font-size: 0.95rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-item-meta {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 2000px;
  opacity: 1;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(20px);
}

.item-list-move,
.item-list-enter-active,
.item-list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.item-list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.item-list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.item-list-leave-active {
  position: absolute;
  width: 100%;
}

@media (max-width: 768px) {
  .motion-expression-manager {
    padding: 1rem;
  }

  .toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .motion-types-grid {
    grid-template-columns: 1fr;
  }
}
.modal-body textarea.import-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
}
</style>
