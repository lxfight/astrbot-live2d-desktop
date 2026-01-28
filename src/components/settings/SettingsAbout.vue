<template>
  <div class="about-container">
    <div class="about-header">
      <div class="logo-container">
        <!-- Placeholder for logo if image fails -->
        <AppIcon name="cube" :size="48" class="logo-icon" />
      </div>
      <div class="app-info">
        <h2 class="app-name">AstrBot Live2D Desktop</h2>
        <div class="app-version">Version 1.0.0</div>
      </div>
    </div>

    <div class="about-content">
      <section class="info-group">
        <h3 class="group-title">开发信息</h3>
        <div class="info-row">
          <span class="label">作者</span>
          <span class="value">lxfight</span>
        </div>
        <div class="info-row">
          <span class="label">开源协议</span>
          <span class="value">MIT License</span>
        </div>
        <div class="info-row">
          <span class="label">GitHub</span>
          <a href="https://github.com/Soulter/AstrBot" target="_blank" class="link">Soulter/AstrBot</a>
        </div>
      </section>

      <section class="info-group">
        <h3 class="group-title">版权声明</h3>
        <div class="legal-text">
          <p>Live2D Cubism® 是 Live2D 公司的注册商标。</p>
          <p>本应用使用 Live2D Cubism Core 和 Live2D Cubism SDK。</p>
          <p>Live2D Cubism Core: © Live2D Inc.</p>
        </div>
      </section>

      <section class="info-group">
        <h3 class="group-title">第三方组件</h3>
        <div class="tech-stack">
          <span class="tag">Vue 3</span>
          <span class="tag">Electron</span>
          <span class="tag">PixiJS</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Vite</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../icons/AppIcon.vue'
</script>

<style scoped>
.about-container {
  max-width: 600px;
  margin: 0 auto;
  padding-top: 20px;
}

.about-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;
  text-align: center;
}

.logo-container {
  width: 80px;
  height: 80px;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  color: var(--text-primary);
}

.app-name {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.app-version {
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--hover-bg);
  padding: 2px 10px;
  border-radius: 12px;
}

.about-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.info-row .label {
  color: var(--text-secondary);
}

.info-row .value {
  color: var(--text-primary);
  font-weight: 500;
}

.link {
  color: var(--text-primary);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.link:hover {
  border-color: var(--text-primary);
}

.legal-text p {
  margin: 4px 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  font-size: 12px;
  padding: 4px 10px;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
}
</style>