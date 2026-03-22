<script setup>
import { BubbleList, Sender } from 'vue-element-plus-x'

const props = defineProps({
  conversation: {
    type: Object,
    default: null,
  },
  isStreaming: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['submitMessage'])

const inputText = ref('')
const enableComposerTransition = ref(false)
const composerRef = ref(null)
const composerHeight = ref(112)
let composerResizeObserver = null

const suggestedQuestions = [
  'APT 报告里最优先处理的风险点有哪些？',
  '这次告警和历史事件相比有什么异常趋势？',
  '如果今天要联调接口，最小可验证流程是什么？',
]

const handleSuggestionPick = (question) => {
  inputText.value = question
}

const isPendingAssistantMessage = (message) =>
  message.role === 'assistant' &&
  Boolean(message.streaming) &&
  !String(message.content ?? '').trim()

const bubbleList = computed(() =>
  (props.conversation?.messages ?? []).map((message) => ({
    content: isPendingAssistantMessage(message) ? '正在生成中...' : message.content,
    placement: message.role === 'user' ? 'end' : 'start',
    variant: message.role === 'user' ? 'filled' : 'borderless',
    noStyle: !(message.role === 'user'),
    loading: isPendingAssistantMessage(message),
    shape: 'round',
    isMarkdown: true,
  })),
)

const hasMessages = computed(() => bubbleList.value.length > 0)

const welcomeTransitionName = computed(() =>
  enableComposerTransition.value ? 'chat-panel-intro' : '',
)

const messagesStyle = computed(() => ({
  paddingBottom: `${composerHeight.value + 16}px`,
}))

const updateComposerHeight = () => {
  composerHeight.value = composerRef.value?.offsetHeight ?? 112
}

watch(
  () => props.conversation?.id,
  () => {
    // 切换/新建会话时回到初始态，不播放回弹动画。
    enableComposerTransition.value = false
  },
  { immediate: true },
)

const handleSubmit = (value) => {
  if (props.isStreaming) return

  const content = String(value ?? inputText.value ?? '').trim()
  if (!content) return

  if (!hasMessages.value) {
    // 仅在“首条消息”触发中心到底部的过渡动画。
    enableComposerTransition.value = true
  }

  emit('submitMessage', content)
  inputText.value = ''
}

onMounted(() => {
  nextTick(updateComposerHeight)

  composerResizeObserver = new ResizeObserver(() => {
    updateComposerHeight()
  })

  if (composerRef.value) {
    composerResizeObserver.observe(composerRef.value)
  }
})

watch(
  () => hasMessages.value,
  async () => {
    await nextTick()

    if (!composerRef.value || !composerResizeObserver) return

    composerResizeObserver.disconnect()
    composerResizeObserver.observe(composerRef.value)
    updateComposerHeight()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  composerResizeObserver?.disconnect()
})
</script>

<template>
  <section class="chat-panel">
    <template v-if="conversation">
      <main class="chat-panel__body" :class="{ 'is-chatting': hasMessages }">
        <div v-if="hasMessages" class="chat-panel__messages" :style="messagesStyle">
          <BubbleList
            :list="bubbleList"
            max-height="100%"
            trigger-indices="only-last"
            class="chat-panel__bubble-list"
          />
        </div>

        <div
          ref="composerRef"
          class="chat-panel__composer"
          :class="{
            'is-docked': hasMessages,
            'with-transition': enableComposerTransition,
          }"
        >
          <Transition :name="welcomeTransitionName">
            <div v-if="!hasMessages" class="chat-panel__welcome">
              <div class="chat-panel__welcome-card">
                <p class="chat-panel__welcome-title">开始新会话</p>
                <p class="chat-panel__welcome-description">输入APT问题，我们会为你分析</p>
              </div>
            </div>
          </Transition>

          <Sender
            v-model="inputText"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :placeholder="isStreaming ? '正在生成回答，请稍候...' : '输入你的问题，回车发送'"
            :allow-speech="false"
            @submit="handleSubmit"
          />

          <!-- <p v-if="isStreaming" class="chat-panel__streaming-tip">正在接收流式返回...</p> -->

          <div v-if="!hasMessages" class="chat-panel__suggestions">
            <p class="chat-panel__suggestions-title">猜你想问：</p>
            <button
              v-for="question in suggestedQuestions"
              :key="question"
              type="button"
              class="chat-panel__suggestion-item"
              :class="{ 'is-selected': inputText === question }"
              @click="handleSuggestionPick(question)"
            >
              {{ question }}
            </button>
          </div>
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

.chat-panel__body {
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
  overflow: hidden;
  position: relative;
}

.chat-panel__messages {
  height: 100%;
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
}

.chat-panel__composer.with-transition {
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

.chat-panel__welcome-card {
  margin-bottom: 6px;
}

.chat-panel__welcome-title {
  margin: 0;
  color: #303133;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.25;
}

.chat-panel__welcome-description {
  margin: 10px 0 0;
  color: #606266;
  font-size: 18px;
  line-height: 1.6;
}

.chat-panel__suggestions {
  text-align: left;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.chat-panel__suggestions-title {
  margin: 0;
  color: #303133;
  font-weight: 600;
}

.chat-panel__streaming-tip {
  margin: -4px 2px 0;
  color: #909399;
  font-size: 12px;
}

.chat-panel__suggestion-item {
  display: block;
  width: 100%;
  margin: 4px 0 0;
  padding: 0;
  text-align: left;
  color: #606266;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.chat-panel__suggestion-item:hover {
  color: #409eff;
}

.chat-panel__suggestion-item.is-selected {
  color: #409eff;
  font-weight: 600;
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
