<template>
  <div class="vr-container" ref="sceneRef">
    <!-- WebRTC 视频源（隐藏，供 THREE.VideoTexture 使用） -->
    <WebrtcVideo ref="webrtcRef" class="video-source" />

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
import { useRobotStore } from '../stores/robot.js'
import WebrtcVideo from '../components/WebrtcVideo.vue'

const route = useRoute()
const sceneRef = ref(null)
const webrtcRef = ref(null)

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
let rightAButtonPrev = false  // 右手柄 A 键(buttons[4])边沿检测用

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

// ========== 初始化去重 ==========
let vrInitialized = false

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
  // 等待 A-Frame scene 真正加载完成，而非硬编码 500ms
  const aframeScene = document.querySelector('a-scene')
  if (aframeScene && aframeScene.hasLoaded) {
    // A-Frame 已经加载好了（热更新/二次进入）
    startVrInit()
  } else if (aframeScene) {
    // A-Frame 还在加载中
    aframeScene.addEventListener('loaded', startVrInit, { once: true })
  }
  // 兜底：3 秒后强制初始化（防止 A-Frame CDN 加载失败导致永远不触发）
  const fallbackTimer = setTimeout(() => {
    if (!vrInitialized) startVrInit()
  }, 3000)

  function startVrInit() {
    clearTimeout(fallbackTimer)
    // 去重：防止 fallback + loaded 事件双重触发
    if (vrInitialized) return
    vrInitialized = true

    cacheButtonNames()
    cacheDomRefs()
    if (!sceneEl) {
      console.error('[VrScene] A-Frame scene 未找到，VR 初始化失败')
      vrInitialized = false
      return
    }
    console.log('[VrScene] 初始化开始...')
    initControllerUpdater()
    initDataPanel()
    initVideoScreen()
    setupRendererAnimationLoop()
  }
})

onUnmounted(() => {
  if (sceneEl && sceneEl.renderer) {
    sceneEl.renderer.setAnimationLoop(null)
  }
  // 清理视频屏幕
  if (videoScreenEntity && videoScreenMesh) {
    videoScreenEntity.object3D?.remove(videoScreenMesh)
    videoScreenMesh.geometry?.dispose()
    videoScreenMesh.material?.map?.dispose()
    videoScreenMesh.material?.dispose()
    videoScreenMesh = null
  }
  if (videoTexture) {
    videoTexture.dispose()
    videoTexture = null
  }
  // 清理数据面板（之前遗漏，导致进出 VR 显存泄漏）
  if (dataPanelMesh) {
    const panelEntity = document.querySelector('#dataPanel')
    panelEntity?.object3D?.remove(dataPanelMesh)
    dataPanelMesh.geometry?.dispose()
    dataPanelMesh.material?.map?.dispose()
    dataPanelMesh.material?.dispose()
    dataPanelMesh = null
  }
  if (dataPanelTexture) {
    dataPanelTexture.dispose()
    dataPanelTexture = null
  }
  dataPanelContext = null
  cleanupEventListeners()
  sceneEl = leftHand = rightHand = null
  leftHandInfoText = rightHandInfoText = null
  videoScreenEntity = null
  cachedButtonNames = null
  vrInitialized = false
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

  // 注意: A 键(右手柄 buttons[4])外骨骼启停已移至 onVrTick 内的 checkExoToggle() 做边沿检测，
  // 不再依赖 a-frame 的 'abuttondown' 事件（部分头显/浏览器不触发该事件，导致按 A 无反应）。
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
  canvas.width = 2048
  canvas.height = 640
  dataPanelContext = canvas.getContext('2d')
  dataPanelTexture = new THREE.CanvasTexture(canvas)
  dataPanelTexture.minFilter = THREE.LinearFilter
  dataPanelTexture.magFilter = THREE.LinearFilter
  // 预渲染背景、边框
  dataPanelContext.fillStyle = 'rgba(0, 0, 0, 0.85)'
  dataPanelContext.fillRect(0, 0, canvas.width, canvas.height)
  dataPanelContext.strokeStyle = '#00ffff'
  dataPanelContext.lineWidth = 8
  dataPanelContext.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)

  const geometry = new THREE.PlaneGeometry(3.0, 0.95)
  const material = new THREE.MeshBasicMaterial({
    map: dataPanelTexture, side: THREE.DoubleSide, transparent: true,
    depthTest: false, depthWrite: false
  })
  dataPanelMesh = new THREE.Mesh(geometry, material)
  dataPanelMesh.renderOrder = 1000
  dataPanelEntity.object3D.add(dataPanelMesh)

  // getImageData 是同步 GPU→CPU 读回，延后到下一帧执行，避免与 A-Frame WebGL 初始化抢主线程
  requestAnimationFrame(() => {
    if (!dataPanelContext || !dataPanelTexture) return
    dataPanelTexture._bgSnapshot = dataPanelContext.getImageData(0, 0, canvas.width, canvas.height)
  })
}

