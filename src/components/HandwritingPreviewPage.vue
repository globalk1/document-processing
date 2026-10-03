<template>
  <article class="hw-page">
    <header v-if="!inModal">
      <strong>第 {{ page.page }} 頁</strong>
      <span>遮罩 {{ (Number(page.mask_ratio || 0) * 100).toFixed(2) }}%</span>
      <button type="button" :disabled="!editable" :aria-label="`放大編輯第 ${page.page} 頁`" @click="$emit('open', $event)">放大編輯</button>
    </header>
    <div class="hw-canvas" :class="{ manual: toolActive && editable, expandable: editable && !toolActive && !inModal }"
      role="group" :aria-label="`第 ${page.page} 頁手動調整`" :tabindex="editable ? 0 : -1"
      @pointerdown="$emit('start', $event)" @pointermove="$emit('move', $event)"
      @pointerup="$emit('end', $event)" @pointercancel="$emit('cancel-drawing')"
      @click="!inModal && !toolActive && editable && $emit('open', $event)"
      @keydown.enter.prevent="!inModal && !toolActive && editable && $emit('open', $event)"
      @keydown.space.prevent="!inModal && !toolActive && editable && $emit('open', $event)">
      <img data-preview-base class="hw-base" :src="layer === 'cleaned' ? page.cleaned_image : page.image"
        :alt="`第 ${page.page} 頁預覽`" draggable="false" />
      <img v-if="layer === 'mask' && page.mask_overlay" class="hw-mask" :src="page.mask_overlay" alt="" draggable="false" />
      <template v-if="layer !== 'original'">
        <span v-for="(region, index) in regions" :key="index" class="hw-result"
          :style="regionStyle(displayRegion(region))"
          :aria-label="region.action === 'restore' ? '已恢復原圖的區域' : '已手動清除的區域'">
          <img v-if="region.action === 'restore' || layer === 'mask'" :src="page.image" alt="" draggable="false"
            :style="originalCropStyle(displayRegion(region))" />
        </span>
        <HandwritingImageOverlay v-for="overlay in overlays" :key="overlay.id" :overlay="overlay"
          :selected="selectedId === overlay.id" :disabled="!editable || toolActive"
          @select="$emit('select-overlay', overlay.id)" @change="$emit('change-overlay', $event)"
          @delete="$emit('delete-overlay', overlay.id)" @interacting="$emit('interacting', $event)" />
      </template>
      <span v-for="(region, index) in pendingErase" :key="`erase-${index}`" class="hw-draft erase" :style="regionStyle(region)" />
      <span v-for="(region, index) in pendingRestore" :key="`restore-${index}`" class="hw-draft restore" :style="regionStyle(region)" />
      <span v-if="repair" class="hw-draft restore" aria-label="待修復區域" :style="regionStyle(repair)" />
      <span v-if="drawing" class="hw-draft" :class="tool === 'erase' ? 'erase' : 'restore'" :style="regionStyle(drawing)" />
    </div>
  </article>
</template>

<script setup>
import HandwritingImageOverlay from "./HandwritingImageOverlay.vue";
const props = defineProps({
  page: { type: Object, required: true }, layer: String, editable: Boolean, toolActive: Boolean,
  tool: String, inModal: Boolean, selectedId: String, drawing: Object, repair: Object,
  regions: { type: Array, default: () => [] }, overlays: { type: Array, default: () => [] },
  pendingErase: { type: Array, default: () => [] }, pendingRestore: { type: Array, default: () => [] },
});
defineEmits(["start", "move", "end", "cancel-drawing", "open", "select-overlay", "change-overlay", "delete-overlay", "interacting"]);
const regionStyle = (r) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` });
const roundPixel = (value) => { const floor = Math.floor(value); return value - floor === .5 ? floor + floor % 2 : Math.round(value); };
function displayRegion(region) {
  const width = props.page.processing_width || props.page.width;
  const height = props.page.processing_height || props.page.height;
  if (!width || !height) return region;
  const padding = props.page.manual_padding || 0;
  const x1 = Math.max(0, Math.min(width - 1, roundPixel(region.x * width) - padding));
  const y1 = Math.max(0, Math.min(height - 1, roundPixel(region.y * height) - padding));
  const x2 = Math.max(x1 + 1, Math.min(width, roundPixel((region.x + region.width) * width) + padding));
  const y2 = Math.max(y1 + 1, Math.min(height, roundPixel((region.y + region.height) * height) + padding));
  return { x: x1 / width, y: y1 / height, width: (x2 - x1) / width, height: (y2 - y1) / height };
}
const originalCropStyle = (r) => ({ width: `${100 / r.width}%`, height: `${100 / r.height}%`, left: `${-r.x / r.width * 100}%`, top: `${-r.y / r.height * 100}%` });
</script>

<style scoped>
.hw-page { border: 1px solid #dce3e9; border-radius: 10px; overflow: hidden; background: white; }
.hw-page header { display: flex; align-items: center; gap: 12px; padding: 10px 14px; font-size: 13px; }
.hw-page header span { flex: 1; color: #627181; }
.hw-page button { border: 1px solid #ccd6e0; border-radius: 6px; background: white; padding: 6px 10px; cursor: pointer; }
.hw-canvas { position: relative; line-height: 0; user-select: none; }
.hw-canvas.manual { cursor: crosshair; touch-action: none; }
.hw-canvas.expandable { cursor: zoom-in; }
.hw-base { display: block; width: 100%; height: auto; }
.hw-mask { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.hw-result { position: absolute; display: block; overflow: hidden; background: white; pointer-events: none; }
.hw-result img { position: absolute; max-width: none; }
.hw-draft { position: absolute; display: block; border: 1px dashed; pointer-events: none; }
.hw-draft.erase { border-color: #bf6037; background: #e2814826; }
.hw-draft.restore { border-color: #238b71; background: #37a78b26; }
.hw-canvas:focus-visible { outline: 3px solid #d3a349; outline-offset: -3px; }
</style>
