/** 临时端到端测试 v2：轮询容错（vite full-reload 无碍）+ 两帧像素对比 */
import { writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const actor = process.argv[2] || 'aider'
const fileKw = process.argv[4] || ''   // 可选：搜索框关键词（过滤出目标文件再点第一行）
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

async function safeEval(fn, ...args) {
  for (let i = 0; i < 20; i++) {
    try {
      return await page.evaluate(fn, ...args)
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
// 可选：先用搜索框过滤出目标文件，再点第一行
if (fileKw) {
  await safeEval((kw) => {
    const inp = document.querySelector('.filter-row input')
    if (!inp) return false
    inp.value = kw
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, fileKw)
  await sleep(1200)
}
await safeClickFirstRow()

// 等就绪：① 出现错误提示 → 结束等待（失败场景也如实输出）；② 播放时间开始走 → 就绪。
// 不能只看 hint 文案：模型加载完与"解算中"提示出现之间有短暂间隙，会在"无关节"文案上误判就绪。
const t0 = Date.now()
let hint = ''
while (Date.now() - t0 < 300000) {
  const err = await safeEval(() => document.querySelector('.error-tip')?.textContent?.trim() || '')
  if (err) break
  const cur = parseFloat(await safeEval(() => document.querySelector('.playbar .time')?.textContent?.trim() || ''))
  if (Number.isFinite(cur) && cur > 0.3) break
  hint = await safeEval(() => document.querySelector('.actor-bar .hint')?.textContent?.trim() || '')
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
const errTip = await safeEval(() => document.querySelector('.error-tip')?.textContent?.trim() || '')

const tag = process.argv[3] || actor
const shots = {}
try {
  if (s1) { writeFileSync(`/tmp/e2e_${tag}_scene1.png`, s1); shots.scene1 = `/tmp/e2e_${tag}_scene1.png` }
  if (s2) { writeFileSync(`/tmp/e2e_${tag}_scene2.png`, s2); shots.scene2 = `/tmp/e2e_${tag}_scene2.png` }
  const full = await page.screenshot()
  writeFileSync(`/tmp/e2e_${tag}_full.png`, full)
  shots.full = `/tmp/e2e_${tag}_full.png`
} catch (e) {
  errors.push(`save shot: ${e.message}`)
}

console.log(JSON.stringify({ actor, hint, playTime: time, errTip, frameDiff: diff, shots, errors }, null, 1))
await browser.close()
