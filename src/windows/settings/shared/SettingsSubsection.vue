<template>
  <section class="settings-section settings-subsection">
    <header v-if="title" class="settings-subsection__head">
      <h3>{{ title }}</h3>
      <slot name="actions" />
    </header>
    <p v-if="description" class="settings-section__desc">{{ description }}</p>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<style scoped>
.settings-subsection__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.settings-subsection__head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--color-text-secondary);
}
</style>
