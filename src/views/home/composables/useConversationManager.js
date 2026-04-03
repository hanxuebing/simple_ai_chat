import {
  deleteConversationApi,
  getConversationDetailApi,
  getConversationsListApi,
  stopConversationStreamApi,
} from '@/api/conversations'
import { sendSseStream } from './useSseStream'

/**
 * 统一管理首页聊天会话的状态与行为。
 *
 * 这个 composable 主要解决三类问题：
 * 1. 会话列表 / 当前激活会话 / 草稿会话的切换。
 * 2. 每个会话各自独立的输入草稿与流式请求状态。
 * 3. 列表接口、详情接口、SSE 回包之间的数据结构归一化。
 */

// 生成前端侧临时 ID（草稿消息、未持久化会话等）。
const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const STREAM_API_URL = import.meta.env.VITE_API_BASE_URL + '/chat/stream'
const DEFAULT_CONVERSATION_TITLE = '新聊天'

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
  const id = String(
    conversation.id ?? conversation.session_id ?? conversation.sessionId ?? createId(),
  )
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
    messageCount: Number(
      conversation.message_count ?? conversation.messageCount ?? messages.length,
    ),
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

const normalizeTitleText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

export const useConversationManager = () => {
  const conversations = ref([])

  // activeConversationId 仅用于“选中哪条历史会话”；空字符串表示当前处于草稿会话。
  const activeConversationId = ref('')
  const searchKeyword = ref('')

  // 核心隔离状态：每个会话一个 AbortController，互不影响。
  // key: conversationId, value: AbortController
  const streamingControllersByConversationId = ref(new Map())

  // 用于防抖同一会话详情的重复请求；不是响应式状态，因为它不直接参与渲染。
  const loadingConversationDetailSet = new Set()

  // 当前“新聊天”占位会话。它不一定已经在后端落库，但 UI 会把它当成当前会话来展示。
  const draftConversation = ref(createDraftConversation())

  // 输入草稿隔离：每个会话保存各自输入框文本。
  // key: conversationId(含 draft_xxx), value: string
  const draftInputByConversationId = ref(new Map())

  // 初始化当前草稿输入态。
  draftInputByConversationId.value.set(draftConversation.value.id, '')

  // 把“当前会话键”统一收敛到：activeConversationId 或当前 draftConversation.id。
  const resolveConversationInputKey = (conversationId = activeConversationId.value) =>
    String(conversationId ?? '').trim() || draftConversation.value.id

  // 读取某个会话的输入草稿；如果没有显式传入 id，就读取当前会话对应的草稿。
  const getDraftInputByConversationId = (conversationId = '') => {
    const key = resolveConversationInputKey(conversationId)
    return draftInputByConversationId.value.get(key) ?? ''
  }

  // 保证每个会话切换回来时，都能恢复自己上次输入到一半的内容。
  const setDraftInputByConversationId = (conversationId = '', value = '') => {
    const key = resolveConversationInputKey(conversationId)
    draftInputByConversationId.value.set(key, String(value ?? ''))
  }

  const clearDraftInputByConversationId = (conversationId = '') => {
    setDraftInputByConversationId(conversationId, '')
  }

  // ChatPanel 的 v-model 会通过这个方法写回当前会话草稿。
  const updateActiveDraftInput = (value) => {
    setDraftInputByConversationId(activeConversationId.value, value)
  }

  const getStreamingController = (conversationId = '') => {
    const key = String(conversationId ?? '').trim()
    if (!key) return null
    return streamingControllersByConversationId.value.get(key) ?? null
  }

  const setStreamingController = (conversationId = '', controller = null) => {
    const key = String(conversationId ?? '').trim()
    if (!key || !controller) return
    streamingControllersByConversationId.value.set(key, controller)
  }

  const deleteStreamingController = (conversationId = '') => {
    const key = String(conversationId ?? '').trim()
    if (!key) return
    streamingControllersByConversationId.value.delete(key)
  }

  const isConversationStreaming = (conversationId = '') =>
    Boolean(getStreamingController(conversationId))

  const activeConversation = computed(() => {
    // 有选中的历史会话时优先返回它；否则回退到草稿会话。
    if (activeConversationId.value) {
      return (
        conversations.value.find(
          (conversation) => conversation.id === activeConversationId.value,
        ) ?? draftConversation.value
      )
    }

    return draftConversation.value
  })

  const activeDraftInput = computed(() => getDraftInputByConversationId(activeConversationId.value))

  // 全局是否存在任意会话流式中（用于上层全局标识，非输入框 loading 判定）。
  const isStreaming = computed(() => streamingControllersByConversationId.value.size > 0)

  // 基于当前会话实体 ID 判定流式状态，避免草稿态与历史会话相互污染。
  const activeConversationKey = computed(() => String(activeConversation.value?.id ?? '').trim())
  const isActiveConversationStreaming = computed(() => {
    if (!activeConversationKey.value) return false
    return isConversationStreaming(activeConversationKey.value)
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

  const resolveConversationId = (conversationIdOrSessionId = '') => {
    const target = String(conversationIdOrSessionId ?? '').trim()
    if (!target) return ''

    // 允许外部既传前端会话 id，也传后端 session_id，统一映射到本地 conversation.id。
    const matchedConversation = conversations.value.find(
      (conversation) => conversation.id === target || conversation.sessionId === target,
    )

    return matchedConversation?.id ?? ''
  }

  const getConversationById = (conversationId) =>
    conversations.value.find((conversation) => conversation.id === conversationId) ?? null

  const startDraftConversation = () => {
    // 清空选中会话，进入“新聊天”草稿态。
    // 这里会创建一个全新 draft id，确保草稿输入与历史草稿完全隔离。
    const previousDraftId = draftConversation.value.id
    activeConversationId.value = ''
    draftConversation.value = createDraftConversation()

    if (previousDraftId) {
      draftInputByConversationId.value.delete(previousDraftId)
    }
    draftInputByConversationId.value.set(draftConversation.value.id, '')
  }

  const maybeAssignConversationTitleFromFirstQuestion = (conversation, questionText) => {
    const normalizedText = normalizeTitleText(questionText)
    if (!normalizedText) return
    if (conversation?.title && conversation.title !== DEFAULT_CONVERSATION_TITLE) return

    // 仅在标题还是默认值时，才拿首问内容生成标题，避免覆盖用户已有标题。
    conversation.title = formatTitle(normalizedText)
  }

  const ensureConversationForSubmit = () => {
    const currentId = activeConversationId.value
    if (currentId) {
      const selectedConversation = getConversationById(currentId)
      if (selectedConversation) return selectedConversation
    }

    // 当前是草稿态发送：将草稿提升为真实会话容器后再发送。
    // 注意：这里先创建本地会话，真正的后端 session_id 会在 SSE session 事件中回填。
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
    clearDraftInputByConversationId(nextConversation.id)
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

      // 详情接口返回的数据结构可能和列表接口不同，这里统一再走一次 buildConversation。
      const normalizedDetail = buildConversation({
        ...detail,
        id: conversation.id,
        sessionId: conversation.sessionId,
        loaded: true,
      })

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

      // 列表接口只用于渲染侧边栏，因此先构造“轻量会话”，详情在用户点开后再懒加载。
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
    // 不中断任何已有流式；仅切换到新草稿会话。
    startDraftConversation()
  }

  const selectConversation = async (conversationIdOrSessionId) => {
    if (!conversationIdOrSessionId) {
      startDraftConversation()
      return
    }

    const resolvedConversationId = resolveConversationId(conversationIdOrSessionId)
    if (!resolvedConversationId) return

    activeConversationId.value = resolvedConversationId
    await loadConversationDetail(resolvedConversationId)
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

    // 本地删除放在接口成功后执行，避免服务端失败但前端状态提前丢失。
    conversations.value.splice(targetIndex, 1)
    draftInputByConversationId.value.delete(conversationId)

    // 只停止被删除会话的流式，其他会话不受影响。
    if (isConversationStreaming(conversationId)) {
      stopStreaming(conversationId)
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

    // 如果整个流结束后都没有拼出正文，则填入一个兜底文案，避免界面上出现空消息气泡。
    const usedFallbackText = !assistantMessage.content && Boolean(fallbackText)
    if (usedFallbackText) {
      assistantMessage.content = fallbackText
    }

    // streaming 字段只在流式过程中有意义，收尾时删掉让消息回归普通态。
    delete assistantMessage.streaming
    conversation.updatedAt = Date.now()
    conversation.messageCount = conversation.messages.length
  }

  const stopStreaming = (
    conversationId = activeConversation.value?.id ?? activeConversationId.value,
  ) => {
    const targetConversationId = String(conversationId ?? '').trim()
    if (!targetConversationId) return

    // 关键点：只 abort 指定会话 controller，不做全局 abort。
    const controller = getStreamingController(targetConversationId)
    if (!controller) return
    controller.abort()

    const targetConversation = getConversationById(targetConversationId)
    const sessionId = String(targetConversation?.sessionId ?? '').trim()
    if (!sessionId) return

    const latestAssistantMessage = [...(targetConversation?.messages ?? [])]
      .reverse()
      .find((message) => message?.role === 'assistant')
    const messageId = String(latestAssistantMessage?.id ?? '').trim()

    const stopPayload = {
      session_id: sessionId,
    }

    // 如果后端支持 message_id，尽量带上，便于它准确停止当前回答而不是整个上下文。
    if (messageId) {
      stopPayload.message_id = messageId
    }

    stopConversationStreamApi(stopPayload).catch(() => {
      // 停止接口失败时忽略，避免影响前端本地中断结果。
    })
  }

  const submitMessage = async (rawContent) => {
    const content = String(rawContent ?? '').trim()
    if (!content) return

    const currentConversation = ensureConversationForSubmit()
    if (!currentConversation) return

    const conversationId = currentConversation.id

    // 仅阻止“同一会话”重复并发提交；其他会话可并行流式。
    if (isConversationStreaming(conversationId)) return

    currentConversation.messages.push({
      id: createId(),
      role: 'user',
      content,
    })

    // 用户消息先本地落入消息列表，保证发送瞬间 UI 立刻可见，不依赖接口返回。
    maybeAssignConversationTitleFromFirstQuestion(currentConversation, content)
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
    clearDraftInputByConversationId(conversationId)

    const abortController = new AbortController()
    setStreamingController(conversationId, abortController)

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
        signal: abortController.signal,
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

          // done 事件只表示流结束，不一定携带文本内容。
          if (typeof payload === 'object' && payload?.done) return
          const chunk = resolveStreamText(payload)
          if (!chunk) return

          // 持续拼接 assistant 内容，驱动实时渲染。
          target.content += chunk
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
        fallbackText: isAbortError ? '请求已取消。' : `请求失败：${error?.message || '未知错误'}`,
      })
    } finally {
      // 无论成功/失败/取消，都必须释放会话级 controller。
      deleteStreamingController(conversationId)
    }
  }

  onMounted(() => {
    // 进入页面即拉取会话列表。
    loadConversations()
  })

  // 对外暴露的是“页面可直接消费”的状态和动作，不暴露内部归一化 / 辅助函数。
  return {
    conversations,
    searchKeyword,
    activeConversationId,
    activeConversation,
    activeDraftInput,
    isActiveConversationStreaming,
    updateActiveDraftInput,
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