function initVideoScreen() {
  if (!videoScreenEntity) return

  let startTimeoutId = null

  const createVideoTexture = (videoEl) => {
    try {
      videoTexture = new THREE.VideoTexture(videoEl)
      videoTexture.minFilter = THREE.LinearFilter
      videoTexture.magFilter = THREE.LinearFilter
      videoTexture.needsUpdate = true
      const geometry = new THREE.PlaneGeometry(2.0, 1.125)
      const material = new THREE.MeshBasicMaterial({
        map: videoTexture, side: THREE.DoubleSide,
        depthTest: false, depthWrite: false,
      })
      videoScreenMesh = new THREE.Mesh(geometry, material)
      videoScreenMesh.renderOrder = 999
      videoScreenEntity.object3D.add(videoScreenMesh)
      console.log('[VrScene] VR 视频屏幕已创建')
    } catch (e) {
      console.warn('[VrScene] 视频屏幕初始化失败:', e)
    }
  }

  const tryCreate = () => {
    const videoEl = webrtcRef.value?.getVideoEl?.()
    if (!videoEl) {
      // 视频元素还没挂载，300ms 后重试
      startTimeoutId = setTimeout(tryCreate, 300)
      return
    }

    // 如果视频已有尺寸，直接创建
    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      createVideoTexture(videoEl)
      return
    }

    // 有流就先播放
    if (videoEl.srcObject && videoEl.paused) {
      videoEl.play().catch(e => console.warn('[VrScene] play 失败:', e))
    }

    // 监听 loadedmetadata 事件（视频元数据加载完成 = videoWidth/Height 可用）
    const onReady = () => {
      videoEl.removeEventListener('loadedmetadata', onReady)
      clearTimeout(fallbackTimer)
      if (!videoScreenMesh && videoEl.videoWidth > 0) {
        createVideoTexture(videoEl)
      }
    }
    videoEl.addEventListener('loadedmetadata', onReady)

    // 兜底：30 秒超时
    const fallbackTimer = setTimeout(() => {
      videoEl.removeEventListener('loadedmetadata', onReady)
      if (!videoScreenMesh) {
        console.warn('[VrScene] 视频尺寸超时未就绪')
      }
    }, 30000)
  }

  // 延迟 1.5 秒等 WebrtcVideo 组件挂载
  setTimeout(tryCreate, 1500)
}

function setupRendererAnimationLoop(retryCount = 0) {
  const maxRetries = 20  // 最多等 2 秒（每 100ms 重试一次）

  if (!sceneEl) {
    console.warn('[VrScene] sceneEl 为空，无法注册渲染循环')
    return
  }
  if (!sceneEl.renderer) {
    if (retryCount < maxRetries) {
      setTimeout(() => setupRendererAnimationLoop(retryCount + 1), 100)
    } else {
      console.error('[VrScene] renderer 始终未就绪，渲染循环注册失败')
    }
    return
  }

  // 注册 A-Frame 组件
  // 先移除旧组件实例（解决 HMR/二次进入时组件可能残留的问题）
  if (sceneEl.hasAttribute('data-panel-updater')) {
    sceneEl.removeAttribute('data-panel-updater')
  }
  // 始终用最新的 tick 重新注册，确保闭包引用到当前模块的 onVrTick
  if (AFRAME.components['data-panel-updater']) {
    delete AFRAME.components['data-panel-updater']
  }
  AFRAME.registerComponent('data-panel-updater', {
    tick: function() {
      onVrTick(this.el)
    }
  })
  sceneEl.setAttribute('data-panel-updater', '')
  console.log('[VrScene] data-panel-updater 组件已注册')
}

function checkExoToggle(vrData) {
  // 右手柄 A 键 = buttons[4]（见 utils/vrData.js getButtonName 的 rightSpecific[4]='A键'）
  if (!vrData || !vrData.rightController) return
  const aBtn = (vrData.rightController.buttons || []).find(b => b.index === 4)
  const pressed = !!(aBtn && aBtn.pressed)
  // 仅在按下上升沿触发一次（避免长按每帧重复 toggle 来回跳）
  if (pressed && !rightAButtonPrev) {
    const store = useRobotStore()
    if (store.controlMode === 'exo_vr_mixed') {
      wsClient.send({ type: 'exo_toggle' })
      console.log('[VrScene] A键(右手柄) → exo_toggle')
    } else {
      console.log('[VrScene] A键忽略：当前非 exo_vr_mixed 模式')
    }
  }
  rightAButtonPrev = pressed
}

