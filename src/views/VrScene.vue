<template>
    <div class="vr-container" ref="sceneRef">
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
import * as THREE from 'three'
import { wsClient } from '../utils/websocket.js'
import { getFullVRData, getButtonName } from '../utils/vrData.js'
import { createAxisIndicators } from '../utils/vrHelpers.js'

const sceneRef = ref(null)

let dataPanelMesh = null
let dataPanelContext = null
let dataPanelTexture = null
let animationId = null

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

onMounted(() => {
  setTimeout(() => {
    initControllerUpdater()
    initDataPanel()
    setupRendererAnimationLoop()
  }, 500)
})

onUnmounted(() => {
  const sceneEl = document.querySelector('a-scene')
  if (sceneEl && sceneEl.renderer) {
    sceneEl.renderer.setAnimationLoop(null)
  }
  cleanupEventListeners()
})

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

function setupEventListeners(leftHand, rightHand) {
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
  const leftHand = document.querySelector('#leftHand')
  const rightHand = document.querySelector('#rightHand')
  if (leftHand) leftHand.removeEventListener('gripdown', null)
  if (rightHand) rightHand.removeEventListener('gripdown', null)
}

function initControllerUpdater() {
  const leftHand = document.querySelector('#leftHand')
  const rightHand = document.querySelector('#rightHand')
  const leftHandInfoText = document.querySelector('#leftHandInfo')
  const rightHandInfoText = document.querySelector('#rightHandInfo')
  if (!leftHand || !rightHand || !leftHandInfoText || !rightHandInfoText) {
    console.error('未找到控制器或文本实体！')
    return
  }
  leftHandInfoText.setAttribute('rotation', '-90 0 0')
  rightHandInfoText.setAttribute('rotation', '-90 0 0')
  createAxisIndicators(leftHand, '左')
  createAxisIndicators(rightHand, '右')
  setupEventListeners(leftHand, rightHand)
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
  const geometry = new THREE.PlaneGeometry(3.0, 0.95)
  const material = new THREE.MeshBasicMaterial({
    map: dataPanelTexture, side: THREE.DoubleSide, transparent: true,
    depthTest: false, depthWrite: false
  })
  dataPanelMesh = new THREE.Mesh(geometry, material)
  dataPanelMesh.renderOrder = 1000
  dataPanelEntity.object3D.add(dataPanelMesh)
}

function setupRendererAnimationLoop() {
  const sceneEl = document.querySelector('a-scene')
  if (!sceneEl || !sceneEl.renderer) return

  sceneEl.addEventListener('enter-vr', () => {
    console.log('[VrScene] 🥽 进入 VR 沉浸模式')
    if (!sceneEl.hasAttribute('data-panel-updater')) {
      sceneEl.setAttribute('data-panel-updater', '')
      AFRAME.registerComponent('data-panel-updater', {
        tick: function() {
          if (sceneEl.renderer.xr.isPresenting) {
            const frame = sceneEl.frame
            if (frame) {
              const referenceSpace = sceneEl.renderer.xr.getReferenceSpace()
              const session = sceneEl.renderer.xr.getSession()
              updateRelativeRotation()
              updateDataPanelInFrame(0, frame, referenceSpace, session)
            }
          }
        }
      })
    }
  })
}

function updateRelativeRotation() {
  const leftHand = document.querySelector('#leftHand')
  const rightHand = document.querySelector('#rightHand')
  const leftHandInfoText = document.querySelector('#leftHandInfo')
  const rightHandInfoText = document.querySelector('#rightHandInfo')
  if (!leftHand || !rightHand) return
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
    if (leftHandInfoText) {
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
    if (rightHandInfoText) {
      const pos = rightHand.object3D.position
      let text = `Pos: ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}\n`
      text += `Rot: ${currentRot.x.toFixed(0)} ${currentRot.y.toFixed(0)} ${currentRot.z.toFixed(0)}\n`
      text += `Z-Rot: ${rightZAxisRotation.toFixed(1)}°`
      rightHandInfoText.setAttribute('value', text)
    }
  }
}

function updateDataPanelInFrame(time, frame, referenceSpace, session) {
  if (!dataPanelContext || !dataPanelTexture) return
  if (!frame || !referenceSpace || !session) return
  const ctx = dataPanelContext
  const canvas = dataPanelTexture.image
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#00ffff'
  ctx.lineWidth = 8
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 70px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('◈ DATA CENTER ◈', canvas.width / 2, 90)
  const sceneEl = document.querySelector('a-scene')
  const vrData = getFullVRData(sceneEl, frame)
  sendVRData(vrData)
  let headsetPos = 'N/A'
  let headsetRot = 'N/A'
  if (vrData && vrData.headset) {
    const pos = vrData.headset.position
    const quat = vrData.headset.quaternion
    headsetPos = `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    headsetRot = `${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}`
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#00ff88'
  ctx.font = 'bold 55px monospace'
  ctx.fillText('HEADSET', canvas.width / 2, 170)
  ctx.fillStyle = '#ffffff'
  ctx.font = '45px monospace'
  ctx.fillText('POS: ' + headsetPos, canvas.width / 2, 230)
  ctx.fillText('ROT: ' + headsetRot, canvas.width / 2, 280)
  displayControllerData(ctx, canvas, vrData?.leftController, 'left', 100)
  displayControllerData(ctx, canvas, vrData?.rightController, 'right', canvas.width - 100)
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
</style>
