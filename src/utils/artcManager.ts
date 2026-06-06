// @ts-nocheck
import AliRtcEngine from 'aliyun-rtc-sdk'

// ============ Types ============
export enum ChannelState {
  IDLE = 'idle',
  JOINING = 'joining',
  JOINED = 'joined',
  LEAVING = 'leaving',
  ERROR = 'error',
}

export interface RemoteUserInfo {
  uid: string
  hasVideo: boolean
  hasAudio: boolean
  videoSubState: number // 0=init, 1=unsubscribed, 2=subscribing, 3=subscribed
}

export interface ARTCConfig {
  appId: string
  channelId: string
  userId: string
  userName: string
}

export interface LogEntry {
  time: string
  message: string
}

// Token 通过公网服务器获取
const TOKEN_SERVER_URL = 'https://www.houqicg.com/api/artc/token'

// ============ ARTCManager Class ============
export class ARTCManager {
  private engine: any = null
  private _state: ChannelState = ChannelState.IDLE
  private remoteUsers: Map<string, RemoteUserInfo> = new Map()
  private logs: LogEntry[] = []
  private cameraStream: MediaStream | null = null
  private videoElements: Map<string, HTMLVideoElement> = new Map()

  // Event handlers
  private stateHandlers: Array<(s: ChannelState) => void> = []
  private remoteUsersHandlers: Array<(users: RemoteUserInfo[]) => void> = []
  private errorHandlers: Array<(error: string) => void> = []
  private logHandlers: Array<(entry: LogEntry) => void> = []

  get state(): ChannelState {
    return this._state
  }

  getLogs(): LogEntry[] {
    return this.logs
  }

  addLog(message: string): void {
    const entry: LogEntry = {
      time: new Date().toLocaleTimeString(),
      message,
    }
    this.logs = [...this.logs.slice(-99), entry] // keep last 100
    console.log(`[ARTC] ${message}`)
    this.logHandlers.forEach((h) => h(entry))
  }

  private setState(s: ChannelState): void {
    this._state = s
    this.stateHandlers.forEach((h) => h(s))
  }

  onStateChange(h: (s: ChannelState) => void): void {
    this.stateHandlers.push(h)
  }

  onRemoteUsersChange(h: (users: RemoteUserInfo[]) => void): void {
    this.remoteUsersHandlers.push(h)
  }

  onError(h: (error: string) => void): void {
    this.errorHandlers.push(h)
  }

  onLog(h: (entry: LogEntry) => void): void {
    this.logHandlers.push(h)
  }

  getRemoteUsers(): RemoteUserInfo[] {
    return Array.from(this.remoteUsers.values())
  }

  // ============ Initialize ============
  async initialize(): Promise<void> {
    if (this.engine) {
      this.addLog('Engine already initialized')
      return
    }

    try {
      this.engine = AliRtcEngine.getInstance()
      this.addLog('✓ Engine instance created')

      this.engine.setChannelProfile('interactive_live')
      this.addLog('✓ Channel profile: interactive_live')

      this.engine.setClientRole('interactive')
      this.addLog('✓ Client role: interactive (push & pull)')

      this.engine.setDefaultSubscribeAllRemoteVideoStreams(true)
      this.engine.setDefaultSubscribeAllRemoteAudioStreams(true)
      this.addLog('✓ Auto-subscribe enabled')

      this.registerEvents()
      this.addLog('✓ Event listeners registered')
    } catch (e: any) {
      const msg = `Engine init failed: ${e.message || e}`
      this.addLog(`✗ ${msg}`)
      this.errorHandlers.forEach((h) => h(msg))
      throw e
    }
  }

