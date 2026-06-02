/**
 * Axios 请求封装
 * 统一处理 API 请求、错误处理和拦截器
 */

import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建 axios 实例
const request = axios.create({
  baseURL: '/api',  // ✅ 使用相对路径，通过 Vite proxy 转发
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 可以在这里添加 token 等认证信息
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const data = response.data
    
    // 如果后端返回了 code 字段，根据 code 判断成功与否
    if (data.code !== undefined) {
      if (data.code === 200) {
        return data
      } else {
        const message = data.message || '请求失败'
        ElMessage.error(message)
        return Promise.reject(new Error(message))
      }
    }
    
    // 如果没有 code 字段，直接返回数据
    return data
  },
  (error) => {
    let message = '网络错误，请稍后重试'
    
    if (error.response) {
      switch (error.response.status) {
        case 400:
          message = '请求参数错误'
          break
        case 401:
          message = '未授权，请重新登录'
          break
        case 403:
          message = '拒绝访问'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 500:
          message = '服务器内部错误'
          break
        case 503:
          message = '服务不可用'
          break
        default:
          message = error.response.data?.message || `请求失败 (${error.response.status})`
      }
    } else if (error.request) {
      message = '网络连接失败，请检查网络'
    }
    
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export default request
