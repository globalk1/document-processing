<template>
  <section class="feature-workspace ocr-workspace">
    <aside class="control-panel">
      <h2 class="section-title">檔案</h2>
      <div class="drop-zone" :class="{ over: dragOver, disabled: active }" role="button" :tabindex="active ? -1 : 0" :aria-disabled="active"
        @click="!active && fileInput?.click()" @keydown.enter.prevent="!active && fileInput?.click()" @keydown.space.prevent="!active && fileInput?.click()"
        @dragover.prevent="!active && (dragOver = true)" @dragleave="dragOver = false" @drop.prevent="handleDrop">
        <div class="file-icon">文</div>
        <strong>{{ file?.name || record?.filename || '選擇、拖拉或貼上 PDF、圖片' }}</strong>
        <span>{{ file ? `${Math.ceil(file.size / 1024)} KB` : '掃描試卷、圖片及有文字層的 PDF' }}</span>
        <span>最多 32 MB／80 頁</span>
        <input ref="fileInput" hidden type="file" accept="application/pdf,image/*" aria-label="選擇 OCR 檔案" :disabled="active"
          @click.stop @change="fileChanged" />
      </div>
      <h2 class="section-title">解析模式</h2>
      <div class="ocr-modes" aria-label="OCR 模式">
        <button v-for="item in modes" :key="item.id" type="button" :aria-pressed="mode === item.id" :disabled="active" @click="mode = item.id">
          <strong>{{ item.title }}</strong><small>{{ item.description }}</small>
        </button>
      </div>
      <p class="ocr-note">使用你的 4 GB OCR 主機，不呼叫付費 AI。</p>
      <button class="primary-button full" type="button" :disabled="!file || active" @click="start">{{ active ? '解析中' : '開始解析' }}</button>
      <button v-if="record" class="secondary-button" type="button" :disabled="stopping" @click="stop">
        {{ stopping ? '正在確認停止…' : pollingPaused || !record.id ? '確認停止工作' : '停止解析' }}
      </button>
      <button v-if="record?.id && pollingPaused" class="secondary-button" type="button" :disabled="stopping" @click="resume">重新查詢進度</button>
      <div v-if="record" class="ocr-progress" aria-live="polite">
        <strong>{{ record.filename }}</strong>
        <progress v-if="job?.status === 'running' && job.total > 0" :value="job.current || 0" :max="job.total" aria-label="OCR 解析進度" />
        <span v-if="job?.status === 'running'">已完成 {{ job.current || 0 }}／{{ job.total || 1 }} 頁</span>
      </div>
      <p v-if="message" class="message" :class="status" role="status">{{ message }}</p>
    </aside>
    <section class="output-panel">
      <header class="panel-header">
        <h2 class="section-title">{{ outputMode === 'local_ocr_latex' ? 'OCR 數學文字' : 'OCR 文字' }}</h2>
        <div class="ocr-actions">
          <button class="secondary-button" type="button" :disabled="!text" @click="copy">複製文字</button>
          <button class="secondary-button" type="button" :disabled="!text" @click="download">下載 {{ outputMode === 'local_ocr_latex' ? 'Markdown' : 'TXT' }}</button>
          <button class="secondary-button" type="button" :disabled="!text || active" @click="clearOutput">清空</button>
        </div>
      </header>
      <p v-if="copyMessage" class="ocr-note" role="status">{{ copyMessage }}</p>
      <div v-if="reviewNotes.length" class="ocr-review">
        <strong>解析結果請對照原稿核對</strong>
        <p v-for="note in reviewNotes" :key="note">{{ note }}</p>
      </div>
      <textarea v-model="text" class="ocr-output" aria-label="OCR 解析文字" :readonly="active" spellcheck="false"
        placeholder="選擇檔案後按「開始解析」。已完成頁面的文字會陸續顯示，可在完成或停止後編輯、複製與下載。" />
      <p class="ocr-note">數學式、手寫字與表格請人工校對。重新整理頁面後，可接續查看目前工作的進度。</p>
    </section>
  </section>
</template>

<script setup>
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue';
import { cancelOcrJob, getOcrJob, startOcrJob, validateOcrFile } from '../services/ocr.js';

