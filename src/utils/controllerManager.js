/**
 * 控制器管理器 - 负责发送 VR 手柄数据到 Aider Server
 * 复用 websocket.js 的连接，只处理业务逻辑
 */

import { wsClient } from './websocket'

class ControllerManager {
  constructor() {
    this.lastLeftSendTime = 0
    this.lastRightSendTime = 0
    this.sendInterval = 8 // 8ms 发送间隔，约 125Hz
    // 使用默认的 'client' 类型，不需要单独设置
  }

  /**
   * 发送左手控制器数据
   */
  sendLeftControllerData(
    position,
    quaternion,
    thumbstick,
    triggerValue,
    gripActive
  ) {
    if (!wsClient.isConnected) return
    
    const now = Date.now()
    if (now - this.lastLeftSendTime < this.sendInterval) return
    this.lastLeftSendTime = now

    const vrCommand = {
      target_robot: 'robot_01',
      leftController: {
        position: [position.x, position.y, position.z],
        quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
        trigger: triggerValue,
        gripActive: gripActive,
        thumbstick: thumbstick
      },
      rightController: {
        position: null,
        quaternion: null,
        trigger: 0,
        gripActive: false
      }
    }

    wsClient.send(vrCommand)
  }

  /**
   * 发送右手控制器数据
   */
  sendRightControllerData(
    position,
    quaternion,
    thumbstick,
    triggerValue,
    gripActive
  ) {
    if (!wsClient.isConnected) return
    
    const now = Date.now()
    if (now - this.lastRightSendTime < this.sendInterval) return
    this.lastRightSendTime = now

    const vrCommand = {
      target_robot: 'robot_01',
      leftController: {
        position: null,
        quaternion: null,
        trigger: 0,
        gripActive: false
      },
      rightController: {
        position: [position.x, position.y, position.z],
        quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
        trigger: triggerValue,
        gripActive: gripActive,
        thumbstick: thumbstick
      }
    }

    wsClient.send(vrCommand)
  }
}

// 导出单例
const controllerManager = new ControllerManager()
export { controllerManager }
export default controllerManager
