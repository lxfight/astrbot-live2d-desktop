<template>
  <header class="settings-page-header" :class="{ 'settings-page-header--immersive': immersive }">
    <transition name="settings-page-head" mode="out-in">
      <div :key="pageKey" class="settings-page-header__inner">
        <h2 class="settings-page-header__title">
          <span v-if="immersive" class="settings-page-header__title-art" aria-hidden="true">
            <span
              v-for="(ch, index) in titleChars"
              :key="`${pageKey}-${index}`"
              class="settings-page-header__char"
              :style="{ '--char-delay': `${index * 42}ms` }"
              >{{ ch === ' ' ? ' ' : ch }}</span
            >
          </span>
          <span v-else class="settings-page-header__title-text">{{ title }}</span>
        </h2>
        <p v-if="description" class="settings-page-header__desc">{{ description }}</p>
        <div v-if="$slots.extra" class="settings-page-header__extra">
          <slot name="extra" />
        </div>
      </div>
    </transition>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    pageKey?: string
    immersive?: boolean
  }>(),
  {
    description: '',
    pageKey: 'default',
    immersive: false
  }
)

const titleChars = computed(() => [...props.title])
</script>

<style scoped>
.settings-page-header {
  margin-bottom: 22px;
  position: relative;
}

.settings-page-header--immersive {
  text-align: center;
  margin-bottom: 38px;
  padding-top: 14px;
}

.settings-page-header__inner {
  position: relative;
}

.settings-page-header__title {
  margin: 0 0 8px;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.18;
}

.settings-page-header--immersive .settings-page-header__title {
  font-size: clamp(30px, 4.2vw, 42px);
  letter-spacing: -0.045em;
}

.settings-page-header__title-text {
  background: linear-gradient(
    120deg,
    var(--color-text-primary) 0%,
    rgba(var(--color-accent-rgb), 0.94) 55%,
    #b4a0ff 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: settings-title-shimmer 6s var(--ease-in-out) infinite;
}

@keyframes settings-title-shimmer {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.settings-page-header__title-art {
  display: inline-block;
}

.settings-page-header__char {
  display: inline-block;
  background: linear-gradient(
    135deg,
    var(--color-text-primary) 0%,
    rgba(var(--color-accent-rgb), 0.95) 55%,
    #b4a0ff 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: settings-char-in 0.62s var(--ease-spring, cubic-bezier(0.2, 0.8, 0.2, 1)) backwards;
  animation-delay: var(--char-delay, 0ms);
}

@keyframes settings-char-in {
  0% {
    opacity: 0;
    transform: translateY(14px) rotate(-2deg);
  }
  60% {
    opacity: 1;
    transform: translateY(-2px) rotate(0.5deg);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

.settings-page-header__desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.65;
  max-width: 520px;
  letter-spacing: 0.005em;
}

.settings-page-header--immersive .settings-page-header__desc {
  margin: 0 auto;
}

.settings-page-header__extra {
  margin-top: 14px;
}

.settings-page-head-enter-active {
  transition:
    opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}

.settings-page-head-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.settings-page-head-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.settings-page-head-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .settings-page-header__title-text {
    animation: none !important;
  }
}
</style>
