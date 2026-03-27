<script setup>
import { Bubble, Sender, XMarkdown } from 'vue-element-plus-x'
import { useClipboard } from '@vueuse/core'
import PrimaryColorTitle from './PrimaryColorTitle.vue'
import ChatSuggestions from './ChatSuggestions.vue'

const props = defineProps({
  conversation: {
    type: Object,
    default: null,
  },
  draftInput: {
    type: String,
    default: '',
  },
  isStreaming: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:draftInput', 'submitMessage', 'cancel'])

const { copy, isSupported } = useClipboard({ legacy: true })
const copiedMessageKeys = ref(new Set())
const copyResetTimers = new Map()
const COPY_SUCCESS_DURATION = 1600
const enableComposerTransition = ref(false)
const scrollContainerRef = ref(null)
const editingMessageKey = ref(null)
const editingSenderText = ref('')
const shouldAutoFollowBottom = ref(true)
const AUTO_FOLLOW_BOTTOM_THRESHOLD = 96

// 受控输入：输入框文本由上层会话态维护，避免切会话时文本丢失。
const senderText = computed({
  get: () => String(props.draftInput ?? ''),
  set: (value) => emit('update:draftInput', String(value ?? '')),
})

const handleSuggestionPick = (question) => {
  senderText.value = question
}

const setCopySuccessState = (messageKey) => {
  const nextKeys = new Set(copiedMessageKeys.value)
  nextKeys.add(messageKey)
  copiedMessageKeys.value = nextKeys

  const existingTimer = copyResetTimers.get(messageKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const resetTimer = setTimeout(() => {
    const resetKeys = new Set(copiedMessageKeys.value)
    resetKeys.delete(messageKey)
    copiedMessageKeys.value = resetKeys
    copyResetTimers.delete(messageKey)
  }, COPY_SUCCESS_DURATION)

  copyResetTimers.set(messageKey, resetTimer)
}

const isCopySuccessMessage = (message, index) =>
  copiedMessageKeys.value.has(getMessageKey(message, index))

const handleCopyMessage = async (message, index) => {
  const content = String(message?.content ?? '').trim()
  if (!content) return

  if (!isSupported.value) {
    console.warn('[ChatPanel] Clipboard API is not supported in current environment.')
    return
  }

  try {
    await copy(content)
    setCopySuccessState(getMessageKey(message, index))
  } catch (error) {
    console.error('[ChatPanel] Failed to copy message content.', error)
  }
}

const handleReEditMessage = (message, index) => {
  editingMessageKey.value = getMessageKey(message, index)
  editingSenderText.value = String(message?.content ?? '').trim()
}

const isEditingMessage = (message, index) =>
  editingMessageKey.value === getMessageKey(message, index)

const handleCancelEdit = () => {
  editingMessageKey.value = null
  editingSenderText.value = ''
}

const handleSendEdit = () => {
  // 当前会话流式中时，禁止重复提交编辑后的问题。
  if (senderLoading.value) return

  const content = String(editingSenderText.value ?? '').trim()
  if (!content) return

  // 发送后与“取消编辑”保持同一收口逻辑：关闭编辑输入框。
  handleCancelEdit()
  emit('submitMessage', content)

  // 发送后强制跟随到底部，避免停留在历史位置。
  shouldAutoFollowBottom.value = true
  nextTick(() => {
    scrollMessagesToBottom('auto')
  })
}

const handleSubmitEdit = (value) => {
  editingSenderText.value = String(value ?? '').trim()
  handleSendEdit()
}

const findQuestionForAssistantMessage = (assistantIndex) => {
  if (!Number.isInteger(assistantIndex) || assistantIndex < 0) return ''

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const candidate = messages.value[index]
    if (candidate?.role !== 'user') continue

    const content = String(candidate.content ?? '').trim()
    if (content) return content
  }

  return ''
}

const handleRefreshMessage = (_message, index) => {
  // 当前会话流式中时，禁止重复触发“刷新回答”。
  if (senderLoading.value) return

  const question = findQuestionForAssistantMessage(index)
  if (!question) return

  emit('submitMessage', question)
  senderText.value = ''

  // 刷新回答后强制回到底部，保证能看到新一轮输出。
  shouldAutoFollowBottom.value = true
  nextTick(() => {
    scrollMessagesToBottom('auto')
  })
}

const isPendingAssistantMessage = (message) =>
  message.role === 'assistant' &&
  Boolean(message.streaming) &&
  !String(message.content ?? '').trim()

const messages = computed(() => props.conversation?.messages ?? [])

const resolveMessageContent = (message) =>
  isPendingAssistantMessage(message) ? '正在生成中...' : String(message.content ?? '')

const shouldRenderMarkdownChart = (message) =>
  message?.role === 'assistant' && !isPendingAssistantMessage(message)

const getBubbleProps = (message) => ({
  content: resolveMessageContent(message),
  placement: message.role === 'user' ? 'end' : 'start',
  variant: message.role === 'user' ? 'filled' : 'borderless',
  noStyle: !(message.role === 'user'),
  maxWidth: '100%',
  loading: isPendingAssistantMessage(message),
  shape: 'round',
  isMarkdown: true,
})

const getMessageKey = (message, index) =>
  message.id ?? `${props.conversation?.id ?? 'draft'}-${message.role ?? 'unknown'}-${index}`

const hasMessages = computed(() => messages.value.length > 0)

// 输入框 loading 只由“当前会话消息”决定，杜绝跨会话串扰。
const isCurrentConversationStreaming = computed(() =>
  messages.value.some((message) => message.role === 'assistant' && Boolean(message.streaming)),
)
const senderLoading = computed(() => isCurrentConversationStreaming.value)

const latestMessageDigest = computed(() => {
  const latest = messages.value[messages.value.length - 1]
  if (!latest) return ''
  return `${latest.role}:${Number(Boolean(latest.streaming))}:${String(latest.content ?? '')}`
})

const welcomeTransitionName = computed(() =>
  enableComposerTransition.value ? 'chat-panel-intro' : '',
)

const isNearBottom = () => {
  if (!scrollContainerRef.value) return true
  const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.value
  return scrollHeight - (scrollTop + clientHeight) <= AUTO_FOLLOW_BOTTOM_THRESHOLD
}

const handleScroll = () => {
  shouldAutoFollowBottom.value = isNearBottom()
}

const scrollMessagesToBottom = (behavior = 'auto') => {
  if (!scrollContainerRef.value) return
  scrollContainerRef.value.scrollTo({
    top: scrollContainerRef.value.scrollHeight,
    behavior,
  })
  shouldAutoFollowBottom.value = true
}

const scrollMessagesToBottomIfNeeded = (behavior = 'auto') => {
  if (!shouldAutoFollowBottom.value) return
  scrollMessagesToBottom(behavior)
}

watch(
  () => props.conversation?.id,
  async () => {
    // 仅重置面板局部临时态；输入草稿由会话级状态管理。
    copiedMessageKeys.value = new Set()
    enableComposerTransition.value = false
    editingMessageKey.value = null
    editingSenderText.value = ''
    await nextTick()
    scrollMessagesToBottom()
  },
  { immediate: true },
)

const handleSubmit = (value) => {
  // 当前会话流式中时，禁止重复提交同会话新问题。
  if (senderLoading.value) return

  const content = String(value ?? senderText.value ?? '').trim()
  if (!content) return

  if (!hasMessages.value) {
    // 仅在“首条消息”触发中心到底部的过渡动画。
    enableComposerTransition.value = true
  }

  emit('submitMessage', content)
  senderText.value = ''
}

const handleCancel = () => {
  if (!senderLoading.value) return
  // 将当前会话 id 透传给 manager，做到精确取消。
  emit('cancel', props.conversation?.id)
}

onBeforeUnmount(() => {
  copyResetTimers.forEach((timer) => clearTimeout(timer))
  copyResetTimers.clear()
})

onMounted(() => {
  nextTick(() => {
    scrollMessagesToBottom()
  })
})

watch(
  () => latestMessageDigest.value,
  async () => {
    await nextTick()
    scrollMessagesToBottomIfNeeded()
  },
  { flush: 'post' },
)
</script>

<template>
  <section ref="scrollContainerRef" class="chat-panel" @scroll.passive="handleScroll">
    <main class="chat-panel__layout" :class="{ 'is-empty': !hasMessages }">
      <section class="chat-panel__messages-section" :class="{ 'is-empty': !hasMessages }">
        <div v-if="hasMessages" class="chat-panel__messages">
          <div class="chat-panel__bubble-list">
            <div v-for="(message, index) in messages" :key="getMessageKey(message, index)">
              <div v-if="isEditingMessage(message, index)" class="chat-panel__edit-composer">
                <Sender
                  v-model="editingSenderText"
                  :auto-size="{ minRows: 2, maxRows: 5 }"
                  :allow-speech="false"
                  placeholder="编辑后发送"
                  @submit="handleSubmitEdit"
                >
                  <template #action-list>
                    <div class="chat-panel__edit-actions">
                      <el-button
                        size="small"
                        round
                        class="chat-panel__edit-action chat-panel__edit-action--cancel"
                        @click="handleCancelEdit"
                      >
                        取消
                      </el-button>
                      <el-button
                        type="primary"
                        size="small"
                        round
                        class="chat-panel__edit-action chat-panel__edit-action--send"
                        @click="handleSendEdit"
                      >
                        发送
                      </el-button>
                    </div>
                  </template>
                </Sender>
              </div>
              <Bubble v-else class="chat-panel__bubble-item" v-bind="getBubbleProps(message)">
                <template v-if="shouldRenderMarkdownChart(message)" #content>
                  <XMarkdown
                    class="chat-panel__markdown-content"
                    :markdown="resolveMessageContent(message)"
                  />
                </template>
                <template #footer>
                  <div class="chat-panel__bubble-actions">
                    <button
                      type="button"
                      class="chat-panel__bubble-action"
                      @click.stop="handleCopyMessage(message, index)"
                    >
                      <el-icon>
                        <i-ep-Select v-if="isCopySuccessMessage(message, index)" />
                        <i-ep-CopyDocument v-else />
                      </el-icon>
                    </button>
                    <button
                      v-if="message.role === 'assistant'"
                      type="button"
                      class="chat-panel__bubble-action"
                      @click.stop="handleRefreshMessage(message, index)"
                    >
                      <el-icon><i-ep-Refresh /></el-icon>
                    </button>
                    <button
                      v-if="message.role === 'user'"
                      type="button"
                      class="chat-panel__bubble-action"
                      @click.stop="handleReEditMessage(message, index)"
                    >
                      <el-icon><i-ep-Edit /></el-icon>
                    </button>
                  </div>
                </template>
              </Bubble>
            </div>
          </div>
        </div>
      </section>

      <section class="chat-panel__composer-section" :class="{ 'is-empty': !hasMessages }">
        <div class="chat-panel__composer" :class="{ 'with-transition': enableComposerTransition }">
          <Transition :name="welcomeTransitionName">
            <div v-if="!hasMessages" class="chat-panel__welcome">
              <div class="chat-panel__welcome-card">
                <PrimaryColorTitle text="APT智能分析助手" tag="p" />
                <p class="chat-panel__welcome-description">
                  基于多维威胁情报与AI大模型的深度关联分析，为您提供精准的攻击溯源与防御建议
                </p>
              </div>
            </div>
          </Transition>

          <ChatSuggestions
            v-if="!hasMessages"
            :selected-question="senderText"
            @pick="handleSuggestionPick"
          />

          <Sender
            v-model="senderText"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :loading="senderLoading"
            :placeholder="senderLoading ? '正在生成回答，请稍候...' : '输入你的问题，回车发送'"
            :allow-speech="false"
            @submit="handleSubmit"
            @cancel="handleCancel"
          />
          <!-- <p v-if="isStreaming" class="chat-panel__streaming-tip">正在接收流式返回...</p> -->
        </div>
      </section>
    </main>
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

.chat-panel__bubble-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.chat-panel__bubble-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #909399;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.chat-panel__bubble-action:hover {
  color: #409eff;
  background: #ecf5ff;
}

.chat-panel__bubble-item:hover .chat-panel__bubble-actions {
  opacity: 1;
  pointer-events: auto;
}

.chat-panel__markdown-content {
  width: 100%;
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
  gap: 48px;
}

.chat-panel__composer.with-transition {
  transition: transform 0.25s ease;
}

.chat-panel__edit-composer {
  width: 100%;
}

.chat-panel__edit-actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.chat-panel__edit-composer :deep(.vepx-sender__action-list) {
  width: 100%;
}

.chat-panel__welcome {
  display: flex;
  justify-content: center;
  text-align: center;
}

.chat-panel__welcome-card {
  margin-bottom: 6px;
}

.chat-panel__welcome-description {
  margin: 10px 0 0;
  color: #606266;
  font-size: 18px;
  line-height: 1.6;
}

.chat-panel__streaming-tip {
  margin: -4px 2px 0;
  color: #909399;
  font-size: 12px;
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
