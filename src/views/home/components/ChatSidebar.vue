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

const getPreviewText = (conversation) => {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : []

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = String(messages[index]?.content ?? '').trim()
    if (content) return content
  }

  return conversation?.title ?? '暂无消息'
}

const handleCreateConversation = () => {
  emit('createConversation')

  if (props.collapsed) {
    emit('toggleSidebar')
  }
}

const handleSearchClick = () => {
  if (props.collapsed) {
    emit('toggleSidebar')
  }
}
</script>

<template>
  <aside class="chat-sidebar text-size-14" :class="{ 'is-collapsed': props.collapsed }">
    <header class="chat-sidebar__header">
      <button
        type="button"
        class="chat-sidebar__action-btn"
        :class="{ 'is-icon-only': props.collapsed }"
        :aria-label="props.collapsed ? '新聊天' : undefined"
        @click="handleCreateConversation"
      >
        <span class="chat-sidebar__menu-icon" aria-hidden="true"></span>
        <span v-if="!props.collapsed">新聊天</span>
      </button>

      <button
        type="button"
        class="chat-sidebar__action-btn"
        :class="{ 'is-icon-only': props.collapsed }"
        :aria-label="props.collapsed ? '搜索' : undefined"
        @click="handleSearchClick"
      >
        <span class="chat-sidebar__menu-icon" aria-hidden="true"></span>
        <span v-if="!props.collapsed">搜索</span>
      </button>
    </header>

    <ElScrollbar class="chat-sidebar__scroll" :class="{ 'is-hidden': props.collapsed }">
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

        <ElEmpty
          v-if="!conversations.length"
          description="暂无会话，发送首条问题后自动创建"
          :image-size="56"
        />
      </div>
    </ElScrollbar>

    <button
      type="button"
      class="chat-sidebar__toggle-btn"
      :class="{ 'is-collapsed': props.collapsed }"
      :aria-label="props.collapsed ? '展开侧栏' : '收起侧栏'"
      @click="emit('toggleSidebar')"
    >
      <span class="chat-sidebar__toggle-icon" aria-hidden="true"></span>
    </button>
  </aside>
</template>

<style scoped>
.chat-sidebar {
  position: relative;
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  border-right: 1px solid #e4e7ed;
  background-color: var(--bg-elevated-secondary);
  display: flex;
  flex-direction: column;
  transition: width var(--sidebar-toggle-duration) ease;
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
  transition:
    padding var(--sidebar-toggle-duration) ease,
    gap var(--sidebar-toggle-duration) ease,
    border-color var(--sidebar-toggle-duration) ease;
}

.chat-sidebar.is-collapsed .chat-sidebar__header {
  padding: 10px 8px;
  gap: 6px;
  border-bottom-color: transparent;
}

.chat-sidebar__action-btn {
  height: calc(var(--spacing) * 9);
  width: 100%;
  border: none;
  background: transparent;
  padding: 0 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  color: #1f2937;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--sidebar-toggle-duration) ease;
}

.chat-sidebar__action-btn.is-icon-only {
  justify-content: center;
  padding: 0;
}

.chat-sidebar__action-btn:hover,
.chat-sidebar__item:hover {
  background-color: var(--menu-item-highlighted);
}

.chat-sidebar__action-btn:active {
  background-color: var(--menu-item-open);
}

.chat-sidebar__menu-icon {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background-color: #9aa4b2;
  flex-shrink: 0;
}

.chat-sidebar__scroll {
  flex: 1;
  opacity: 1;
  visibility: visible;
  transition:
    opacity var(--sidebar-toggle-duration) ease,
    visibility 0s linear 0s;
}

.chat-sidebar__scroll.is-hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity var(--sidebar-toggle-duration) ease,
    visibility 0s linear var(--sidebar-toggle-duration);
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
  transition: background-color var(--sidebar-toggle-duration) ease;
  display: flex;
  align-items: center;
}

.chat-sidebar__item.is-active {
  background-color: var(--menu-item-active);
}

.chat-sidebar__item-preview {
  flex: 1;
  margin: 0;
  color: #334155;
  line-height: 1.4;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chat-sidebar__toggle-btn {
  position: absolute;
  top: 12px;
  right: -14px;
  width: 28px;
  height: 28px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background-color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  transition:
    background-color var(--sidebar-toggle-duration) ease,
    border-color var(--sidebar-toggle-duration) ease,
    box-shadow var(--sidebar-toggle-duration) ease;
  z-index: 2;
}

.chat-sidebar__toggle-btn:hover {
  background-color: var(--menu-item-highlighted);
}

.chat-sidebar__toggle-btn:active {
  background-color: var(--menu-item-open);
}

.chat-sidebar__toggle-icon {
  width: 8px;
  height: 8px;
  border-top: 1.5px solid #6b7280;
  border-right: 1.5px solid #6b7280;
  transform: rotate(-135deg);
  transition: transform var(--sidebar-toggle-duration) ease;
}

.chat-sidebar__toggle-btn.is-collapsed .chat-sidebar__toggle-icon {
  transform: rotate(45deg);
}
</style>
