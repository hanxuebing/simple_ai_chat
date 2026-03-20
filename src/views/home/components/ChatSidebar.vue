<script setup>
const props = defineProps({
  searchKeyword: {
    type: String,
    default: '',
  },
  conversations: {
    type: Array,
    default: () => [],
  },
  activeConversationId: {
    type: String,
    default: '',
  },
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:searchKeyword',
  'createConversation',
  'selectConversation',
  'toggleSidebar',
])

const keywordModel = computed({
  get: () => props.searchKeyword,
  set: (value) => emit('update:searchKeyword', value),
})

const getPreviewText = (conversation) => {
  const lastMessage = conversation.messages.at(-1)
  return lastMessage?.content ?? '暂无消息'
}

const handleCreateConversation = () => {
  emit('createConversation')

  if (props.collapsed) {
    emit('toggleSidebar')
  }
}
</script>

<template>
  <aside class="chat-sidebar" :class="{ 'is-collapsed': props.collapsed }">
    <header class="chat-sidebar__header">
      <div class="chat-sidebar__toolbar">
        <button
          type="button"
          class="chat-sidebar__menu-btn"
          :class="{ 'is-icon-only': props.collapsed }"
          :aria-label="props.collapsed ? '新聊天' : undefined"
          @click="handleCreateConversation"
        >
          <span class="chat-sidebar__menu-icon" aria-hidden="true"></span>
          <span v-if="!props.collapsed">新聊天</span>
        </button>

        <button
          v-if="!props.collapsed"
          type="button"
          class="chat-sidebar__collapse-btn"
          aria-label="收起侧栏"
          @click="emit('toggleSidebar')"
        >
          <span class="chat-sidebar__menu-icon" aria-hidden="true"></span>
        </button>
      </div>

      <button
        v-if="props.collapsed"
        type="button"
        class="chat-sidebar__search-btn"
        aria-label="展开侧栏并搜索"
        @click="emit('toggleSidebar')"
      >
        <span class="chat-sidebar__menu-icon" aria-hidden="true"></span>
      </button>

      <label v-else class="chat-sidebar__search" for="chat-sidebar-search">
        <span class="chat-sidebar__menu-icon" aria-hidden="true"></span>
        <input
          id="chat-sidebar-search"
          v-model="keywordModel"
          type="text"
          placeholder="搜索聊天"
          class="chat-sidebar__search-input"
        />
      </label>
    </header>

    <ElScrollbar v-if="!props.collapsed" class="chat-sidebar__scroll">
      <div class="chat-sidebar__list">
        <button
          v-for="conversation in conversations"
          :key="conversation.id"
          type="button"
          class="chat-sidebar__item"
          :class="{
            'is-active': conversation.id === activeConversationId,
          }"
          @click="emit('selectConversation', conversation.id)"
        >
          <span class="chat-sidebar__item-preview">{{ getPreviewText(conversation) }}</span>
        </button>

        <ElEmpty v-if="!conversations.length" description="暂无会话" :image-size="56" />
      </div>
    </ElScrollbar>
  </aside>
</template>

<style scoped>
.chat-sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  border-right: 1px solid #e4e7ed;
  background-color: var(--bg-elevated-secondary);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  overflow: hidden;
}

.chat-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
  min-width: var(--sidebar-collapsed-width);
}

.chat-sidebar__header {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid #eceff5;
}

.chat-sidebar.is-collapsed .chat-sidebar__header {
  padding: 10px 8px;
  gap: 6px;
  border-bottom: none;
}

.chat-sidebar__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-sidebar.is-collapsed .chat-sidebar__toolbar {
  justify-content: center;
}

.chat-sidebar__menu-btn {
  border: none;
  background: transparent;
  padding: 6px 4px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1f2937;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.chat-sidebar__menu-btn.is-icon-only,
.chat-sidebar__search-btn {
  width: 100%;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.chat-sidebar__menu-btn:hover,
.chat-sidebar__collapse-btn:hover,
.chat-sidebar__search-btn:hover,
.chat-sidebar__item:hover {
  background-color: var(--menu-item-highlighted);
}

.chat-sidebar__menu-btn:active,
.chat-sidebar__collapse-btn:active,
.chat-sidebar__search-btn:active {
  background-color: var(--menu-item-open);
}

.chat-sidebar__collapse-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.chat-sidebar__menu-icon {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background-color: #9aa4b2;
  flex-shrink: 0;
}

.chat-sidebar__search {
  border: 1px solid #d7dce6;
  border-radius: 8px;
  background-color: #fff;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-sidebar__search:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.18);
}

.chat-sidebar__search-input {
  width: 100%;
  border: none;
  outline: none;
  font-size: 13px;
  color: #1f2937;
  background: transparent;
}

.chat-sidebar__search-input::placeholder {
  color: #9aa4b2;
}

.chat-sidebar__scroll {
  flex: 1;
}

.chat-sidebar__list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chat-sidebar__item {
  height: calc(var(--spacing) * 9);
  border: none;
  background: transparent;
  text-align: left;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
}

.chat-sidebar__item.is-active {
  background-color: var(--menu-item-active);
}

.chat-sidebar__item-preview {
  flex: 1;
  margin: 0;
  font-size: 12px;
  color: #334155;
  line-height: 1.4;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
