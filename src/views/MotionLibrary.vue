<template>
  <div class="motion-library">
    <!-- 左侧：动作文件列表 -->
    <div class="panel left-panel">
      <div class="panel-header">
        <div class="title">动作库</div>
        <el-radio-group v-model="source" size="small">
          <el-radio-button value="dir">本机目录</el-radio-button>
          <el-radio-button value="alist">AList</el-radio-button>
          <el-radio-button value="picker">选文件夹</el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="source === 'dir'" class="connect-box">
        <div class="connect-row">
          <el-button size="small" type="primary" :loading="scanning" @click="loadFromDir(true)">
            {{ scanning ? '扫描中…' : '刷新列表' }}
          </el-button>
          <span class="hint">{{ localRoot || '读取中…' }}</span>
        </div>
      </div>

      <el-collapse v-if="source === 'dir' && treeData.length" v-model="catPanel" class="cat-panel">
        <el-collapse-item name="cat">
          <template #title>
            <span class="cat-title">
              分类
              <em v-if="selectedDir">· {{ selectedDir }}</em>
            </span>
          </template>
          <div class="cat-head">
            <el-button link size="small" :disabled="!selectedDir" @click="clearDir">显示全部</el-button>
          </div>
          <el-tree
            ref="treeRef"
            :data="treeData"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            class="cat-tree"
            @node-click="onDirSelect"
          />
        </el-collapse-item>
      </el-collapse>

      <div v-else-if="source === 'alist'" class="connect-box">
        <div class="connect-row">
          <el-button size="small" type="primary" :loading="scanning" @click="loadFromAlist">
            {{ scanning ? '扫描中…' : '刷新动作列表' }}
          </el-button>
          <span class="hint">文件来自 NAS（aider_server 代理）</span>
        </div>
        <div v-if="scanning" class="scan-tip">正在扫描，请稍候…</div>
      </div>

      <div v-else class="connect-box">
        <div class="connect-row">
          <el-button size="small" type="primary" @click="pickFolder">选择动作文件夹</el-button>
          <el-button size="small" :disabled="!allFiles.length" @click="clearAll">清空</el-button>
        </div>
        <input
          ref="folderInput"
          type="file"
          webkitdirectory
          directory
          multiple
          hidden
          @change="onFolderPicked"
        />
      </div>

      <div class="filter-row">
        <el-input v-model="keyword" size="small" placeholder="搜索文件名" clearable />
        <el-select
          v-model="formatFilter"
          size="small"
          placeholder="格式"
          clearable
          style="width: 110px; margin-left: 8px"
        >
          <el-option label="BVH" value="bvh" />
          <el-option label="FBX" value="fbx" />
          <el-option label="其他" value="other" />
        </el-select>
      </div>

      <div class="stat-row">
        共 <b>{{ allFiles.length }}</b> 个文件，筛出 <b>{{ filteredFiles.length }}</b> 个
        <span v-if="loadingMeta" class="meta-tip">（读取时长中…）</span>
      </div>

      <el-table
        ref="tableRef"
        :data="displayedFiles"
        :empty-text="emptyText"
        size="small"
        height="100%"
        highlight-current-row
        @current-change="onRowSelect"
        class="file-table"
      >
        <el-table-column label="文件名" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="file-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="96" align="center">
          <template #default="{ row }">
            <el-tooltip :content="row.path" placement="top" :show-after="400">
              <span class="category-name">{{ row.category || '-' }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="格式" width="66" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.previewable ? 'success' : 'info'">
              {{ row.ext.toUpperCase() }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="72" align="center">
          <template #default="{ row }">
            <span v-if="row.duration">{{ row.duration.toFixed(1) }}s</span>
            <span v-else class="dim">-</span>
          </template>
        </el-table-column>
        <el-table-column label="帧数" width="68" align="center">
          <template #default="{ row }">
            <span v-if="row.frames">{{ row.frames }}</span>
            <span v-else class="dim">-</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="load-more-tip">
        <span v-if="displayedFiles.length < filteredFiles.length">下滑加载更多…</span>
        <span v-else-if="filteredFiles.length">已全部显示（{{ filteredFiles.length }} 个）</span>
      </div>
    </div>

    <!-- 右侧：预览 -->
    <div class="panel right-panel">
      <div class="actor-bar">
        <span class="actor-label">机器人</span>
        <el-select v-model="robotType" size="small" style="width: 110px" @change="onRobotTypeChange">
          <el-option v-for="r in ROBOT_TYPES" :key="r.value" :label="r.label" :value="r.value" />
        </el-select>
        <span class="actor-label">演员</span>
        <el-select v-model="actor" size="small" style="width: 170px" @change="onActorChange">
          <el-option label="火柴人（动作源）" value="skeleton" />
          <el-option :label="`${robotLabel}（机器人本体）`" :value="robotType" />
        </el-select>
        <span v-if="busyTip" class="hint">{{ busyTip }}</span>
        <span v-else-if="actor === 'skeleton'" class="hint">
          只动胳膊{{ aiderJoints ? ` · ${aiderJoints} 个关节` : '' }}
        </span>
        <span v-else class="hint">
          机器人本体{{ aiderJoints ? ` · ${aiderJoints} 个关节跟随动作` : '（无关节可驱动）' }}
        </span>
      </div>

      <div v-if="!current" class="empty-tip">
        <div class="big">💃</div>
        <p>左边选一个动作文件，这里会播放出来</p>
        <p class="dim">支持 BVH（骨架/模型）和 FBX（自带模型）</p>
      </div>

      <div v-show="current" ref="canvasWrap" class="canvas-wrap"></div>

      <div v-if="current" class="playbar">
        <el-button size="small" @click="togglePlay">
          {{ playing ? '⏸ 暂停' : '▶ 播放' }}
        </el-button>
        <el-button size="small" @click="restart">⟲ 重播</el-button>
        <span class="time">
          {{ currentTime.toFixed(1) }} / {{ (current?.duration || 0).toFixed(1) }} s
        </span>
        <el-slider
          v-model="progress"
          :min="0"
          :max="1000"
          :show-tooltip="false"
          class="progress"
          @input="onSeek"
        />
        <span class="speed-label">速度</span>
        <el-select v-model="speed" size="small" style="width: 78px" @change="onSpeedChange">
          <el-option label="0.25x" :value="0.25" />
          <el-option label="0.5x" :value="0.5" />
          <el-option label="1x" :value="1" />
          <el-option label="1.5x" :value="1.5" />
          <el-option label="2x" :value="2" />
        </el-select>
      </div>

      <div v-if="error" class="error-tip">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
/**
 * 动作库页面：只负责编排。
 *   列表/筛选/分类树 → composables/useMotionList.js
 *   预览场景/重定向/播放 → composables/useMotionScene.js
 *   骨骼算法与演员模型      → three/motionRetarget.js、three/actors.js、three/aiderJoints.js
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMotionScene } from '../composables/useMotionScene'
import { useMotionList } from '../composables/useMotionList'
import { ROBOT_TYPES } from '../three/actors'

const error = ref('')          // 列表与预览共用（谁出错谁写）

// 两级选择：先选机器人类型（决定关节映射与可驱动关节数），再选演员 ——
// 火柴人（动作源，只动胳膊）或该类型的机器人本体。演员可以用 URL 指定，
// 如 /motion-library?actor=aider（便于分享链接与自动化截图）
const robotType = ref('aider')
const actorParam = new URLSearchParams(location.search).get('actor')
const validActors = ['skeleton', ...ROBOT_TYPES.map((r) => r.value)]
const actor = ref(validActors.includes(actorParam) ? actorParam : 'skeleton')
const robotLabel = computed(
  () => ROBOT_TYPES.find((r) => r.value === robotType.value)?.label || robotType.value
)

const canvasWrap = ref(null)

const scene = useMotionScene({ canvasRef: canvasWrap, error })

const list = useMotionList({
  error,
  resetPreview: () => { scene.current.value = null },
  clearPreview: () => {
    scene.disposeScene()
    scene.current.value = null
  },
  onPick: (row) => scene.loadMotion(row, actor.value)
})

const {
  // 模板 ref
  tableRef, treeRef, folderInput,
  // 列表状态
  source, scanning, loadingMeta, allFiles, keyword, formatFilter,
  selectedDir, catPanel, localRoot, treeData, filteredFiles, displayedFiles, emptyText,
  // 列表动作
  loadFromDir, loadFromAlist, pickFolder, clearAll, onFolderPicked,
  onDirSelect, clearDir, bindTableScroll, onRowSelect
} = list

const {
  // 预览状态
  current, playing, currentTime, progress, speed, busyTip, aiderJoints,
  // 预览动作
  togglePlay, restart, seek, setSpeed, disposeAll
} = scene

function onSeek(val) {
  seek(val)
}

function onSpeedChange(v) {
  setSpeed(v)
}

function onActorChange() {
  // 换演员 → 重新加载当前动作
  if (current.value) scene.loadMotion(current.value, actor.value)
}

function onRobotTypeChange() {
  // 换机器人类型：本体演员切到新类型；火柴人的关节映射也随类型走 —— 统一重载
  if (actor.value !== 'skeleton') actor.value = robotType.value
  if (current.value) scene.loadMotion(current.value, actor.value)
}

onMounted(() => {
  bindTableScroll()
  loadFromDir()
})

onBeforeUnmount(() => {
  disposeAll()
})
</script>

<style scoped>
.motion-library {
  display: flex;
  height: calc(100vh - 60px);
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
}

.panel {
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color-light, #ddd);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.left-panel {
  width: 520px;
  min-width: 380px;
  padding: 10px;
}

.right-panel {
  flex: 1;
  position: relative;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.panel-header .title {
  font-size: 16px;
  font-weight: 600;
}

.connect-box {
  border: 1px dashed var(--el-border-color, #d0d0d0);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 8px;
}

.connect-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cat-panel {
  margin-bottom: 8px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 6px;
}

.cat-title {
  font-size: 13px;
  font-weight: 600;
}

.cat-title em {
  font-style: normal;
  font-weight: 400;
  color: var(--el-text-color-secondary, #888);
}

.cat-head {
  text-align: right;
  margin-bottom: 2px;
}

.cat-tree {
  max-height: 220px;
  overflow: auto;
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary, #888);
}

.scan-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-primary, #409eff);
}

.filter-row {
  display: flex;
  margin-bottom: 6px;
}

.stat-row {
  font-size: 12px;
  color: var(--el-text-color-secondary, #888);
  margin-bottom: 6px;
}

.meta-tip {
  margin-left: 6px;
  color: var(--el-color-primary, #409eff);
}

.file-table {
  flex: 1;
  font-size: 12px;
}

.file-name {
  cursor: pointer;
}

.category-name {
  font-size: 12px;
  color: var(--el-text-color-secondary, #888);
}

.dim {
  color: var(--el-text-color-secondary, #aaa);
}

.load-more-tip {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary, #999);
  padding: 6px 0 2px;
}

.actor-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-light, #ddd);
}

.actor-label {
  font-size: 13px;
  font-weight: 600;
}

.canvas-wrap {
  width: 100%;
  flex: 1;
  min-height: 300px;
}

.playbar {
  height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-top: 1px solid var(--el-border-color-light, #ddd);
}

.playbar .time {
  font-size: 12px;
  min-width: 96px;
  text-align: center;
  color: var(--el-text-color-regular, #666);
}

.progress {
  flex: 1;
}

.speed-label {
  font-size: 12px;
  color: var(--el-text-color-secondary, #888);
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--el-text-color-secondary, #888);
}

.empty-tip .big {
  font-size: 48px;
  margin-bottom: 10px;
}

.error-tip {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 56px;
  padding: 8px 12px;
  background: var(--el-color-danger-light-9, #fde2e2);
  color: var(--el-color-danger, #f56c6c);
  border-radius: 6px;
  font-size: 12px;
}
</style>
