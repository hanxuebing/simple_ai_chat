<script setup>
import { searchConversationsApi } from '@/api/conversations'
import { abortRequestByKey, isRequestCanceled } from '@/utils/request'

const props = defineProps({
  searchKeyword: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:searchKeyword', 'selectConversation'])

const visible = defineModel({
  type: Boolean,
  default: false,
})

const localKeyword = ref(props.searchKeyword)
const searchLoading = ref(false)
const searchResults = ref([])
let searchDebounceTimer = null
let activeSearchRequestId = 0
const SEARCH_ABORT_KEY = 'conversations-search-dialog'

const normalizePreviewText = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()

const getConversationPreview = (conversation) => {
  const matches = Array.isArray(conversation?.matches) ? conversation.matches : []
  const snippets = matches.map((item) => normalizePreviewText(item?.snippet)).filter(Boolean)
  if (snippets.length) return snippets

  const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    const content = normalizePreviewText(message?.content)
    if (content) return [content]
  }

  return ['暂无可展示内容']
}

const resolveSearchList = (response) => {
  if (Array.isArray(response)) return response

  const responseData = response?.data
  const responseResults = response?.results
  const responseDataResults = responseData?.results
  const candidates = [
    responseResults,
    responseDataResults,
    response?.conversations,
    response?.list,
    response?.items,
    responseData?.conversations,
    responseData?.list,
    responseData?.items,
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

const handleSelectConversation = (conversation) => {
  const sessionId = String(conversation?.session_id ?? conversation?.sessionId ?? '').trim()
  if (!sessionId) return

  emit('selectConversation', sessionId)
  visible.value = false
}

const performSearch = async (keyword) => {
  const requestId = ++activeSearchRequestId
  const normalizedKeyword = String(keyword ?? '').trim()

  if (!normalizedKeyword) {
    abortRequestByKey(SEARCH_ABORT_KEY)
    searchResults.value = []
    searchLoading.value = false
    return
  }

  searchLoading.value = true

  try {
    const response = await searchConversationsApi(
      {
        keyword: normalizedKeyword,
        page: 1,
        page_size: 20,
      },
      { abortKey: SEARCH_ABORT_KEY },
    )

    if (requestId !== activeSearchRequestId) return
    searchResults.value = resolveSearchList(response)
  } catch (error) {
    if (requestId !== activeSearchRequestId) return
    if (isRequestCanceled(error)) return
    searchResults.value = []
  } finally {
    if (requestId === activeSearchRequestId) {
      searchLoading.value = false
    }
  }
}

const triggerDebouncedSearch = (keyword, { emitKeyword = true } = {}) => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  searchDebounceTimer = setTimeout(() => {
    if (emitKeyword) {
      emit('update:searchKeyword', keyword)
    }
    performSearch(keyword)
  }, 300)
}

const triggerImmediateSearch = (keyword = localKeyword.value, { emitKeyword = true } = {}) => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }

  if (emitKeyword) {
    emit('update:searchKeyword', keyword)
  }
  performSearch(keyword)
}

watch(
  () => props.searchKeyword,
  (keyword) => {
    const normalizedKeyword = String(keyword ?? '')
    if (normalizedKeyword === localKeyword.value) return
    localKeyword.value = normalizedKeyword
    triggerDebouncedSearch(normalizedKeyword, { emitKeyword: false })
  },
)

watch(localKeyword, (keyword) => {
  if (keyword === props.searchKeyword) return
  triggerDebouncedSearch(keyword)
})

watch(visible, (isVisible) => {
  if (!isVisible) return
  performSearch(localKeyword.value)
})

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  abortRequestByKey(SEARCH_ABORT_KEY)
})
</script>

<template>
  <ElDialog
    v-model="visible"
    width="678"
    align-center
    modal-class="chat-search-dialog-modal"
    class="chat-search-dialog"
  >
    <template #header>
      <ElInput
        v-model="localKeyword"
        class="chat-search-dialog__search-input"
        placeholder="搜索"
        clearable
        @keyup.enter="triggerImmediateSearch(localKeyword)"
      >
        <template #prefix>
          <el-icon size="16"><i-ep-Search /></el-icon>
        </template>
      </ElInput>
    </template>
    <div class="chat-search-dialog__body">
      <ElEmpty v-if="!localKeyword.trim()" description="请输入关键词进行搜索" :image-size="56" />
      <div v-else-if="searchLoading" class="chat-search-dialog__state">搜索中...</div>
      <ElEmpty v-else-if="!searchResults.length" description="未找到相关会话" :image-size="56" />
      <div v-else class="chat-search-dialog__list">
        <div
          v-for="(conversation, index) in searchResults"
          :key="conversation?.session_id ?? conversation?.sessionId ?? conversation?.id ?? index"
          class="chat-search-dialog__item"
          @click="handleSelectConversation(conversation)"
        >
          <p
            class="chat-search-dialog__item-title"
            v-html="conversation?.title_snippet || conversation?.title || '未命名会话'"
          />
          <p
            v-for="(preview, previewIndex) in getConversationPreview(conversation)"
            :key="`${conversation?.session_id ?? conversation?.id ?? index}-${previewIndex}`"
            class="chat-search-dialog__item-preview"
            v-html="preview"
          />
        </div>
      </div>
    </div>
  </ElDialog>
</template>

<style scoped>
:global(.chat-search-dialog) {
  height: 440px;
  border-radius: 16px;
  padding: 0;
}
:global(.chat-search-dialog-modal) {
  background-color: transparent !important;
}
:global(.chat-search-dialog .el-dialog__header) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  margin-right: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
:global(.chat-search-dialog .el-dialog__title) {
  flex: 1;
  min-width: 0;
  display: block;
}
:global(.chat-search-dialog .el-dialog__body) {
  padding: 16px 20px;
}

.chat-search-dialog__divider {
  height: 1px;
  background-color: var(--el-border-color-lighter);
}

.chat-search-dialog__body {
  height: 330px;
  overflow: auto;
}

.chat-search-dialog__state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.chat-search-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-search-dialog__item {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background-color: #f8fafc;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.chat-search-dialog__item:hover {
  border-color: #cbd5e1;
}

.chat-search-dialog__item-title {
  margin: 0;
  font-size: 16px;
  font-weight: 400;
  color: #0f172a;
  line-height: 1.5;
}

.chat-search-dialog__item-preview {
  margin: 6px 0 0;
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
  word-break: break-word;
}

.chat-search-dialog__item :deep(em) {
  color: #0f172a;
  font-style: normal;
  font-weight: 600;
}

.chat-search-dialog__search-input {
  width: 100%;
}

.chat-search-dialog__search-input :deep(.el-input__wrapper) {
  padding-inline: 0;
  background: transparent;
  box-shadow: none;
}
</style>
