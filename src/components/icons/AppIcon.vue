<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :stroke="stroke"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <title v-if="title">{{ title }}</title>

    <template v-else-if="name === 'x'">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </template>

    <template v-else-if="name === 'minus'">
      <path d="M5 12h14" />
    </template>

    <template v-else-if="name === 'square'">
      <rect x="5" y="5" width="14" height="14" rx="2" ry="2" />
    </template>

    <template v-else-if="name === 'check'">
      <path d="M20 6 9 17l-5-5" />
    </template>

    <template v-else-if="name === 'sun'">
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.22 4.22l1.42 1.42" />
      <path d="M18.36 18.36l1.42 1.42" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.22 19.78l1.42-1.42" />
      <path d="M18.36 5.64l1.42-1.42" />
      <circle cx="12" cy="12" r="4" />
    </template>

    <template v-else-if="name === 'moon'">
      <path
        d="M21 13.5A8 8 0 1 1 10.5 3.5a6 6 0 1 0 10.5 10Z"
      />
    </template>

    <!-- Navigation -->
    <template v-else-if="name === 'sliders'">
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M2 14h4" />
      <path d="M10 12h4" />
      <path d="M18 16h4" />
    </template>

    <template v-else-if="name === 'cube'">
      <path d="M21 16V8" />
      <path d="M3 16V8" />
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M12 13v8" />
      <path d="M21 16l-9 5-9-5" />
    </template>

    <template v-else-if="name === 'sparkles'">
      <path d="M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2Z" />
      <path d="M19 13l.9 3.1L23 17l-3.1.9L19 21l-.9-3.1L15 17l3.1-.9L19 13Z" />
    </template>

    <template v-else-if="name === 'plug'">
      <path d="M12 2v6" />
      <path d="M10 8h4" />
      <path d="M7 8v5a5 5 0 0 0 10 0V8" />
      <path d="M12 18v4" />
    </template>

    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </template>

    <template v-else-if="name === 'bar-chart'">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20V8" />
    </template>

    <template v-else-if="name === 'monitor'">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </template>

    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </template>

    <!-- Actions -->
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </template>

    <template v-else-if="name === 'refresh-cw'">
      <path d="M21 12a9 9 0 0 0-15.3-6.3" />
      <path d="M3 12a9 9 0 0 0 15.3 6.3" />
      <path d="M3 4v6h6" />
      <path d="M21 20v-6h-6" />
    </template>

    <template v-else-if="name === 'download'">
      <path d="M12 3v10" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 21h16" />
    </template>

    <template v-else-if="name === 'upload'">
      <path d="M12 21V11" />
      <path d="M8 13l4-4 4 4" />
      <path d="M4 3h16" />
    </template>

    <template v-else-if="name === 'trash'">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 16h10l1-16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </template>

    <template v-else-if="name === 'plus'">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </template>

    <template v-else-if="name === 'play'">
      <path d="M9 7l10 5-10 5V7Z" />
    </template>

    <template v-else-if="name === 'arrow-up'">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </template>

    <template v-else-if="name === 'arrow-down'">
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </template>

    <template v-else-if="name === 'shuffle'">
      <path d="M16 3h5v5" />
      <path d="M4 20l7-7" />
      <path d="M4 4l7 7" />
      <path d="M21 16v5h-5" />
      <path d="M14 14l7 7" />
      <path d="M14 10l7-7" />
    </template>

    <template v-else-if="name === 'inbox'">
      <path d="M4 4h16v12H4z" />
      <path d="M4 16l4 4h8l4-4" />
      <path d="M8 12h8" />
    </template>

    <template v-else-if="name === 'eye'">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </template>

    <template v-else-if="name === 'eye-off'">
      <path d="M3 3l18 18" />
      <path d="M10.7 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-4.2 5.2" />
      <path d="M6.2 6.2A18 18 0 0 0 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </template>

    <template v-else-if="name === 'copy'">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
    </template>

    <!-- Emotions / Actions -->
    <template v-else-if="name === 'smile'">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </template>

    <template v-else-if="name === 'frown'">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </template>

    <template v-else-if="name === 'meh'">
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="15" x2="16" y2="15" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </template>

    <template v-else-if="name === 'message-circle'">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </template>

    <template v-else-if="name === 'activity'">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </template>

    <template v-else-if="name === 'thumbs-up'">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </template>

    <template v-else-if="name === 'thumbs-down'">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </template>

    <template v-else-if="name === 'heart'">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </template>

    <template v-else-if="name === 'zap'">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </template>

    <template v-else-if="name === 'hand'">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </template>
    
    <template v-else-if="name === 'flag'">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </template>
    
    <template v-else-if="name === 'help-circle'">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </template>

    <template v-else-if="name === 'log-out'">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </template>

    <!-- Fallback -->
    <template v-else>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" />
      <path d="M12 12v4" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    strokeWidth?: number
    title?: string
    ariaLabel?: string
    stroke?: string
  }>(),
  {
    size: 18,
    strokeWidth: 2,
    title: undefined,
    ariaLabel: undefined,
    stroke: 'currentColor'
  }
)

const name = computed(() => (props.name || '').trim())
const size = computed(() => props.size)
const strokeWidth = computed(() => props.strokeWidth)
const title = computed(() => props.title)
const ariaLabel = computed(() => props.ariaLabel || props.title || props.name)
const stroke = computed(() => props.stroke)
</script>

<style scoped>
.app-icon {
  display: inline-block;
  vertical-align: -0.12em;
}
</style>

