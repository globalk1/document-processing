<template>
  <section class="hw-workspace" @keydown="handleKeyDown">
    <div class="feature-workspace">
      <aside class="control-panel">
        <h2 class="section-title">檔案</h2>
        <div class="drop-zone" :class="{ over: dragOver }" role="button" tabindex="0"
          @click="fileInput?.click()" @keydown.enter.prevent="fileInput?.click()" @keydown.space.prevent="fileInput?.click()"
          @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="handleDrop">
          <div class="file-icon">擦</div>
          <strong>{{ file ? file.name : '選擇、拖拉或貼上 PDF、圖片' }}</strong>
          <span>{{ file ? `${Math.ceil(file.size / 1024)} KB` : '選好後自動預覽，輸出固定為 PDF' }}</span>
          <span>最多 30 MB／80 頁</span>
          <input ref="fileInput" hidden type="file" accept="application/pdf,image/*" aria-label="選擇試卷"
            @click.stop @change="handleFileChange" />
        </div>
        <h2 class="section-title">清除設定</h2>
        <label class="field-label" for="handwriting-strength">遮罩強度 <strong>{{ strength }}</strong></label>
        <input id="handwriting-strength" v-model.number="strength" class="range-input" min="1" max="5" type="range"
          :disabled="busy" aria-describedby="handwriting-strength-status" />
        <p id="handwriting-strength-status" class="hw-strength">
          {{ unappliedStrength ? `強度 ${strength} 尚未套用，按「AI 清除」更新。` : '調整強度後，按「AI 清除」套用。' }}
        </p>
        <button class="primary-button full" :disabled="!file || busy || hasPending || !pages.length" type="button" @click="aiCleanup">
          {{ autoEnabled && previewStatus === 'loading' ? 'AI 清除中' : 'AI 清除' }}
        </button>
        <button class="primary-button full" :disabled="busy || !confirmed" type="button" @click="exportPdf">
          {{ exportStatus === 'loading' ? '處理中' : '匯出 PDF' }}
        </button>
        <button v-if="busy" class="secondary-button" type="button" @click="cancelProcessing">取消處理</button>
        <p v-if="exportMessage" class="message" :class="exportStatus" role="status">{{ exportMessage }}</p>
      </aside>
      <section class="output-panel">
        <div class="panel-header">
          <div class="preview-title-group">
            <h2 class="section-title">預覽</h2>
            <span v-if="regions.length" class="manual-count remove">手動調整 {{ regions.length }}</span>
            <span v-if="pendingErase.length" class="manual-count pending">待清除 {{ pendingErase.length }}</span>
            <span v-if="pendingRestore.length" class="manual-count restore">待恢復 {{ pendingRestore.length }}</span>
          </div>
          <div class="icon-group">
            <button v-if="markCount" class="icon-button" title="清除全部框選" aria-label="清除全部框選" type="button"
              :disabled="!editable" @click="clearAll">×</button>
            <button v-if="downloadResult" class="icon-button" title="下載清理後 PDF" aria-label="下載清理後 PDF" type="button"
              @click="downloadBlob(downloadResult.blob, downloadResult.filename)">↓</button>
          </div>
        </div>
        <HandwritingControls v-if="pages.length" :state="controlsState" @action="controlAction" @image="addImage" />
        <div v-if="file || previewMessage" class="hw-preview-status" :class="previewStatus" role="status" aria-live="polite">
          <span>{{ previewMessage || '等待預覽' }}</span>
          <button v-if="previewStatus === 'error'" type="button" class="secondary-button" @click="retryPreview">重試預覽</button>
          <div v-if="pages.length" class="preview-stats">
            <span>{{ autoEnabled ? '考卷自動' : '原稿預覽' }}</span>
            <span>已套用強度 {{ appliedStrength }}</span><span>{{ confirmationLabel }}</span>
            <span>自動遮罩 {{ (maskRatio * 100).toFixed(2) }}%</span>
          </div>
        </div>
        <div v-if="pages.length" class="hw-viewport" :aria-busy="busy">
          <div class="hw-preview-list" :class="{ busy }" :style="{ width: `${zoom}%` }">
            <HandwritingPreviewPage v-for="page in pages" :key="page.page" v-bind="pageBindings(page)" v-on="pageEvents(page)" />
          </div>
          <div v-if="busy" class="hw-busy"><span>{{ processingMessage }}</span><button type="button" @click="cancelProcessing">取消處理</button></div>
        </div>
        <div v-else class="empty-state">
          <strong>{{ previewStatus === 'loading' ? '正在載入原稿…' : '尚未產生預覽' }}</strong>
          <span>{{ file ? '預覽完成後可 AI 清除、手動清除或恢復。' : '請先選擇要清理的試卷。' }}</span>
        </div>
      </section>
    </div>
    <Teleport to="body">
      <div v-if="modalPage" class="hw-modal-backdrop" @click.self="closeModal">
        <section ref="modalElement" class="hw-modal" role="dialog" aria-modal="true" :aria-label="`第 ${modalPage.page} 頁放大編輯`"
          tabindex="-1" @keydown="handleModalKeyDown">
          <header class="hw-modal-header"><div><strong>第 {{ modalPage.page }} 頁</strong><small>{{ file?.name }}</small></div>
            <button type="button" aria-label="關閉放大編輯" title="關閉（Esc）" @click="closeModal">×</button></header>
          <HandwritingControls :state="modalControlsState" in-modal @action="modalControlAction" @image="addImage" />
          <div class="hw-modal-viewport" role="region" aria-label="放大頁面預覽">
            <div :style="{ width: `${modalZoom}%`, marginInline: modalZoom <= 100 ? 'auto' : 0 }">
              <HandwritingPreviewPage v-bind="pageBindings(modalPage, true)" v-on="pageEvents(modalPage)" />
            </div>
          </div>
          <div v-if="busy" class="hw-modal-busy" role="status">{{ processingMessage }}<button type="button" @click="cancelProcessing">取消處理</button></div>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { previewHandwriting, removeHandwriting, repairHandwritingImage } from '../services/api';
