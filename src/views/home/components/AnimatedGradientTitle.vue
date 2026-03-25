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
  <component :is="tag" class="animated-gradient-title">
    <span class="animated-gradient-title__text">{{ props.text }}</span>
  </component>
</template>

<style scoped>
.animated-gradient-title {
  margin: 0;
}

.animated-gradient-title__text {
  --text-gradient: linear-gradient(
    110deg,
    #2d62ff 0%,
    #00b8d4 18%,
    #00c97c 36%,
    #ffc83d 54%,
    #ff5d7a 72%,
    #8d5cff 90%,
    #2d62ff 100%
  );
  display: inline-block;
  font-size: clamp(30px, 4vw, 38px);
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.2;
  color: #1f2a44;
  background-image: var(--text-gradient);
  background-size: 220% 220%;
  background-position: 0 50%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-flow 6s linear infinite;
  text-shadow: 0 1px 0 rgb(255 255 255 / 30%);
}

@keyframes gradient-flow {
  0% {
    background-position: 0 50%;
  }
  100% {
    background-position: 220% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* 无障碍降级：当系统开启“减少动态效果”时，禁用动画并固定渐变位置 */
  .animated-gradient-title__text {
    animation: none;
    background-position: 50% 50%;
  }
}
</style>
