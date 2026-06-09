<template>
  <div class="vr-container" ref="sceneRef">
    <!-- ARTC 视频（隐藏，只作为视频源） -->
    <div class="artc-source">
      <ArtcVideo
        ref="artcVideoRef"
        :channel-id="channelId"
        userId="vr_user"
        userName="VR User"
      />
    </div>

    <a-scene vr-mode-ui="enabled: true;">
      <a-entity webxr-passthrough="referenceSpaceType: local-floor"></a-entity>

      <a-entity id="leftHand" oculus-touch-controls="hand: left">
        <a-text 
          id="leftHandInfo" 
          value="Pos: ...\nRot: ..." 
          position="0 0.04 -0.05"
          rotation="0 0 0"
          scale="0.05 0.05 0.05"
          color="white"
          align="center"
        ></a-text>
      </a-entity>
      
      <a-entity id="rightHand" oculus-touch-controls="hand: right">
        <a-text 
          id="rightHandInfo" 
          value="Pos: ...\nRot: ..." 
          position="0 0.04 -0.05"
          rotation="0 0 0"
          scale="0.05 0.05 0.05"
          color="white"
          align="center"
        ></a-text>
      </a-entity>
      
      <a-entity id="dataPanel" position="0 -0.2 -1.5" rotation="-15 0 0"></a-entity>
      <a-entity id="videoScreen" position="0 1.2 -2" rotation="0 0 0"></a-entity>
    </a-scene>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { wsClient } from '../utils/websocket.js'
import { getFullVRData, getButtonName } from '../utils/vrData.js'
import { createAxisIndicators } from '../utils/vrHelpers.js'
import ArtcVideo from '../components/ArtcVideo.vue'

const route = useRoute()
const sceneRef = ref(null)
const artcVideoRef = ref(null)

// 从路由参数获取频道信息
const channelId = route.query.channel || 'test123'

// ========== 节流常量 (ms) ==========
const WS_SEND_INTERVAL = 33     // WebSocket 发送 ~30fps
const PANEL_REDRAW_INTERVAL = 100  // 数据面板重绘 ~10fps
const TEXT_UPDATE_INTERVAL = 100   // 手柄文字更新 ~10fps

// ========== 缓存 DOM 引用 ==========
let sceneEl = null
let leftHand = null, rightHand = null
let leftHandInfoText = null, rightHandInfoText = null
let videoScreenEntity = null

let dataPanelMesh = null
let dataPanelContext = null
let dataPanelTexture = null
let videoScreenMesh = null
let videoTexture = null

let leftGripDown = false
let rightGripDown = false
let leftTriggerDown = false
let rightTriggerDown = false

let leftGripInitialRotation = null
let rightGripInitialRotation = null
let leftRelativeRotation = { x: 0, y: 0, z: 0 }
let rightRelativeRotation = { x: 0, y: 0, z: 0 }

let leftGripInitialQuaternion = null
let rightGripInitialQuaternion = null
let leftZAxisRotation = 0
let rightZAxisRotation = 0

// ========== 节流时间戳 ==========
let lastWsSendTime = 0
let lastPanelRedrawTime = 0
let lastTextUpdateTime = 0

// ========== 提前创建的按钮名称缓存 ==========
let cachedButtonNames = null // { left: [...], right: [...] }

function cacheButtonNames() {
  if (cachedButtonNames) return
  cachedButtonNames = { left: [], right: [] }
  for (let i = 0; i < 16; i++) {
    cachedButtonNames.left[i] = getButtonName(i, 'left')
    cachedButtonNames.right[i] = getButtonName(i, 'right')
  }
}

onMounted(() => {
  setTimeout(() => {
    cacheButtonNames()
    cacheDomRefs()
    initControllerUpdater()
    initDataPanel()
    initVideoScreen()
    setupRendererAnimationLoop()
  }, 500)
})

onUnmounted(() => {
  if (sceneEl && sceneEl.renderer) {
    sceneEl.renderer.setAnimationLoop(null)
  }
  if (videoScreenEntity && videoScreenMesh) {
    videoScreenEntity.object3D.remove(videoScreenMesh)
    videoScreenMesh.geometry?.dispose()
    videoScreenMesh.material?.dispose()
    videoScreenMesh = null
  }
  if (videoTexture) {
    videoTexture.dispose()
    videoTexture = null
  }
  cleanupEventListeners()
  // 清理所有缓存引用
  sceneEl = leftHand = rightHand = null
  leftHandInfoText = rightHandInfoText = null
  videoScreenEntity = null
  cachedButtonNames = null
})

