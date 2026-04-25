/**
 * WebRTC 视频连接管理器
 * 用于在多个页面复用 WebRTC 连接逻辑
 */

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
    
    // 创建 WebSocket 连接(使用唯一 ID)
    const clientId = `video_${this.videoId}_${Date.now()}`
    const fullUrl = `${this.wsUrl.split('/vr/client')[0]}/vr/client/${clientId}`
    this.ws = new WebSocket(fullUrl)
    
    this.ws.onopen = async () => {
      console.log(`[${this.videoId}] WebSocket connected`)
      
      // 发送初始化消息
      this.ws.send(JSON.stringify({ type: 'client' }))
      
      this.setupWebRTC()
    }
    
    this.ws.onerror = (error) => {
      console.error(`[${this.videoId}] WebSocket error:`, error)
      this.onError(error)
    }
    
    this.ws.onclose = () => {
      console.log(`[${this.videoId}] WebSocket closed`)
      this.isConnected = false
      this.onDisconnected()
    }
  }

  /**
   * 设置 WebRTC
   */
  setupWebRTC() {
    console.log(`[${this.videoId}] 开始设置 WebRTC`)

    // 创建 RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [
        // 国内 STUN
        // { urls: 'stun:stun.miwifi.com:3478' },
        // { urls: 'stun:stun.qq.com:3478' },
        // { urls: 'stun:stun.bige0.com:3391' },
        // 自建 TURN 服务器 (强制中继)
        {
          urls: 'turn:121.40.151.10:3478',
          username: 'aider',
          credential: 'aider123456'
        },
        {
          urls: 'turns:121.40.151.10:5349',
          username: 'aider',
          credential: 'aider123456'
        }
      ],
      iceCandidatePoolSize: 10,  // ICE 候选池大小
      iceTransportPolicy: 'relay'  // 强制使用 TURN 中继
    })
    
    // 处理远程视频流
    this.pc.ontrack = (event) => {
      console.log(`[${this.videoId}] 收到视频轨道:`, event.track.kind)
      const video = document.getElementById(this.videoId)
      if (video && event.streams[0]) {
        video.srcObject = event.streams[0]
        console.log('✅ 视频已连接',event.streams)
        this.isConnected = true
        // 不立即调用 onConnected,等待 stats 判断完成
        
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
        this.ws.send(JSON.stringify({
          type: 'candidate',
          candidate: event.candidate
        }))
      }
    }
    
    // 监听连接状态变化
    this.pc.onconnectionstatechange = async () => {
      const state = this.pc?.connectionState
      console.log(`[${this.videoId}] WebRTC 状态: ${state}`)
      
      if (state === 'connected') {
        // 延迟获取 stats 确保连接稳定
        setTimeout(async () => {
          if (!this.pc || this.pc.connectionState !== 'connected') return
          
          try {
            const stats = await this.pc.getStats()
            let connectionType = 'unknown'
            let foundNominated = false
            
            stats.forEach(stat => {
              // 只检查被提名（实际使用）的连接对
              if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
                const localCandidate = stats.get(stat.localCandidateId)
                if (localCandidate) {
                  connectionType = localCandidate.candidateType === 'relay' 
                    ? 'TURN (中继)' 
                    : localCandidate.candidateType === 'srflx' 
                      ? 'STUN (P2P)' 
                      : 'Host (局域网)'
                  foundNominated = true
                  console.log(`[${this.videoId}] ICE 候选类型: ${localCandidate.candidateType}`)
                }
              }
            })
            
            // 如果没有找到 nominated 的 pair，记录警告
            if (!foundNominated) {
              console.warn(`[${this.videoId}] 未找到 nominated candidate pair`)
            }
            
            console.log(`[${this.videoId}] 🌐 连接类型: ${connectionType}`)
            this.onConnected(connectionType)
          } catch (error) {
            console.error(`[${this.videoId}] 获取 stats 失败:`, error)
          }
        }, 500)
      }
      
      if (state === 'failed' || state === 'disconnected') {
        console.error(`[${this.videoId}] 连接失败,尝试重连...`)
        
        this.reconnectAttempts++
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error(`[${this.videoId}] 重连次数过多,停止重连`)
          this.cleanup()
          this.onDisconnected()
          return
        }
        
        // 5秒后重连
        setTimeout(() => {
          this.init()
        }, 5000)
      }
    }
    
    // 监听信令消息
    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data))
        
        // 创建 answer
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        
        // 发送 answer
        this.ws.send(JSON.stringify({
          type: 'answer',
          sdp: this.pc.localDescription.sdp
        }))
      } else if (data.type === 'candidate') {
        console.log(`[${this.videoId}] Received candidate`)
      }
    }
  }

  /**
   * 清理连接
   */
  cleanup() {
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
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
