<template>
  <div class="chat-panel__suggestions">
    <p class="chat-panel__suggestions-title">猜你想问：</p>
    <div class="chat-panel__suggestion-grid">
      <article
        v-for="group in suggestionGroups"
        :key="group.id"
        class="chat-panel__suggestion-group"
      >
        <div class="chat-panel__suggestion-group-header">
          <img
            class="chat-panel__suggestion-group-icon"
            :src="group.icon"
            :alt="`${group.title}图标`"
          />
          <p class="chat-panel__suggestion-group-title">{{ group.title }}</p>
        </div>
        <button
          v-for="question in group.questions"
          :key="question"
          type="button"
          class="chat-panel__suggestion-item"
          @click="handlePick(question)"
        >
          {{ question }}
        </button>
      </article>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(['pick'])

const getSuggestionIcon = (id) =>
  new URL(`../../../assets/icons/sug/${id}.svg`, import.meta.url).href

const suggestionGroups = [
  {
    id: 'group-a',
    icon: getSuggestionIcon('group-a'),
    title: 'APT组织分析',
    questions: ['提供APT28 组织的完整画像', 'Lazarus Group 和 Hidden Cobra 是同一个组织吗'],
  },
  {
    id: 'group-b',
    icon: getSuggestionIcon('group-b'),
    title: '情报报告分析',
    questions: [
      '解读报告《海莲花组织Rust特马攻击活动分析》',
      '提供《APT-C-08（蔓灵花）组织新载荷披露》核心摘要',
    ],
  },
  {
    id: 'group-c',
    icon: getSuggestionIcon('group-c'),
    title: 'IoC与技战术分析',
    questions: ['T1592攻击技术解析', '分析IP:104.128.239.70'],
  },
  {
    id: 'group-d',
    icon: getSuggestionIcon('group-d'),
    title: '智能统计查询',
    questions: ['北美方向一共有多少个 APT 组织', '哪些APT 组织攻击过能源行业且归属俄罗斯'],
  },
]

const handlePick = (question) => {
  emit('pick', question)
}
</script>

<style scoped>
.chat-panel__suggestions {
  text-align: left;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.chat-panel__suggestions-title {
  margin: 0 0 12px;
  color: #303133;
  font-weight: 600;
  font-size: 16px;
  line-height: 1.5;
}

.chat-panel__suggestion-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.chat-panel__suggestion-group {
  padding: 14px;
  border-radius: 16px;
  background: #f5f7ff;
}

.chat-panel__suggestion-group:nth-child(2) {
  background: #f4fbf6;
}

.chat-panel__suggestion-group:nth-child(3) {
  background: #fff8ef;
}

.chat-panel__suggestion-group:nth-child(4) {
  background: #f4f8ff;
}

.chat-panel__suggestion-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  color: #303133;
}

.chat-panel__suggestion-group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.chat-panel__suggestion-group-title {
  margin: 0;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.5;
}

.chat-panel__suggestion-item {
  display: block;
  width: 100%;
  margin: 0 0 8px;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  line-height: 1.65;
  color: #4e5969;
  background: #fff;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.chat-panel__suggestion-item:hover {
  color: #409eff;
  background: #edf5ff;
  border-color: #d9ecff;
}

.chat-panel__suggestion-item:last-child {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .chat-panel__suggestion-grid {
    grid-template-columns: 1fr;
  }
}
</style>