function cacheDomRefs() {
  sceneEl = document.querySelector('a-scene')
  leftHand = document.querySelector('#leftHand')
  rightHand = document.querySelector('#rightHand')
  leftHandInfoText = document.querySelector('#leftHandInfo')
  rightHandInfoText = document.querySelector('#rightHandInfo')
  videoScreenEntity = document.querySelector('#videoScreen')
}

function calculateRelativeRotation(currentRotation, initialRotation) {
  return {
    x: currentRotation.x - initialRotation.x,
    y: currentRotation.y - initialRotation.y,
    z: currentRotation.z - initialRotation.z
  }
}

function calculateZAxisRotation(currentQuaternion, initialQuaternion) {
  const relativeQuat = new THREE.Quaternion()
  relativeQuat.multiplyQuaternions(currentQuaternion, initialQuaternion.clone().invert())
  const forwardDirection = new THREE.Vector3(0, 0, 1)
  forwardDirection.applyQuaternion(currentQuaternion)
  const angle = 2 * Math.acos(Math.abs(relativeQuat.w))
  if (angle < 0.0001) return 0
  const sinHalfAngle = Math.sqrt(1 - relativeQuat.w * relativeQuat.w)
  const rotationAxis = new THREE.Vector3(
    relativeQuat.x / sinHalfAngle,
    relativeQuat.y / sinHalfAngle,
    relativeQuat.z / sinHalfAngle
  )
  const projectedComponent = rotationAxis.dot(forwardDirection)
  const forwardRotation = angle * projectedComponent
  let degrees = THREE.MathUtils.radToDeg(forwardRotation)
  while (degrees > 180) degrees -= 360
  while (degrees < -180) degrees += 360
  return degrees
}

function sendGripRelease(hand) {
  if (wsClient.isConnected) {
    wsClient.send(JSON.stringify({ hand, gripReleased: true }))
  }
}

function sendTriggerRelease(hand) {
  if (wsClient.isConnected) {
    wsClient.send(JSON.stringify({ hand, triggerReleased: true }))
  }
}

function setupEventListeners() {
  leftHand.addEventListener('triggerdown', () => { leftTriggerDown = true })
  leftHand.addEventListener('triggerup', () => {
    leftTriggerDown = false
    sendTriggerRelease('left')
  })
  leftHand.addEventListener('gripdown', () => {
    leftGripDown = true
    if (leftHand.object3D.visible) {
      const rot = leftHand.object3D.rotation
      leftGripInitialRotation = {
        x: THREE.MathUtils.radToDeg(rot.x),
        y: THREE.MathUtils.radToDeg(rot.y),
        z: THREE.MathUtils.radToDeg(rot.z)
      }
      leftGripInitialQuaternion = leftHand.object3D.quaternion.clone()
    }
  })
  leftHand.addEventListener('gripup', () => {
    leftGripDown = false
    leftGripInitialRotation = null
    leftGripInitialQuaternion = null
    leftRelativeRotation = { x: 0, y: 0, z: 0 }
    leftZAxisRotation = 0
    sendGripRelease('left')
  })
  rightHand.addEventListener('triggerdown', () => { rightTriggerDown = true })
  rightHand.addEventListener('triggerup', () => {
    rightTriggerDown = false
    sendTriggerRelease('right')
  })
  rightHand.addEventListener('gripdown', () => {
    rightGripDown = true
    if (rightHand.object3D.visible) {
      const rot = rightHand.object3D.rotation
      rightGripInitialRotation = {
        x: THREE.MathUtils.radToDeg(rot.x),
        y: THREE.MathUtils.radToDeg(rot.y),
        z: THREE.MathUtils.radToDeg(rot.z)
      }
      rightGripInitialQuaternion = rightHand.object3D.quaternion.clone()
    }
  })
  rightHand.addEventListener('gripup', () => {
    rightGripDown = false
    rightGripInitialRotation = null
    rightGripInitialQuaternion = null
    rightRelativeRotation = { x: 0, y: 0, z: 0 }
    rightZAxisRotation = 0
    sendGripRelease('right')
  })
}

