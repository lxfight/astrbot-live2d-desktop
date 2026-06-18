<template>
  <div class="settings-page-actions">
    <slot name="status" />
    <div v-if="$slots.default" class="settings-page-actions__buttons">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.settings-page-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}

.settings-page-actions__buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
