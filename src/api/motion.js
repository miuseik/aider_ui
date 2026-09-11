/**
 * 动作库接口
 * 后端（aider_server）负责带身份代理 AList，前端不需要任何账号密码。
 */
import request from './request'

/** 列目录（不递归） */
export function motionList(path = '/') {
  return request.post('/motion/list', { path })
}

/** 递归扫描目录，返回全部动作文件 */
export function motionScan(path = '/') {
  return request.post('/motion/scan', { path })
}

/** 批量读 BVH 元信息（帧数/时长） */
export function motionMeta(paths) {
  return request.post('/motion/meta', { paths })
}

/** 动作文件下载地址（走后端代理，前端直接 fetch 即可） */
export function motionFileUrl(path) {
  return `/api/motion/file?path=${encodeURIComponent(path)}`
}

/**
 * 开发机本地动作目录（vite dev 中间件直读磁盘，仅 dev server 上有）
 * 不走 axios（baseURL 是 /api，会被代理到后端）
 * 地址写死为本机绝对地址
 */
const LOCAL_MOTION_BASE = 'https://192.168.0.112:3000'

/** 递归列表；refresh=true 时忽略服务端缓存重扫 */
export async function localMotionList(refresh = false) {
  const res = await fetch(`${LOCAL_MOTION_BASE}/local-motion/list${refresh ? '?refresh=1' : ''}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** 批量读 BVH 帧数/时长 */
export async function localMotionMeta(paths) {
  const res = await fetch(`${LOCAL_MOTION_BASE}/local-motion/meta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths })
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** 本地动作文件地址 */
export function localMotionFileUrl(path) {
  return `${LOCAL_MOTION_BASE}/local-motion/file?path=${encodeURIComponent(path)}`
}

/** Aider 机器人模型（URDF/STL）的地址前缀 */
export const LOCAL_ROBOT_BASE = `${LOCAL_MOTION_BASE}/local-robot`

/**
 * BVH → Python IK 解算 → 逐帧关节角序列（度）。
 * 后端调 terminal 的解算脚本（真机同款 pinocchio+pink IK），
 * 返回 {frame_time, n_frames, names, angles[[16]...], failed}。
 * 前端/真机/仿真消费同一份数据（单一真源）。失败返回 null。
 */
export async function solveMotionIK(path) {
  try {
    const res = await fetch('/api/motion-ik', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.data || null
  } catch (_) {
    return null
  }
}

/**
 * Aider 关节真实限位（度），来自后端 servo_routes 的 /api/get-servo-ids
 * （唯一真源 = server 端 sql/servo_ids.yaml，terminal 的限位也以它为准）。
 * 返回 { left_arm1: [min, max], ... }；后端不在/失败时返回 null，调用方用内置表兜底。
 */
export async function fetchAiderJointLimits() {
  try {
    const res = await fetch('/api/get-servo-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'aider' })
    })
    if (!res.ok) return null
    const json = await res.json()
    const cfg = json?.data
    if (!cfg) return null
    const limits = {}
    for (const side of ['left', 'right']) {
      const arm = cfg[`${side}_arm`]
      for (let i = 1; i <= 8; i++) {
        const node = arm?.[`${side}_arm${i}`]
        const mn = parseFloat(node?.min_angle)
        const mx = parseFloat(node?.max_angle)
        if (Number.isFinite(mn) && Number.isFinite(mx) && mn < mx) {
          limits[`${side}_arm${i}`] = [mn, mx]
        }
      }
    }
    return Object.keys(limits).length ? limits : null
  } catch (_) {
    return null
  }
}