function cleanupEventListeners() {
  // A-Frame 事件用 addEventListener 注册的无法通过 removeEventListener 移除，
  // 组件卸载时 A-Frame 会自动清理，此处仅清空引用
}

function initControllerUpdater() {
  if (!leftHand || !rightHand || !leftHandInfoText || !rightHandInfoText) {
    console.error('未找到控制器或文本实体！')
    return
  }
  leftHandInfoText.setAttribute('rotation', '-90 0 0')
  rightHandInfoText.setAttribute('rotation', '-90 0 0')
  createAxisIndicators(leftHand, '左')
  createAxisIndicators(rightHand, '右')
  setupEventListeners()
}

function sendVRData(vrData) {
  if (!(leftGripDown || rightGripDown) || !wsClient.isConnected || !vrData) return
  const dualControllerData = {
    timestamp: Date.now(),
    headset: vrData?.headset || { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } },
    leftController: vrData?.leftController ? {
      hand: 'left', position: vrData.leftController.position,
      quaternion: vrData.leftController.quaternion, gripActive: leftGripDown,
      trigger: vrData.leftController.buttons[0]?.value || 0,
      joystick: vrData.leftController.joystick,
    } : { hand: 'left', position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, gripActive: false, trigger: 0, joystick: { x: 0, y: 0 } },
    rightController: vrData?.rightController ? {
      hand: 'right', position: vrData.rightController.position,
      quaternion: vrData.rightController.quaternion, gripActive: rightGripDown,
      trigger: vrData.rightController.buttons[0]?.value || 0,
      joystick: vrData.rightController.joystick,
    } : { hand: 'right', position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, gripActive: false, trigger: 0, joystick: { x: 0, y: 0 } },
  }
  wsClient.send(JSON.stringify(dualControllerData))
}

async function restartSystem() {
  try { await fetch('/api/restart', { method: 'POST' }) } catch {}
  setTimeout(() => window.location.reload(), 5000)
}

function initDataPanel() {
  const dataPanelEntity = document.querySelector('#dataPanel')
  if (!dataPanelEntity) return
  const canvas = document.createElement('canvas')
  canvas.width = 3840
  canvas.height = 1200
  dataPanelContext = canvas.getContext('2d')
  dataPanelTexture = new THREE.CanvasTexture(canvas)
  dataPanelTexture.minFilter = THREE.LinearFilter
  dataPanelTexture.magFilter = THREE.LinearFilter
  // 预渲染背景、边框，后续只做增量更新（性能关键）
  dataPanelContext.fillStyle = 'rgba(0, 0, 0, 0.85)'
  dataPanelContext.fillRect(0, 0, canvas.width, canvas.height)
  dataPanelContext.strokeStyle = '#00ffff'
  dataPanelContext.lineWidth = 8
  dataPanelContext.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  // 保存背景快照用于快速恢复
  const bgSnapshot = dataPanelContext.getImageData(0, 0, canvas.width, canvas.height)
  dataPanelTexture._bgSnapshot = bgSnapshot
  const geometry = new THREE.PlaneGeometry(3.0, 0.95)
  const material = new THREE.MeshBasicMaterial({
    map: dataPanelTexture, side: THREE.DoubleSide, transparent: true,
    depthTest: false, depthWrite: false
  })
  dataPanelMesh = new THREE.Mesh(geometry, material)
  dataPanelMesh.renderOrder = 1000
  dataPanelEntity.object3D.add(dataPanelMesh)
}

function initVideoScreen() {
  if (!videoScreenEntity) return
  const tryCreate = (attempt = 0) => {
    const videoEl = artcVideoRef.value?.videoEl
    if (!videoEl) {
      if (attempt < 20) { setTimeout(() => tryCreate(attempt + 1), 500); return }
      console.warn('[VrScene] 未获取到视频元素')
      return
    }
    try {
      videoTexture = new THREE.VideoTexture(videoEl)
      videoTexture.minFilter = THREE.LinearFilter
      videoTexture.magFilter = THREE.LinearFilter
      const geometry = new THREE.PlaneGeometry(2.0, 1.125)
      const material = new THREE.MeshBasicMaterial({
        map: videoTexture, side: THREE.DoubleSide,
      })
      videoScreenMesh = new THREE.Mesh(geometry, material)
      videoScreenEntity.object3D.add(videoScreenMesh)
      console.log('[VrScene] VR 视频屏幕已创建')
    } catch (e) {
      console.warn('[VrScene] 视频屏幕初始化失败:', e)
    }
  }
  setTimeout(() => tryCreate(), 1500)
}

