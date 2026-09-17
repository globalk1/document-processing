<template>
  <div class="pdf-editor-shell">
    <aside class="pdf-sidebar">
      <div class="sidebar-heading">
        <strong>PDF 編輯</strong>
        <small>檔案只在你的瀏覽器內處理，不會上傳</small>
      </div>

      <div
        class="pdf-drop-zone"
        :class="{ active: dropActive }"
        role="button"
        tabindex="0"
        @click="fileInput?.click()"
        @keydown.enter.prevent="fileInput?.click()"
        @keydown.space.prevent="fileInput?.click()"
        @dragover.prevent="dropActive = true"
        @dragleave="dropActive = false"
        @drop.prevent="handleDrop"
      >
        <span class="drop-icon">＋</span>
        <strong>加入一個或多個 PDF</strong>
        <span>點擊選擇，或直接拖曳檔案到這裡</span>
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          @change="handleFileInput"
        />
      </div>

      <label class="pdf-field">
        <span>輸出檔名</span>
        <input v-model="outputName" placeholder="合併文件.pdf" />
      </label>

      <div class="pdf-summary">
        <div><strong>{{ items.length }}</strong><span>來源檔案</span></div>
        <div><strong>{{ pages.length || "—" }}</strong><span>輸出頁數</span></div>
        <div><strong>{{ formatBytes(totalSize) }}</strong><span>原始大小</span></div>
      </div>

      <button
        class="primary-pdf-button"
        type="button"
        :disabled="!canExport"
        @click="exportPdf(pages, getOutputName(outputName), `PDF 已完成，共 ${pages.length} 頁，已開始下載。`)"
      >
        <span :class="{ spinning: status === 'loading' }">{{ status === "loading" ? "↻" : "⇩" }}</span>
        {{ status === "loading" ? "處理中" : "匯出完整 PDF" }}
      </button>

      <div v-if="message" class="pdf-message" :class="status">{{ message }}</div>
    </aside>

    <section class="pdf-main">
      <div class="pdf-view-tabs" aria-label="PDF 編輯模式">
        <button type="button" :class="{ active: activeView === 'pages' }" @click="activeView = 'pages'">▦ 頁面整理</button>
        <button type="button" :class="{ active: activeView === 'files' }" @click="activeView = 'files'">▤ 來源檔案</button>
        <button type="button" :class="{ active: activeView === 'text' }" @click="activeView = 'text'">文 文字擷取</button>
      </div>

      <div v-if="activeView === 'files'" class="pdf-panel">
        <div class="pdf-panel-header">
          <div>
            <h2>來源檔案順序</h2>
            <p>拖曳整份檔案會重新排列該檔案的所有頁面。</p>
          </div>
          <button v-if="items.length" class="quiet-button" type="button" @click="clearAll">清除全部</button>
        </div>

        <div v-if="items.length" class="pdf-file-list" aria-label="PDF 合併順序">
          <article
            v-for="(item, index) in items"
            :key="item.id"
            class="pdf-file-row"
            :class="{ 'drag-over': dragOverId === item.id }"
            :draggable="status !== 'loading'"
            @dragstart="startFileDrag($event, item.id)"
            @dragover.prevent="dragOverId = item.id"
            @dragleave="dragOverId === item.id && (dragOverId = null)"
            @drop.prevent="dropFile($event, item.id)"
            @dragend="endFileDrag"
          >
            <span class="drag-handle" title="拖曳排序">⋮⋮</span>
            <span class="order-number">{{ index + 1 }}</span>
            <span class="pdf-file-icon">PDF</span>
            <div class="pdf-file-details">
              <strong :title="item.file.name">{{ item.file.name }}</strong>
              <span v-if="item.state === 'loading'">讀取頁數中…</span>
              <span v-else-if="item.state === 'error'">{{ item.error }}</span>
              <span v-else>{{ item.pageCount }} 頁 ・ {{ formatBytes(item.file.size) }}</span>
            </div>
            <div class="row-actions">
              <button type="button" :aria-label="`上移 ${item.file.name}`" :disabled="index === 0 || status === 'loading'" @click="moveItemBy(item.id, -1)">↑</button>
              <button type="button" :aria-label="`下移 ${item.file.name}`" :disabled="index === items.length - 1 || status === 'loading'" @click="moveItemBy(item.id, 1)">↓</button>
              <button type="button" :aria-label="`移除 ${item.file.name}`" :disabled="status === 'loading'" @click="removeItem(item.id)">×</button>
            </div>
          </article>
        </div>
        <EmptyPdfState v-else @choose="fileInput?.click()" />
      </div>

      <div v-else-if="activeView === 'text'" class="pdf-panel">
        <div class="pdf-panel-header">
          <div>
            <h2>文字擷取</h2>
            <p>可擷取頁面的原生文字；掃描 PDF 請使用文件解析 OCR。</p>
          </div>
          <div v-if="extractedText" class="header-actions">
            <button class="quiet-button" type="button" @click="copyExtractedText">複製文字</button>
            <button class="quiet-button" type="button" @click="downloadText">⇩ TXT</button>
          </div>
        </div>
        <textarea v-if="extractedText" v-model="extractedText" class="pdf-text-output" aria-label="PDF 擷取文字"></textarea>
        <div v-else class="pdf-text-empty">
          <span class="empty-symbol">文</span>
          <strong>尚未擷取文字</strong>
          <span>到「頁面整理」勾選頁面，再按「擷取文字」。</span>
          <button type="button" @click="activeView = 'pages'">前往選取頁面</button>
        </div>
      </div>

      <div v-else class="pdf-panel">
        <div class="pdf-panel-header">
          <div>
            <h2>頁面整理</h2>
            <p>拖曳縮圖調整跨檔案頁序；勾選後可批次旋轉、複製、刪除或擷取。</p>
          </div>
          <button v-if="pages.length" class="quiet-button" type="button" @click="clearAll">清除全部</button>
        </div>

        <template v-if="pages.length">
          <div class="page-toolbar">
            <button type="button" :class="{ active: allPagesSelected }" @click="toggleAllPages">{{ allPagesSelected ? "☑ 取消全選" : "☐ 全選" }}</button>
            <span class="selection-count">{{ selectedPageIds.size ? `已選 ${selectedPageIds.size} 頁` : "點縮圖左上角勾選頁面" }}</span>
            <i></i>
            <button type="button" :disabled="!selectedPageIds.size" @click="applySelectedPageChange('rotate-left')">↶ 左轉</button>
            <button type="button" :disabled="!selectedPageIds.size" @click="applySelectedPageChange('rotate-right')">↷ 右轉</button>
            <button type="button" :disabled="!selectedPageIds.size" @click="applySelectedPageChange('duplicate')">▣ 複製</button>
            <button type="button" :disabled="!selectedPageIds.size" @click="applySelectedPageChange('delete')">⌫ 刪除</button>
            <i></i>
            <button type="button" :disabled="!selectedPages.length || status === 'loading'" @click="exportPdf(selectedPages, `${safeBaseName(outputName)}-選取頁面.pdf`, `已將 ${selectedPages.length} 頁另存為 PDF。`)">⇩ 另存選取頁</button>
            <button type="button" :disabled="!selectedPages.length || status === 'loading'" @click="extractSelectedText">文 擷取文字</button>
            <button type="button" :disabled="!selectedPages.length || status === 'loading'" @click="exportSelectedImages">▧ 匯出 PNG</button>
          </div>

          <div class="pdf-page-list" aria-label="PDF 頁面順序">
            <article
              v-for="(page, index) in pages"
              :key="page.id"
              class="pdf-page-card"
              :class="{ selected: selectedPageIds.has(page.id), 'drag-over': pageDragOverId === page.id }"
              :draggable="status !== 'loading'"
              @dragstart="startPageDrag($event, page.id)"
              @dragover.prevent="pageDragOverId = page.id"
              @dragleave="pageDragOverId === page.id && (pageDragOverId = null)"
              @drop.prevent="dropPage($event, page.id)"
              @dragend="endPageDrag"
            >
              <button class="page-select" :class="{ selected: selectedPageIds.has(page.id) }" type="button" :aria-label="`${selectedPageIds.has(page.id) ? '取消選取' : '選取'} ${page.fileName} 第 ${page.sourcePageNumber} 頁`" @click="togglePage(page.id)">
                {{ selectedPageIds.has(page.id) ? "✓" : "" }}
              </button>
              <span class="page-position">{{ index + 1 }}</span>
              <button class="thumbnail-stage" type="button" :disabled="!page.thumbnail" :aria-label="`放大預覽 ${page.fileName} 第 ${page.sourcePageNumber} 頁`" @click="openPagePreview(page)">
                <img v-if="page.thumbnail" :src="page.thumbnail" :alt="`${page.fileName} 第 ${page.sourcePageNumber} 頁預覽`" :style="{ transform: `rotate(${page.rotation}deg)` }" />
                <span v-else class="thumbnail-loading" :class="{ error: page.thumbnailState === 'error' }">
                  <b :class="{ spinning: page.thumbnailState !== 'error' }">{{ page.thumbnailState === "error" ? "PDF" : "↻" }}</b>
                  {{ page.thumbnailState === "error" ? "無法顯示縮圖" : "產生縮圖中" }}
                </span>
              </button>
              <div class="page-meta">
                <strong :title="page.fileName">{{ page.fileName }}</strong>
                <span>原第 {{ page.sourcePageNumber }} 頁{{ page.rotation ? ` ・ 已旋轉 ${page.rotation}°` : "" }}</span>
              </div>
              <div class="page-quick-actions">
                <button type="button" :aria-label="`向前移第 ${index + 1} 頁`" :disabled="index === 0" @click="movePageBy(page.id, -1)">←</button>
                <button type="button" :aria-label="`向後移第 ${index + 1} 頁`" :disabled="index === pages.length - 1" @click="movePageBy(page.id, 1)">→</button>
              </div>
            </article>
          </div>
        </template>
        <EmptyPdfState v-else @choose="fileInput?.click()" />
      </div>
    </section>
  </div>

  <div v-if="previewPage" class="preview-backdrop" @mousedown.self="closePagePreview">
    <section class="preview-dialog" role="dialog" aria-modal="true" :aria-label="`${previewPage.fileName} 第 ${previewPage.sourcePageNumber} 頁放大預覽`">
      <header>
        <div><strong>{{ previewPage.fileName }}</strong><span>原第 {{ previewPage.sourcePageNumber }} 頁</span></div>
        <button type="button" aria-label="關閉放大預覽" @click="closePagePreview">×</button>
      </header>
      <div class="preview-toolbar" aria-label="放大預覽功能">
        <button type="button" aria-label="預覽上一頁" :disabled="previewPageIndex <= 0" @click="showAdjacentPreview(-1)">← 上一頁</button>
        <span>{{ previewPageIndex + 1 }} / {{ pages.length }}</span>
        <button type="button" aria-label="預覽下一頁" :disabled="previewPageIndex < 0 || previewPageIndex >= pages.length - 1" @click="showAdjacentPreview(1)">下一頁 →</button>
        <i></i>
        <button type="button" aria-label="預覽頁面左轉" @click="rotatePreviewPage(-90)">↶ 左轉</button>
        <button type="button" aria-label="預覽頁面右轉" @click="rotatePreviewPage(90)">↷ 右轉</button>
        <i></i>
        <button type="button" :class="{ active: previewPage.fit }" @click="previewPage.fit = true">適合視窗</button>
        <button type="button" :class="{ active: !previewPage.fit }" @click="previewPage.fit = false">原始大小</button>
      </div>
      <div class="preview-canvas">
        <img :class="{ fit: previewPage.fit }" :src="previewPage.image" :alt="`${previewPage.fileName} 第 ${previewPage.sourcePageNumber} 頁放大預覽`" :style="{ transform: `rotate(${previewPage.rotation - previewPage.imageRotation}deg)` }" />
        <span v-if="previewPage.loading" class="preview-loading"><b class="spinning">↻</b> 準備清晰預覽…</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onBeforeUnmount, ref } from "vue";