import { readOverlayFile, initialOverlayRect, cropRepairImage } from '../services/handwritingImageOverlays';
import HandwritingControls from './HandwritingControls.vue';
import HandwritingPreviewPage from './HandwritingPreviewPage.vue';

const fileInput = ref(null), file = ref(null), dragOver = ref(false);
const strength = ref(2), appliedStrength = ref(2), autoEnabled = ref(false), run = ref(0), fileVersion = ref(0);
const pages = ref([]), previewStatus = ref('idle'), previewMessage = ref(''), previewSignature = ref('');
const exportStatus = ref('idle'), exportMessage = ref(''), downloadResult = ref(null), confirmedSignature = ref('');
const layer = ref('original'), zoom = ref(100), modalZoom = ref(100), modalPageNumber = ref(null), modalElement = ref(null);
const regions = ref([]), pendingErase = ref([]), pendingRestore = ref([]), drawing = ref(null), history = ref([]);
const toolActive = ref(false), tool = ref('erase'), activePage = ref(1);
const overlays = ref([]), selectedId = ref(null), interacting = ref(false), pendingRepair = ref(null), instructions = ref('');
const imageBusy = ref(false), imageMessage = ref('');
let previewController, exportController, imageController, requestId = 0, draftSequence = 0, overlaySequence = 0;
let modalTrigger, previousOverflow, backgroundElement, previousInert, pasteAttached = false;

const colorMode = computed(() => autoEnabled.value ? 'exam_auto' : 'manual_only');
const analysisSignature = computed(() => JSON.stringify([fileVersion.value, colorMode.value, appliedStrength.value, run.value]));
const currentSignature = computed(() => JSON.stringify([analysisSignature.value, regions.value, overlays.value]));
const busy = computed(() => previewStatus.value === 'loading' || exportStatus.value === 'loading' || imageBusy.value);
const editable = computed(() => previewStatus.value === 'success' && previewSignature.value === analysisSignature.value && pages.value.length > 0 && !busy.value);
const hasPending = computed(() => Boolean(drawing.value || pendingRepair.value || pendingErase.value.length || pendingRestore.value.length));
const unappliedStrength = computed(() => autoEnabled.value && strength.value !== appliedStrength.value);
const canConfirm = computed(() => editable.value && !interacting.value && !hasPending.value && !unappliedStrength.value && (autoEnabled.value || regions.value.length > 0 || overlays.value.length > 0));
const confirmed = computed(() => canConfirm.value && confirmedSignature.value === currentSignature.value);
const markCount = computed(() => regions.value.length + pendingErase.value.length + pendingRestore.value.length + overlays.value.length + (pendingRepair.value ? 1 : 0));
const maskRatio = computed(() => pages.value.length ? pages.value.reduce((sum, p) => sum + Number(p.mask_ratio || 0), 0) / pages.value.length : 0);
const confirmationLabel = computed(() => confirmed.value ? '已確認結果' : hasPending.value ? '框選未套用' : unappliedStrength.value ? '強度尚未套用' : autoEnabled.value ? '待人工確認' : '原稿預覽');
const processingMessage = computed(() => imageBusy.value ? imageMessage.value : exportStatus.value === 'loading' ? exportMessage.value : previewMessage.value);
const modalPage = computed(() => pages.value.find(p => p.page === modalPageNumber.value));
const controlsState = computed(() => ({ layer: layer.value, busy: busy.value, editable: editable.value, interacting: interacting.value,
  tool: tool.value, toolActive: toolActive.value, canConfirm: canConfirm.value, confirmed: confirmed.value, zoom: zoom.value,
  canUndo: Boolean(markCount.value || drawing.value || history.value.length), hasPending: hasPending.value,
  pendingErase: pendingErase.value.length, pendingRestore: pendingRestore.value.length, repair: pendingRepair.value,
  pages: pages.value, activePage: activePage.value, selectedId: selectedId.value, instructions: instructions.value, imageMessage: imageMessage.value }));
