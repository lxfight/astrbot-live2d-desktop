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
  margin-bottom: 10px;
}

.settings-subsection__head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--settings-text-muted);
  position: relative;
  padding-left: 12px;
}

.settings-subsection__head h3::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--color-accent-hover), var(--color-accent));
  opacity: 0.7;
}
</style>
