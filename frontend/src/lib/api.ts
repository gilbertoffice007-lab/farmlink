import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'

export const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('farmlink_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err?.response?.data?.detail
    if (typeof msg === 'string') err.friendlyMessage = msg
    else if (err?.response?.status === 401) err.friendlyMessage = 'Your session has expired. Please sign in again.'
    else err.friendlyMessage = 'Something went wrong. Please try again.'
    return Promise.reject(err)
  }
)

export function apiError(e: any): string {
  return e?.friendlyMessage || 'Something went wrong. Please try again.'
}
