/**
 * 本机动作库 / 机器人模型中间件（仅 vite dev server 生效）
 *
 * 让浏览器直接读取开发机上的动作目录和 Aider 的 URDF，无需拷进 public/，也不走 aider_server。
 *   GET  /local-motion/list[?refresh=1] → { root, files: [...] }
 *   POST /local-motion/meta  { paths }  → { "<相对路径>": { frames, duration } }
 *   GET  /local-motion/file?path=<相对> → 文件流
 *   GET  /local-robot/<相对路径>         → Aider 的 URDF / STL（urdf-loader 用 package:// 取）
 */
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'

/** 与前端 MotionLibrary.vue 的 MOTION_EXTS 保持一致 */
const MOTION_EXTS = [
  'bvh', 'fbx', 'vmd', 'c3d', 'bip', 'amc', 'asf', 'dae', 'obj', 'pmx', 'pmd',
  'vns', 'imotion', 'anim'
]
const EXTSET = new Set(MOTION_EXTS)
const PREVIEWABLE = new Set(['bvh', 'fbx'])

const MIME = {
  urdf: 'text/plain; charset=utf-8',
  mtl: 'text/plain; charset=utf-8',
  dae: 'model/vnd.collada+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tif: 'image/tiff'
}

async function walk(dir, base, out) {
  let entries
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const abs = path.join(dir, e.name)
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) {
      // 索引文件夹只是清单，不列进动作列表
      if (!base && e.name === '00_索引') continue
      await walk(abs, rel, out)
      continue
    }
    const ext = (e.name.split('.').pop() || '').toLowerCase()
    if (!EXTSET.has(ext)) continue
    let size = 0
    try {
      size = (await fsp.stat(abs)).size
    } catch {
      continue
    }
    out.push({
      path: rel,
      name: e.name,
      ext,
      size,
      category: rel.includes('/') ? rel.split('/')[0] : '根目录',
      previewable: PREVIEWABLE.has(ext)
    })
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

/** BVH 头部取帧数/帧间隔算时长 */
async function readMeta(abs) {
  const fh = await fsp.open(abs, 'r')
  try {
    const buf = Buffer.alloc(65536)
    const { bytesRead } = await fh.read(buf, 0, 65536, 0)
    const head = buf.subarray(0, bytesRead).toString('latin1')
    const fm = head.match(/Frames\s*:\s*(\d+)/i)
    const tm = head.match(/Frame\s*Time\s*:\s*([\d.eE+-]+)/i)
    if (!fm) return null
    const frames = parseInt(fm[1], 10)
    const ft = tm ? parseFloat(tm[1]) : 0
    return { frames, duration: ft ? frames * ft : 0 }
  } finally {
    await fh.close()
  }
}

export default function localMotion(root, robotRoot) {
  const absRoot = path.resolve(root)
  const absRobot = robotRoot ? path.resolve(robotRoot) : null
  let cache = null

  return {
    name: 'local-motion',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const isMotion = url.pathname.startsWith('/local-motion/')
        const isRobot = url.pathname.startsWith('/local-robot/')
        if (!isMotion && !isRobot) return next()

        // 允许跨源访问（万一从其它 origin 打开页面；预检 OPTIONS 一并放行）
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.statusCode = 204
          return res.end()
        }

        const json = (data, code = 200) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(data))
        }

        try {
          // ---- Aider 的 URDF / STL（urdf-loader 用 package://aider_pro01/... 取 mesh）----
          if (isRobot) {
            if (!absRobot) return json({ error: '未配置机器人模型目录' }, 404)
            // 前置斜杠必须去掉：urdf-loader 会拼出 /local-robot//meshes/x.STL，
            // 而 path.resolve 遇到以 / 开头的串会当成绝对路径，直接逃到 /meshes/x.STL
            const rel = decodeURIComponent(url.pathname.slice('/local-robot/'.length)).replace(/^\/+/, '')
            const abs = path.resolve(absRobot, rel)
            if (!abs.startsWith(absRobot + path.sep)) return json({ error: '路径越界' }, 403)
            const st = await fsp.stat(abs)
            const ext = path.extname(abs).slice(1).toLowerCase()
            res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
            res.setHeader('Content-Length', st.size)
            // STL 是几百 MB 的大件且不会变，让它进浏览器缓存（否则每次刷新都要重下）
            res.setHeader('Cache-Control', ext === 'urdf' ? 'no-cache' : 'public, max-age=86400')
            return fs.createReadStream(abs).pipe(res)
          }

          if (url.pathname === '/local-motion/list') {
            if (!cache || url.searchParams.get('refresh')) {
              const files = []
              await walk(absRoot, '', files)
              files.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
              cache = { root: absRoot, files }
            }
            return json(cache)
          }

          if (url.pathname === '/local-motion/meta' && req.method === 'POST') {
            const { paths = [] } = await readBody(req)
            const out = {}
            for (const rel of paths) {
              try {
                const abs = path.resolve(absRoot, rel)
                if (!abs.startsWith(absRoot + path.sep)) continue
                const m = await readMeta(abs)
                if (m) out[rel] = m
              } catch { /* 单个文件失败不影响整体 */ }
            }
            return json(out)
          }

          if (url.pathname === '/local-motion/file') {
            const rel = url.searchParams.get('path') || ''
            const abs = path.resolve(absRoot, rel)
            if (!abs.startsWith(absRoot + path.sep)) return json({ error: '路径越界' }, 403)
            const st = await fsp.stat(abs)
            const ext = path.extname(abs).slice(1).toLowerCase()
            res.setHeader('Content-Type', ext === 'bvh' ? 'text/plain; charset=utf-8' : 'application/octet-stream')
            res.setHeader('Content-Length', st.size)
            res.setHeader('Cache-Control', 'no-cache')
            return fs.createReadStream(abs).pipe(res)
          }

          return json({ error: 'not found' }, 404)
        } catch (e) {
          return json({ error: String(e?.message || e) }, 500)
        }
      })
    }
  }
}