import { PDFDocument, degrees } from "pdf-lib";
import {
  extractPdfTextPages,
  renderPdfPagePreview,
  renderPdfPagesAsPng,
  renderPdfThumbnails,
} from "../services/pdfPreview.js";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const EmptyPdfState = defineComponent({
  emits: ["choose"],
  setup(_, { emit }) {
    return () => h("div", { class: "pdf-empty-state" }, [
      h("span", { class: "empty-pdf-icon" }, "PDF"),
      h("strong", "尚未加入 PDF"),
      h("span", "一次可選擇多個檔案，再逐頁預覽、排序與編輯。"),
      h("button", { type: "button", onClick: () => emit("choose") }, "選擇 PDF"),
    ]);
  },
});

const fileInput = ref(null);
const items = ref([]);
const pages = ref([]);
const selectedPageIds = ref(new Set());
const activeView = ref("pages");
const dropActive = ref(false);
const dragOverId = ref(null);
const pageDragOverId = ref(null);
const outputName = ref("合併文件.pdf");
const status = ref("idle");
const message = ref("");
const extractedText = ref("");
const previewPage = ref(null);
const activeFileIds = new Set();
let sequence = 0;
let draggedFileId = null;
let draggedPageId = null;
let previewRequest = 0;

const totalSize = computed(() => items.value.reduce((sum, item) => sum + (item.file.size || 0), 0));
const selectedPages = computed(() => pages.value.filter((page) => selectedPageIds.value.has(page.id)));
const canExport = computed(() => pages.value.length > 0 && !items.value.some((item) => item.state === "loading") && status.value !== "loading");
const allPagesSelected = computed(() => pages.value.length > 0 && selectedPageIds.value.size === pages.value.length);
const previewPageIndex = computed(() => previewPage.value ? pages.value.findIndex((page) => page.id === previewPage.value.id) : -1);

