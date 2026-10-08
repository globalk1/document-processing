<template>
  <div class="hw-controls">
    <div class="hw-toolbar">
      <div class="hw-button-group" aria-label="檢視模式">
        <button v-for="[id, label] in layers" :key="id" type="button" :aria-pressed="state.layer === id"
          @click="$emit('action', 'layer', id)">{{ label }}</button>
      </div>
      <div class="hw-zoom" aria-label="預覽縮放">
        <button type="button" aria-label="縮小預覽" :disabled="state.busy || state.interacting || state.zoom <= (inModal ? 25 : 100)"
          @click="$emit('action', 'zoom', state.zoom - (inModal ? 25 : 50))">−</button>
        <input v-if="inModal" type="range" aria-label="PDF 縮放比例" min="25" max="300" step="25" :value="state.zoom"
          :disabled="state.busy || state.interacting" @input="$emit('action', 'zoom', Number($event.target.value))" />
        <span>{{ state.zoom }}%</span>
        <button type="button" aria-label="放大預覽" :disabled="state.busy || state.interacting || state.zoom >= 300"
          @click="$emit('action', 'zoom', state.zoom + (inModal ? 25 : 50))">＋</button>
        <button v-if="inModal" type="button" :disabled="state.busy || state.interacting" @click="$emit('action', 'zoom', 100)">符合寬度</button>
      </div>
      <div class="hw-button-group">
        <button type="button" title="上一步（⌘ / Ctrl + Z）" :disabled="!state.editable || state.interacting || !state.canUndo" @click="$emit('action', 'undo')">上一步</button>
        <button type="button" :aria-pressed="!state.toolActive" :disabled="!state.editable" @click="$emit('action', 'browse')">瀏覽</button>
        <button v-if="!inModal" type="button" :disabled="!state.canConfirm" :aria-pressed="state.confirmed" @click="$emit('action', 'confirm')">
          {{ state.confirmed ? '已確認結果' : '確認結果' }}
        </button>
        <button v-for="[id, label] in tools" :key="id" type="button" :disabled="!state.editable"
          :aria-pressed="state.toolActive && state.tool === id" @click="$emit('action', 'tool', id)">{{ label }}</button>
        <button type="button" :disabled="!state.editable" @click="overlayInput?.click()">加入覆蓋圖片</button>
      </div>
    </div>
    <div class="hw-overlay-controls">
      <input ref="overlayInput" type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="選擇覆蓋圖片"
        @change="addImage" />
      <label>圖片貼到第 <select aria-label="覆蓋圖片頁碼" :value="state.activePage" :disabled="inModal || !state.editable"
        @change="$emit('action', 'page', Number($event.target.value))">
        <option v-for="page in state.pages" :key="page.page" :value="page.page">{{ page.page }}</option>
      </select> 頁</label>
      <small>⌘ / Ctrl + V 貼上圖片 · 拖曳移動 · 拉四角縮放 · 方向鍵微調</small>
      <button v-if="state.selectedId" type="button" :disabled="!state.editable" @click="$emit('action', 'delete')">刪除覆蓋圖片</button>
    </div>
    <div v-if="state.toolActive" class="hw-hint">
      {{ state.tool === 'repair' ? '拖曳框選原圖中要修復的區塊，再按「修復並覆蓋」' : state.tool === 'restore' ? '拖曳框選要恢復的區域，再按「恢復原圖」' : '拖曳框選要清除的區域，再按「清除」' }}
      <small>可連續框選 · Esc {{ inModal ? '關閉' : '取消' }} · ⌘ / Ctrl + Z 復原</small>
    </div>
    <div v-if="state.toolActive || state.hasPending" class="hw-selection-actions">
      <span>待清除 {{ state.pendingErase }} · 待恢復 {{ state.pendingRestore }}</span>
      <button type="button" :disabled="!state.editable || !state.pendingErase" @click="$emit('action', 'erase')">清除</button>
      <button type="button" :disabled="!state.editable || !state.pendingRestore" @click="$emit('action', 'restore')">恢復原圖</button>
      <button type="button" :disabled="!state.editable || !state.hasPending" @click="$emit('action', 'cancel')">取消</button>
    </div>
    <div v-if="(state.tool === 'repair' && state.toolActive) || state.repair" class="hw-repair">
      <label>修復需求（選填）<textarea aria-label="修復需求" rows="2" maxlength="1000" :value="state.instructions"
        :disabled="state.busy" placeholder="例如：去除手寫筆跡，補回圖形線條，保留題目與數字。"
        @input="$emit('action', 'instructions', $event.target.value)" /></label>
      <small>框選原圖區塊後送至 OpenAI 修復，會使用 API 額度。完成後覆蓋原位置，請核對結果。</small>
      <button type="button" :disabled="!state.editable || !state.repair" @click="$emit('action', 'repair')">修復並覆蓋{{ state.repair ? `（第 ${state.repair.page} 頁）` : '' }}</button>
    </div>
    <p v-if="state.imageMessage" class="hw-image-message" role="status">{{ state.imageMessage }}</p>
  </div>
</template>

<script setup>
import { ref } from "vue";
defineProps({ state: { type: Object, required: true }, inModal: Boolean });
const emit = defineEmits(["action", "image"]);
const overlayInput = ref(null);
const layers = [["original", "原圖"], ["mask", "遮罩"], ["cleaned", "清理預覽"]];
const tools = [["erase", "框選清除"], ["restore", "框選恢復"], ["repair", "框選修復"]];
function addImage(event) { emit("image", event.target.files?.[0]); event.target.value = ""; }
</script>

<style scoped>
.hw-controls { display: grid; gap: 10px; padding-block: 12px; }
.hw-toolbar, .hw-button-group, .hw-zoom, .hw-overlay-controls, .hw-selection-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.hw-controls button { border: 1px solid var(--theme-border, #ccd6e0); border-radius: 7px; background: var(--theme-surface, white); padding: 8px 10px; font-size: 13px; cursor: pointer; }
.hw-controls button[aria-pressed="true"] { background: var(--theme-strong, #153f67); color: white; border-color: var(--theme-accent, #153f67); }
.hw-controls button:disabled { opacity: .45; cursor: default; }
.hw-controls button:focus-visible { outline: 3px solid var(--theme-warning-border, #d3a349); outline-offset: 2px; }
.hw-zoom span { min-width: 44px; text-align: center; font-size: 13px; }
.hw-zoom input { width: 100px; }
.hw-overlay-controls, .hw-hint, .hw-selection-actions { padding: 10px; border-radius: 8px; background: var(--theme-surface-soft, #f0f5f8); font-size: 13px; }
.hw-overlay-controls select { padding: 4px; border: 1px solid var(--theme-border, #ccd6e0); border-radius: 4px; }
.hw-hint { display: grid; gap: 5px; }
.hw-controls small { color: var(--theme-muted, #5e6c7d); line-height: 1.5; }
.hw-repair { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--theme-border, #d8e2ec); border-radius: 8px; }
.hw-repair label { display: grid; gap: 6px; font-size: 13px; }
.hw-repair textarea { resize: vertical; padding: 8px; width: 100%; border: 1px solid var(--theme-border, #ccd6e0); border-radius: 6px; }
.hw-repair button { justify-self: start; }
.hw-image-message { margin: 0; font-size: 13px; color: var(--theme-muted, #526173); }
</style>
