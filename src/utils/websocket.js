class WebSocketClient {
  constructor(url = null) {
    this.ws = null
    this.url = url || this.getDefaultUrl()
    this.reconnectInterval = 3000
    this.maxReconnectAttempts = 10
    this.reconnectAttempts = 0
    this.messageHandlers = []
    this.isConnected = false
    this.clientType = 'client' // 默认客户端类型
  }

  getDefaultUrl() {
    // 使用环境变量配置的 WebSocket URL
    return import.meta.env.VITE_WS_URL || `wss://${window.location.hostname}:8442/ws`
  }

  /**
   * 设置客户端类型（用于身份认证）
   */
  setClientType(type) {
    this.clientType = type
  }

  connect() {
    // 先断开旧连接（防止热重载重复连接）
    if (this.ws) {
      this.ws.onclose = null  // 移除旧的事件处理器，避免触发重连
      this.ws.close()
      this.ws = null
    }

    try {
      console.log(`🔌 正在连接 WebSocket: ${this.url}`)
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('✅ WebSocket 连接成功')
        this.isConnected = true
        this.reconnectAttempts = 0
        
        // 发送身份认证
        const authMsg = { type: this.clientType }
        this.ws.send(JSON.stringify(authMsg))
        console.log(`📨 已发送 ${this.clientType} 身份认证:`, authMsg)
        
        this.notifyHandlers({ type: 'connected' })
      }

      this.ws.onmessage = (event) => {
        console.log('📥 收到 WebSocket 消息:', event.data.substring(0, 200))
        // 处理文本消息
        try {
          const data = JSON.parse(event.data)
          this.notifyHandlers(data)
        } catch (error) {
          console.error('解析 WebSocket 消息失败:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket 错误:', error)
        this.notifyHandlers({ type: 'error', error })
      }

      this.ws.onclose = (event) => {
        console.log(`⚠️ WebSocket 关闭: code=${event.code}, reason=${event.reason || '无'}`)
        this.isConnected = false
        this.notifyHandlers({ type: 'disconnected' })
        
        // 自动重连（无限重试）
        this.reconnectAttempts++
        console.log(`🔄 ${this.reconnectInterval / 1000}秒后尝试重连 (第${this.reconnectAttempts}次)`)
        setTimeout(() => this.connect(), this.reconnectInterval)
      }
    } catch (error) {
      console.error('❌ 创建 WebSocket 连接失败:', error)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      console.log('📤 发送 WebSocket 消息:', message.substring(0, 200))
      this.ws.send(message)
      return true
    } else {
      console.warn('⚠️ WebSocket 未连接,无法发送消息. 当前状态:', this.getState())
      return false
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

  getState() {
    if (!this.ws) return 'CLOSED'
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING'
      case WebSocket.OPEN: return 'OPEN'
      case WebSocket.CLOSING: return 'CLOSING'
      case WebSocket.CLOSED: return 'CLOSED'
      default: return 'UNKNOWN'
    }
  }
}

// 导出单例
export const wsClient = new WebSocketClient()
export default WebSocketClient
