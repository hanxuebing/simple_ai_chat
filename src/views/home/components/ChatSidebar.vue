<script setup>
// import { ElMessageBox } from 'element-plus'
import { Typewriter } from 'vue-element-plus-x'
import logoIcon from '@/assets/icons/logo.svg'
import CloseSidebarOutlineIcon from '@/components/icons/CloseSidebarOutlineIcon.vue'
import ChatSearchDialog from './search-dialog/ChatSearchDialog.vue'

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
  'deleteConversation',
  'toggleSidebar',
])

const normalizePreviewText = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()

const getConversationTitle = (conversation) => {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : []

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (message?.role !== 'user') continue

    const content = normalizePreviewText(message?.content)
    if (content) return content
  }

  return normalizePreviewText(conversation?.title) || '暂无消息'
}

const handleCreateConversation = () => {
  emit('createConversation')
}

const searchDialogVisible = ref(false)

const handleSearchClick = () => {
  searchDialogVisible.value = true
}

const handleSelectConversationFromSearch = (sessionId) => {
  if (!sessionId) return
  emit('selectConversation', sessionId)
}

const handleDeleteConversation = async (conversation) => {
  try {
    await ElMessageBox.confirm('删除后不可恢复，是否继续删除当前会话？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }

  emit('deleteConversation', conversation.id)
}
</script>

<template>
  <aside class="chat-sidebar text-size-14" :class="{ 'is-collapsed': props.collapsed }">
    <div class="chat-sidebar__top" :class="{ 'is-collapsed': props.collapsed }">
      <img v-if="!props.collapsed" class="chat-sidebar__logo" :src="logoIcon" alt="Logo" />

      <button
        type="button"
        class="chat-sidebar__top-toggle-btn"
        :class="{ 'is-collapsed': props.collapsed }"
        :aria-label="props.collapsed ? '展开侧栏' : '收起侧栏'"
        @click="emit('toggleSidebar')"
      >
        <el-icon class="chat-sidebar__top-toggle-icon" size="18" aria-hidden="true">
          <CloseSidebarOutlineIcon />
        </el-icon>
      </button>
    </div>

    <header class="chat-sidebar__header">
      <button
        type="button"
        class="chat-sidebar__action-btn"
        :class="{ 'is-icon-only': props.collapsed }"
        :aria-label="props.collapsed ? '新聊天' : undefined"
        @click="handleCreateConversation"
      >
        <el-icon size="16"><i-ep-EditPen /></el-icon>
        <span v-if="!props.collapsed">新聊天</span>
      </button>

      <button
        type="button"
        class="chat-sidebar__action-btn"
        :class="{ 'is-icon-only': props.collapsed }"
        :aria-label="props.collapsed ? '搜索' : undefined"
        @click="handleSearchClick"
      >
        <el-icon size="16"><i-ep-Search /></el-icon>
        <span v-if="!props.collapsed">搜索</span>
      </button>
    </header>

    <ElScrollbar class="chat-sidebar__scroll" :class="{ 'is-hidden': props.collapsed }">
      <div class="chat-sidebar__list">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          class="chat-sidebar__item"
          :class="{
            'is-active': conversation.id === activeConversationId,
          }"
        >
          <button
            type="button"
            class="chat-sidebar__item-main"
            @click="emit('selectConversation', conversation.id)"
          >
            <Typewriter
              class="chat-sidebar__item-preview"
              :content="getConversationTitle(conversation)"
              :typing="true"
              :is-markdown="true"
            />
          </button>

          <ElPopover
            trigger="click"
            placement="bottom-start"
            :width="200"
            :show-arrow="false"
            :hide-after="0"
            popper-class="chat-sidebar__item-menu-popper"
          >
            <template #reference>
              <button
                type="button"
                class="chat-sidebar__item-menu-btn"
                aria-label="会话菜单"
                @click.stop
              >
                <el-icon class="chat-sidebar__item-menu-icon" size="16">
                  <i-ep-MoreFilled />
                </el-icon>
              </button>
            </template>
            <el-button
              type="danger"
              text
              class="w-full"
              @click.stop="handleDeleteConversation(conversation)"
            >
              删除会话
            </el-button>
          </ElPopover>
        </div>

        <ElEmpty
          v-if="!conversations.length"
          description="暂无会话，发送首条问题后自动创建"
          :image-size="56"
        />
      </div>
    </ElScrollbar>

    <div class="chat-sidebar__version" :class="{ 'is-collapsed': props.collapsed }">v0.0.2</div>
    <ChatSearchDialog
      v-model="searchDialogVisible"
      :search-keyword="props.searchKeyword"
      @update:search-keyword="emit('update:searchKeyword', $event)"
      @select-conversation="handleSelectConversationFromSearch"
    />
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

.chat-sidebar__top {
  height: calc(var(--spacing) * 11);
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid #eceff5;
  transition: padding var(--sidebar-toggle-duration) ease;
}

.chat-sidebar__top.is-collapsed {
  padding: 10px 8px;
  justify-content: center;
}

.chat-sidebar__logo {
  height: 20px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
}

.chat-sidebar__top-toggle-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  /* background-color: transparent; */
  color: var(--text-tertiary, #8f8f8f);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color var(--sidebar-toggle-duration) ease,
    transform var(--sidebar-toggle-duration) ease;
}

.chat-sidebar__top-toggle-btn:hover {
  color: #334155;
}

.chat-sidebar__top-toggle-btn:active {
  color: #1f2937;
}

.chat-sidebar__top-toggle-btn.is-collapsed {
  color: var(--text-primary);
}

.chat-sidebar__top-toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
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
  color: var(--text-primary);
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
  background: transparent;
  padding: 0 8px;
  border-radius: 8px;
  transition: background-color var(--sidebar-toggle-duration) ease;
  display: flex;
  align-items: center;
  gap: 2px;
}

.chat-sidebar__item-main {
  height: 100%;
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  padding: 7px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.chat-sidebar__item.is-active {
  background-color: var(--menu-item-active);
}

.chat-sidebar__item-preview {
  display: block;
  width: 100%;
  min-width: 0;
  flex: 1;
  margin: 0;
  color: #334155;
  line-height: 1.4;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chat-sidebar__item-preview :deep(*) {
  margin: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.chat-sidebar__item-preview :deep(br) {
  display: none;
}

.chat-sidebar__item-menu-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity var(--sidebar-toggle-duration) ease,
    visibility 0s linear var(--sidebar-toggle-duration);
}

.chat-sidebar__item:hover .chat-sidebar__item-menu-btn,
.chat-sidebar__item:focus-within .chat-sidebar__item-menu-btn {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition:
    opacity var(--sidebar-toggle-duration) ease,
    visibility 0s linear 0s;
}
.chat-sidebar__item-menu-btn:hover .chat-sidebar__item-menu-icon,
.chat-sidebar__item-menu-btn:focus-visible .chat-sidebar__item-menu-icon {
  color: #334155;
}
.chat-sidebar__item-menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  line-height: 1;
  transition: color var(--sidebar-toggle-duration) ease;
}

:global(.chat-sidebar__item-menu-popper) {
  border-radius: 16px;
}

.chat-sidebar__version {
  padding: 6px 12px 10px;
  font-size: 12px;
  line-height: 1;
  color: #94a3b8;
  text-align: left;
  user-select: none;
  transition:
    opacity var(--sidebar-toggle-duration) ease,
    padding var(--sidebar-toggle-duration) ease;
}

.chat-sidebar__version.is-collapsed {
  opacity: 0;
  pointer-events: none;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
