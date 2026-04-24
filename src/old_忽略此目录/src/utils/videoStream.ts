/**
 * 视频流管理器 - 从 Aider Server 接收机器人视频帧并显示
 */

import WebSocketManager from './websocketManager'

class VideoStreamManager {
  private ws: WebSocket | null = null
  private serverPort: number = 8442
  private displayImage: HTMLImageElement | null = null
  public onFrameUpdate: ((frame: string) => void) | null = null

  constructor(port?: number) {
    if (port) {
      this.serverPort = port
    }
  }

  /**
   * 初始化视频流连接
   */
  connect(): void {
    const serverHostname = window.location.hostname
    const websocketUrl = `wss://${serverHostname}:${this.serverPort}/controller/vr_controller_01`

    try {
      this.ws = WebSocketManager.getInstance().getConnection(websocketUrl)

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'robot_data') {
          this.handleRobotData(data.data)
        }
      }
    } catch (error) {
    }
  }

  /**
   * 处理机器人数据
   */
  private handleRobotData(dataStr: string): void {
    try {
      const data = JSON.parse(dataStr)
      if (data.type === 'video_frame' && data.frame) {
        this.updateVideoFrame(data.frame)
      }
    } catch (e) {
    }
  }

  /**
   * 更新视频帧
   */
  private updateVideoFrame(base64Frame: string): void {
    if (!this.displayImage) {
      this.displayImage = new Image()
    }
    this.displayImage.src = `data:image/jpeg;base64,${base64Frame}`
    
    // 通知外部组件
    if (this.onFrameUpdate) {
      this.onFrameUpdate(base64Frame)
    }
  }

  /**
   * 获取最新的视频帧 Image 对象
   */
  public getLatestFrameImage(): HTMLImageElement | null {
    return this.displayImage
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export default VideoStreamManager