const modalControlsState = computed(() => ({ ...controlsState.value, zoom: modalZoom.value, activePage: modalPageNumber.value }));

watch(currentSignature, () => { exportController?.abort(); downloadResult.value = null; exportStatus.value = 'idle'; exportMessage.value = ''; });
watch(strength, () => { downloadResult.value = null; exportMessage.value = ''; });
watch(modalPageNumber, async (value, oldValue) => {
  if (value !== null && oldValue === null) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    backgroundElement = fileInput.value?.closest('.page-shell');
    previousInert = backgroundElement?.inert;
    if (backgroundElement) backgroundElement.inert = true;
    await nextTick();
    modalElement.value?.querySelector('button:not(:disabled)')?.focus();
  } else if (value === null) restoreModalEnvironment();
});

const isCleanupFile = f => Boolean(f && (f.type === 'application/pdf' || f.type?.startsWith('image/') || /\.(pdf|png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i.test(f.name || '')));
function resetFileState() {
  pages.value = []; previewSignature.value = ''; confirmedSignature.value = ''; previewStatus.value = 'idle'; previewMessage.value = '';
  regions.value = []; pendingErase.value = []; pendingRestore.value = []; history.value = []; drawing.value = null;
  overlays.value = []; selectedId.value = null; pendingRepair.value = null; instructions.value = ''; imageMessage.value = ''; imageBusy.value = false;
  toolActive.value = false; tool.value = 'erase'; interacting.value = false; activePage.value = 1; zoom.value = 100;
  downloadResult.value = null; exportStatus.value = 'idle'; exportMessage.value = ''; layer.value = 'original'; autoEnabled.value = false;
}
function handleFile(selected) {
  if (!selected) return;
  if (!isCleanupFile(selected) || selected.size > 30 * 1024 * 1024) {
    exportStatus.value = 'error'; exportMessage.value = !isCleanupFile(selected) ? '請選擇 PDF 或圖片檔案。' : '試卷擦除檔案上限為 30 MB。'; return;
  }
  stopAll(); closeModal(); resetFileState(); file.value = selected; fileVersion.value++; run.value = 0; appliedStrength.value = strength.value;
  loadPreview();
}
function handleFileChange(event) { handleFile(event.target.files?.[0]); event.target.value = ''; }
function handleDrop(event) { dragOver.value = false; handleFile(Array.from(event.dataTransfer.files || []).find(isCleanupFile) || event.dataTransfer.files?.[0]); }
function stopAll() { requestId++; previewController?.abort(); exportController?.abort(); imageController?.abort(); imageBusy.value = false; }
async function loadPreview() {
  if (!file.value) return;
  previewController?.abort();
  const controller = new AbortController(); previewController = controller;
  const id = ++requestId, signature = analysisSignature.value;
  previewSignature.value = ''; confirmedSignature.value = ''; previewStatus.value = 'loading';
  previewMessage.value = autoEnabled.value ? '正在清除筆跡…' : '正在載入原稿…';
  const label = autoEnabled.value ? '正在清除筆跡' : '正在載入原稿';
  try {
    const result = await previewHandwriting({ file: file.value, colorMode: colorMode.value, strength: appliedStrength.value, manualRegions: [], maxPages: 80,
      signal: controller.signal, onProgress: (current, total, partial) => {
        if (id !== requestId || controller.signal.aborted) return;
        if (partial) {
          const updated = [...pages.value]; partial.forEach(p => { const index = updated.findIndex(old => old.page === p.page); if (index < 0) updated.push(p); else updated[index] = p; });
          pages.value = updated.sort((a, b) => a.page - b.page);
        }
        previewMessage.value = `${label} ${current}/${total} 頁…`;
      } });
    if (id !== requestId || controller.signal.aborted) return;
    if (!result.success || !result.pages?.length) throw new Error(result.error || '沒有收到頁面預覽。');
    pages.value = result.pages; previewSignature.value = signature; previewStatus.value = 'success';
    if (autoEnabled.value) layer.value = 'cleaned';
    previewMessage.value = autoEnabled.value ? '筆跡清除完成，請檢查清理預覽並確認結果。' : '原稿已載入，可按 AI 清除或框選手動調整。';
  } catch (error) {
    if (id !== requestId || controller.signal.aborted) return;
    previewStatus.value = 'error'; previewMessage.value = error.message || '筆跡預覽失敗。';
  }
}
function aiCleanup() { if (busy.value || hasPending.value || !pages.value.length) return; appliedStrength.value = strength.value; autoEnabled.value = true; run.value++; drawing.value = null; loadPreview(); }
function retryPreview() { if (busy.value) return; run.value++; loadPreview(); }
function cancelProcessing() {
  if (imageBusy.value) { imageController?.abort(); imageBusy.value = false; imageMessage.value = '已停止等待，可重新加入圖片或重試修復。'; return; }
  if (exportStatus.value === 'loading') { exportController?.abort(); exportStatus.value = 'idle'; exportMessage.value = '已取消匯出，可重新匯出 PDF。'; return; }
  previewController?.abort(); requestId++; previewSignature.value = ''; previewStatus.value = 'error'; previewMessage.value = '已取消處理，按「重試預覽」重新載入。';
}
function invalidateResult() { confirmedSignature.value = ''; downloadResult.value = null; exportStatus.value = 'idle'; exportMessage.value = ''; }
function confirm() { if (!canConfirm.value) return; confirmedSignature.value = currentSignature.value; layer.value = 'cleaned'; previewMessage.value = '已確認清除結果，可以匯出 PDF。'; }
async function exportPdf() {
  if (!file.value || !confirmed.value || busy.value) return;
  const controller = new AbortController(); exportController?.abort(); exportController = controller;
  exportStatus.value = 'loading'; exportMessage.value = '正在去除筆跡並產生 PDF…'; downloadResult.value = null;
  try {
    const result = await removeHandwriting({ file: file.value, colorMode: colorMode.value, strength: appliedStrength.value, outputFormat: 'pdf',
      manualRegions: JSON.parse(JSON.stringify(regions.value)), imageOverlays: JSON.parse(JSON.stringify(overlays.value)), signal: controller.signal,
      onProgress: (current, total) => { if (!controller.signal.aborted) exportMessage.value = `正在匯出 PDF ${current}/${total} 頁…`; } });
    if (controller.signal.aborted) return;
    if (!result.success) throw new Error(result.error || 'PDF 匯出失敗。');
    downloadResult.value = { blob: result.blob, filename: result.filename || 'cleaned-document.pdf' };
    downloadBlob(result.blob, downloadResult.value.filename); exportStatus.value = 'success'; exportMessage.value = '試卷擦除完成，已開始下載。';
  } catch (error) { if (!controller.signal.aborted) { exportStatus.value = 'error'; exportMessage.value = error.message || 'PDF 匯出失敗。'; } }
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const clamp = n => Math.max(0, Math.min(1, n));
function pointer(event) { const image = event.currentTarget.querySelector('[data-preview-base]')?.getBoundingClientRect(); const rect = image?.width ? image : event.currentTarget.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height), rect }; }
function normalize(r) { return r ? { page: r.page, x: Math.min(r.startX, r.currentX), y: Math.min(r.startY, r.currentY), width: Math.abs(r.currentX - r.startX), height: Math.abs(r.currentY - r.startY) } : null; }
function startRegion(page, event) {
  activePage.value = page; selectedId.value = null;
  if (!toolActive.value || !editable.value || (event.button !== undefined && event.button !== 0)) return;
  event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
  try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
  const p = pointer(event); drawing.value = { page, startX: p.x, startY: p.y, currentX: p.x, currentY: p.y };
}
function moveRegion(event) { if (!drawing.value) return; event.preventDefault(); const p = pointer(event); drawing.value = { ...drawing.value, currentX: p.x, currentY: p.y }; }
function endRegion(event) {
  if (!drawing.value) return;
  event.preventDefault(); const p = pointer(event), region = normalize({ ...drawing.value, currentX: p.x, currentY: p.y }); drawing.value = null;
  try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch {}
  if (!editable.value || region.width * p.rect.width < 1 - 1e-6 || region.height * p.rect.height < 1 - 1e-6) return;
  if (tool.value === 'repair') { pendingRepair.value = region; imageMessage.value = '已框選修復區塊，可填寫需求後按「修復並覆蓋」。'; return; }
  const drafts = tool.value === 'restore' ? pendingRestore : pendingErase;
  drafts.value = [...drafts.value, { ...region, draftOrder: ++draftSequence }];
  previewMessage.value = `已框選 ${drafts.value.length} 個區域，可繼續框選或按${tool.value === 'restore' ? '恢復原圖' : '清除'}。`;
}
function applyRegions(restore) {
  const drafts = restore ? pendingRestore : pendingErase; if (!editable.value || !drafts.value.length) return;
  history.value = [...history.value, { type: 'regions', before: regions.value }];
  regions.value = [...regions.value, ...drafts.value.map(({ draftOrder, ...region }) => restore ? { ...region, action: 'restore' } : region)];
  drafts.value = []; layer.value = 'cleaned'; invalidateResult(); previewMessage.value = restore ? '已恢復框選區域，匯出 PDF 時會保留原圖。' : '已清除框選區域，匯出 PDF 時會一併套用。';
}
function cancelDrafts() { drawing.value = null; pendingErase.value = []; pendingRestore.value = []; pendingRepair.value = null; previewMessage.value = ''; }
function undo() {
  if (!editable.value || interacting.value) return;
  if (drawing.value) { drawing.value = null; return; }
  if (pendingRepair.value) { pendingRepair.value = null; return; }
  const eraseOrder = pendingErase.value.at(-1)?.draftOrder || 0, restoreOrder = pendingRestore.value.at(-1)?.draftOrder || 0;
  if (eraseOrder || restoreOrder) { const drafts = restoreOrder > eraseOrder ? pendingRestore : pendingErase; drafts.value = drafts.value.slice(0, -1); return; }
  const action = history.value.at(-1); if (!action) return; history.value = history.value.slice(0, -1);
  if (action.type === 'regions') regions.value = action.before;
  if (action.type === 'overlays') { overlays.value = action.before; selectedId.value = null; }
  if (action.type === 'reset') { regions.value = action.regions; overlays.value = action.overlays; pendingErase.value = action.pendingErase; pendingRestore.value = action.pendingRestore; pendingRepair.value = action.repair; }
  invalidateResult(); previewMessage.value = '已復原上一步。';
}
function clearAll() {
  if (!editable.value) return;
  history.value = [...history.value, { type: 'reset', regions: regions.value, overlays: overlays.value, pendingErase: pendingErase.value, pendingRestore: pendingRestore.value, repair: pendingRepair.value }];
  regions.value = []; overlays.value = []; selectedId.value = null; cancelDrafts(); invalidateResult(); previewMessage.value = '已清除所有手動標記。';
}
function commitOverlays(next) { history.value = [...history.value, { type: 'overlays', before: overlays.value }]; overlays.value = next; layer.value = 'cleaned'; invalidateResult(); }
function changeOverlay(next) { if (editable.value) commitOverlays(overlays.value.map(item => item.id === next.id ? next : item)); }
function deleteOverlay(id = selectedId.value) { if (!editable.value || !id) return; commitOverlays(overlays.value.filter(item => item.id !== id)); selectedId.value = null; }
async function addImage(selected) {
  if (!selected || !editable.value || interacting.value) return;
  const page = pages.value.find(p => p.page === (modalPageNumber.value || activePage.value)); if (!page) return;
  const controller = new AbortController(); imageController?.abort(); imageController = controller; imageBusy.value = true;
  try {
    const decoded = await readOverlayFile(selected); if (controller.signal.aborted) return;
    const overlay = { ...initialOverlayRect(decoded, page), page: page.page, image: decoded.image, id: `overlay-${++overlaySequence}`, label: selected.name || '貼上的圖片' };
    commitOverlays([...overlays.value, overlay]); selectedId.value = overlay.id; toolActive.value = false;
    imageMessage.value = `已加入第 ${page.page} 頁；拖曳圖片移動，拉四角調整大小。`;
  } catch (error) { if (!controller.signal.aborted) imageMessage.value = error.message || '圖片讀取失敗。'; }
  finally { if (!controller.signal.aborted) imageBusy.value = false; }
}
async function repairImage() {
  if (!editable.value || !pendingRepair.value) return;
  const region = pendingRepair.value, page = pages.value.find(p => p.page === region.page); if (!page) return;
  const controller = new AbortController(); imageController?.abort(); imageController = controller; imageBusy.value = true; imageMessage.value = '正在擷取原圖區塊…';
  try {
    const image = await cropRepairImage(page.image, region); if (controller.signal.aborted) return;
    const result = await repairHandwritingImage({ image, instructions: instructions.value, signal: controller.signal,
      onProgress: message => { if (!controller.signal.aborted) imageMessage.value = message; } });
    if (controller.signal.aborted) return; if (!result.success) throw new Error(result.error || '圖片修復失敗。');
    const overlay = { ...region, id: `overlay-${++overlaySequence}`, image: result.image, label: 'AI 修復圖片' };
    commitOverlays([...overlays.value, overlay]); selectedId.value = overlay.id; pendingRepair.value = null; toolActive.value = false;
    imageMessage.value = '已用修復圖覆蓋原位置；可移動、縮放或按上一步復原。請核對文字與圖形後確認結果。';
  } catch (error) { if (!controller.signal.aborted) imageMessage.value = error.message || '圖片修復失敗，框選已保留。'; }
  finally { if (!controller.signal.aborted) imageBusy.value = false; }
}
function controlAction(action, value, inModal = false) {
  if (action === 'layer') layer.value = value;
  else if (action === 'zoom') { drawing.value = null; (inModal ? modalZoom : zoom).value = Math.max(inModal ? 25 : 100, Math.min(300, value)); }
  else if (action === 'instructions') instructions.value = value;
  else if (action === 'page') activePage.value = value;
  else if (action === 'confirm') confirm();
  else if (action === 'tool' && editable.value) { toolActive.value = tool.value === value ? !toolActive.value : true; tool.value = value; drawing.value = null; selectedId.value = null; if (value === 'repair') layer.value = 'original'; }
  else if (action === 'browse') { toolActive.value = false; drawing.value = null; }
  else if (action === 'undo') undo();
  else if (action === 'erase') applyRegions(false);
  else if (action === 'restore') applyRegions(true);
  else if (action === 'cancel') cancelDrafts();
  else if (action === 'delete') deleteOverlay();
  else if (action === 'repair') repairImage();
}
function modalControlAction(action, value) { controlAction(action, value, true); }
function pageBindings(page, inModal = false) { const onPage = items => items.filter(r => r.page === page.page); return {
  page, inModal, layer: layer.value, editable: editable.value, toolActive: toolActive.value, tool: tool.value,
  regions: onPage(regions.value), overlays: onPage(overlays.value), pendingErase: onPage(pendingErase.value), pendingRestore: onPage(pendingRestore.value),
  repair: pendingRepair.value?.page === page.page ? pendingRepair.value : null, drawing: drawing.value?.page === page.page ? normalize(drawing.value) : null, selectedId: selectedId.value }; }
