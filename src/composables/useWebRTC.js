/**
 * WebRTC 摄像头订阅 + 双向音频 composable
 *
 * - 接收 terminal 推送的视频/音频 track
 * - 支持客户端麦克风采集并发送到 terminal（双向通话）
 * - 信令复用 VR client 通道（/ws/client/webrtc-camera）
 */
import { ref, onUnmounted } from 'vue'

const ROOM_ID = 'robot-camera'

// ICE 服务器（与 Terminal/服务器保持一致，后续可由 webrtc_sub_joined 响应更新）
const HARDCODED_ICE_SERVERS = [
  { urls: ['stun:121.40.151.10:3478'] },
  { urls: ['turn:121.40.151.10:3478'], username: 'aider', credential: 'aider123456' },
  { urls: ['turns:server.houqicg.com:5349'], username: 'aider', credential: 'aider123456' },
]

// 开发环境：通过 Vite /ws proxy 转发到 server（复用页面 origin，访问哪个域名就连哪个域名的 ws）
// 生产环境：直连 server.houqicg.com（WebSocket Server 独立子域名）
const CLIENT_WS_URL = import.meta.env.DEV
  ? `${location.origin}/ws/client/webrtc-camera`
  : 'wss://server.houqicg.com/ws/client/webrtc-camera'

