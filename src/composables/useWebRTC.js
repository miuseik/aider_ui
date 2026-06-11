/**
 * WebRTC 摄像头订阅 composable
 *
 * 通过 aider_server 的 /ws/signaling 信令端点，
 * 订阅 ARM 端推送的实时摄像头视频流。
 */
import { ref, onUnmounted } from 'vue'

const ROOM_ID = 'robot-camera'

// 开发环境：通过 Vite proxy 转发 wss://localhost:3000/ws/signaling → https://localhost:8442/ws/signaling
// 生产环境：直连 ws.houqicg.com（Nginx 有 Upgrade/WSS 支持，www.houqicg.com 没有）
const SIGNALING_WS_URL = import.meta.env.DEV
  ? `wss://${location.host}/ws/signaling`
  : 'wss://ws.houqicg.com/ws/signaling'

export function useWebRTC(videoRef) {
  const connectionState = ref('disconnected') // disconnected | connecting | connected | failed | closed
  const iceConnectionState = ref('')
  const error = ref('')

  let ws = null
  let pc = null
  let iceServers = []

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
    return new Promise((resolve, reject) => {
      connectionState.value = 'connecting'
      ws = new WebSocket(SIGNALING_WS_URL)

      ws.onopen = () => {
        console.log('[Camera] 信令 WS 已连接')
        joinRoom()
        resolve()
      }

      ws.onmessage = (event) => handleSignalingMessage(event.data)

      ws.onerror = () => {
        error.value = '信令服务器连接失败'
        connectionState.value = 'failed'
        reject(new Error('WebSocket error'))
      }

      ws.onclose = () => {
        connectionState.value = 'closed'
      }
    })
  }

  function joinRoom() {
    ws.send(JSON.stringify({ type: 'join', role: 'sub', room_id: ROOM_ID }))
  }

  // ─── 信令消息 ───
  function handleSignalingMessage(raw) {
    try {
      const msg = JSON.parse(raw)
      switch (msg.type) {
        case 'joined':
          iceServers = msg.ice_servers || []
          break
        case 'publisher_online':
          break
        case 'offer':
          handleOffer(msg)
          break
        case 'ice_candidate':
          handleIceCandidate(msg)
          break
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
    try {
      await connectSignaling()
      // 注意: PC 由 handleOffer() 在收到 SDP 时自动创建，
      // 不能在这里调用 createPeerConnection()，否则会销毁已工作的 PC 导致黑屏
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
