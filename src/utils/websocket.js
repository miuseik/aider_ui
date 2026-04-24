/**
 * WebSocket 业务层 - 处理身份认证和消息分发
 */

import WSTransport from './socket/ws_transport.js'
import { encodeMessage, decodeMessage } from './socket/ws_protocol.js'

class WebSocketClient {
  constructor(url = null) {
    this.url = url || this.getDefaultUrl()
    this.transport = new WSTransport(this.url)
    this.messageHandlers = []
    this.clientType = 'client' // 默认客户端类型
    
    // 注册消息回调
    this.transport.onMessage(this._handleMessage.bind(this))
  }

  getDefaultUrl() {
    // 使用环境变量配置的 WebSocket URL
    return import.meta.env.VITE_WS_URL || `wss://${window.location.hostname}:8442/vr/client/ui`
  }

  /**
   * 设置客户端类型（用于身份认证）
   */
  setClientType(type) {
    this.clientType = type
  }

  connect() {
    const result = this.transport.connect()
    
    if (result) {
      // 发送身份认证
      const authMsg = { type: this.clientType }
      this.transport.send(encodeMessage(authMsg))
      console.log(`📨 已发送 ${this.clientType} 身份认证:`, authMsg)
      
      this.notifyHandlers({ type: 'connected' })
    }
    
    return result
  }

  disconnect() {
    this.transport.disconnect()
  }

  send(data) {
    return this.transport.send(encodeMessage(data))
  }

  _handleMessage(rawData) {
    try {
      const data = decodeMessage(rawData)
      this.notifyHandlers(data)
    } catch (error) {
      console.error('消息解析错误:', error)
    }
  }

  onMessage(handler) {
    this.messageHandlers.push(handler)
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler)
    }
  }

  notifyHandlers(data) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error('消息处理器错误:', error)
      }
    })
  }

  get isConnected() {
    return this.transport.isConnected
  }

  getState() {
    return this.transport.getState()
  }
}

// 导出单例
export const wsClient = new WebSocketClient()
export default WebSocketClient
