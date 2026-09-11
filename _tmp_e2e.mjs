/** 临时端到端测试 v2：轮询容错（vite full-reload 无碍）+ 两帧像素对比 */
import puppeteer from 'puppeteer-core'

const actor = process.argv[2] || 'aider'
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  userDataDir: '/tmp/pptr-profile',
  protocolTimeout: 600000,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors',
    '--enable-unsafe-swiftshader', '--use-gl=swiftshader'
  ]
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 850 })
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message.slice(0, 200)}`))
await page.goto(`https://192.168.0.112:3000/motion-library?actor=${actor}`, {
  waitUntil: 'domcontentloaded', timeout: 60000
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function safeEval(fn) {
  for (let i = 0; i < 20; i++) {
    try {
      return await page.evaluate(fn)
    } catch (_) {
      await sleep(1000)     // 页面可能在 vite reload，稍后重试
    }
  }
  return null
}

async function safeClickFirstRow() {
  for (let i = 0; i < 20; i++) {
    try {
      return await page.evaluate(() => {
        const row = document.querySelector('.el-table__row')
        if (!row) return false
        row.querySelector('.file-name')?.click()
        row.click()
        return true
      })
    } catch (_) {
      await sleep(1000)
    }
  }
  return false
}

// 等表格出现
for (let i = 0; i < 30; i++) {
  const ok = await safeEval(() => !!document.querySelector('.el-table__row'))
  if (ok) break
  await sleep(1500)
}
await safeClickFirstRow()

// 等就绪：hint 存在且不含"解算/加载/正在/读取"（IK 解算与模型加载都算未就绪）
const t0 = Date.now()
let hint = ''
while (Date.now() - t0 < 300000) {
  const t = await safeEval(() => document.querySelector('.actor-bar .hint')?.textContent?.trim() || '')
  if (t && !t.includes('解算') && !t.includes('加载') && !t.includes('正在') && !t.includes('读取')) {
    hint = t
    break
  }
  await sleep(2000)
}

// 让播放跑起来，抓两帧对比
await sleep(2000)
const shot = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      const el = await page.$('.canvas-wrap')
      return await el.screenshot()
    } catch (_) { await sleep(1000) }
  }
  return null
}
const s1 = await shot()
await sleep(2500)
const s2 = await shot()
let diff = -1
if (s1 && s2) {
  diff = 0
  for (let i = 0; i < Math.min(s1.length, s2.length); i++) if (s1[i] !== s2[i]) diff++
}
const time = await safeEval(() => document.querySelector('.playbar .time')?.textContent?.trim() || '')

console.log(JSON.stringify({ actor, hint, playTime: time, frameDiff: diff, errors }, null, 1))
await browser.close()
