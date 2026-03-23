import axios from 'axios'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8',
  },
})

request.interceptors.request.use(
  (config) => {
    const apiKey = localStorage.getItem('x-api-key')
    if (apiKey) {
      config.headers['x-api-key'] = apiKey
    }
    return config
  },
  (error) => Promise.reject(error),
)

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
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
