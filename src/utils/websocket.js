class WebSocketClient {
  constructor(url = null) {
    this.ws = null
    this.url = url || this.getDefaultUrl()
    this.reconnectInterval = 3000
    this.maxReconnectAttempts = 10
    this.reconnectAttempts = 0
    this.messageHandlers = []
    this.isConnected = false
  }

  getDefaultUrl() {
    // 生产环境使用固定域名,开发环境使用当前主机
    const isProd = import.meta.env.PROD
    if (isProd) {
      return `wss://www.houqicg.com:8442`
    }
    const host = window.location.hostname
    return `wss://${host}:8442`
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket 已连接')
      return
    }

    try {
      console.log(`正在连接 WebSocket: ${this.url}`)
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket 连接成功')
        this.isConnected = true
        this.reconnectAttempts = 0
        
        // 发送身份认证
        this.send({ type: 'client' })
        console.log('已发送 UI 客户端身份认证')
        
        this.notifyHandlers({ type: 'connected' })
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.notifyHandlers(data)
        } catch (error) {
          console.error('解析 WebSocket 消息失败:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error)
        this.notifyHandlers({ type: 'error', error })
      }

      this.ws.onclose = (event) => {
        console.log(`WebSocket 关闭: ${event.code} - ${event.reason}`)
        this.isConnected = false
        this.notifyHandlers({ type: 'disconnected' })
        
        // 自动重连（无限重试）
        this.reconnectAttempts++
        console.log(`${this.reconnectInterval / 1000}秒后尝试重连 (第${this.reconnectAttempts}次)`)
        setTimeout(() => this.connect(), this.reconnectInterval)
      }
    } catch (error) {
      console.error('创建 WebSocket 连接失败:', error)
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
      this.ws.send(JSON.stringify(data))
      return true
    } else {
      console.warn('WebSocket 未连接,无法发送消息')
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
