/**
 * 控制器管理器 - 负责发送 VR 手柄数据到 Aider Server
 */

class ControllerManager {
  private ws: WebSocket | null = null
  private serverPort: number = 8443
  private lastLeftSendTime: number = 0
  private lastRightSendTime: number = 0
  private sendInterval: number = 16 // 16ms 发送间隔，约 60Hz

  constructor() {
    this.connect()
  }

  /**
   * 连接到服务器
   */
  connect(): void {
    const serverHostname = window.location.hostname
    const websocketUrl = `wss://${serverHostname}:${this.serverPort}/ws/controller/vr_controller_01`
    
    try {
      this.ws = new WebSocket(websocketUrl)
      
      this.ws.onopen = () => {
        console.log('✅ 控制器 WebSocket 已连接')
      }
      
      this.ws.onerror = (error) => {
        console.error('❌ 控制器 WebSocket 错误:', error)
      }
      
      this.ws.onclose = () => {
        console.log('⚠️ 控制器 WebSocket 已断开，3秒后重连...')
        setTimeout(() => this.connect(), 3000)
      }
    } catch (error) {
      console.error('创建 WebSocket 失败:', error)
    }
  }

  /**
   * 发送左手控制器数据（摇杆控制底盘）
   */
  sendLeftControllerData(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    thumbstick: { x: number; y: number },
    triggerValue: number,
    gripActive: boolean
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    
    const now = Date.now()
    if (now - this.lastLeftSendTime < this.sendInterval) return
    this.lastLeftSendTime = now

    // 左手：摇杆控制底盘前进/转向
    const vrCommand = {
      target_robot: 'robot_01',
      command: {
        type: 'vr_pose',
        hand: 'left',
        position: [position.x, position.y, position.z],
        orientation: [rotation.x, rotation.y, rotation.z],
        thumbstick: {
          x: thumbstick.x,
          y: thumbstick.y
        },
        triggerValue: triggerValue,
        gripActive: gripActive,
        timestamp: Date.now() / 1000
      }
    }

    this.ws.send(JSON.stringify(vrCommand))
  }

  /**
   * 发送右手控制器数据（摇杆控制升降/平移，扳机控制爪机）
   */
  sendRightControllerData(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    thumbstick: { x: number; y: number },
    triggerValue: number,
    gripActive: boolean
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    
    const now = Date.now()
    if (now - this.lastRightSendTime < this.sendInterval) return
    this.lastRightSendTime = now

    // 右手：摇杆控制升降/平移，扳机控制爪机
    const vrCommand = {
      target_robot: 'robot_01',
      command: {
        type: 'vr_pose',
        hand: 'right',
        position: [position.x, position.y, position.z],
        orientation: [rotation.x, rotation.y, rotation.z],
        thumbstick: {
          x: thumbstick.x,
          y: thumbstick.y
        },
        triggerValue: triggerValue,
        gripActive: gripActive,
        timestamp: Date.now() / 1000
      }
    }

    this.ws.send(JSON.stringify(vrCommand))
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

// 导出单例
export const controllerManager = new ControllerManager()
export default controllerManager