  // ============ Events ============
  private registerEvents(): void {
    const e = this.engine
    if (!e) return

    e.on('remoteUserOnLineNotify', (uid: string) => {
      this.addLog(`⟶ Remote user online: ${uid}`)
      if (!this.remoteUsers.has(uid)) {
        this.remoteUsers.set(uid, {
          uid,
          hasVideo: false,
          hasAudio: false,
          videoSubState: 0,
        })
      }
      this.notifyRemoteUsers()
    })

    e.on('remoteUserOffLineNotify', (uid: string) => {
      this.addLog(`⟵ Remote user offline: ${uid}`)
      this.remoteUsers.delete(uid)
      this.notifyRemoteUsers()
    })

    e.on(
      'remoteTrackAvailableNotify',
      (uid: string, audioTrack: any, videoTrack: any) => {
        const user = this.remoteUsers.get(uid)
        if (user) {
          user.hasAudio = !!audioTrack
          user.hasVideo = !!videoTrack
        }
        this.addLog(
          `📡 ${uid}: audio=${!!audioTrack} video=${!!videoTrack}`
        )
        this.notifyRemoteUsers()

        // 显式订阅（兜底：某些浏览器自动订阅可能不工作）
        if (videoTrack || audioTrack) {
          try {
            this.engine.subscribeRemoteMediaStream(uid, 1, !!videoTrack, !!audioTrack)
            this.addLog(`📡 ${uid} explicit subscribe sent`)
          } catch (e: any) {
            this.addLog(`⚠ subscribeRemoteMediaStream error: ${e.message}`)
          }
        }
      }
    )

    e.on(
      'videoSubscribeStateChanged',
      (
        uid: string,
        oldState: number,
        newState: number,
        _interval: number,
        _channel: string
      ) => {
        const states = ['init', 'unsub', 'sub-ing', 'subbed']
        const user = this.remoteUsers.get(uid)
        if (user) {
          user.videoSubState = newState
        }
        this.addLog(
          `📹 ${uid} video: ${states[oldState] || oldState} → ${states[newState] || newState}`
        )
        this.notifyRemoteUsers()

        // 订阅成功 → 绑定 video 元素（带重试，解决 DOM 时序竞争）
        if (newState === 3) {
          const tryBind = (attempt = 0) => {
            const el = this.videoElements.get(uid)
            if (el) {
              this.setRemoteView(el, uid)
            } else if (attempt < 20) {
              setTimeout(() => tryBind(attempt + 1), 50)
            }
          }
          tryBind()
        }
      }
    )

    e.on(
      'audioSubscribeStateChanged',
      (
        uid: string,
        oldState: number,
        newState: number,
        _interval: number,
        _channel: string
      ) => {
        const states = ['init', 'unsub', 'sub-ing', 'subbed']
        this.addLog(
          `🔊 ${uid} audio: ${states[oldState] || oldState} → ${states[newState] || newState}`
        )
      }
    )

    e.on('connectionStatusChange', (status: string, reason: string) => {
      this.addLog(`🔗 Connection: ${status} (${reason})`)
      if (status === 'DISCONNECTED' || status === 'FAILED') {
        this.setState(ChannelState.ERROR)
      }
    })

    e.on('bye', (code: number) => {
      this.addLog(`⛔ Kicked from channel (code=${code})`)
      this.setState(ChannelState.IDLE)
      this.remoteUsers.clear()
      this.notifyRemoteUsers()
    })

    e.on('occurError', (error: any, uid?: string) => {
      const msg = `✗ Error${uid ? ` from ${uid}` : ''}: ${JSON.stringify(error)}`
      this.addLog(msg)
      this.errorHandlers.forEach((h) => h(msg))
    })

    e.on('authInfoWillExpire', () => {
      this.addLog('⚠ Token expiring in 30s')
    })

    e.on('authInfoExpired', () => {
      this.addLog('⛔ Token expired')
      this.setState(ChannelState.ERROR)
    })
  }