function nextId(prefix) {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function isPdf(file) {
  return file?.type === "application/pdf" || String(file?.name || "").toLowerCase().endsWith(".pdf");
}

function safeBaseName(name) {
  return String(name || "PDF").replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]/g, "-");
}

function getOutputName(value) {
  const trimmed = String(value || "").trim() || "合併文件";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetResult() {
  status.value = "idle";
  message.value = "";
}

function moveItem(list, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return list;
  const sourceIndex = list.findIndex((item) => item.id === sourceId);
  const targetIndex = list.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return list;
  const next = [...list];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function groupPagesByFile(pageList) {
  const groups = new Map();
  pageList.forEach((page) => {
    if (!groups.has(page.fileId)) groups.set(page.fileId, []);
    groups.get(page.fileId).push(page);
  });
  return groups;
}

function handleDrop(event) {
  dropActive.value = false;
  addFiles(event.dataTransfer.files);
}

function handleFileInput(event) {
  addFiles(event.target.files);
  event.target.value = "";
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const validFiles = files.filter(isPdf);
  const oversized = validFiles.filter((file) => file.size > MAX_FILE_SIZE);
  const accepted = validFiles.filter((file) => file.size <= MAX_FILE_SIZE);
  const pendingItems = accepted.map((file) => ({
    id: nextId("pdf"),
    file,
    pageCount: 0,
    state: "loading",
    error: "",
  }));

  if (pendingItems.length) {
    pendingItems.forEach((item) => activeFileIds.add(item.id));
    items.value = [...items.value, ...pendingItems];
    status.value = "loading";
    message.value = "正在讀取 PDF 頁面…";

    const inspected = await Promise.all(pendingItems.map(async (item) => {
      try {
        const document = await PDFDocument.load(await item.file.arrayBuffer(), { updateMetadata: false });
        const pageCount = document.getPageCount();
        return {
          ...item,
          pageCount,
          state: "ready",
          pages: Array.from({ length: pageCount }, (_, pageIndex) => ({
            id: nextId("page"),
            fileId: item.id,
            fileName: item.file.name,
            pageIndex,
            sourcePageNumber: pageIndex + 1,
            rotation: 0,
            thumbnail: "",
            thumbnailState: "loading",
          })),
        };
      } catch {
        return { ...item, state: "error", error: "PDF 無法讀取，可能已加密或檔案損壞。", pages: [] };
      }
    }));

    items.value = items.value.map((currentItem) => {
      const result = inspected.find((item) => item.id === currentItem.id);
      return result ? { ...currentItem, pageCount: result.pageCount, state: result.state, error: result.error } : currentItem;
    });
    const activeInspected = inspected.filter((item) => activeFileIds.has(item.id));
    pages.value = [...pages.value, ...activeInspected.flatMap((item) => item.pages)];
    const hasError = activeInspected.some((item) => item.state === "error");
    status.value = hasError ? "error" : "idle";
    message.value = hasError ? "部分 PDF 無法讀取；其他檔案仍可繼續編輯。" : "";

    activeInspected.filter((item) => item.state === "ready").forEach(async (item) => {
      try {
        const thumbnails = await renderPdfThumbnails(item.file, item.pageCount);
        if (!activeFileIds.has(item.id)) return;
        pages.value = pages.value.map((page) => page.fileId === item.id
          ? { ...page, thumbnail: thumbnails[page.pageIndex] || "", thumbnailState: "ready" }
          : page);
      } catch (error) {
        console.error("PDF thumbnail rendering failed", error);
        pages.value = pages.value.map((page) => page.fileId === item.id
          ? { ...page, thumbnailState: "error", thumbnailError: error?.message || "縮圖載入失敗" }
          : page);
      }
    });
  }

  if (validFiles.length !== files.length) {
    status.value = "idle";
    message.value = "已略過非 PDF 檔案。";
  } else if (oversized.length) {
    status.value = "idle";
    message.value = "單一 PDF 上限為 100 MB，過大的檔案已略過。";
  }
}

function removeItem(id) {
  activeFileIds.delete(id);
  const removedPageIds = new Set(pages.value.filter((page) => page.fileId === id).map((page) => page.id));
  items.value = items.value.filter((item) => item.id !== id);
  pages.value = pages.value.filter((page) => page.fileId !== id);
  selectedPageIds.value = new Set([...selectedPageIds.value].filter((pageId) => !removedPageIds.has(pageId)));
  resetResult();
}

function reorderFiles(sourceId, targetId) {
  const nextItems = moveItem(items.value, sourceId, targetId);
  const grouped = groupPagesByFile(pages.value);
  items.value = nextItems;
  pages.value = nextItems.flatMap((item) => grouped.get(item.id) || []);
  resetResult();
}

function moveItemBy(id, offset) {
  const sourceIndex = items.value.findIndex((item) => item.id === id);
  const target = items.value[sourceIndex + offset];
  if (sourceIndex >= 0 && target) reorderFiles(id, target.id);
}

function movePageBy(id, offset) {
  const sourceIndex = pages.value.findIndex((page) => page.id === id);
  const target = pages.value[sourceIndex + offset];
  if (target) pages.value = moveItem(pages.value, id, target.id);
  resetResult();
}

function startFileDrag(event, id) {
  draggedFileId = id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", id);
}

function dropFile(event, targetId) {
  reorderFiles(draggedFileId || event.dataTransfer.getData("text/plain"), targetId);
  dragOverId.value = null;
}

function endFileDrag() {
  draggedFileId = null;
  dragOverId.value = null;
}

function startPageDrag(event, id) {
  draggedPageId = id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", id);
}

function dropPage(event, targetId) {
  pages.value = moveItem(pages.value, draggedPageId || event.dataTransfer.getData("text/plain"), targetId);
  pageDragOverId.value = null;
  resetResult();
}

function endPageDrag() {
  draggedPageId = null;
  pageDragOverId.value = null;
}

function togglePage(id) {
  const next = new Set(selectedPageIds.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  selectedPageIds.value = next;
}

function toggleAllPages() {
  selectedPageIds.value = allPagesSelected.value ? new Set() : new Set(pages.value.map((page) => page.id));
}

function clearAll() {
  activeFileIds.clear();
  items.value = [];
  pages.value = [];
  selectedPageIds.value = new Set();
  extractedText.value = "";
  closePagePreview();
  resetResult();
}

function applySelectedPageChange(action) {
  if (!selectedPageIds.value.size) return;
  if (action === "rotate-left" || action === "rotate-right") {
    const amount = action === "rotate-left" ? -90 : 90;
    pages.value = pages.value.map((page) => selectedPageIds.value.has(page.id)
      ? { ...page, rotation: ((page.rotation + amount) % 360 + 360) % 360 }
      : page);
  }
  if (action === "duplicate") {
    pages.value = pages.value.flatMap((page) => selectedPageIds.value.has(page.id)
      ? [page, { ...page, id: nextId("page") }]
      : [page]);
    selectedPageIds.value = new Set();
  }
  if (action === "delete") {
    pages.value = pages.value.filter((page) => !selectedPageIds.value.has(page.id));
    selectedPageIds.value = new Set();
  }
  resetResult();
}

async function buildPdf(outputPages) {
  const output = await PDFDocument.create();
  const sources = new Map();
  for (const pageSpec of outputPages) {
    if (!sources.has(pageSpec.fileId)) {
      const item = items.value.find((candidate) => candidate.id === pageSpec.fileId);
      if (!item) continue;
      sources.set(pageSpec.fileId, await PDFDocument.load(await item.file.arrayBuffer(), { updateMetadata: false }));
    }
    const [copiedPage] = await output.copyPages(sources.get(pageSpec.fileId), [pageSpec.pageIndex]);
    const sourceRotation = copiedPage.getRotation().angle || 0;
    copiedPage.setRotation(degrees((sourceRotation + pageSpec.rotation + 360) % 360));
    output.addPage(copiedPage);
  }
  return output.save();
}

async function exportPdf(outputPages, filename, successMessage) {
  if (!outputPages.length) return;
  status.value = "loading";
  message.value = "正在依照目前頁面順序產生 PDF…";
  try {
    const bytes = await buildPdf(outputPages);
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), filename);
    status.value = "success";
    message.value = successMessage;
  } catch {
    status.value = "error";
    message.value = "PDF 產生失敗，請移除無法讀取或設有密碼的檔案後再試一次。";
  }
}

async function extractSelectedText() {
  if (!selectedPages.value.length) return;
  status.value = "loading";
  message.value = "正在擷取選取頁面的文字…";
  try {
    const grouped = groupPagesByFile(selectedPages.value);
    const textByFile = new Map();
    for (const [fileId, filePages] of grouped) {
      const item = items.value.find((candidate) => candidate.id === fileId);
      if (item) textByFile.set(fileId, await extractPdfTextPages(item.file, filePages.map((page) => page.pageIndex)));
    }
    extractedText.value = selectedPages.value.map((page, index) => {
      const pageText = textByFile.get(page.fileId)?.[page.pageIndex] || "";
      return `--- ${index + 1}. ${page.fileName}・第 ${page.sourcePageNumber} 頁 ---\n${pageText || "（此頁沒有可選取文字，掃描頁請改用文件解析 OCR。）"}`;
    }).join("\n\n");
    activeView.value = "text";
    status.value = "success";
    message.value = `已擷取 ${selectedPages.value.length} 頁文字。`;
  } catch {
    status.value = "error";
    message.value = "文字擷取失敗；掃描 PDF 請改用文件解析進行 OCR。";
  }
}

async function exportSelectedImages() {
  if (!selectedPages.value.length) return;
  status.value = "loading";
  message.value = "正在把選取頁面轉成 PNG…";
  try {
    const grouped = groupPagesByFile(selectedPages.value);
    const rendered = new Map();
    for (const [fileId, filePages] of grouped) {
      const item = items.value.find((candidate) => candidate.id === fileId);
      if (item) {
        const images = await renderPdfPagesAsPng(item.file, filePages.map((page) => ({
          id: page.id,
          pageIndex: page.pageIndex,
          rotation: page.rotation,
        })));
        images.forEach((image) => rendered.set(image.id, image.blob));
      }
    }
    selectedPages.value.forEach((page, index) => {
      const blob = rendered.get(page.id);
      if (blob) downloadBlob(blob, `${safeBaseName(page.fileName)}-第${page.sourcePageNumber}頁-${index + 1}.png`);
    });
    status.value = "success";
    message.value = `已匯出 ${selectedPages.value.length} 張 PNG 圖片。`;
  } catch {
    status.value = "error";
    message.value = "頁面圖片匯出失敗，請縮小選取範圍後重試。";
  }
}

async function copyExtractedText() {
  try {
    await navigator.clipboard.writeText(extractedText.value);
    status.value = "success";
    message.value = "文字已複製到剪貼簿。";
  } catch {
    status.value = "error";
    message.value = "無法自動複製，請在文字框內全選複製。";
  }
}

function downloadText() {
  downloadBlob(new Blob([extractedText.value], { type: "text/plain;charset=utf-8" }), `${safeBaseName(outputName.value)}.txt`);
}

function closePagePreview() {
  previewRequest += 1;
  previewPage.value = null;
  document.body.style.overflow = "";
}

async function openPagePreview(page) {
  const source = items.value.find((item) => item.id === page.fileId);
  if (!source || !page.thumbnail) return;
  const requestId = ++previewRequest;
  previewPage.value = { ...page, image: page.thumbnail, imageRotation: 0, fit: true, loading: true };
  document.body.style.overflow = "hidden";
  try {
    const image = await renderPdfPagePreview(source.file, page.pageIndex, page.rotation);
    if (previewRequest === requestId && previewPage.value) {
      previewPage.value = { ...previewPage.value, image, imageRotation: page.rotation, loading: false };
    }
  } catch (error) {
    console.error("PDF enlarged preview rendering failed", error);
    if (previewRequest === requestId && previewPage.value) previewPage.value.loading = false;
  }
}

async function rotatePreviewPage(amount) {
  if (!previewPage.value) return;
  const currentPreview = previewPage.value;
  const nextRotation = ((currentPreview.rotation + amount) % 360 + 360) % 360;
  const requestId = ++previewRequest;
  pages.value = pages.value.map((page) => page.id === currentPreview.id ? { ...page, rotation: nextRotation } : page);
  previewPage.value = { ...currentPreview, rotation: nextRotation, loading: true };
  resetResult();

  const source = items.value.find((item) => item.id === currentPreview.fileId);
  if (!source) return;
  try {
    const image = await renderPdfPagePreview(source.file, currentPreview.pageIndex, nextRotation);
    if (previewRequest === requestId && previewPage.value) {
      previewPage.value = { ...previewPage.value, image, imageRotation: nextRotation, loading: false };
    }
  } catch (error) {
    console.error("PDF enlarged preview rotation failed", error);
    if (previewRequest === requestId && previewPage.value) previewPage.value.loading = false;
  }
}

function showAdjacentPreview(offset) {
  const target = pages.value[previewPageIndex.value + offset];
  if (target) openPagePreview(target);
}

function handleKeydown(event) {
  if (event.key === "Escape" && previewPage.value) closePagePreview();
}

document.addEventListener("keydown", handleKeydown);
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.body.style.overflow = "";
});
</script>

