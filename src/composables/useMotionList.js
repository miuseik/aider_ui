/**
 * 动作文件列表：数据来源（本机目录 / AList / 本地文件夹）、分类树、搜索筛选、分页。
 *
 * 只管"有哪些动作文件"，不碰 three.js —— 需要预览某一行时通过 onPick 回调抛给页面。
 */
import { ref, computed, watch, nextTick } from 'vue'
import {
  motionScan,
  motionMeta,
  localMotionList,
  localMotionMeta,
  localMotionFileUrl
} from '../api/motion'

const PREVIEWABLE = ['bvh', 'fbx']
const MOTION_EXTS = ['bvh', 'fbx', 'vmd', 'c3d', 'bip', 'amc', 'asf', 'dae', 'obj', 'pmx', 'pmd']

/**
 * @param {object} opts
 * @param {import('vue').Ref<string>} opts.error 与页面共享的错误文案 ref
 * @param {() => void} opts.resetPreview 清空当前预览对象（不销毁场景）
 * @param {() => void} opts.clearPreview 销毁场景并清空预览对象
 * @param {(row: object) => void} opts.onPick 用户选中某一行
 */
export function useMotionList({ error, resetPreview, clearPreview, onPick }) {
  const pageSize = 50

  // 模板 ref（由组件模板里的 ref="xxx" 绑定）
  const tableRef = ref(null)
  const treeRef = ref(null)
  const folderInput = ref(null)

  const source = ref('dir')
  const scanning = ref(false)
  const loadingMeta = ref(false)
  const allFiles = ref([])
  const keyword = ref('')
  const formatFilter = ref('')
  const selectedDir = ref('')       // 分类树选中的目录（空 = 全部）
  const catPanel = ref(['cat'])
  const localRoot = ref('')
  const visibleCount = ref(pageSize)

  // ---------- 本机目录（vite dev 中间件直读磁盘） ----------

  /** dev server 重启/依赖预构建那一下请求会落空，隔一会儿重试 */
  async function fetchDirList(refresh) {
    let lastErr
    for (let i = 0; i < 3; i++) {
      try {
        return await localMotionList(refresh)
      } catch (e) {
        lastErr = e
        await new Promise((r) => setTimeout(r, 700))
      }
    }
    throw lastErr
  }

  async function loadFromDir(refresh = false) {
    scanning.value = true
    error.value = ''
    try {
      const res = await fetchDirList(refresh)
      localRoot.value = res?.root || localRoot.value
      allFiles.value = (res?.files || []).map((f) => ({
        src: 'dir',
        path: f.path,
        url: localMotionFileUrl(f.path),
        category: f.category,
        name: f.name,
        ext: f.ext,
        size: f.size,
        previewable: f.previewable,
        duration: 0,
        frames: 0
      }))
      visibleCount.value = pageSize
      selectedDir.value = ''
      resetPreview()
      loadMeta()
    } catch (e) {
      error.value = `读取本机目录失败：${e?.message || e}（仅 vite dev server 支持本机目录）`
    } finally {
      scanning.value = false
    }
  }

  /**
   * 分类树：目录结构本身就是分类（顶层=大分类，往下是数据集/子目录），直接照搬目录层级。
   * 每个节点显示该目录下的动作文件数。
   */
  const treeData = computed(() => {
    const root = { children: new Map() }
    for (const f of allFiles.value) {
      const parts = (f.path || '').split('/')
      parts.pop()               // 去掉文件名，只留目录链
      let node = root
      let acc = ''
      for (const p of parts) {
        acc = acc ? `${acc}/${p}` : p
        let child = node.children.get(p)
        if (!child) {
          child = { key: acc, label: p, children: new Map(), count: 0 }
          node.children.set(p, child)
        }
        child.count++
        node = child
      }
    }
    const conv = (n) =>
      [...n.children.values()].map((c) => ({
        key: c.key,
        label: `${c.label} (${c.count})`,
        children: conv(c)
      }))
    return conv(root)
  })

  function onDirSelect(node) {
    selectedDir.value = node.key
  }

  function clearDir() {
    selectedDir.value = ''
    treeRef.value?.setCurrentKey(null)
  }

  // ---------- AList（后端代理） ----------

  async function loadFromAlist() {
    scanning.value = true
    error.value = ''
    try {
      const res = await motionScan('/')
      allFiles.value = (res?.data?.files || []).map((f) => ({
        src: 'alist',
        path: f.path,
        name: f.name,
        ext: f.ext,
        size: f.size,
        previewable: PREVIEWABLE.includes(f.ext),
        duration: 0,
        frames: 0
      }))
      visibleCount.value = pageSize
      resetPreview()
      loadMeta()
    } catch (e) {
      error.value = `读取动作列表失败：${e?.message || e}`
    } finally {
      scanning.value = false
    }
  }

  async function loadMeta() {
    const targets = allFiles.value.filter((f) => f.ext === 'bvh' && !f.duration)
    if (!targets.length) return
    if (source.value === 'picker') return readLocalMeta(targets)
    loadingMeta.value = true
    try {
      for (let i = 0; i < targets.length; i += 200) {
        const batch = targets.slice(i, i + 200)
        const map =
          source.value === 'dir'
            ? await localMotionMeta(batch.map((f) => f.path))
            : (await motionMeta(batch.map((f) => f.path)))?.data || {}
        for (const f of batch) {
          if (map[f.path]) {
            f.frames = map[f.path].frames
            f.duration = map[f.path].duration
          }
        }
      }
    } catch (_) { /* 元信息失败不影响主流程 */ }
    finally { loadingMeta.value = false }
  }

  // ---------- 本地文件夹 ----------

  function pickFolder() {
    folderInput.value?.click()
  }

  function clearAll() {
    clearPreview()
    allFiles.value = []
    error.value = ''
    selectedDir.value = ''
    visibleCount.value = pageSize
  }

  async function onFolderPicked(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const list = []
    for (const f of files) {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      if (!MOTION_EXTS.includes(ext)) continue
      list.push({
        src: 'picker',
        raw: f,
        name: f.name,
        ext,
        size: f.size,
        previewable: PREVIEWABLE.includes(ext),
        duration: 0,
        frames: 0
      })
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    allFiles.value = list
    visibleCount.value = pageSize
    selectedDir.value = ''
    resetPreview()
    error.value = ''
    readLocalMeta(list.filter((f) => f.ext === 'bvh'))
  }

  async function readLocalMeta(list) {
    if (!list.length) return
    loadingMeta.value = true
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      try {
        const head = await f.raw.slice(0, 65536).text()
        const fm = head.match(/Frames\s*:\s*(\d+)/i)
        const tm = head.match(/Frame\s*Time\s*:\s*([\d.]+)/i)
        if (fm) f.frames = parseInt(fm[1], 10)
        if (fm && tm) f.duration = parseInt(fm[1], 10) * parseFloat(tm[1])
      } catch (_) { /* ignore */ }
      if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0))
    }
    loadingMeta.value = false
  }

  // ---------- 列表 ----------

  const filteredFiles = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return allFiles.value.filter((f) => {
      // 关键词同时匹配文件名和目录路径，便于按分类/数据集子目录筛
      if (kw && !f.name.toLowerCase().includes(kw) && !(f.path || '').toLowerCase().includes(kw)) return false
      if (selectedDir.value && !(f.path || '').startsWith(selectedDir.value + '/')) return false
      if (formatFilter.value === 'other') {
        if (PREVIEWABLE.includes(f.ext)) return false
      } else if (formatFilter.value && f.ext !== formatFilter.value) {
        return false
      }
      return true
    })
  })

  const displayedFiles = computed(() => filteredFiles.value.slice(0, visibleCount.value))

  /** 列表为空时给出原因，而不是干巴巴一句 No Data */
  const emptyText = computed(() => {
    if (scanning.value) return '正在读取动作目录…'
    if (error.value) return error.value
    if (allFiles.value.length) return '当前筛选条件下没有文件'
    return '没有读到动作文件，点上方「刷新列表」重试'
  })

  function loadMore() {
    if (visibleCount.value >= filteredFiles.value.length) return
    visibleCount.value = Math.min(filteredFiles.value.length, visibleCount.value + pageSize)
  }

  function tableWrapEl() {
    const el = tableRef.value?.$el
    if (!el) return null
    return (
      el.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') ||
      el.querySelector('.el-table__body-wrapper')
    )
  }

  function onTableScroll() {
    const wrap = tableWrapEl()
    if (!wrap) return
    if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 60) loadMore()
  }

  function resetScrollTop() {
    nextTick(() => {
      const wrap = tableWrapEl()
      if (wrap) wrap.scrollTop = 0
    })
  }

  /** 表格挂载后绑定滚动（el-table 的滚动容器要等渲染完才存在） */
  function bindTableScroll() {
    nextTick(() => {
      tableWrapEl()?.addEventListener('scroll', onTableScroll, { passive: true })
    })
  }

  function onRowSelect(row) {
    if (!row) return
    onPick(row)
  }

  watch([keyword, formatFilter, selectedDir], () => {
    visibleCount.value = pageSize
    resetScrollTop()
  })

  watch(source, (val) => {
    clearPreview()
    allFiles.value = []
    error.value = ''
    selectedDir.value = ''
    visibleCount.value = pageSize
    if (val === 'dir') loadFromDir()
    else if (val === 'alist') loadFromAlist()
  })

  return {
    // 模板 ref
    tableRef,
    treeRef,
    folderInput,
    // 状态
    source,
    scanning,
    loadingMeta,
    allFiles,
    keyword,
    formatFilter,
    selectedDir,
    catPanel,
    localRoot,
    treeData,
    filteredFiles,
    displayedFiles,
    emptyText,
    // 动作
    loadFromDir,
    loadFromAlist,
    loadMeta,
    pickFolder,
    clearAll,
    onFolderPicked,
    onDirSelect,
    clearDir,
    loadMore,
    onTableScroll,
    resetScrollTop,
    bindTableScroll,
    onRowSelect
  }
}
