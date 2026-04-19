/**
 * WebSocket 连接管理器 - 单例模式，统一管理所有 WebSocket 连接
 */

class WebSocketManager {
  private static instance: WebSocketManager | null = null
  private connections: Record<string, any> = {}

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager()
    }
    return WebSocketManager.instance
  }

  /**
   * 获取或创建 WebSocket 连接
   */
  public getConnection(url: string): WebSocket {
    // 如果已存在且连接正常，直接返回
    if (this.connections[url]) {
      const ws = this.connections[url]
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        return ws
      }
      // 连接已关闭，删除旧连接
      delete this.connections[url]
    }

    // 创建新连接
    const ws = new WebSocket(url)
    this.connections[url] = ws
    return ws
  }

  /**
   * 关闭指定连接
   */
  public closeConnection(url: string): void {
    const ws = this.connections[url]
    if (ws) {
      ws.close()
      delete this.connections[url]
    }
  }

  /**
   * 关闭所有连接
   */
  public closeAll(): void {
    Object.keys(this.connections).forEach((url) => {
      this.connections[url].close()
    })
    this.connections = {}
  }
}

export default WebSocketManager
