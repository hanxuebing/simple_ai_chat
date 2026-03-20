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

      <main class="chat-panel__body">
        <BubbleList
          v-if="bubbleList.length"
          :list="bubbleList"
          max-height="100%"
          trigger-indices="only-last"
          class="chat-panel__bubble-list"
        />

        <div v-else class="chat-panel__welcome">
          <Welcome
            title="开始新会话"
            description="输入你的问题后发送，后续我们再补充联调细节与真实接口。"
            variant="borderless"
          />
        </div>
      </main>

      <footer class="chat-panel__footer">
        <Sender
          v-model="inputText"
          :auto-size="{ minRows: 2, maxRows: 5 }"
          placeholder="输入你的问题，回车发送"
          :allow-speech="false"
          @submit="handleSubmit"
        />
      </footer>
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
}

.chat-panel__bubble-list {
  height: 100%;
}

.chat-panel__welcome {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-panel__footer {
  border-top: 1px solid #ebeef5;
  padding: 12px 20px 16px;
}

.chat-panel__empty {
  margin: auto;
}
</style>
