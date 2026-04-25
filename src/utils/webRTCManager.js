/**
 * WebRTC 视频连接管理器
 * 用于在多个页面复用 WebRTC 连接逻辑
 */

import { wsClient } from './websocket'

export class WebRTCVideoManager {
  constructor(options = {}) {
    this.videoId = options.videoId
    this.wsUrl = options.wsUrl
    this.onConnected = options.onConnected || (() => {})
    this.onDisconnected = options.onDisconnected || (() => {})
    this.onError = options.onError || (() => {})
    
    this.pc = null
    this.ws = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 3  // 最多重连 3 次
  }

  /**
   * 初始化 WebRTC 连接
   */
  init() {
    // 先清理旧连接
    this.cleanup()
    this.reconnectAttempts = 0  // 重置重连计数
    
    // 先创建 WebRTC PeerConnection
    this.setupWebRTC()
    
    // 再通知终端开始推流
    wsClient.send({ type: 'reconnect' })
    console.log(`[${this.videoId}] 📤 已通知终端开始推流`)
  }

  /**
   * 设置 WebRTC
   */
  setupWebRTC() {
    console.log(`[${this.videoId}] 开始设置 WebRTC`)

    // 创建 RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [
        // Google STUN (最稳定)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // 国内 STUN
        { urls: 'stun:stun.miwifi.com:3478' },
        { urls: 'stun:stun.qq.com:3478' },
        { urls: 'stun:stun.bige0.com:3391' },
        // 自建 TURN 服务器
        {
          urls: 'turn:ws.houqicg.com:3478',
          username: 'aider',
          credential: 'aider123456'
        },
        {
          urls: 'turns:ws.houqicg.com:5349',
          username: 'aider',
          credential: 'aider123456'
        }
      ],
      iceCandidatePoolSize: 10  // ICE 候选池大小
    })
    
    // 处理远程视频流
    this.pc.ontrack = (event) => {
      console.log(`[${this.videoId}] 收到视频轨道:`, event.track.kind)
      const video = document.getElementById(this.videoId)
      if (video && event.streams[0]) {
        video.srcObject = event.streams[0]
        console.log(`[${this.videoId}] ✅ 视频已连接`)
        console.log(`[${this.videoId}] 视频元素:`, video)
        console.log(`[${this.videoId}] srcObject:`, video.srcObject)
        console.log(`[${this.videoId}] 视频轨道:`, video.srcObject?.getVideoTracks())
        console.log(`[${this.videoId}] 轨道状态:`, video.srcObject?.getVideoTracks()[0]?.readyState)
        this.isConnected = true
        this.onConnected()
        
        // 监听视频播放状态
        video.onplay = () => {
          console.log(`[${this.videoId}] 视频开始播放`)
        }
        video.onerror = (e) => {
          console.error(`[${this.videoId}] 视频播放错误:`, e)
          this.isConnected = false
          this.onDisconnected()
        }
      } else {
        console.error(`[${this.videoId}] ❌ 找不到 video 元素或没有视频流`)
        this.isConnected = false
        this.onDisconnected()
      }
    }
    
    // 处理 ICE 候选
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send({
          type: 'candidate',
          candidate: event.candidate
        })
      }
    }
    
    // 监听连接状态变化
    this.pc.onconnectionstatechange = () => {
      console.log(`[${this.videoId}] WebRTC 连接状态:`, this.pc.connectionState)
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
        console.error(`[${this.videoId}] WebRTC 连接失败,尝试重连...`)
        // 5秒后重连
        setTimeout(() => {
          this.init()
        }, 5000)
      }
    }
    
    // 监听信令消息
    this.messageHandler = (data) => {
      if (!this.pc) {
        console.warn(`[${this.videoId}] ⚠️ PeerConnection 未初始化,忽略消息`)
        return
      }
      
      if (data.type === 'offer') {
        this.pc.setRemoteDescription(new RTCSessionDescription(data))
          .then(() => this.pc.createAnswer())
          .then(answer => this.pc.setLocalDescription(answer))
          .then(() => {
            wsClient.send({
              type: 'answer',
              sdp: this.pc.localDescription.sdp
            })
          })
      } else if (data.type === 'candidate') {
        console.log(`[${this.videoId}] Received candidate`)
      }
    }
    
    this.removeMessageHandler = wsClient.onMessage(this.messageHandler)
  }

  /**
   * 清理连接
   */
  cleanup() {
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    // 移除消息监听器
    if (this.removeMessageHandler) {
      this.removeMessageHandler()
      this.removeMessageHandler = null
    }
    this.isConnected = false
  }

  /**
   * 获取连接状态
   */
  get connectionState() {
    return this.isConnected
  }
}
