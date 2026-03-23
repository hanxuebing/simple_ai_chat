import { get } from '@/utils/request'
export function getConversationsListApi (url, params) {
  const apiKey = localStorage.getItem('x-api-key')?.trim()
  const config = apiKey ? { headers: { 'x-api-key': apiKey } } : {}
  return get(url, params, config)
}