function onVrTick(scene) {
  // 防御：scene 可能为 null（组件卸载过程中 tick 仍可能被调用）
  if (!scene) return
  if (!scene.renderer) return

  // 用 getSession() 判断是否处于 VR 模式，替代不可靠的 isPresenting
  const session = scene.renderer.xr.getSession()
  if (!session) return

  const frame = scene.frame
  if (!frame) return

  const referenceSpace = scene.renderer.xr.getReferenceSpace()
  if (!referenceSpace) return

  const now = performance.now()

  // ---- 视频纹理强制刷新（每帧）----
  if (videoTexture && videoScreenMesh?.material?.map) {
    videoTexture.needsUpdate = true
  }

  // ---- 手柄姿态计算（轻量，每帧执行）----
  updateRelativeRotation()

  // ---- 每帧取一次 VR 数据（A 键边沿检测 + 节流发送/面板共用）----
  const vrData = getFullVRData(scene, frame)

  // ---- A 键(右手柄 buttons[4])外骨骼启停：独立于握把，每帧边沿检测 ----
  checkExoToggle(vrData)

  // ---- VR 数据采集 + WS 发送（节流 ~30fps）----
  if (now - lastWsSendTime >= WS_SEND_INTERVAL) {
    sendVRData(vrData)
    lastWsSendTime = now
  }

  // ---- 数据面板重绘（节流 ~10fps，最重的操作）----
  if (now - lastPanelRedrawTime >= PANEL_REDRAW_INTERVAL) {
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

  // 用背景快照恢复，替代 clearRect + fillRect + strokeRect（避免重复绘制 1.3M 像素背景）
  const bg = dataPanelTexture._bgSnapshot
  if (bg) {
    ctx.putImageData(bg, 0, 0)
  } else {
    // fallback: 首次无快照时完整绘制
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 4
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
  }
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 36px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('◈ DATA CENTER ◈', canvas.width / 2, 48)

  let headsetPos = 'N/A'
  let headsetRot = 'N/A'
  if (vrData && vrData.headset) {
    const pos = vrData.headset.position
    const quat = vrData.headset.quaternion
    headsetPos = `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    headsetRot = `${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}`
  }
  ctx.fillStyle = '#00ff88'
  ctx.font = 'bold 28px monospace'
  ctx.fillText('HEADSET', canvas.width / 2, 90)
  ctx.fillStyle = '#ffffff'
  ctx.font = '24px monospace'
  ctx.fillText('POS: ' + headsetPos, canvas.width / 2, 122)
  ctx.fillText('ROT: ' + headsetRot, canvas.width / 2, 150)
  displayControllerData(ctx, canvas, vrData?.leftController, 'left', 50)
  displayControllerData(ctx, canvas, vrData?.rightController, 'right', canvas.width - 50)
  dataPanelTexture.needsUpdate = true
}

function displayControllerData(ctx, canvas, controller, hand, xPos) {
  const isLeft = hand === 'left'
  ctx.textAlign = isLeft ? 'left' : 'right'
  ctx.fillStyle = isLeft ? '#00ff88' : '#ff6688'
  ctx.font = 'bold 34px monospace'
  ctx.shadowBlur = 16
  ctx.shadowColor = isLeft ? '#00ff88' : '#ff6688'
  ctx.fillText(isLeft ? '◈ LEFT ◈' : '◈ RIGHT ◈', xPos, 80)
  ctx.shadowBlur = 0
  if (!controller) {
    ctx.fillStyle = '#666666'
    ctx.font = '22px monospace'
    ctx.fillText(isLeft ? '未检测到左手柄' : '未检测到右手柄', xPos, 112)
    return
  }
  if (controller.buttons?.[12]?.pressed) { restartSystem(); return }
  let posText = 'POS: 0.00, 0.00, 0.00'
  let rotText = 'ROT: 0.00, 0.00, 0.00'
  if (controller.position && controller.quaternion) {
    const pos = controller.position
    const quat = controller.quaternion
    posText = `POS: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    rotText = `ROT: ${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}`
  }
  ctx.fillStyle = isLeft ? '#00ffcc' : '#ff99aa'
  ctx.font = '22px monospace'
  ctx.fillText(posText, xPos, 106)
  ctx.fillText(rotText, xPos, 134)
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 26px monospace'
  ctx.shadowBlur = 10
  ctx.shadowColor = '#00ffff'
  const joyX = controller.joystick?.x?.toFixed(2) ?? '0.00'
  const joyY = controller.joystick?.y?.toFixed(2) ?? '0.00'
  ctx.fillText(`JOY: ${joyX}, ${joyY}`, xPos, 165)
  ctx.shadowBlur = 0
  const buttons = controller.buttons
  if (!buttons || buttons.length === 0) return
  ctx.fillStyle = '#ffffff'
  ctx.font = '24px monospace'
  let yPos = 198
  for (let i = 0; i < buttons.length && yPos < 610; i++) {
    const btn = buttons[i]
    const name = getButtonName(btn.index, hand)
    const value = btn.value.toFixed(2)
    const text = `${name}: ${value}`
    if (btn.value > 0.5) { ctx.fillStyle = '#ff6600'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff6600' }
    else if (btn.value > 0) { ctx.fillStyle = '#ffaa00'; ctx.shadowBlur = 5; ctx.shadowColor = '#ffaa00' }
    else { ctx.fillStyle = '#666666'; ctx.shadowBlur = 0 }
    ctx.fillText(text, xPos, yPos)
    yPos += 26
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
.video-source {
  position: fixed;
  top: 0;
  left: 0;
  width: 640px;
  height: 360px;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}
</style>
