import { getConversationDetailApi, getConversationsListApi } from '@/api/conversations'
import { sendSseStream } from './useSseStream'

const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const STREAM_API_URL = import.meta.env.VITE_API_BASE_URL + '/chat/stream'
const DEFAULT_CONVERSATION_TITLE = '新聊天'
const TITLE_FROM_ASSISTANT_MIN_LENGTH = 20

const formatTitle = (content) => {
  const trimmed = content.trim()
  if (!trimmed) return DEFAULT_CONVERSATION_TITLE
  return trimmed.length > 14 ? `${trimmed.slice(0, 14)}...` : trimmed
}

const toTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return Date.now()
}

const buildMessage = (message = {}) => ({
  id: message.id ?? message.message_id ?? createId(),
  role: message.role ?? 'assistant',
  content: String(message.content ?? ''),
  time: message.time ?? message.created_at ?? message.createdAt ?? '',
  streaming: Boolean(message.streaming),
})

const buildConversation = (conversation = {}) => {
  const id = String(conversation.id ?? conversation.session_id ?? conversation.sessionId ?? createId())
  const sessionId = String(conversation.sessionId ?? conversation.session_id ?? id ?? '')
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.map((message) => buildMessage(message))
    : []

  return {
    id,
    sessionId,
    title: conversation.title ?? DEFAULT_CONVERSATION_TITLE,
    updatedAt: toTimestamp(
      conversation.updatedAt ?? conversation.updated_at ?? conversation.created_at ?? Date.now(),
    ),
    messages,
    loaded: conversation.loaded ?? messages.length > 0,
    messageCount: Number(conversation.message_count ?? conversation.messageCount ?? messages.length),
  }
}

const createDraftConversation = () =>
  buildConversation({
    id: `draft_${createId()}`,
    sessionId: '',
    loaded: true,
    messages: [],
    updatedAt: Date.now(),
    title: DEFAULT_CONVERSATION_TITLE,
    messageCount: 0,
  })

const getTextLength = (value) => String(value ?? '').replace(/\s+/g, '').length

const normalizeTitleText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const shouldGenerateTitle = (title, content) => {
  if (title && title !== DEFAULT_CONVERSATION_TITLE) return false
  return getTextLength(content) >= TITLE_FROM_ASSISTANT_MIN_LENGTH
}

