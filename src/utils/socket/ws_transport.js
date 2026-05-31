/**
 * WebSocket 传输层 - 负责连接管理、重连、消息收发
 */

class WSTransport {
  constructor(url) {
    this.ws = null
    this.url = url
    this.reconnectInterval = 3000
    this.maxReconnectAttempts = 10
    this.reconnectAttempts = 0
    this.onMessageCallback = null
    this.isConnected = false
  }

  connect() {
    // 先断开旧连接（防止热重载重复连接）
    if (this.ws) {
      this.ws.onclose = null
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
      }

      this.ws.onmessage = (event) => {
        if (this.onMessageCallback) {
          this.onMessageCallback(event.data)
        }
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket 错误:', error)
      }

      this.ws.onclose = () => {
        console.log('⚠️ WebSocket 已断开')
        this.isConnected = false
        this._reconnect()
      }

      return true
    } catch (error) {
      console.error('创建 WebSocket 失败:', error)
      return false
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  async _reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数，停止重连')
      return
    }

    this.reconnectAttempts++
    console.log(`🔄 重连尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`)
    
    await new Promise(resolve => setTimeout(resolve, this.reconnectInterval))
    this.connect()
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
      return true
    } else {
      console.warn('⚠️ WebSocket 未连接,无法发送消息')
      return false
    }
  }

  onMessage(callback) {
    this.onMessageCallback = callback
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

export default WSTransport
