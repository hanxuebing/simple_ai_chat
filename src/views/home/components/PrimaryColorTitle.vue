<script setup>
const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  tag: {
    type: String,
    default: 'p',
  },
})
</script>

<template>
  <component :is="tag" class="primary-color-title">
    {{ props.text }}
  </component>
</template>

<style scoped>
.primary-color-title {
  margin: 0;
  font-size: clamp(30px, 4vw, 38px);
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.2;
  color: var(--text-primary, #409eff);
}
</style>
