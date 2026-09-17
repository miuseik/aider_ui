/**
 * 动作预览的 three.js 场景。
 *
 * 负责：渲染器/相机/控制器生命周期、把动作装进场景、播放控制与进度同步。
 *
 * 动作数据（BVH 解析、骨架姿态、机器人关节角）全部来自 terminal（经 WS 广播），
 * UI 只做可视化与交互 —— 不解析动作文件、不做 IK、不裁剪动作。
 */
import { ref, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { motionFileUrl, fetchAiderJointLimits } from '../api/motion'
import { wsClient } from '../utils/websocket'
import { ACTORS, loadActorModel } from '../three/actors'
import { ACTOR_HEIGHT } from '../three/motionRetarget'
import { findUrdfRobot, relaxJointLimits } from '../three/aiderJoints'
import { createJointPlayer } from '../three/jointPlayer'
import { createSkeletonPlayer } from '../three/skeletonPlayer'

/**
 * @param {object} opts
 * @param {import('vue').Ref<HTMLElement|null>} opts.canvasRef 画布容器
 * @param {import('vue').Ref<string>} opts.error 与页面共享的错误文案 ref
 */
export function useMotionScene({ canvasRef, error }) {
  const current = ref(null)          // 当前预览的文件（列表行）
  const playing = ref(false)
  const currentTime = ref(0)
  const progress = ref(0)
  const speed = ref(1)
  const busyTip = ref('')
  const aiderJoints = ref(0)         // 跟随动作的活动单元数（机器人=关节数，火柴人=活动骨骼数）

  let renderer, scene, camera, controls, mixer, clock, animId
  let currentObject = null
  let action = null                  // FBX 自带动画的 clip 播放（模型文件侧，与 BVH 链路无关）
  let jointPlayer = null             // 机器人关节角播放器（数据 = terminal 解算）
  let skeletonPlayer = null          // 火柴人骨架播放器（数据 = terminal 解析）
  // 动作解算走 WS：向 server 发 motion_ik_request，结果由 server 广播回来（terminal 算）
  let pendingIK = null               // { path, actorKey, model, file }
  let ikUnsub = null

  const activePlayer = () => jointPlayer || skeletonPlayer

  function initThree() {
    if (renderer) return
    const wrap = canvasRef.value
    if (!wrap) return
    const width = wrap.clientWidth || 800
    const height = wrap.clientHeight || 600

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1f)
    // far 给宽一点：万一某天来了个尺度没归一化的模型，也不至于被远裁剪成一片空白
    camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 1000)
    camera.position.set(0, 0.8, 1.8)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    wrap.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.4, 0)
    controls.enableDamping = true
    controls.update()

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0))
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(2, 4, 3)
    scene.add(dir)
    // 网格按 Aider 尺度来（模型只有 0.78m，10m 的网格会显得空荡荡）
    scene.add(new THREE.GridHelper(4, 8, 0x444444, 0x2a2a2a))

    clock = new THREE.Clock()
    window.addEventListener('resize', onResize)
    animate()
  }

  function onResize() {
    if (!renderer || !canvasRef.value) return
    const w = canvasRef.value.clientWidth
    const h = canvasRef.value.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  function animate() {
    animId = requestAnimationFrame(animate)
    const dt = clock.getDelta()
    if (mixer) mixer.update(dt)
    const p = activePlayer()
    if (p) p.update(dt * speed.value)
    controls?.update()
    if (current.value?.duration) {
      const t = action ? action.time : p ? p.time : 0
      currentTime.value = t
      progress.value = Math.min(1000, (t / current.value.duration) * 1000)
    }
    renderer?.render(scene, camera)
  }

  /** 清掉当前预览（不动 current 这个 ref，由调用方决定要不要置空） */
  function disposeScene() {
    if (currentObject) {
      scene?.remove(currentObject)
      if (!currentObject.userData?.keepInCache) {
        currentObject.traverse?.((o) => {
          if (o.geometry) o.geometry.dispose?.()
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            mats.forEach((m) => m.dispose?.())
          }
        })
      }
      currentObject = null
    }
    if (jointPlayer) {
      jointPlayer.dispose()
      jointPlayer = null
    }
    if (skeletonPlayer) {
      skeletonPlayer.dispose()
      skeletonPlayer = null
    }
    aiderJoints.value = 0
    pendingIK = null
    mixer?.stopAllAction()
    mixer = null
    action = null
    playing.value = false
    currentTime.value = 0
    progress.value = 0
  }

  function fitCamera(obj, hint, boxOverride) {
    const box = boxOverride || new THREE.Box3().setFromObject(obj)
    if (!box || box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || hint || 2
    controls.target.copy(center)
    camera.position.set(center.x + maxDim * 1.2, center.y + maxDim * 0.4, center.z + maxDim * 1.8)
    controls.update()
  }

  /** 订阅 server 广播的动作数据（terminal 算完经 server 推来），按演员分发播放 */
  function initIkWs() {
    if (ikUnsub) return
    ikUnsub = wsClient.onMessage((msg) => {
      if (msg?.type !== 'motion_ik_result') return
      if (!pendingIK || msg.path !== pendingIK.path) return   // 非当前等待的目标，忽略
      const { actorKey, model, file } = pendingIK
      pendingIK = null
      busyTip.value = ''
      if (!msg.ok || !msg.data) {
        error.value = `IK 解算失败：${msg.message || '未知原因'}`
        return
      }
      const data = msg.data
      file.duration = data.n_frames * data.frame_time
      file.frames = data.n_frames
      if (actorKey === 'skeleton') {
        // 火柴人：terminal 的骨架数据 → 线段播放器（纯渲染，UI 不解析不裁剪）
        if (!data.skeleton?.moving_positions?.length) {
          error.value = '解算结果里没有骨架数据（terminal 侧脚本需要更新后重试）'
          return
        }
        skeletonPlayer = createSkeletonPlayer({
          scene,
          skeleton: data.skeleton,
          frameTime: data.frame_time
        })
        aiderJoints.value = data.skeleton.moving?.length || 0
        fitCamera(skeletonPlayer.object, ACTOR_HEIGHT)
        skeletonPlayer.play()
        playing.value = true
      } else {
        // 机器人本体：terminal 的关节角 → jointPlayer
        if (!data.angles?.length) {
          error.value = '解算结果里没有关节角数据'
          return
        }
        if (!model) {
          error.value = '机器人模型未加载'
          return
        }
        jointPlayer = createJointPlayer({
          model,
          names: data.names,
          angles: data.angles,
          frameTime: data.frame_time
        })
        aiderJoints.value = data.names.length
        jointPlayer.play()
        playing.value = true
      }
    })
  }

  /**
   * 预览一个动作文件。
   * @param {object} file 列表行（含 src / ext / url / path / absPath / raw）
   * @param {string} actorKey 'skeleton' | ACTORS 的 key
   */
  async function loadMotion(file, actorKey) {
    error.value = ''
    current.value = file
    await nextTick()
    initThree()
    disposeScene()

    try {
      if (!file.previewable) {
        error.value = `暂不支持预览 .${file.ext}（可先用 Blender 转成 BVH/FBX）`
        return
      }

      if (file.ext === 'bvh') {
        // —— BVH 动作：数据全部来自 terminal（经 WS），UI 不解析动作文件 ——
        if (file.src !== 'dir' || !file.absPath) {
          error.value = '这个来源没有本机文件路径，无法交给 terminal 解算（请用「本机目录」里的文件）'
          return
        }
        initIkWs()

        // 机器人本体：先加载 URDF 模型再发请求 —— 避免"缓存秒回结果、模型还没加载完"的竞态
        let model = null
        if (actorKey !== 'skeleton') {
          const actorCfg = ACTORS[actorKey]
          if (!actorCfg?.urdf) {
            error.value = '该演员暂不支持（模型重定向数据暂未接入 terminal 通道）'
            return
          }
          model = await loadActorModel(actorKey, (msg) => { busyTip.value = msg })
          if (!model) {
            error.value = '演员模型加载失败'
            return
          }
          currentObject = model
          scene.add(model)
          fitCamera(model, ACTOR_HEIGHT)
          const robot = findUrdfRobot(model)
          if (!robot) {
            error.value = '这个 URDF 里没有 joints 表，无法驱动关节'
            return
          }
          // 限位优先取 server 的 servo_ids.yaml（唯一真源），后端不在时用内置兜底表
          relaxJointLimits(robot, (await fetchAiderJointLimits()) || undefined)
        }

        pendingIK = { path: file.absPath, actorKey, model, file }
        const sent = wsClient.send({ type: 'motion_ik_request', path: file.absPath })
        if (!sent) {
          pendingIK = null
          error.value = 'WebSocket 未连接，无法请求解算（确认 aider_server 在运行）'
          return
        }
        busyTip.value = 'terminal 解析动作中…（骨架 + 机器人解算；首次约 10-60s）'
      } else if (file.ext === 'fbx') {
        // FBX：模型+动画一体（文件侧，与 BVH 链路无关）——保留前端解析
        let buffer = null
        if (file.src === 'picker') buffer = await file.raw.arrayBuffer()
        else {
          const url = file.url || motionFileUrl(file.path)
          const res = await fetch(url)
          if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`)
          buffer = await res.arrayBuffer()
        }
        const obj = new FBXLoader().parse(buffer, '')
        currentObject = obj
        scene.add(obj)
        if (obj.animations?.length) {
          mixer = new THREE.AnimationMixer(obj)
          action = mixer.clipAction(obj.animations[0])
          if (!file.duration) file.duration = obj.animations[0].duration
        }
        fitCamera(obj, 2.0)
      }

      if (action) {
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.play()
        mixer.timeScale = speed.value
        playing.value = true
      }
    } catch (err) {
      error.value = `加载失败：${err?.message || err}`
    }
  }

  function togglePlay() {
    if (!action && !activePlayer()) return
    playing.value = !playing.value
    if (action) action.paused = !playing.value
    const p = activePlayer()
    if (p) playing.value ? p.play() : p.pause()
  }

  function restart() {
    if (!action && !activePlayer()) return
    if (action) {
      action.reset()
      action.paused = false
    }
    const p = activePlayer()
    if (p) {
      p.seek(0)
      p.play()   // 暂停状态下点重播也要真正走起来（seek 不改变播放器 playing 标志）
    }
    playing.value = true
  }

  function seek(val) {
    const t = (val / 1000) * (current.value?.duration || 0)
    const p = activePlayer()
    if (p) {
      p.seek(t)
      return
    }
    if (!action || !current.value?.duration) return
    action.time = t
    mixer?.update(0)
  }

  function setSpeed(v) {
    if (mixer) mixer.timeScale = v
  }

  /** 组件卸载时的整体清理 */
  function disposeAll() {
    if (animId) cancelAnimationFrame(animId)
    animId = null
    window.removeEventListener('resize', onResize)
    ikUnsub?.()
    ikUnsub = null
    disposeScene()
    renderer?.dispose?.()
    renderer = null
  }

  return {
    // 状态
    current,
    playing,
    currentTime,
    progress,
    speed,
    busyTip,
    aiderJoints,
    // 动作
    initThree,
    loadMotion,
    disposeScene,
    disposeAll,
    togglePlay,
    restart,
    seek,
    setSpeed,
    onResize
  }
}
