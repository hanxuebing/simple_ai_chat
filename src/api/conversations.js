import { get, post } from '@/utils/request'

const CONVERSATIONS_API_PREFIX = '/conversations'


export function getConversationsListApi (params = {}) {
  return get(CONVERSATIONS_API_PREFIX, params)
}

export function getConversationDetailApi (sessionId) {
  return get(`${CONVERSATIONS_API_PREFIX}/${sessionId}`)
}

export function createConversationApi (payload = {}) {
  return post(CONVERSATIONS_API_PREFIX, payload)
}