function pageEvents(page) { return { start: event => startRegion(page.page, event), move: moveRegion, end: endRegion, 'cancel-drawing': () => { drawing.value = null; },
  open: event => openModal(page.page, event), 'select-overlay': id => { selectedId.value = id; activePage.value = page.page; },
  'change-overlay': changeOverlay, 'delete-overlay': deleteOverlay, interacting: value => { interacting.value = value; } }; }
function handleKeyDown(event) {
  if (!editable.value || interacting.value || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.key === 'Escape') { event.preventDefault(); drawing.value = null; if (hasPending.value) cancelDrafts(); else toolActive.value = false; }
  else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId.value) { event.preventDefault(); deleteOverlay(); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
}
function openModal(page, event) { if (!editable.value) return; modalTrigger = event.currentTarget; drawing.value = null; modalZoom.value = 100; activePage.value = page; modalPageNumber.value = page; }
function closeModal() { drawing.value = null; interacting.value = false; toolActive.value = false; modalPageNumber.value = null; }
function restoreModalEnvironment() {
  if (previousOverflow !== undefined) { document.body.style.overflow = previousOverflow; previousOverflow = undefined; }
  if (backgroundElement) { backgroundElement.inert = Boolean(previousInert); backgroundElement = null; }
  const trigger = modalTrigger; modalTrigger = null; if (trigger?.isConnected) nextTick(() => trigger.focus({ preventScroll: true }));
}
function handleModalKeyDown(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeModal(); return; }
  if (event.key === 'Tab') {
    const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled):not([type="file"]), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  handleKeyDown(event);
}
function handlePaste(event) {
  if (event.defaultPrevented || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  const files = [...(event.clipboardData?.files || [])];
  for (const item of event.clipboardData?.items || []) if (item.kind === 'file' && !files.length) { const f = item.getAsFile(); if (f) files.push(f); }
  const image = files.find(f => f.type?.startsWith('image/'));
  if (file.value && image) { event.preventDefault(); if (editable.value) addImage(image); else imageMessage.value = '請等待目前處理完成，再貼上覆蓋圖片。'; return; }
  const selected = files.find(isCleanupFile); if (selected) { event.preventDefault(); handleFile(selected); }
}
function attachPaste() { if (!pasteAttached) { document.addEventListener('paste', handlePaste); pasteAttached = true; } }
function detachPaste() { document.removeEventListener('paste', handlePaste); pasteAttached = false; }
onMounted(attachPaste); onActivated(attachPaste);
onDeactivated(() => { detachPaste(); closeModal(); if (busy.value) cancelProcessing(); });
onUnmounted(() => { detachPaste(); stopAll(); restoreModalEnvironment(); });
</script>

<style scoped>
.hw-workspace { display: grid; gap: 16px; }
.hw-modal-header button, .hw-busy button, .hw-modal-busy button { padding: 7px 12px; background: var(--theme-surface, white); border: 1px solid var(--theme-border, #ccd6e0); border-radius: 7px; cursor: pointer; }
.hw-strength { margin: 0; color: var(--theme-accent, #607185); font-size: 12px; line-height: 1.6; }
.hw-preview-status { display: grid; gap: 8px; padding: 12px; border-radius: 8px; background: var(--theme-surface-soft, #f2f5f8); font-size: 13px; }
.hw-preview-status.error { color: var(--theme-error-text, #a8322c); background: var(--theme-surface-soft, #fff0ef); }
.hw-preview-status button { justify-self: start; }
.hw-viewport { position: relative; overflow: auto; max-height: 80vh; background: var(--theme-surface-soft, #e9eef3); border-radius: 10px; }
.hw-preview-list { display: grid; gap: 16px; min-width: 100%; padding: 12px; }
.hw-preview-list.busy { pointer-events: none; opacity: .6; }
.hw-busy { position: sticky; bottom: 12px; display: flex; justify-content: center; align-items: center; gap: 10px; background: var(--theme-loading-overlay, #ffffffee); border: 1px solid var(--theme-border, #ccd6e0); padding: 14px; margin: 12px; border-radius: 8px; font-size: 13px; }
.hw-modal-backdrop { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; padding: 20px; background: var(--theme-overlay, #15283caa); }
.hw-modal { width: min(1320px, 96vw); height: 94vh; display: flex; flex-direction: column; padding: 16px; background: var(--theme-surface, #fff); border-radius: 12px; box-shadow: 0 30px 100px #0005; }
.hw-modal-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.hw-modal-header div { display: grid; gap: 4px; }
.hw-modal-header small { max-width: 70vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--theme-accent, #607185); }
.hw-modal-viewport { overflow: auto; min-height: 0; flex: 1; background: var(--theme-surface-soft, #e9eef3); padding: 12px; border-radius: 8px; }
.hw-modal-busy { display: flex; gap: 10px; align-items: center; justify-content: center; padding-top: 10px; font-size: 13px; }
.hw-modal :deep(.hw-controls) { max-height: 45vh; overflow-y: auto; flex-shrink: 0; }
.hw-workspace button:disabled { opacity: .45; cursor: default; }
@media (max-width: 640px) { .hw-modal-backdrop { padding: 6px; } .hw-modal { width: 100%; height: 98dvh; padding: 10px; } .hw-preview-list { padding: 6px; } }
</style>
