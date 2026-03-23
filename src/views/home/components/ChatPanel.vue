<script setup>
import { Bubble, Sender } from 'vue-element-plus-x'

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
const scrollContainerRef = ref(null)

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

const messages = computed(() => props.conversation?.messages ?? [])

const resolveMessageContent = (message) =>
  isPendingAssistantMessage(message) ? '正在生成中...' : String(message.content ?? '')

const getBubbleProps = (message) => ({
  content: resolveMessageContent(message),
  placement: message.role === 'user' ? 'end' : 'start',
  variant: message.role === 'user' ? 'filled' : 'borderless',
  noStyle: !(message.role === 'user'),
  loading: isPendingAssistantMessage(message),
  shape: 'round',
  isMarkdown: true,
})

const getMessageKey = (message, index) =>
  message.id ?? `${props.conversation?.id ?? 'draft'}-${message.role ?? 'unknown'}-${index}`

const hasMessages = computed(() => messages.value.length > 0)

const latestMessageDigest = computed(() => {
  const latest = messages.value[messages.value.length - 1]
  if (!latest) return ''
  return `${latest.role}:${Number(Boolean(latest.streaming))}:${String(latest.content ?? '')}`
})

const welcomeTransitionName = computed(() =>
  enableComposerTransition.value ? 'chat-panel-intro' : '',
)

const scrollMessagesToBottom = (behavior = 'auto') => {
  if (!scrollContainerRef.value) return
  scrollContainerRef.value.scrollTo({
    top: scrollContainerRef.value.scrollHeight,
    behavior,
  })
}

watch(
  () => props.conversation?.id,
  async () => {
    // 切换/新建会话时回到初始态，不播放回弹动画。
    enableComposerTransition.value = false
    await nextTick()
    scrollMessagesToBottom()
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
  nextTick(() => {
    scrollMessagesToBottom()
  })
})

watch(
  () => latestMessageDigest.value,
  async () => {
    await nextTick()
    scrollMessagesToBottom()
  },
  { flush: 'post' },
)
</script>

<template>
  <section ref="scrollContainerRef" class="chat-panel">
    <template v-if="conversation">
      <main class="chat-panel__layout" :class="{ 'is-empty': !hasMessages }">
        <section class="chat-panel__messages-section" :class="{ 'is-empty': !hasMessages }">
          <div v-if="hasMessages" class="chat-panel__messages">
            <div class="chat-panel__bubble-list">
              <Bubble
                v-for="(message, index) in messages"
                :key="getMessageKey(message, index)"
                v-bind="getBubbleProps(message)"
              />
            </div>
          </div>
        </section>

        <section class="chat-panel__composer-section" :class="{ 'is-empty': !hasMessages }">
          <div
            class="chat-panel__composer"
            :class="{ 'with-transition': enableComposerTransition }"
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
        </section>
      </main>
    </template>

    <ElEmpty v-else description="请先创建一个会话" class="chat-panel__empty" />
  </section>
</template>

<style scoped>
.chat-panel {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 20px;
  scrollbar-gutter: stable;
  background-color: #fff;
}

.chat-panel__layout {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-panel__layout.is-empty {
  min-height: max(100%, 640px);
  justify-content: center;
  padding: 16px 0;
  gap: 20px;
}

.chat-panel__messages-section {
  flex: 1;
  min-height: 0;
  padding-top: 16px;
}

.chat-panel__messages-section.is-empty {
  flex: 0 0 auto;
  min-height: 0;
  padding-top: 0;
}

.chat-panel__messages {
  min-height: calc(100% - 16px);
}

.chat-panel__bubble-list {
  width: min(820px, calc(100% - 40px));
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 0;
  padding-bottom: 100px;
}

.chat-panel__composer-section {
  position: sticky;
  bottom: 0;
  z-index: 3;
  padding-bottom: 32px;
  background: #fff;
  /* background: linear-gradient(to bottom, rgb(255 255 255 / 0%) 0%, #fff 34px); */
}

.chat-panel__composer-section.is-empty {
  position: relative;
  bottom: auto;
  padding-bottom: 0;
  background: transparent;
}

.chat-panel__composer {
  width: min(820px, calc(100% - 40px));
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-panel__composer.with-transition {
  transition: transform 0.25s ease;
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
  margin: 18vh auto 0;
}

@media (max-width: 768px) {
  .chat-panel {
    padding: 0 12px;
  }

  .chat-panel__layout.is-empty {
    min-height: max(100%, 520px);
    padding: 12px 0;
    gap: 16px;
  }

  .chat-panel__bubble-list,
  .chat-panel__composer {
    width: 100%;
  }

  .chat-panel__composer-section {
    bottom: 12px;
    padding-bottom: 12px;
  }

  .chat-panel__composer-section.is-empty {
    padding-bottom: 0;
  }
}
</style>
