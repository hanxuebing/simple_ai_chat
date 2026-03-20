<script setup>
import { BubbleList, Sender, Welcome } from 'vue-element-plus-x'

const props = defineProps({
  conversation: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['submitMessage'])

const inputText = ref('')

const bubbleList = computed(() =>
  (props.conversation?.messages ?? []).map((message) => ({
    content: message.content,
    placement: message.role === 'user' ? 'end' : 'start',
    variant: message.role === 'user' ? 'filled' : 'outlined',
    shape: 'round',
  })),
)

const hasMessages = computed(() => bubbleList.value.length > 0)

const formatFullTime = (timestamp) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
  })
}

const handleSubmit = (value) => {
  const content = String(value ?? inputText.value ?? '').trim()
  if (!content) return

  emit('submitMessage', content)
  inputText.value = ''
}
</script>

<template>
  <section class="chat-panel">
    <template v-if="conversation">
      <header class="chat-panel__header">
        <h2 class="chat-panel__title">{{ conversation.title }}</h2>
        <span class="chat-panel__time">
          最近更新：{{ formatFullTime(conversation.updatedAt) }}
        </span>
      </header>

      <main class="chat-panel__body" :class="{ 'is-chatting': hasMessages }">
        <div v-if="hasMessages" class="chat-panel__messages">
          <BubbleList
            :list="bubbleList"
            max-height="100%"
            trigger-indices="only-last"
            class="chat-panel__bubble-list"
          />
        </div>

        <div class="chat-panel__composer" :class="{ 'is-docked': hasMessages }">
          <Transition name="chat-panel-intro">
            <div v-if="!hasMessages" class="chat-panel__welcome">
              <Welcome
                title="开始新会话"
                description="输入你的问题后发送，后续我们再补充联调细节与真实接口。"
                variant="borderless"
              />
            </div>
          </Transition>

          <Sender
            v-model="inputText"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            placeholder="输入你的问题，回车发送"
            :allow-speech="false"
            @submit="handleSubmit"
          />
        </div>
      </main>
    </template>

    <ElEmpty v-else description="请先创建一个会话" class="chat-panel__empty" />
  </section>
</template>

<style scoped>
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.chat-panel__header {
  border-bottom: 1px solid #ebeef5;
  padding: 16px 20px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.chat-panel__title {
  margin: 0;
  font-size: 18px;
  color: #1f2937;
}

.chat-panel__time {
  color: #909399;
  font-size: 12px;
}

.chat-panel__body {
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
  overflow: hidden;
  position: relative;
}

.chat-panel__messages {
  height: 100%;
  padding-bottom: 112px;
}

.chat-panel__bubble-list {
  height: 100%;
}

.chat-panel__composer {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(820px, calc(100% - 40px));
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition:
    top 0.35s ease,
    bottom 0.35s ease,
    transform 0.35s ease;
}

.chat-panel__welcome {
  display: flex;
  justify-content: center;
  text-align: center;
}

.chat-panel__composer.is-docked {
  top: auto;
  bottom: 16px;
  transform: translateX(-50%);
}

.chat-panel-intro-enter-active,
.chat-panel-intro-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.chat-panel-intro-enter-from,
.chat-panel-intro-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.chat-panel__empty {
  margin: auto;
}
</style>
