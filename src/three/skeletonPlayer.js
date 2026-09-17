/**
 * 骨架播放器（火柴人）：按 terminal 解析好的骨架姿态数据逐帧摆线段。
 *
 * 数据完全由 terminal 产出（bones/static/moving/moving_positions），
 * UI 不解析 BVH、不裁剪动作 —— 只负责把线段摆出来（可视化）。
 *
 * 数据约定（bvh_play.py 的 JSON skeleton 段）：
 *   bones: [[name, parent|null], ...]         全部骨骼及父子关系
 *   static: { name: [x,y,z] }                 每根骨骼第一帧世界位置（米，Y-up）
 *   moving: ["lShldr", ...]                   动骨骼（双臂肩/肘/腕/手）
 *   moving_positions: [[x,y,z × moving.length], ...]  逐帧动骨骼世界位置
 */
import * as THREE from 'three'

/**
 * @param {object} opts
 * @param {THREE.Scene} opts.scene 场景（骨骼线段挂进来）
 * @param {object} opts.skeleton terminal 产出的骨架数据（见上）
 * @param {number} opts.frameTime 帧间隔（秒）
 */
export function createSkeletonPlayer({ scene, skeleton, frameTime }) {
  const { bones, static: staticPos, moving, moving_positions } = skeleton
  const nFrames = moving_positions.length
  const duration = nFrames * frameTime
  const root = new THREE.Group()

  // 每段骨骼（child→parent）一条线段；左右配色（与终端可视化一致：左绿右红，躯干灰蓝）
  const segs = []
  for (const [name, parent] of bones) {
    if (!parent) continue
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const low = name.toLowerCase()
    const color = low.startsWith('l') ? 0x33ff66 : low.startsWith('r') ? 0xff5544 : 0x8899bb
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color }))
    line.frustumCulled = false
    root.add(line)
    segs.push({ name, parent, line })
  }
  scene.add(root)

  const state = { time: 0, playing: false, frame: 0 }
  const moveIdx = new Map(moving.map((n, i) => [n, i]))

  function posOf(name, row) {
    const i = moveIdx.get(name)
    if (i !== undefined) return [row[i * 3], row[i * 3 + 1], row[i * 3 + 2]]
    return staticPos[name]
  }

  function apply(frame) {
    const row = moving_positions[frame]
    if (!row) return
    for (const s of segs) {
      const a = posOf(s.name, row)
      const b = posOf(s.parent, row)
      if (!a || !b) continue
      const arr = s.line.geometry.attributes.position.array
      arr[0] = a[0]; arr[1] = a[1]; arr[2] = a[2]
      arr[3] = b[0]; arr[4] = b[1]; arr[5] = b[2]
      s.line.geometry.attributes.position.needsUpdate = true
    }
  }
  apply(0)

  return {
    duration,
    nFrames,
    /** 线段组（供取景/移除） */
    get object() { return root },
    /** 按 dt 推进（渲染循环调用） */
    update(dt) {
      if (!state.playing) return
      state.time = Math.min(state.time + dt, duration)
      state.frame = Math.min(nFrames - 1, Math.floor(state.time / frameTime))
      apply(state.frame)
    },
    /** 跳到指定时间（秒） */
    seek(time) {
      state.time = Math.max(0, Math.min(time, duration))
      state.frame = Math.min(nFrames - 1, Math.floor(state.time / frameTime))
      apply(state.frame)
    },
    play() { state.playing = true },
    pause() { state.playing = false },
    get time() { return state.time },
    dispose() {
      state.playing = false
      scene.remove(root)
      for (const s of segs) {
        s.line.geometry.dispose()
        s.line.material.dispose()
      }
    },
  }
}
