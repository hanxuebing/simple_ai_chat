import { deleteConversationApi, getConversationDetailApi, getConversationsListApi } from '@/api/conversations'
import { sendSseStream } from './useSseStream'

// 生成前端侧临时 ID（草稿消息、未持久化会话等）。
const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const STREAM_API_URL = import.meta.env.VITE_API_BASE_URL + '/chat/stream'
const DEFAULT_CONVERSATION_TITLE = '新聊天'
const TITLE_FROM_ASSISTANT_MIN_LENGTH = 20

// 截断标题，避免侧栏显示过长。
const formatTitle = (content) => {
  const trimmed = content.trim()
  if (!trimmed) return DEFAULT_CONVERSATION_TITLE
  return trimmed.length > 14 ? `${trimmed.slice(0, 14)}...` : trimmed
}

// 统一将接口字段转换为时间戳，失败时回退到当前时间。
const toTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return Date.now()
}

// 统一消息结构，兼容不同接口字段命名。
const buildMessage = (message = {}) => ({
  id: message.id ?? message.message_id ?? createId(),
  role: message.role ?? 'assistant',
  content: String(message.content ?? ''),
  time: message.time ?? message.created_at ?? message.createdAt ?? '',
  streaming: Boolean(message.streaming),
})

// 统一会话结构，确保列表、详情、草稿都能走同一套渲染逻辑。
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

// 新建“草稿会话”：用于首页默认态和“新建会话”。
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

// 仅在默认标题且回复文本足够长时，才自动生成会话标题。
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
    // 有选中的历史会话时优先返回它；否则回退到草稿会话。
    if (activeConversationId.value) {
      return (
        conversations.value.find((conversation) => conversation.id === activeConversationId.value) ??
        draftConversation.value
      )
    }

    return draftConversation.value
  })

  // 发送消息后把当前会话置顶，提升“最近会话”可见性。
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
    // 清空选中会话，进入“新聊天”草稿态。
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

    // 当前没有可用会话时，创建一个真实会话容器承载本次发送。
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

    // 还未拿到 sessionId 的会话无需请求详情（通常是本地新建态）。
    if (!conversation.sessionId) {
      conversation.loaded = true
      return conversation
    }

    if (!force && conversation.loaded) {
      return conversation
    }

    // 防止同一会话并发重复拉取。
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
      // 详情加载失败时保持当前数据，避免中断 UI。
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

      // 首页保持“新会话”草稿态，不自动激活历史会话。
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

  const deleteConversation = async (conversationId) => {
    if (!conversationId) return

    const targetConversation = getConversationById(conversationId)
    if (!targetConversation) return

    try {
      if (targetConversation.sessionId) {
        await deleteConversationApi(targetConversation.sessionId)
      }
    } catch {
      return
    }

    const targetIndex = conversations.value.findIndex((item) => item.id === conversationId)
    if (targetIndex < 0) return

    conversations.value.splice(targetIndex, 1)

    if (isStreaming.value) {
      stopStreaming()
    }
    startDraftConversation()
  }

  const resolveStreamText = (payload) => {
    // 兼容不同后端协议字段，尽量提取可展示文本。
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
      // 流式结束后再尝试用完整回复生成标题，避免早期片段误命名。
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
    // 同一时间仅允许一个流式请求，避免消息交叉写入。
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
            // 首次收到 session 事件后，绑定后端会话 ID，后续继续同一上下文。
            conversation.sessionId = String(payload.session_id)
            return
          }

          const target = conversation.messages.find((item) => item.id === assistantMessage.id)
          if (!target) return

          if (typeof payload === 'object' && payload?.done) return
          const chunk = resolveStreamText(payload)
          if (!chunk) return

          // 持续拼接 assistant 内容，驱动实时渲染。
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
    // 进入页面即拉取会话列表。
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
    deleteConversation,
    submitMessage,
    stopStreaming,
    isStreaming,
    loadConversations,
  }
}