const storageKey = 'huanyu-active-ocr-v1';
const modes = [
  { id: 'local_ocr', title: '逐字文字', description: '保留辨識出的原始文字與頁碼。' },
  { id: 'local_ocr_latex', title: '數學文字（LaTeX）', description: '整理題號、正文數字及明確算式。' },
];
const fileInput = ref(null), file = ref(null), dragOver = ref(false), mode = ref('local_ocr_latex');
const text = ref(''), status = ref('idle'), message = ref(''), copyMessage = ref(''), job = ref(null);
const record = ref(null), stopping = ref(false), pollingPaused = ref(false);
const active = computed(() => Boolean(record.value));
const outputMode = computed(() => job.value?.mode || mode.value);
let uploadController, queryController, pollTimer, copyTimer, generation = 0, failures = 0, pasteAttached = false, recovered = false;
const reviewNotes = computed(() => {
  const d = job.value?.diagnostics || {}, notes = [];
  if (outputMode.value === 'local_ocr_latex' || d.math_review_required) notes.push('分數、根號、上下標及公式請逐題核對。');
  if (d.answer_review_required) notes.push(`參考答案需要核對${d.answer_missing_count ? `，目前有 ${d.answer_missing_count} 題未對應答案` : ''}。`);
  if (d.colored_ink_filtered) notes.push('辨識時已暫時排除部分彩色筆跡，請核對手寫內容和彩色印刷字。');
  if (d.figure_candidates?.length) notes.push(`已辨識 ${d.figure_candidates.length} 個附圖候選區域；文字輸出不包含原圖。`);
  return text.value ? notes : [];
});
function persist() {
  try { if (record.value) sessionStorage.setItem(storageKey, JSON.stringify(record.value)); else sessionStorage.removeItem(storageKey); } catch {}
}
function cancelPolling() { clearTimeout(pollTimer); queryController?.abort(); queryController = null; }
function resetTracking() { generation++; cancelPolling(); record.value = null; pollingPaused.value = false; persist(); }
function selectFile(selected) {
  if (!selected) return;
  if (active.value) { message.value = '請先停止目前的工作，再更換檔案。'; return; }
  const error = validateOcrFile(selected); if (error) { status.value = 'error'; message.value = error; return; }
  file.value = selected; text.value = ''; job.value = null; status.value = 'idle'; message.value = ''; copyMessage.value = '';
}
function fileChanged(event) { selectFile(event.target.files?.[0]); event.target.value = ''; }
function handleDrop(event) { dragOver.value = false; selectFile(event.dataTransfer.files?.[0]); }
function applyJob(next) {
  if (!next?.id || !['queued', 'running', 'success', 'error', 'cancelled'].includes(next.status)) throw new Error('OCR 工作回應不完整，請重新查詢或確認停止。');
  job.value = next;
  if (typeof next.text === 'string') text.value = next.text;
  if (next.status === 'success') { status.value = 'success'; message.value = '文字解析完成，可校對、複製或下載。'; resetTracking(); }
  else if (next.status === 'error') { status.value = 'error'; message.value = next.error || 'OCR 解析失敗，已保留完成的文字。'; resetTracking(); }
  else if (next.status === 'cancelled') { status.value = 'idle'; message.value = '已停止解析，已完成的文字仍保留。'; resetTracking(); }
  else {
    status.value = 'loading';
    message.value = next.status === 'queued'
      ? (next.queue_ahead_count > 0 ? `排隊中，前面還有 ${next.queue_ahead_count} 份工作。` : '等待 4 GB OCR 主機領取工作…')
      : `正在解析第 ${Math.min((next.current || 0) + 1, next.total || 1)}／${next.total || 1} 頁…`;
  }
}
function schedulePoll(token) { if (token === generation && record.value?.id && !pollingPaused.value && !stopping.value) pollTimer = setTimeout(() => poll(token), 1800); }
async function poll(token = generation) {
  if (token !== generation || !record.value?.id || stopping.value) return;
  queryController?.abort(); const controller = new AbortController(); queryController = controller;
  try {
    const result = await getOcrJob({ jobId: record.value.id, signal: controller.signal });
    if (controller.signal.aborted || token !== generation) return;
    if (!result.success) {
      if (result.status === 404) { resetTracking(); status.value = 'error'; message.value = 'OCR 工作已過期或不存在，請重新選檔解析。'; return; }
      throw new Error(result.error || '無法取得 OCR 進度。');
    }
    applyJob(result.job); failures = 0;
  } catch (error) {
    if (controller.signal.aborted || token !== generation) return;
    if (++failures >= 3) { pollingPaused.value = true; status.value = 'error'; message.value = `${error.message} 可重新查詢進度或確認停止工作。`; return; }
    message.value = '暫時無法取得進度，正在重新連線…';
  }
  schedulePoll(token);
}
async function start() {
  if (active.value || !file.value) return;
  const error = validateOcrFile(file.value); if (error) { status.value = 'error'; message.value = error; return; }
  const token = ++generation, requestId = crypto.randomUUID();
  record.value = { requestId, id: null, filename: file.value.name, mode: mode.value }; persist();
  text.value = ''; job.value = null; failures = 0; pollingPaused.value = false; status.value = 'loading'; message.value = '正在上傳檔案並建立 OCR 工作…';
  const controller = new AbortController(); uploadController = controller;
  try {
    const result = await startOcrJob({ file: file.value, mode: mode.value, requestId, signal: controller.signal });
    if (token !== generation || controller.signal.aborted) return;
    if (!result.success) {
      if ((result.status >= 400 && result.status < 500 && ![408, 429].includes(result.status)) || (result.status === 503 && result.code === 'local_ocr_unavailable')) {
        resetTracking(); status.value = 'error'; message.value = result.error; return;
      }
      throw new Error(result.error || '尚無法確認工作是否建立。');
    }
    if (!result.job?.id) throw new Error('尚未收到工作編號。');
    record.value = { ...record.value, id: result.job.id }; persist(); applyJob(result.job); schedulePoll(token);
  } catch (error) {
    if (token !== generation || controller.signal.aborted) return;
    pollingPaused.value = true; status.value = 'error'; message.value = `${error.message} 請按「確認停止工作」再重新送件。`;
  }
}
async function stop() {
  if (!record.value || stopping.value) return;
  stopping.value = true; generation++; cancelPolling(); uploadController?.abort();
  const snapshot = { ...record.value };
  try {
    const result = await cancelOcrJob({ jobId: snapshot.id, requestId: snapshot.requestId });
    if (!result.success || (!result.cancelled && !['cancelled', 'success', 'error'].includes(result.job?.status))) {
      throw new Error(result.error || '尚無法確認停止。');
    }
    if (typeof result.job?.text === 'string') text.value = result.job.text;
    if (result.job) job.value = result.job;
    resetTracking(); status.value = ['success', 'error'].includes(result.job?.status) ? result.job.status : 'idle';
    message.value = result.job?.status === 'success' ? '工作已完成，可校對、複製或下載。'
      : result.job?.status === 'error' ? result.job.error || 'OCR 解析失敗，已保留完成的文字。'
      : '已確認停止解析，已完成的文字仍保留。';
  } catch (error) { pollingPaused.value = true; status.value = 'error'; message.value = `${error.message} 請重新確認停止。`; }
  finally { stopping.value = false; }
}
function resume() { if (!record.value?.id || stopping.value) return; pollingPaused.value = false; failures = 0; poll(generation); }
function recover() {
  if (recovered) return; recovered = true;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (!saved || typeof saved.requestId !== 'string' || !modes.some(m => m.id === saved.mode)) return;
    record.value = saved; mode.value = saved.mode;
    if (saved.id) { message.value = '正在恢復目前 OCR 工作…'; poll(generation); }
    else { pollingPaused.value = true; status.value = 'error'; message.value = '上次送件尚未確認完成，請先按「確認停止工作」。'; }
  } catch { try { sessionStorage.removeItem(storageKey); } catch {} }
}
async function copy() {
  try { await navigator.clipboard.writeText(text.value); copyMessage.value = '已複製'; } catch { copyMessage.value = '複製失敗，請直接選取文字複製。'; }
  clearTimeout(copyTimer); copyTimer = setTimeout(() => copyMessage.value = '', 1800);
}
function download() {
  const isMath = outputMode.value === 'local_ocr_latex';
  const basename = (file.value?.name || job.value?.filename || 'OCR文字').replace(/\.[^.]+$/, '');
  const blob = new Blob([text.value], { type: isMath ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${basename}.${isMath ? 'md' : 'txt'}`; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function clearOutput() { if (active.value) return; text.value = ''; job.value = null; message.value = ''; status.value = 'idle'; }
function handlePaste(event) {
  if (event.defaultPrevented || event.target.closest?.('input,textarea,[contenteditable="true"]')) return;
  const selected = [...(event.clipboardData?.files || [])].find(f => !validateOcrFile(f));
  if (selected) { event.preventDefault(); selectFile(selected); }
}
function attachPaste() { if (!pasteAttached) { document.addEventListener('paste', handlePaste); pasteAttached = true; } }
function detachPaste() { document.removeEventListener('paste', handlePaste); pasteAttached = false; }
onMounted(() => { attachPaste(); recover(); });
onActivated(attachPaste);
onDeactivated(detachPaste);
onUnmounted(() => { detachPaste(); generation++; cancelPolling(); uploadController?.abort(); clearTimeout(copyTimer); });
</script>

<style scoped>
.ocr-modes { display: grid; gap: 10px; }
.ocr-modes button { display: grid; text-align: left; gap: 6px; border: 1px solid #ccd6e0; background: white; padding: 12px; border-radius: 8px; cursor: pointer; }
.ocr-modes button[aria-pressed='true'] { border-color: #153f67; background: #edf4fa; color: #153f67; }
.ocr-modes small, .ocr-note { color: #647284; font-size: 12px; line-height: 1.6; }
.ocr-note { margin: 0; }
.ocr-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ocr-output { width: 100%; min-height: 540px; resize: vertical; border: 1px solid #ccd6e0; border-radius: 8px; padding: 14px; background: white; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; line-height: 1.7; }
.ocr-progress { display: grid; gap: 8px; font-size: 13px; overflow-wrap: anywhere; }
.ocr-progress progress { width: 100%; accent-color: #153f67; }
.ocr-review { border: 1px solid #e8d29a; border-radius: 8px; padding: 12px; color: #786025; background: #fffbef; font-size: 13px; line-height: 1.6; }
.ocr-review p { margin: 6px 0 0; }
.ocr-workspace button:disabled, .drop-zone.disabled { opacity: .5; cursor: default; }
.ocr-workspace button:focus-visible { outline: 3px solid #d3a349; outline-offset: 2px; }
@media (max-width: 640px) { .panel-header { flex-wrap: wrap; } .ocr-output { min-height: 420px; } }
</style>
