// 全局视频管理器 - 单例模式
import { ref } from 'vue'
import { wsClient } from './websocket.js'

class VideoManager {
  constructor() {
    this.isConnected = ref(false)
    this.isConnecting = ref(false)
    this.videoElement = null
    this.aliRtcEngine = null
    
    // ARTC 配置
    this.config = {
      appId: '1295a524-ff41-4bfc-ba3f-7c1c786738cd',
      appKey: '659fe17ceb1494befefd57559b094a0d',
      channelId: 'test123',
      terminalUserId: 'python_terminal'
    }
  }

  // 初始化 video 元素
  initVideoElement(videoId = 'global-video') {
    if (this.videoElement) return this.videoElement
    
    let video = document.getElementById(videoId)
    if (!video) {
      video = document.createElement('video')
      video.id = videoId
      video.autoplay = true
      video.playsInline = true
      video.muted = true
      video.style.display = 'none' // 隐藏，供纹理使用
      document.body.appendChild(video)
    }
    
    this.videoElement = video
    return video
  }

  // 连接视频
  async connect() {
    if (this.isConnected.value || this.isConnecting.value) {
      console.log('[VideoManager] 已连接或正在连接')
      return
    }

    this.isConnecting.value = true
    console.log('[VideoManager] 🚀 开始连接视频...')

    try {
      // 1. 通知后端启动推流
      wsClient.send(JSON.stringify({
        type: 'api_command',
        category: 'video',
        action: 'start'
      }))
      
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 2. 加载 SDK
      if (!window.AliRtcEngine) {
        await this.loadSDK()
      }

      this.aliRtcEngine = window.AliRtcEngine.getInstance()
      this.aliRtcEngine.setChannelProfile('interactive_live')
      this.aliRtcEngine.setClientRole('interactive')

      // 3. 生成 Token
      const userId = `web_viewer_global`
      const timestamp = Math.floor(Date.now() / 1000) + 3600
      const token = await this.generateToken(
        this.config.appId,
        this.config.appKey,
        this.config.channelId,
        userId,
        timestamp
      )

      // 4. 加入频道
      await this.aliRtcEngine.joinChannel({
        appId: this.config.appId,
        channelId: this.config.channelId,
        userId,
        token,
        timestamp,
      }, userId)

      console.log('[VideoManager] ✅ 加入频道成功')

      // 5. 注册事件和轮询
      this.registerEvents()
      this.startPolling()

    } catch (error) {
      console.error('[VideoManager] ❌ 连接失败:', error)
      this.isConnecting.value = false
      throw error
    }
  }

  // 断开连接
  disconnect() {
    if (!this.isConnected.value) return

    console.log('[VideoManager] 断开视频连接')
    
    // 通知后端停止推流
    wsClient.send(JSON.stringify({
      type: 'api_command',
      category: 'video',
      action: 'stop'
    }))

    if (this.aliRtcEngine) {
      try {
        this.aliRtcEngine.stopPreview()
        this.aliRtcEngine.leaveChannel()
        this.aliRtcEngine.destroy()
      } catch (e) {
        console.error('[VideoManager] 清理出错:', e)
      }
      this.aliRtcEngine = null
    }

    this.isConnected.value = false
    this.isConnecting.value = false
  }

  // 获取 video 元素
  getVideoElement() {
    if (!this.videoElement) {
      this.initVideoElement()
    }
    return this.videoElement
  }

  // 私有方法：加载 SDK
  loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.AliRtcEngine) return resolve()
      
      const script = document.createElement('script')
      script.src = 'https://g.alicdn.com/apsara-media-box/imp-web-rtc/7.1.9/aliyun-rtc-sdk.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('SDK 加载失败'))
      document.head.appendChild(script)
    })
  }

  // 私有方法：生成 Token
  async generateToken(appId, appKey, channelId, userId, timestamp) {
    const encoder = new TextEncoder()
    const data = encoder.encode(`${appId}${appKey}${channelId}${userId}${timestamp}`)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return this.hex(hash)
  }

  hex(buffer) {
    const hexCodes = []
    const view = new DataView(buffer)
    for (let i = 0; i < view.byteLength; i += 4) {
      const value = view.getUint32(i)
      const stringValue = value.toString(16)
      const padding = '00000000'
      const paddedValue = (padding + stringValue).slice(-padding.length)
      hexCodes.push(paddedValue)
    }
    return hexCodes.join('')
  }

  // 私有方法：注册事件
  registerEvents() {
    if (!this.aliRtcEngine) return

    this.aliRtcEngine.on('remoteUserOnLineNotify', (userId) => {
      this.bindVideo(userId)
    })

    this.aliRtcEngine.on('remoteUserOffLineNotify', (userId) => {
      if (userId.includes('terminal')) {
        this.disconnect()
      }
    })

    this.aliRtcEngine.on('videoSubscribeStateChanged', (userId, oldState, newState) => {
      if (newState === 3) {
        this.bindVideo(userId)
        if (!this.isConnected.value) {
          this.isConnected.value = true
          this.isConnecting.value = false
        }
      } else if (newState === 1) {
        if (userId.includes('terminal')) this.disconnect()
      }
    })
  }

  // 私有方法：绑定视频
  bindVideo(userId) {
    if (!this.videoElement || !this.aliRtcEngine) return

    try {
      this.aliRtcEngine.subscribe?.(userId, 'video')
      this.aliRtcEngine.subscribeRemoteUserVideo?.(userId)
      this.aliRtcEngine.setRemoteViewConfig(this.videoElement, userId, 1)
      
      this.videoElement.muted = true
      this.videoElement.play().catch(() => {})
    } catch (e) {
      console.error('[VideoManager] 绑定视频失败:', e)
    }
  }

  // 私有方法：轮询检测
  startPolling() {
    let tries = 0
    const pollTimer = setInterval(() => {
      tries++
      
      if (!this.videoElement || this.isConnected.value) {
        clearInterval(pollTimer)
        return
      }

      try {
        const users = this.aliRtcEngine.getRemoteUsers?.() || this.aliRtcEngine.getUsers?.() || []
        for (const uid of users) {
          const userId = typeof uid === 'string' ? uid : uid.userId || uid.id
          if (userId && userId.includes('terminal')) {
            this.bindVideo(userId)
          }
        }
      } catch (e) {}

      this.videoElement.muted = true
      this.videoElement.play().catch(() => {})
      
      if (this.videoElement.readyState >= 2 && this.videoElement.videoWidth > 0) {
        this.isConnected.value = true
        this.isConnecting.value = false
        clearInterval(pollTimer)
        console.log('[VideoManager] 🎬 视频连接成功')
      }

      if (tries > 60) {
        clearInterval(pollTimer)
        console.warn('[VideoManager] ⚠️ 轮询超时')
      }
    }, 500)
  }
}

// 导出单例
export const videoManager = new VideoManager()
