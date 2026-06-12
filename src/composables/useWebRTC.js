/**
 * WebRTC 摄像头订阅 composable
 *
 * 信令复用 VR client 通道（/ws/client/webrtc-camera），
 * 不再单独连接 /ws/signaling。
 * Terminal 的 offer/ice_candidate 经服务器转发到此客户端，
 * 此客户端的 answer/ice_candidate 经服务器转发到 Terminal。
 */
import { ref, onUnmounted } from 'vue'

const ROOM_ID = 'robot-camera'

// ICE 服务器（与 Terminal/服务器保持一致，后续可由 webrtc_sub_joined 响应更新）
const HARDCODED_ICE_SERVERS = [
  { urls: ['stun:121.40.151.10:3478'] },
  { urls: ['turn:121.40.151.10:3478'], username: 'aider', credential: 'aider123456' },
  { urls: ['turns:houqicg.com:5349'], username: 'aider', credential: 'aider123456' },
]

// 开发环境：通过 Vite /ws proxy 转发到 server
// 生产环境：直连 www.houqicg.com（复用主域名证书，避免 ws.houqicg.com 证书不匹配）
const CLIENT_WS_URL = import.meta.env.DEV
  ? `wss://${location.host}/ws/client/webrtc-camera`
  : 'wss://www.houqicg.com/ws/client/webrtc-camera'

export function useWebRTC(videoRef) {
  const connectionState = ref('disconnected')
  const iceConnectionState = ref('')
  const error = ref('')

  let ws = null
  let pc = null
  let iceServers = [...HARDCODED_ICE_SERVERS]

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

    pc.ontrack = (event) => {
      if (event.track.kind === 'video' && videoRef.value) {
        if (event.streams.length > 0) {
          videoRef.value.srcObject = event.streams[0]
        } else {
          event.track.onunmute = () => {
            videoRef.value.srcObject = new MediaStream([event.track])
          }
        }
      }
    }
  }

  async function handleOffer(msg) {
    if (!pc) createPeerConnection()
    await pc.setRemoteDescription({ sdp: msg.sdp, type: 'offer' })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    ws.send(JSON.stringify({
      type: 'answer',
      sdp: pc.localDescription.sdp,
      room_id: ROOM_ID,
    }))
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
    pc?.close(); pc = null
    ws?.close(); ws = null
    connectionState.value = 'disconnected'
  }

  onUnmounted(stop)

  return { connectionState, iceConnectionState, error, stateLabel, start, stop }
}