export const useConversationManager = () => {
  const conversations = ref([])

  const activeConversationId = ref('')
  const searchKeyword = ref('')
  const isStreaming = ref(false)
  const streamAbortController = ref(null)
  const loadingConversationDetailSet = new Set()
  const draftConversation = ref(createDraftConversation())

  const filteredConversations = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    if (!keyword) return conversations.value

    return conversations.value.filter((conversation) => {
      const titleMatched = String(conversation.title ?? '')
        .toLowerCase()
        .includes(keyword)
      const contentMatched = conversation.messages.some((item) =>
        String(item.content ?? '')
          .toLowerCase()
          .includes(keyword),
      )
      return titleMatched || contentMatched
    })
  })

  const activeConversation = computed(() => {
    if (activeConversationId.value) {
      return (
        conversations.value.find((conversation) => conversation.id === activeConversationId.value) ??
        draftConversation.value
      )
    }

    return draftConversation.value
  })

  const moveToTop = (conversationId) => {
    const currentIndex = conversations.value.findIndex((item) => item.id === conversationId)
    if (currentIndex < 1) return

    const [targetConversation] = conversations.value.splice(currentIndex, 1)
    conversations.value.unshift(targetConversation)
  }

  const updateSearchKeyword = (keyword) => {
    searchKeyword.value = keyword
  }

  const getConversationById = (conversationId) =>
    conversations.value.find((conversation) => conversation.id === conversationId) ?? null

  const startDraftConversation = () => {
    activeConversationId.value = ''
    draftConversation.value = createDraftConversation()
  }

  const maybeAssignConversationTitle = (conversation, assistantText) => {
    const normalizedText = normalizeTitleText(assistantText)
    if (!shouldGenerateTitle(conversation?.title, normalizedText)) return

    conversation.title = formatTitle(normalizedText)
  }

  const ensureConversationForSubmit = () => {
    const currentId = activeConversationId.value
    if (currentId) {
      const selectedConversation = getConversationById(currentId)
      if (selectedConversation) return selectedConversation
    }

    const nextConversation = buildConversation({
      id: createId(),
      sessionId: '',
      loaded: true,
      messages: [],
      updatedAt: Date.now(),
      title: DEFAULT_CONVERSATION_TITLE,
      messageCount: 0,
    })

    conversations.value.unshift(nextConversation)
    activeConversationId.value = nextConversation.id
    return nextConversation
  }

  const loadConversationDetail = async (conversationId, { force = false } = {}) => {
    const conversation = getConversationById(conversationId)
    if (!conversation) return null

    if (!conversation.sessionId) {
      conversation.loaded = true
      return conversation
    }

    if (!force && conversation.loaded) {
      return conversation
    }

    if (loadingConversationDetailSet.has(conversationId)) {
      return conversation
    }

    loadingConversationDetailSet.add(conversationId)

    try {
      const detail = await getConversationDetailApi(conversation.sessionId)
      const normalizedDetail = buildConversation({
        ...detail,
        id: conversation.id,
        sessionId: conversation.sessionId,
        loaded: true,
      })

      conversation.title = normalizedDetail.title || conversation.title
      conversation.updatedAt = normalizedDetail.updatedAt
      conversation.messages = normalizedDetail.messages
      conversation.messageCount = Math.max(
        normalizedDetail.messageCount,
        normalizedDetail.messages.length,
      )
      conversation.loaded = true

      return conversation
    } catch {
      return null
    } finally {
      loadingConversationDetailSet.delete(conversationId)
    }
  }

  const loadConversations = async () => {
    try {
      const response = await getConversationsListApi({
        page: 1,
        page_size: 100,
      })

      const list = Array.isArray(response?.conversations) ? response.conversations : []

      conversations.value = list.map((item) =>
        buildConversation({
          ...item,
          id: item.session_id ?? item.id,
          sessionId: item.session_id ?? item.sessionId ?? item.id,
          messages: [],
          loaded: false,
        }),
      )

      if (!conversations.value.length) {
        startDraftConversation()
        return
      }

      // 首页初始化保持“新会话”草稿态，不默认选中历史会话。
      startDraftConversation()
    } catch {
      conversations.value = []
      startDraftConversation()
    }
  }

  const createConversation = () => {
    startDraftConversation()
  }

  const selectConversation = async (conversationId) => {
    if (!conversationId) {
      startDraftConversation()
      return
    }

    activeConversationId.value = conversationId
    await loadConversationDetail(conversationId)
  }

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

    const usedFallbackText = !assistantMessage.content && Boolean(fallbackText)
    if (usedFallbackText) {
      assistantMessage.content = fallbackText
    } else {
      maybeAssignConversationTitle(conversation, assistantMessage.content)
    }

    delete assistantMessage.streaming
    conversation.updatedAt = Date.now()
    conversation.messageCount = conversation.messages.length
  }

  const stopStreaming = () => {
    streamAbortController.value?.abort()
  }

  const submitMessage = async (rawContent) => {
    const content = String(rawContent ?? '').trim()
    if (!content) return
    if (isStreaming.value) return

    const currentConversation = ensureConversationForSubmit()
    if (!currentConversation) return

    const conversationId = currentConversation.id

    currentConversation.messages.push({
      id: createId(),
      role: 'user',
      content,
    })
    currentConversation.updatedAt = Date.now()
    currentConversation.loaded = true

    const assistantMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    currentConversation.messages.push(assistantMessage)
    currentConversation.messageCount = currentConversation.messages.length
    moveToTop(conversationId)

    isStreaming.value = true
    streamAbortController.value = new AbortController()

    try {
      const body = {
        conversationId,
        message: content,
      }

      if (currentConversation.sessionId) {
        body.session_id = currentConversation.sessionId
      }

      await sendSseStream({
        url: STREAM_API_URL,
        method: 'POST',
        body,
        signal: streamAbortController.value.signal,
        onMessage: (payload, event) => {
          const conversation = getConversationById(conversationId)
          if (!conversation) return

          if (event === 'session' && typeof payload === 'object' && payload?.session_id) {
            conversation.sessionId = String(payload.session_id)
            return
          }

          const target = conversation.messages.find((item) => item.id === assistantMessage.id)
          if (!target) return

          if (typeof payload === 'object' && payload?.done) return
          const chunk = resolveStreamText(payload)
          if (!chunk) return

          target.content += chunk
          maybeAssignConversationTitle(conversation, target.content)
          conversation.updatedAt = Date.now()
          conversation.messageCount = conversation.messages.length
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
          ? '请求已取消。'
          : `请求失败：${error?.message || '未知错误'}`,
      })
    } finally {
      isStreaming.value = false
      streamAbortController.value = null
    }
  }

  onMounted(() => {
    loadConversations()
  })

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
    loadConversations,
  }
}