<style scoped>
.pdf-editor-shell { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; }
.pdf-sidebar, .pdf-panel { border: 1px solid #dedede; border-radius: 10px; background: #fff; }
.pdf-sidebar { display: grid; gap: 16px; padding: 18px; position: sticky; top: 16px; }
.sidebar-heading { display: grid; gap: 3px; }
.sidebar-heading strong { font-size: 17px; font-weight: 900; }
.sidebar-heading small { color: #687078; font-size: 12px; line-height: 1.45; }
.pdf-drop-zone { display: grid; justify-items: center; gap: 7px; padding: 22px 12px; border: 1.5px dashed #c8c8c8; border-radius: 10px; background: #f7f7f7; text-align: center; cursor: pointer; transition: 150ms ease; }
.pdf-drop-zone:hover, .pdf-drop-zone.active { border-color: #3867d6; background: #f0f4ff; }
.pdf-drop-zone > strong { font-size: 14px; }
.pdf-drop-zone > span:not(.drop-icon) { color: #707780; font-size: 12px; line-height: 1.5; }
.pdf-drop-zone input { display: none; }
.drop-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: #222; color: #fff; font-size: 21px; }
.pdf-field { display: grid; gap: 7px; font-size: 13px; font-weight: 800; }
.pdf-field input { min-width: 0; padding: 10px 11px; border: 1px solid #cfcfcf; border-radius: 7px; background: #fff; }
.pdf-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.pdf-summary div { display: grid; gap: 2px; padding: 9px 4px; border-radius: 7px; background: #f2f2f2; text-align: center; }
.pdf-summary strong { font-size: 14px; }
.pdf-summary span { color: #707070; font-size: 10px; }
.primary-pdf-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 11px 14px; border: 0; border-radius: 8px; background: #222; color: #fff; font-weight: 900; cursor: pointer; }
.primary-pdf-button:disabled { opacity: .42; cursor: not-allowed; }
.spinning { display: inline-block; animation: pdf-spin .9s linear infinite; }
@keyframes pdf-spin { to { transform: rotate(360deg); } }
.pdf-message { padding: 10px 11px; border-radius: 7px; background: #f3f3f3; color: #4f4f4f; font-size: 12px; line-height: 1.5; }
.pdf-message.error { background: #fff0ee; color: #8c1d18; }
.pdf-message.success { background: #eef8f0; color: #246a36; }
.pdf-main { min-width: 0; }
.pdf-view-tabs { display: inline-flex; gap: 4px; margin-bottom: 10px; padding: 4px; border: 1px solid #d4d4d4; border-radius: 8px; background: #eee; }
.pdf-view-tabs button { padding: 8px 11px; border: 0; border-radius: 6px; background: transparent; color: #292929; font-size: 12px; font-weight: 800; cursor: pointer; }
.pdf-view-tabs button.active { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.pdf-panel { min-width: 0; padding: 16px; }
.pdf-panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.pdf-panel-header h2 { margin: 0 0 4px; font-size: 16px; }
.pdf-panel-header p { margin: 0; color: #707780; font-size: 12px; line-height: 1.45; }
.quiet-button, .header-actions button { flex: none; padding: 7px 9px; border: 1px solid #d2d2d2; border-radius: 7px; background: #fff; color: #555; font-size: 12px; cursor: pointer; }
.header-actions { display: inline-flex; gap: 6px; }
.pdf-file-list { display: grid; gap: 8px; }
.pdf-file-row { display: grid; grid-template-columns: 22px 28px 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 66px; padding: 9px 10px; border: 1px solid #d7d7d7; border-radius: 8px; background: #fff; }
.pdf-file-row.drag-over { border-color: #3867d6; background: #f2f6ff; }
.drag-handle { color: #888; cursor: grab; }
.order-number { color: #747474; font-size: 12px; font-weight: 800; text-align: center; }
.pdf-file-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 7px; background: #fff0ee; color: #b32922; font-size: 10px; font-weight: 950; }
.pdf-file-details { min-width: 0; display: grid; gap: 4px; }
.pdf-file-details strong, .pdf-file-details span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdf-file-details strong { font-size: 13px; }
.pdf-file-details span { color: #6f6f6f; font-size: 11px; }
.row-actions, .page-quick-actions { display: inline-flex; gap: 4px; }
.row-actions button, .page-quick-actions button { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid #d5d5d5; border-radius: 6px; background: #fff; color: #555; cursor: pointer; }
.row-actions button:disabled, .page-quick-actions button:disabled { opacity: .3; cursor: not-allowed; }
.page-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; padding: 9px; border-radius: 8px; background: #f3f3f3; }
.page-toolbar button, .preview-toolbar button { min-height: 32px; padding: 6px 8px; border: 1px solid #d0d0d0; border-radius: 6px; background: #fff; color: #333; font-size: 11px; font-weight: 800; cursor: pointer; }
.page-toolbar button.active, .preview-toolbar button.active { border-color: #3867d6; background: #edf2ff; }
.page-toolbar button:disabled, .preview-toolbar button:disabled { opacity: .38; cursor: not-allowed; }
.selection-count { color: #6f6f6f; font-size: 11px; padding: 0 4px; }
.page-toolbar i, .preview-toolbar i { width: 1px; height: 23px; background: #d0d0d0; }
.pdf-page-list { display: grid; gap: 12px; }
.pdf-page-card { position: relative; min-width: 0; display: grid; grid-template-columns: minmax(170px, 240px) minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 12px; border: 2px solid transparent; border-radius: 9px; background: #f1f1f1; transition: 120ms ease; cursor: grab; }
.pdf-page-card.selected { border-color: #4775dc; background: #f0f4ff; }
.pdf-page-card.drag-over { border-color: #3867d6; }
.page-select { position: absolute; z-index: 2; top: 14px; left: 14px; width: 28px; height: 28px; padding: 0; border: 1px solid rgba(0,0,0,.2); border-radius: 6px; background: rgba(255,255,255,.94); color: #fff; font-weight: 900; cursor: pointer; }
.page-select.selected { border-color: #3867d6; background: #3867d6; }
.page-position { position: absolute; z-index: 2; top: 14px; right: 14px; min-width: 25px; padding: 4px 6px; border-radius: 999px; background: rgba(25,25,25,.78); color: #fff; font-size: 10px; font-weight: 800; text-align: center; }
.thumbnail-stage { display: grid; place-items: center; width: 100%; height: 270px; padding: 0; overflow: hidden; border: 1px solid #d7d7d7; border-radius: 5px; background: #e9e9e9; cursor: zoom-in; }
.thumbnail-stage img { display: block; max-width: 90%; max-height: 90%; object-fit: contain; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.14); transition: transform 180ms ease; }
.thumbnail-stage:hover:not(:disabled), .thumbnail-stage:focus-visible { border-color: #3867d6; box-shadow: 0 0 0 2px rgba(56,103,214,.16); }
.thumbnail-loading { display: grid; justify-items: center; gap: 8px; color: #777; font-size: 11px; }
.thumbnail-loading b { font-size: 22px; }
.thumbnail-loading.error { color: #9b3934; }
.page-meta { min-width: 0; display: grid; gap: 3px; margin-top: 8px; }
.page-meta strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.page-meta span { color: #6e6e6e; font-size: 12px; }
.page-quick-actions { justify-content: flex-end; }
.pdf-empty-state, .pdf-text-empty { display: grid; justify-items: center; align-content: center; gap: 8px; min-height: 330px; border: 1px dashed #d2d2d2; border-radius: 9px; color: #707070; text-align: center; }
.empty-pdf-icon, .empty-symbol { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 4px; border-radius: 9px; background: #fff0ee; color: #bd3b34; font-size: 12px; font-weight: 950; }
.pdf-empty-state strong, .pdf-text-empty strong { color: #2a2a2a; font-size: 15px; }
.pdf-empty-state > span:not(.empty-pdf-icon), .pdf-text-empty > span:not(.empty-symbol) { max-width: 310px; font-size: 12px; line-height: 1.6; }
.pdf-empty-state button, .pdf-text-empty button { margin-top: 5px; padding: 8px 13px; border: 1px solid #ccc; border-radius: 7px; background: #fff; color: #2a2a2a; font-weight: 800; cursor: pointer; }
.pdf-text-output { width: 100%; min-height: 470px; resize: vertical; padding: 14px; border: 1px solid #d1d1d1; border-radius: 8px; background: #fff; color: #222; font: 13px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pdf-text-empty { min-height: 400px; border: 0; }
.empty-symbol { border-radius: 50%; background: #f2f2f2; color: #555; font-size: 20px; }
.preview-backdrop { position: fixed; z-index: 10000; inset: 0; display: grid; place-items: center; padding: 8px; background: rgba(12,14,18,.78); backdrop-filter: blur(3px); }
.preview-dialog { display: grid; grid-template-rows: auto auto minmax(0, 1fr); width: min(1600px, calc(100vw - 16px)); height: min(1100px, calc(100dvh - 16px)); overflow: hidden; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; background: #f8f8f8; box-shadow: 0 22px 70px rgba(0,0,0,.42); }
.preview-dialog > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 13px; border-bottom: 1px solid #d5d5d5; }
.preview-dialog > header div { min-width: 0; display: grid; gap: 2px; }
.preview-dialog > header strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.preview-dialog > header span { color: #6e6e6e; font-size: 11px; }
.preview-dialog > header button { width: 34px; height: 34px; border: 1px solid #d0d0d0; border-radius: 7px; background: #eee; font-size: 18px; cursor: pointer; }
.preview-toolbar { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; padding: 7px 10px; border-bottom: 1px solid #d5d5d5; background: #f0f0f0; }
.preview-toolbar > span { min-width: 46px; color: #666; font-size: 12px; font-weight: 800; text-align: center; }
.preview-canvas { position: relative; display: grid; place-items: center; min-height: 0; overflow: auto; padding: 10px; background: #3d4249; }
.preview-canvas img { display: block; width: auto; height: auto; max-width: none; max-height: none; object-fit: contain; background: #fff; box-shadow: 0 4px 22px rgba(0,0,0,.32); transition: transform 160ms ease; }
.preview-canvas img.fit { max-width: 100%; max-height: 100%; }
.preview-loading { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 999px; background: rgba(20,20,20,.82); color: #fff; font-size: 11px; white-space: nowrap; }
@media (max-width: 900px) {
  .pdf-editor-shell { grid-template-columns: 1fr; }
  .pdf-sidebar { position: static; }
}
@media (max-width: 620px) {
  .pdf-file-row { grid-template-columns: 20px 24px 32px minmax(0, 1fr); }
  .row-actions { grid-column: 2 / -1; justify-content: flex-end; }
  .pdf-page-card { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
  .thumbnail-stage { grid-column: 1 / -1; height: 320px; }
  .page-toolbar i, .preview-toolbar i { display: none; }
  .pdf-panel-header { align-items: stretch; flex-direction: column; }
}
</style>