function setupRendererAnimationLoop() {
  if (!sceneEl || !sceneEl.renderer) return

  // 注册 A-Frame 组件（只注册一次）
  if (!sceneEl.hasAttribute('data-panel-updater')) {
    sceneEl.setAttribute('data-panel-updater', '')
    AFRAME.registerComponent('data-panel-updater', {
      tick: function() {
        onVrTick(sceneEl)
      }
    })
  }
}

function onVrTick(sceneEl) {
  if (!sceneEl.renderer?.xr?.isPresenting) return

  const frame = sceneEl.frame
  if (!frame) return

  const referenceSpace = sceneEl.renderer.xr.getReferenceSpace()
  const session = sceneEl.renderer.xr.getSession()
  if (!referenceSpace || !session) return

  const now = performance.now()

  // ---- 手柄姿态计算（轻量，每帧执行）----
  updateRelativeRotation()

  // ---- VR 数据采集 + WS 发送（节流 ~30fps）----
  let vrData = null
  if (now - lastWsSendTime >= WS_SEND_INTERVAL) {
    vrData = getFullVRData(sceneEl, frame)
    sendVRData(vrData)
    lastWsSendTime = now
  }

  // ---- 数据面板重绘（节流 ~10fps，最重的操作）----
  if (now - lastPanelRedrawTime >= PANEL_REDRAW_INTERVAL) {
    // 如果本轮没取过 vrData，补取一次
    if (!vrData) vrData = getFullVRData(sceneEl, frame)
    updateDataPanelInFrame(vrData)
    lastPanelRedrawTime = now
  }
}

function updateRelativeRotation() {
  if (!leftHand || !rightHand) return

  const now = performance.now()
  const shouldUpdateText = (now - lastTextUpdateTime >= TEXT_UPDATE_INTERVAL)

  if (leftGripDown && leftGripInitialRotation && leftHand.object3D.visible) {
    const rot = leftHand.object3D.rotation
    const currentRot = {
      x: THREE.MathUtils.radToDeg(rot.x),
      y: THREE.MathUtils.radToDeg(rot.y),
      z: THREE.MathUtils.radToDeg(rot.z)
    }
    leftRelativeRotation = calculateRelativeRotation(currentRot, leftGripInitialRotation)
    if (leftGripInitialQuaternion) {
      leftZAxisRotation = calculateZAxisRotation(leftHand.object3D.quaternion, leftGripInitialQuaternion)
    }
    // 文字更新节流 ~10fps
    if (shouldUpdateText && leftHandInfoText) {
      const pos = leftHand.object3D.position
      let text = `Pos: ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}\n`
      text += `Rot: ${currentRot.x.toFixed(0)} ${currentRot.y.toFixed(0)} ${currentRot.z.toFixed(0)}\n`
      text += `Z-Rot: ${leftZAxisRotation.toFixed(1)}°`
      leftHandInfoText.setAttribute('value', text)
    }
  }
  if (rightGripDown && rightGripInitialRotation && rightHand.object3D.visible) {
    const rot = rightHand.object3D.rotation
    const currentRot = {
      x: THREE.MathUtils.radToDeg(rot.x),
      y: THREE.MathUtils.radToDeg(rot.y),
      z: THREE.MathUtils.radToDeg(rot.z)
    }
    rightRelativeRotation = calculateRelativeRotation(currentRot, rightGripInitialRotation)
    if (rightGripInitialQuaternion) {
      rightZAxisRotation = calculateZAxisRotation(rightHand.object3D.quaternion, rightGripInitialQuaternion)
    }
    if (shouldUpdateText && rightHandInfoText) {
      const pos = rightHand.object3D.position
      let text = `Pos: ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}\n`
      text += `Rot: ${currentRot.x.toFixed(0)} ${currentRot.y.toFixed(0)} ${currentRot.z.toFixed(0)}\n`
      text += `Z-Rot: ${rightZAxisRotation.toFixed(1)}°`
      rightHandInfoText.setAttribute('value', text)
    }
  }

  if (shouldUpdateText) lastTextUpdateTime = now
}

