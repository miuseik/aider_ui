/**
 * 视频流管理器 - 从 WebSocket 接收机器人视频帧并显示
 * 复用 websocket.js 的连接，只处理业务逻辑
 */

import { wsClient } from './websocket'

class VideoStreamManager {
  constructor() {
    this.displayImage = null
    this.onFrameUpdate = null
    this.messageHandler = null
  }

  /**
   * 初始化视频流监听（复用全局 WebSocket）
   */
  connect() {
    console.log('Video stream listening on global WebSocket')
    
    // 移除旧的监听器（如果存在）
    if (this.messageHandler) {
      wsClient.messageHandlers = wsClient.messageHandlers.filter(h => h !== this.messageHandler)
    }
    
    // 添加新的监听器
    this.messageHandler = (data) => {
      // 处理视频帧
      try {
        if (data.type === 'robot_data' && data.data) {
          const robotData = JSON.parse(data.data)
          if (robotData.type === 'video_frame' && robotData.frame) {
            if (!this.displayImage) {
              this.displayImage = new Image()
            }
            this.displayImage.src = `data:image/jpeg;base64,${robotData.frame}`
            
            if (this.onFrameUpdate) {
              this.onFrameUpdate(robotData.frame)
            }
          }
        }
      } catch (e) {
        console.error('Error parsing video frame:', e)
      }
    }
    
    wsClient.onMessage(this.messageHandler)
  }

  /**
   * 获取最新的视频帧 Image 对象
   */
  getLatestFrameImage() {
    return this.displayImage
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.messageHandler) {
      wsClient.messageHandlers = wsClient.messageHandlers.filter(h => h !== this.messageHandler)
      this.messageHandler = null
    }
  }
}

export default VideoStreamManager
