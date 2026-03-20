<template>
  <div class="window-shell" :class="{ 'window-shell--centered': centered }">
    <div class="window-shell__ambient">
      <span class="window-shell__orb window-shell__orb--a"></span>
      <span class="window-shell__orb window-shell__orb--b"></span>
    </div>

    <div class="window-shell__frame">
      <header class="window-shell__header window-drag-region">
        <div class="window-shell__heading">
          <div v-if="icon" class="window-shell__icon window-no-drag">
            <component :is="icon" :size="18" />
          </div>
          <h1 class="window-shell__title">{{ title }}</h1>
        </div>

        <div class="window-shell__actions window-no-drag">
          <slot name="topbar-extra"></slot>
          <button v-if="showClose" class="window-shell__close" type="button" @click="$emit('close')">
            <X :size="16" />
          </button>
        </div>
      </header>

      <section v-if="hasHero" class="window-shell__hero">
        <slot name="hero"></slot>
      </section>

      <div class="window-shell__body" :class="{ 'window-shell__body--with-aside': hasAside }">
        <aside v-if="hasAside" class="window-shell__aside">
          <slot name="aside"></slot>
        </aside>
        <main class="window-shell__content">
          <slot></slot>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import type { Component } from 'vue'
import { X } from 'lucide-vue-next'

withDefaults(defineProps<{
  title: string
  icon?: Component
  showClose?: boolean
  centered?: boolean
}>(), {
  icon: undefined,
  showClose: true,
  centered: false,
})

defineEmits<{
  close: []
}>()

const slots = useSlots()
const hasHero = computed(() => Boolean(slots.hero))
const hasAside = computed(() => Boolean(slots.aside))
</script>

<style scoped lang="scss">
.window-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  color: var(--color-text-primary);
  background:
    radial-gradient(circle at top left, var(--color-accent-soft), transparent 35%),
    radial-gradient(circle at bottom right, rgba(var(--color-accent-rgb), 0.14), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 20%);

  &--centered {
    .window-shell__content {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}

.window-shell__ambient {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.window-shell__orb {
  position: absolute;
  display: block;
  border-radius: 999px;
  filter: blur(60px);
  opacity: 0.9;

  &--a {
    top: -120px;
    left: -60px;
    width: 280px;
    height: 280px;
    background: rgba(var(--color-accent-rgb), 0.18);
  }

  &--b {
    right: -120px;
    bottom: -140px;
    width: 340px;
    height: 340px;
    background: rgba(var(--color-accent-rgb), 0.12);
  }
}

.window-shell__frame {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 18px;
}

.window-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px;
  background: #0f1520;
  border: 1px solid var(--surface-border);
  border-bottom: none;
  border-radius: 28px 28px 0 0;
}

.window-shell__heading {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.window-shell__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  color: var(--theme-accent-contrast);
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  box-shadow: 0 12px 30px rgba(var(--color-accent-rgb), 0.24);
}

.window-shell__title {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.window-shell__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.window-shell__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-tertiary);
  transition: background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);

  &:hover {
    background: var(--color-error-soft);
    color: var(--color-error);
  }

  &:active {
    transform: scale(0.94);
  }
}

.window-shell__hero {
  padding: 20px 22px 0;
  background: #0f1520;
  border-left: 1px solid var(--surface-border);
  border-right: 1px solid var(--surface-border);
}

.window-shell__body {
  flex: 1;
  min-height: 0;
  display: grid;
  background: #0f1520;
  border: 1px solid var(--surface-border);
  border-radius: 0 0 28px 28px;
  overflow: hidden;

  &--with-aside {
    grid-template-columns: minmax(220px, 260px) 1fr;
  }
}

.window-shell__aside {
  min-width: 0;
  padding: 22px;
  border-right: 1px solid var(--surface-border);
  background: linear-gradient(180deg, rgba(var(--color-accent-rgb), 0.08), transparent 32%);
  overflow-y: auto;
}

.window-shell__content {
  min-width: 0;
  padding: 22px;
  overflow-y: auto;
}

@media (max-width: 960px) {
  .window-shell__frame {
    padding: 12px;
  }

  .window-shell__header {
    padding: 16px 18px;
    border-radius: 22px 22px 0 0;
  }

  .window-shell__body {
    border-radius: 0 0 22px 22px;

    &--with-aside {
      grid-template-columns: 1fr;
    }
  }

  .window-shell__aside {
    border-right: none;
    border-bottom: 1px solid var(--surface-border);
  }
}
</style>
