import { del, get, post } from '@/utils/request'

const CONVERSATIONS_API_PREFIX = '/conversations'

export function getConversationsListApi(params = {}) {
  return get(CONVERSATIONS_API_PREFIX, params)
}

export function getConversationDetailApi(sessionId) {
  return get(`${CONVERSATIONS_API_PREFIX}/${sessionId}`)
}

export function searchConversationsApi(params = {}, config = {}) {
  return get(`${CONVERSATIONS_API_PREFIX}/search`, params, config)
}

export function createConversationApi(payload = {}) {
  return post(CONVERSATIONS_API_PREFIX, payload)
}

export function deleteConversationApi(sessionId) {
  return del(`${CONVERSATIONS_API_PREFIX}/${sessionId}`)
}

export function stopConversationStreamApi(payload = {}) {
  return post('/chat/stream/stop', payload)
}