export function useWebRTC(videoRef) {
  const connectionState = ref('disconnected')
  const iceConnectionState = ref('')
  const error = ref('')
  const micEnabled = ref(false)
  const micUnavailable = ref(false)  // 设备不支持麦克风（如 VR 眼镜）

  let ws = null
  let pc = null
  let iceServers = [...HARDCODED_ICE_SERVERS]
  let remoteAudioEl = null  // 播放 terminal 传来的音频
  let localMicStream = null  // 本地麦克风 MediaStream
  let localAudioTrack = null
  let micErrorTimer = null

  const stateLabel = () => {
    const map = {
      disconnected: '未连接',
      connecting: '连接中...',
      connected: '已连接',
      failed: '连接失败',
      closed: '已断开',
    }
    return map[connectionState.value] || connectionState.value
  }

  // ─── 信令 WebSocket ───
  function connectSignaling() {
    console.log('[Camera] connectSignaling')
    return new Promise((resolve, reject) => {
      connectionState.value = 'connecting'
      ws = new WebSocket(CLIENT_WS_URL)
      console.log('[Camera] 开始连接信令 WebSocket:', CLIENT_WS_URL)
      ws.onopen = () => {
        console.log('[Camera] 信令 WS 已连接 (复用 /ws/client 通道)')
        // 告知服务器我是 WebRTC 订阅者
        ws.send(JSON.stringify({
          type: 'webrtc_sub_join',
          role: 'sub',
          room_id: ROOM_ID,
        }))
        resolve()
      }

      ws.onmessage = (event) => handleSignalingMessage(event.data)

      ws.onerror = () => {
        console.log('[Camera] 信令 WS 连接错误:', ws.readyState)
        error.value = '信令服务器连接失败'
        connectionState.value = 'failed'
        reject(new Error('WebSocket error'))
      }

      ws.onclose = () => {
        console.log('[Camera] 信令 WS 已关闭:', ws.readyState)
        connectionState.value = 'closed'
      }
    })
  }

  // ─── 信令消息 ───
  function handleSignalingMessage(raw) {
    try {
      const msg = JSON.parse(raw)
      switch (msg.type) {
        case 'webrtc_sub_joined':
          if (msg.ice_servers?.length) {
            iceServers = msg.ice_servers
            console.log('[Camera] ICE 服务器已同步:', iceServers.length)
          }
          break
        case 'offer':
          handleOffer(msg)
          break
        case 'ice_candidate':
          handleIceCandidate(msg)
          break
        case 'answer':
          handleAnswer(msg)
          break
        // 忽略其他消息（terminal_connected、hardware_status 等）
      }
    } catch { /* ignore */ }
  }

  // ─── PeerConnection ───
  function createPeerConnection() {
    if (pc) pc.close()
    pc = new RTCPeerConnection({ iceServers })

    pc.oniceconnectionstatechange = () => {
      iceConnectionState.value = pc.iceConnectionState
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        connectionState.value = 'connected'
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        connectionState.value = 'failed'
        error.value = 'WebRTC 连接失败'
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ice_candidate',
          candidate: {
            foundation: event.candidate.foundation,
            ip: event.candidate.address,
            port: event.candidate.port,
            priority: event.candidate.priority,
            protocol: event.candidate.protocol,
            type: event.candidate.type,
          },
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        }))
      }
    }

    // 当本地添加 track 时自动发起 renegotiation
    pc.onnegotiationneeded = async () => {
      console.log('[Camera] negotiationneeded, signalingState:', pc.signalingState)
      try {
        if (pc.signalingState !== 'stable') {
          console.log('[Camera] 跳过 renegotiation: PC 非 stable 状态')
          return
        }
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'offer',
            sdp: pc.localDescription.sdp,
            room_id: ROOM_ID,
          }))
          console.log('[Camera] Renegotiation offer 已发送')
        }
      } catch (e) {
        console.error('[Camera] renegotiation 失败:', e)
      }
    }

    pc.ontrack = (event) => {
      console.log('[Camera] ontrack:', event.track.kind)

      // ── 视频 track ──
      if (event.track.kind === 'video' && videoRef.value) {
        if (event.streams.length > 0) {
          videoRef.value.srcObject = event.streams[0]
        } else {
          event.track.onunmute = () => {
            videoRef.value.srcObject = new MediaStream([event.track])
          }
        }
      }

      // ── 音频 track（terminal → UI）──
      if (event.track.kind === 'audio') {
        if (!remoteAudioEl) {
          remoteAudioEl = new Audio()
          remoteAudioEl.autoplay = true
          remoteAudioEl.id = 'remote-audio'
          console.log('[Camera] 创建远程音频播放器')
        }
        if (event.streams.length > 0) {
          remoteAudioEl.srcObject = event.streams[0]
          remoteAudioEl.play().catch(e => console.warn('[Camera] audio play 失败:', e))
          console.log('[Camera] 远程音频已连接')
        } else {
          event.track.onunmute = () => {
            remoteAudioEl.srcObject = new MediaStream([event.track])
            remoteAudioEl.play().catch(() => {})
          }
        }
      }
    }
  }

  async function handleOffer(msg) {
    if (!pc) createPeerConnection()
    console.log('[Camera] 收到 offer, signalingState:', pc.signalingState)
    // 如果已经在 have-local-offer 状态（客户端自己发起了 renegotiation），
    // 忽略服务端的 offer（使用客户端的 localDescription）
    if (pc.signalingState === 'have-local-offer') {
      console.log('[Camera] 忽略服务端 offer: PC 已有 local offer')
      return
    }
    await pc.setRemoteDescription({ sdp: msg.sdp, type: 'offer' })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    ws.send(JSON.stringify({
      type: 'answer',
      sdp: pc.localDescription.sdp,
      room_id: ROOM_ID,
    }))
    console.log('[Camera] Answer 已发送')
  }

  async function handleAnswer(msg) {
    if (!pc) return
    console.log('[Camera] 收到 answer, signalingState:', pc.signalingState)
    // 只在自己发起了 offer 时处理 answer
    if (pc.signalingState !== 'have-local-offer') {
      console.log('[Camera] 忽略 answer: PC 不在 have-local-offer 状态')
      return
    }
    await pc.setRemoteDescription({ sdp: msg.sdp, type: 'answer' })
    console.log('[Camera] 远程 SDP (answer) 已设置')
  }

  async function handleIceCandidate(msg) {
    if (!pc || !msg.candidate) return
    const c = msg.candidate
    try {
      await pc.addIceCandidate(new RTCIceCandidate({
        candidate: `candidate:${c.foundation} ${c.component||1} ${c.protocol} ${c.priority} ${c.ip} ${c.port} typ ${c.type}`,
        sdpMid: msg.sdpMid,
        sdpMLineIndex: msg.sdpMLineIndex,
      }))
    } catch { /* ignore */ }
  }

  // ─── 麦克风（UI → Terminal）──
  async function enableMic() {
    if (localAudioTrack) {
      console.log('[Camera] 麦克风已开启')
      return true
    }
    try {
      console.log('[Camera] 请求麦克风权限...')
      localMicStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      localAudioTrack = localMicStream.getAudioTracks()[0]
      if (!localAudioTrack) {
        throw new Error('未获取到音频 track')
      }
      console.log('[Camera] 麦克风已获取:', localAudioTrack.label)

      if (pc) {
        pc.addTrack(localAudioTrack, localMicStream)
        // onnegotiationneeded 会自动触发，无需手动 createOffer
        console.log('[Camera] 麦克风 track 已添加到 PC')
      }
      micEnabled.value = true
      micUnavailable.value = false
      return true
    } catch (e) {
      console.error('[Camera] 麦克风开启失败:', e.name, e.message)
      // NotFoundError: 设备没有麦克风（VR眼镜常见）
      // NotAllowedError: 用户拒绝或浏览器不支持非 HTTPS 访问麦克风
      if (e.name === 'NotFoundError') {
        micUnavailable.value = true
        if (micErrorTimer) clearTimeout(micErrorTimer)
        micErrorTimer = setTimeout(() => { micUnavailable.value = false }, 8000)
      } else {
        error.value = e.name === 'NotAllowedError'
          ? '麦克风权限被拒绝，请在浏览器设置中允许'
          : `麦克风异常: ${e.message}`
        if (micErrorTimer) clearTimeout(micErrorTimer)
        micErrorTimer = setTimeout(() => { error.value = '' }, 6000)
      }
      return false
    }
  }

  function disableMic() {
    if (localAudioTrack) {
      localAudioTrack.stop()
      localAudioTrack = null
    }
    if (localMicStream) {
      localMicStream.getTracks().forEach(t => t.stop())
      localMicStream = null
    }
    micEnabled.value = false
    console.log('[Camera] 麦克风已关闭')
  }

  // ─── 启停 ───
  async function start() {
    error.value = ''
    connectionState.value = 'connecting'
    console.log('[Camera] 开始启动 WebRTC 连接')
    try {
      await connectSignaling()
    } catch (e) {
      error.value = '启动失败: ' + e.message
      connectionState.value = 'failed'
    }
  }

  function stop() {
    disableMic()
    if (remoteAudioEl) {
      remoteAudioEl.srcObject = null
      remoteAudioEl = null
    }
    pc?.close(); pc = null
    ws?.close(); ws = null
    connectionState.value = 'disconnected'
  }

  onUnmounted(stop)

  return {
    connectionState, iceConnectionState, error, stateLabel, micEnabled, micUnavailable,
    start, stop, enableMic, disableMic,
  }
}
