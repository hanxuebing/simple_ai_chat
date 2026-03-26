<script setup>
import ChatSidebar from './home/components/ChatSidebar.vue'
import ChatPanel from './home/components/ChatPanel.vue'
import { useConversationManager } from './home/composables/useConversationManager'

const {
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
} = useConversationManager()
const isSidebarCollapsed = ref(false)
</script>

<template>
  <main class="home-layout">
    <ChatSidebar
      :search-keyword="searchKeyword"
      :conversations="conversations"
      :active-conversation-id="activeConversationId"
      :collapsed="isSidebarCollapsed"
      @update:search-keyword="updateSearchKeyword"
      @create-conversation="createConversation"
      @select-conversation="selectConversation"
      @delete-conversation="deleteConversation"
      @toggle-sidebar="isSidebarCollapsed = !isSidebarCollapsed"
    />

    <section class="home-layout__content">
      <ChatPanel
        :conversation="activeConversation"
        :draft-input="activeDraftInput"
        :is-streaming="isActiveConversationStreaming"
        @update:draft-input="updateActiveDraftInput"
        @submit-message="submitMessage"
        @cancel="stopStreaming"
      />
    </section>
  </main>
</template>

<style scoped>
.home-layout {
  height: 100vh;
  width: 100%;
  display: flex;
  background: linear-gradient(135deg, #f8fbff 0%, #ffffff 58%);
}

.home-layout__content {
  flex: 1;
  min-width: 0;
}
</style>
