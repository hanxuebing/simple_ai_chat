import { sendSseStream } from './useSseStream'

const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const STREAM_API_URL = import.meta.env.VITE_APP_BASE_API + '/chat/stream'

const formatTitle = (content) => {
  const trimmed = content.trim()
  if (!trimmed) return '新聊天'
  return trimmed.length > 14 ? `${trimmed.slice(0, 14)}...` : trimmed
}

const buildConversation = (conversation = {}) => ({
  id: conversation.id ?? createId(),
  title: conversation.title ?? '新聊天',
  updatedAt: conversation.updatedAt ?? Date.now(),
  messages: conversation.messages ?? [],
})

export const useConversationManager = () => {
  const conversations = ref([buildConversation()])

  const activeConversationId = ref(conversations.value[0]?.id ?? '')
  const searchKeyword = ref('')
  const isStreaming = ref(false)
  const streamAbortController = ref(null)

  const filteredConversations = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    if (!keyword) return conversations.value

    return conversations.value.filter((conversation) => {
      const titleMatched = conversation.title.toLowerCase().includes(keyword)
      const contentMatched = conversation.messages.some((item) =>
        item.content.toLowerCase().includes(keyword),
      )
      return titleMatched || contentMatched
    })
  })

  const activeConversation = computed(
    () =>
      conversations.value.find((conversation) => conversation.id === activeConversationId.value) ??
      null,
  )

  const moveToTop = (conversationId) => {
    const currentIndex = conversations.value.findIndex((item) => item.id === conversationId)
    if (currentIndex < 1) return

    const [targetConversation] = conversations.value.splice(currentIndex, 1)
    conversations.value.unshift(targetConversation)
  }

  const createConversation = () => {
    const nextConversation = buildConversation()
    conversations.value.unshift(nextConversation)
    activeConversationId.value = nextConversation.id
  }

  const selectConversation = (conversationId) => {
    activeConversationId.value = conversationId
  }

  const updateSearchKeyword = (keyword) => {
    searchKeyword.value = keyword
  }

  const getConversationById = (conversationId) =>
    conversations.value.find((conversation) => conversation.id === conversationId) ?? null

  const resolveStreamText = (payload) => {
    if (typeof payload === 'string') return payload
    if (!payload || typeof payload !== 'object') return ''
    return (
      payload.delta ??
      payload.content ??
      payload.message ??
      payload.text ??
      payload.answer ??
      payload.token ??
      ''
    )
  }

  const finalizeAssistantMessage = ({ conversationId, assistantMessageId, fallbackText = '' }) => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return

    const assistantMessage = conversation.messages.find((item) => item.id === assistantMessageId)
    if (!assistantMessage) return

    if (!assistantMessage.content && fallbackText) {
      assistantMessage.content = fallbackText
    }

    delete assistantMessage.streaming
    conversation.updatedAt = Date.now()
  }

  const stopStreaming = () => {
    streamAbortController.value?.abort()
  }

  const submitMessage = async (rawContent) => {
    const content = String(rawContent ?? '').trim()
    if (!content) return
    if (isStreaming.value) return

    const currentConversation = activeConversation.value
    if (!currentConversation) return

    const conversationId = currentConversation.id
    const hasUserMessage = currentConversation.messages.some((message) => message.role === 'user')

    currentConversation.messages.push({
      id: createId(),
      role: 'user',
      content,
    })
    currentConversation.updatedAt = Date.now()

    if (!hasUserMessage) {
      currentConversation.title = formatTitle(content)
    }

    const assistantMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    currentConversation.messages.push(assistantMessage)
    moveToTop(conversationId)

    isStreaming.value = true
    streamAbortController.value = new AbortController()

    try {
      await sendSseStream({
        url: STREAM_API_URL,
        method: 'POST',
        body: {
          conversationId,
          message: content,
        },
        signal: streamAbortController.value.signal,
        onMessage: (payload) => {
          const conversation = getConversationById(conversationId)
          if (!conversation) return

          const target = conversation.messages.find((item) => item.id === assistantMessage.id)
          if (!target) return

          if (typeof payload === 'object' && payload?.done) return
          const chunk = resolveStreamText(payload)
          if (!chunk) return

          target.content += chunk
          conversation.updatedAt = Date.now()
        },
      })

      finalizeAssistantMessage({
        conversationId,
        assistantMessageId: assistantMessage.id,
        fallbackText: '收到请求，但流式响应内容为空。',
      })
    } catch (error) {
      const isAbortError = error?.name === 'AbortError'
      finalizeAssistantMessage({
        conversationId,
        assistantMessageId: assistantMessage.id,
        fallbackText: isAbortError
          ? '流式请求已取消。'
          : `流式请求失败：${error?.message || '未知错误'}`,
      })
    } finally {
      isStreaming.value = false
      streamAbortController.value = null
    }
  }

  return {
    searchKeyword,
    filteredConversations,
    activeConversationId,
    activeConversation,
    updateSearchKeyword,
    createConversation,
    selectConversation,
    submitMessage,
    stopStreaming,
    isStreaming,
  }
}