function updateDataPanelInFrame(vrData) {
  if (!dataPanelContext || !dataPanelTexture) return
  const ctx = dataPanelContext
  const canvas = dataPanelTexture.image

  // 用背景快照恢复，替代 clearRect + fillRect + strokeRect（避免重复绘制 4.6M 像素背景）
  const bg = dataPanelTexture._bgSnapshot
  if (bg) {
    ctx.putImageData(bg, 0, 0)
  } else {
    // fallback: 首次无快照时完整绘制
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 8
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  }
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 70px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('◈ DATA CENTER ◈', canvas.width / 2, 90)

  let headsetPos = 'N/A'
  let headsetRot = 'N/A'
  if (vrData && vrData.headset) {
    const pos = vrData.headset.position
    const quat = vrData.headset.quaternion
    headsetPos = `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    headsetRot = `${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}`
  }
  ctx.fillStyle = '#00ff88'
  ctx.font = 'bold 55px monospace'
  ctx.fillText('HEADSET', canvas.width / 2, 170)
  ctx.fillStyle = '#ffffff'
  ctx.font = '45px monospace'
  ctx.fillText('POS: ' + headsetPos, canvas.width / 2, 230)
  ctx.fillText('ROT: ' + headsetRot, canvas.width / 2, 280)
  displayControllerData(ctx, vrData?.leftController, 'left', 100)
  displayControllerData(ctx, vrData?.rightController, 'right', canvas.width - 100)
  dataPanelTexture.needsUpdate = true
}

function displayControllerData(ctx, canvas, controller, hand, xPos) {
  const isLeft = hand === 'left'
  ctx.textAlign = isLeft ? 'left' : 'right'
  ctx.fillStyle = isLeft ? '#00ff88' : '#ff6688'
  ctx.font = 'bold 65px monospace'
  ctx.shadowBlur = 30
  ctx.shadowColor = isLeft ? '#00ff88' : '#ff6688'
  ctx.fillText(isLeft ? '◈ LEFT ◈' : '◈ RIGHT ◈', xPos, 150)
  ctx.shadowBlur = 0
  if (!controller) {
    ctx.fillStyle = '#666666'
    ctx.font = '42px monospace'
    ctx.fillText(isLeft ? '未检测到左手柄' : '未检测到右手柄', xPos, 210)
    return
  }
  if (controller.buttons[12]?.pressed) { restartSystem(); return }
  let posText = 'POS: 0.00, 0.00, 0.00'
  let rotText = 'ROT: 0.00, 0.00, 0.00'
  if (controller.position && controller.quaternion) {
    const pos = controller.position
    const quat = controller.quaternion
    posText = `POS: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    rotText = `ROT: ${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}`
  }
  ctx.fillStyle = isLeft ? '#00ffcc' : '#ff99aa'
  ctx.font = '42px monospace'
  ctx.fillText(posText, xPos, 200)
  ctx.fillText(rotText, xPos, 250)
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 48px monospace'
  ctx.shadowBlur = 20
  ctx.shadowColor = '#00ffff'
  const joyX = controller.joystick.x.toFixed(2)
  const joyY = controller.joystick.y.toFixed(2)
  ctx.fillText(`JOY: ${joyX}, ${joyY}`, xPos, 310)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff'
  ctx.font = '45px monospace'
  let yPos = 370
  for (let i = 0; i < controller.buttons.length && yPos < 1150; i++) {
    const btn = controller.buttons[i]
    const name = getButtonName(btn.index, hand)
    const value = btn.value.toFixed(2)
    const text = `${name}: ${value}`
    if (btn.value > 0.5) { ctx.fillStyle = '#ff6600'; ctx.shadowBlur = 20; ctx.shadowColor = '#ff6600' }
    else if (btn.value > 0) { ctx.fillStyle = '#ffaa00'; ctx.shadowBlur = 10; ctx.shadowColor = '#ffaa00' }
    else { ctx.fillStyle = '#666666'; ctx.shadowBlur = 0 }
    ctx.fillText(text, xPos, yPos)
    yPos += 50
  }
  ctx.shadowBlur = 0
}
</script>

<style scoped>
.vr-container {
  width: 100vw; height: 100vh;
  position: fixed; top: 0; left: 0;
  overflow: hidden; z-index: 10;
}
.artc-source {
  position: fixed;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
</style>
