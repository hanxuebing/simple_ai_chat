const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

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

  const submitMessage = (rawContent) => {
    const content = String(rawContent ?? '').trim()
    if (!content) return

    const currentConversation = activeConversation.value
    if (!currentConversation) return

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

    moveToTop(currentConversation.id)
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
  }
}
