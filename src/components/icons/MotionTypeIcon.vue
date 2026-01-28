<template>
  <span class="motion-type-icon" :title="title" aria-hidden="true">
    <svg
      v-if="name === 'idle'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'speaking'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M8 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M12 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M16 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M20 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'thinking'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M10 22h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path
        d="M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
    </svg>

    <svg
      v-else-if="name === 'happy'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M9 10h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <path d="M15 10h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'surprised'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9 9h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <path d="M15 9h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <path d="M12 17c1.66 0 3-1.12 3-2.5S13.66 12 12 12s-3 1.12-3 2.5 1.34 2.5 3 2.5Z" stroke="currentColor" stroke-width="2" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'angry'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9 10l-2-1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M15 10l2-1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'sad'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 16s1.5-2 4-2 4 2 4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M9 10h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <path d="M15 10h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'agree'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9 12l2 2 4-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'disagree'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'question'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 17h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1 1-1 1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'welcome'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'thanks'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 21s7-4.5 7-10a4 4 0 0 0-7-2 4 4 0 0 0-7 2c0 5.5 7 10 7 10Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
    </svg>

    <svg
      v-else-if="name === 'apology'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M7 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M7 21l5-7 5 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>

    <svg
      v-else-if="name === 'goodbye'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 12l4-4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M12 8v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else-if="name === 'excited'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2l1.2 4.2L17 7l-3.8 1 1.2 4-3.4-2.4L7.6 12l1.2-4L5 7l3.8-.8L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>

    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ name: string; title?: string }>()

const name = (props.name || '').trim() || 'idle'
const title = props.title
</script>

<style scoped>
.motion-type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.motion-type-icon svg {
  width: 1em;
  height: 1em;
}
</style>