  // ============ Token ============
  private async fetchToken(config: ARTCConfig): Promise<string> {
    const url = `${TOKEN_SERVER_URL}?channel=${encodeURIComponent(config.channelId)}&userid=${encodeURIComponent(config.userId)}`
    this.addLog(`🔑 Fetching token from ${url}...`)
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Token server error: ${res.status} ${res.statusText}`)
    }
    const data = await res.json()
    this.addLog(`✅ Token received for ${data.userId}`)
    return data.token
  }

  // ============ Join / Leave Channel ============
  async joinChannel(config: ARTCConfig): Promise<void> {
    if (!this.engine) await this.initialize()
    if (!this.engine) return

    this.setState(ChannelState.JOINING)

    try {
      const token = await this.fetchToken(config)
      this.addLog(`🚪 Joining channel "${config.channelId}"...`)

      // 单字符串方式：token 是 Python GenerateToken 返回的完整令牌
      await this.engine.joinChannel(token, config.userName)

      this.addLog(
        `✅ Joined channel "${config.channelId}" as ${config.userName}`
      )
      this.setState(ChannelState.JOINED)
    } catch (e: any) {
      const msg = `Join failed: ${e.message || e}`
      this.addLog(`✗ ${msg}`)
      this.setState(ChannelState.ERROR)
      this.errorHandlers.forEach((h) => h(msg))
      throw e
    }
  }

  async leaveChannel(): Promise<void> {
    if (!this.engine || this._state === ChannelState.IDLE) return

    this.setState(ChannelState.LEAVING)
    this.addLog('🚪 Leaving channel...')

    try {
      await this.engine.leaveChannel()
      this.addLog('✅ Left channel')
      this.remoteUsers.clear()
      this.notifyRemoteUsers()
      this.setState(ChannelState.IDLE)
    } catch (e: any) {
      this.addLog(`✗ Leave error: ${e.message || e}`)
      this.setState(ChannelState.IDLE)
    }
  }

  async destroy(): Promise<void> {
    try {
      this.stopCamera()
      if (this.engine) {
        await this.engine.leaveChannel().catch(() => {})
        await this.engine.destroy()
        this.engine = null
        this.addLog('💀 Engine destroyed')
      }
    } catch (e: any) {
      this.addLog(`Destroy error: ${e.message || e}`)
    }
  }

  // ============ Camera ============
  async startCamera(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.engine) {
      this.addLog('⚠ Cannot start camera: engine not initialized')
      return
    }

    try {
      // Try SDK native camera first (no separate getUserMedia)
      await this.engine.setLocalViewConfig(videoElement, 1)
      await this.engine.startPreview()
      this.addLog('📷 Camera started (SDK native)')
    } catch (e: any) {
      this.addLog(`SDK camera failed: ${e.message}, trying getUserMedia...`)

      // Fallback: getUserMedia for preview only
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        videoElement.srcObject = this.cameraStream
        await videoElement.play()
        this.addLog('📷 Camera started (getUserMedia fallback)')
      } catch (mediaErr: any) {
        const msg = `Camera access denied: ${mediaErr.message || mediaErr}`
        this.addLog(`✗ ${msg}`)
        throw mediaErr
      }
    }
  }

  stopCamera(): void {
    try {
      if (this.engine) {
        this.engine.stopPreview()
        this.engine.setLocalViewConfig(null, 1)
      }
    } catch {}

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop())
      this.cameraStream = null
    }

    this.addLog('📷 Camera stopped')
  }

  // ============ Remote Video ============
  setRemoteView(videoElement: HTMLVideoElement, uid: string): void {
    if (!this.engine) {
      this.addLog(`setRemoteView skipped for ${uid}: engine not ready`)
      return
    }
    try {
      this.engine.setRemoteViewConfig(videoElement, uid, 1)
      this.addLog(`🎬 setRemoteViewConfig(${uid}) called`)
    } catch (e: any) {
      this.addLog(`setRemoteView error for ${uid}: ${e.message}`)
    }
  }

  clearRemoteView(uid: string): void {
    if (!this.engine) return
    try {
      this.engine.setRemoteViewConfig(null, uid, 1)
    } catch {}
  }

  /** 注册远端 video 元素（由 App.vue 模板 ref 调用） */
  registerVideoElement(uid: string, el: HTMLVideoElement | null): void {
    if (el) {
      this.videoElements.set(uid, el)
    } else {
      this.videoElements.delete(uid)
    }
  }

  // ============ Internal ============
  private notifyRemoteUsers(): void {
    const users = Array.from(this.remoteUsers.values())
    this.remoteUsersHandlers.forEach((h) => h(users))
  }
}

// ============ Singleton ============
export const artcManager = new ARTCManager()
