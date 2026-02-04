<template>
  <div class="welcome-container">
    <div class="welcome-card">
      <h1 class="title">欢迎使用 AstrBot Live2D</h1>
      <p class="subtitle">首次启动，请输入您的名称</p>

      <div class="input-group">
        <input
          v-model="userName"
          type="text"
          class="name-input"
          placeholder="请输入您的名称"
          maxlength="20"
          @keyup.enter="handleSubmit"
          autofocus
        />
        <p class="hint">此名称将作为您的唯一标识</p>
      </div>

      <button
        class="submit-btn"
        :disabled="!userName.trim()"
        @click="handleSubmit"
      >
        开始使用
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const userName = ref('')

async function handleSubmit() {
  const name = userName.value.trim()
  if (!name) return

  try {
    await window.electron.user.setUserName(name)
    // 设置成功后，主进程会自动关闭欢迎窗口并打开主窗口
  } catch (error) {
    console.error('设置用户名失败:', error)
    alert('设置失败，请重试')
  }
}
</script>

<style scoped>
.welcome-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.welcome-card {
  background: white;
  border-radius: 16px;
  padding: 48px 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 90%;
}

.title {
  font-size: 28px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px 0;
  text-align: center;
}

.subtitle {
  font-size: 16px;
  color: #666;
  margin: 0 0 32px 0;
  text-align: center;
}

.input-group {
  margin-bottom: 24px;
}

.name-input {
  width: 100%;
  padding: 14px 16px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.name-input:focus {
  border-color: #667eea;
}

.hint {
  font-size: 13px;
  color: #999;
  margin: 8px 0 0 0;
}

.submit-btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.3s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
