import axios from 'axios'
import { getIdToken } from './firebase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Axiosインスタンス作成
const api = axios.create({
  baseURL: API_BASE_URL,
})

// リクエストインターセプター（認証トークン付与）
api.interceptors.request.use(async (config) => {
  const token = await getIdToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// PDFを処理
export const processDocument = async (file, documentType) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('document_type', documentType)

  const response = await api.post('/api/process', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

// プロンプト取得
export const getPrompt = async (documentType) => {
  const response = await api.get(`/api/prompts/${documentType}`)
  return response.data
}

// プロンプト更新
export const updatePrompt = async (documentType, prompt) => {
  const response = await api.put('/api/prompts', {
    document_type: documentType,
    prompt: prompt,
  })
  return response.data
}

// プロンプトテスト
export const testPrompt = async (file, documentType, prompt) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('document_type', documentType)
  formData.append('prompt', prompt)

  const response = await api.post('/api/prompts/test', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

// プロンプトリセット
export const resetPrompt = async (documentType) => {
  const response = await api.delete(`/api/prompts/${documentType}`)
  return response.data
}

export default api
