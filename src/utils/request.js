import axios from 'axios'

export const isRequestCanceled = (error) =>
  axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'

const abortControllerMap = new Map()

// const getCookieValue = (key) => {
//   if (!key || typeof document === 'undefined') return ''
//   const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
//   const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapedKey}=([^;]*)`))
//   return match ? decodeURIComponent(match[1]) : ''
// }

export const abortRequestByKey = (abortKey) => {
  if (!abortKey) return

  const activeController = abortControllerMap.get(abortKey)
  if (!activeController) return

  activeController.abort()
  abortControllerMap.delete(abortKey)
}

const clearAbortController = (config) => {
  const abortKey = config?.abortKey
  if (!abortKey) return

  const activeController = abortControllerMap.get(abortKey)
  if (!activeController) return

  if (!config.signal || activeController.signal === config.signal) {
    abortControllerMap.delete(abortKey)
  }
}

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8',
  },
})

request.interceptors.request.use(
  (config) => {
    // const apiKey = getCookieValue('X-Api-Key')
    // if (apiKey) {
    //   config.headers['x-api-key'] = apiKey
    // }
    const abortKey = config?.abortKey
    if (abortKey && !config.signal) {
      abortRequestByKey(abortKey)
      const controller = new AbortController()
      abortControllerMap.set(abortKey, controller)
      config.signal = controller.signal
    }

    return config
  },
  (error) => Promise.reject(error),
)

request.interceptors.response.use(
  (response) => {
    clearAbortController(response?.config)
    return response.data
  },
  (error) => {
    clearAbortController(error?.config)
    if (isRequestCanceled(error)) {
      return Promise.reject(error)
    }
    const message = error?.response?.data?.message || error?.message || 'Request Error'
    return Promise.reject(new Error(message))
  },
)

export const get = (url, params = {}, config = {}) =>
  request({
    url,
    method: 'get',
    params,
    ...config,
  })

export const post = (url, data = {}, config = {}) =>
  request({
    url,
    method: 'post',
    data,
    ...config,
  })

export const put = (url, data = {}, config = {}) =>
  request({
    url,
    method: 'put',
    data,
    ...config,
  })

export const del = (url, params = {}, config = {}) =>
  request({
    url,
    method: 'delete',
    params,
    ...config,
  })

export default request
