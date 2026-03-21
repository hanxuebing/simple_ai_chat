<script setup>
import { BubbleList, Sender } from 'vue-element-plus-x'

const props = defineProps({
  conversation: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['submitMessage'])

const inputText = ref('')
const enableComposerTransition = ref(false)

const suggestedQuestions = [
  'APT 报告里最优先处理的风险点有哪些？',
  '这次告警和历史事件相比有什么异常趋势？',
  '如果今天要联调接口，最小可验证流程是什么？',
]

const handleSuggestionPick = (question) => {
  inputText.value = question
}

const bubbleList = computed(() =>
  (props.conversation?.messages ?? []).map((message) => ({
    content: message.content,
    placement: message.role === 'user' ? 'end' : 'start',
    variant: message.role === 'user' ? 'filled' : 'outlined',
    shape: 'round',
  })),
)

const hasMessages = computed(() => bubbleList.value.length > 0)

const welcomeTransitionName = computed(() =>
  enableComposerTransition.value ? 'chat-panel-intro' : '',
)

watch(
  () => props.conversation?.id,
  () => {
    // 切换/新建会话时回到初始态，不播放回弹动画。
    enableComposerTransition.value = false
  },
  { immediate: true },
)

const handleSubmit = (value) => {
  const content = String(value ?? inputText.value ?? '').trim()
  if (!content) return

  if (!hasMessages.value) {
    // 仅在“首条消息”触发中心到底部的过渡动画。
    enableComposerTransition.value = true
  }

  emit('submitMessage', content)
  inputText.value = ''
}
</script>

<template>
  <section class="chat-panel">
    <template v-if="conversation">
      <main class="chat-panel__body" :class="{ 'is-chatting': hasMessages }">
        <div v-if="hasMessages" class="chat-panel__messages">
          <BubbleList
            :list="bubbleList"
            max-height="100%"
            trigger-indices="only-last"
            class="chat-panel__bubble-list"
          />
        </div>

        <div
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
            placeholder="输入你的问题，回车发送"
            :allow-speech="false"
            @submit="handleSubmit"
          />

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
