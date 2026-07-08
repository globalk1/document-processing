<template>
  <section class="feature-workspace">
    <aside class="control-panel">
      <h2 class="section-title">筆跡去除</h2>
      <div
        class="drop-zone"
        :class="{ over: dragOver }"
        @click="fileInput?.click()"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="handleDrop"
      >
        <div class="file-icon">消</div>
        <strong>{{ file ? file.name : "選擇或拖拉 PDF、圖片" }}</strong>
        <span>{{ file ? `${Math.ceil(file.size / 1024)} KB` : "選好後自動預覽，輸出固定 PDF" }}</span>
        <input
          ref="fileInput"
          hidden
          type="file"
          accept="application/pdf,image/*"
          @change="handleFileChange"
        />
      </div>

      <label class="field-label">
        遮罩強度
        <input v-model.number="strength" class="range-input" min="1" max="5" type="range" />
      </label>
      <div class="segmented-row" aria-label="遮罩強度">
        <button
          v-for="value in [1, 2, 3, 4, 5]"
          :key="value"
          class="segment-button"
          :class="{ active: strength === value }"
          type="button"
          @click="strength = value"
        >
          {{ value }}
        </button>
      </div>

      <button
        class="primary-button full"
        :disabled="status === 'loading' || !maskConfirmed"
        type="button"
        @click="removeMarks"
      >
        {{ status === "loading" ? "處理中" : "匯出 PDF" }}
      </button>

      <p v-if="message" class="message" :class="status">{{ message }}</p>
    </aside>

    <section class="output-panel">
      <div class="panel-header">
        <div class="preview-title-group">
          <h2 class="section-title">預覽</h2>
          <span v-if="manualRegions.length" class="manual-count remove">清除 {{ manualRegions.length }}</span>
          <span v-if="pendingManualRegions.length" class="manual-count pending">待清除 {{ pendingManualRegions.length }}</span>
          <span v-if="pendingRestoreRegions.length" class="manual-count restore">待恢復 {{ pendingRestoreRegions.length }}</span>
        </div>
        <div class="icon-group">
          <button
            v-if="manualMarkCount"
            class="icon-button"
            title="復原最後框選"
            type="button"
            @click="undoManualRegion"
          >
            ↶
          </button>
          <button
            v-if="manualMarkCount"
            class="icon-button"
            title="清除全部框選"
            type="button"
            @click="clearManualRegions"
          >
            ×
          </button>
          <button
            v-if="downloadResult"
            class="icon-button"
            title="下載清理後 PDF"
            type="button"
            @click="downloadBlob(downloadResult.blob, downloadResult.filename)"
          >
            ↓
          </button>
        </div>
      </div>

      <div v-if="previewPages.length" class="preview-toolbar">
        <div class="view-mode-group">
          <button :class="{ active: previewLayer === 'original' }" type="button" @click="previewLayer = 'original'">原圖</button>
          <button :class="{ active: previewLayer === 'mask' }" type="button" @click="previewLayer = 'mask'">遮罩</button>
          <button :class="{ active: previewLayer === 'cleaned' }" type="button" @click="previewLayer = 'cleaned'">清理預覽</button>
        </div>
        <div class="manual-tool-group">
          <button
            class="confirm-mask-button"
            :class="{ active: maskConfirmed }"
            :disabled="!canConfirmMask"
            type="button"
            @click="confirmMask"
          >
            {{ maskConfirmed ? "已清除預覽" : "確認清除" }}
          </button>
          <button
            class="manual-toggle-button erase"
            :class="{ active: manualToolActive && manualToolMode === 'erase' }"
            type="button"
            @click="toggleManualTool('erase')"
          >
            框選清除
          </button>
          <button
            class="manual-toggle-button restore"
            :class="{ active: manualToolActive && manualToolMode === 'restore' }"
            type="button"
            @click="toggleManualTool('restore')"
          >
            框選恢復
          </button>
        </div>
      </div>

      <div v-if="file || previewMessage" class="preview-status-bar" :class="previewStatus">
        <span>{{ previewMessage || "等待預覽" }}</span>
        <div v-if="previewPages.length" class="preview-stats">
          <span>考卷自動</span>
          <span>強度 {{ strength }}</span>
          <span>{{ maskConfirmationLabel }}</span>
          <span>遮罩 {{ (averageMaskRatio * 100).toFixed(2) }}%</span>
        </div>
      </div>

      <div v-if="pendingManualRegions.length" class="selection-actions">
        <span>已框選 {{ pendingManualRegions.length }} 個區域</span>
        <button class="secondary-button" type="button" @click="applyPendingRemovalRegion">清除</button>
        <button class="secondary-button" type="button" @click="cancelPendingRegion">取消</button>
      </div>

      <div v-if="pendingRestoreRegions.length" class="selection-actions restore">
        <span>已框選 {{ pendingRestoreRegions.length }} 個恢復區域</span>
        <button class="secondary-button" type="button" @click="applyPendingRestoreRegion">恢復原圖</button>
        <button class="secondary-button" type="button" @click="cancelPendingRegion">取消</button>
      </div>

      <div v-if="previewPages.length" class="preview-list">
        <article v-for="page in previewPages" :key="page.page" class="preview-page-card">
          <header>
            <strong>第 {{ page.page }} 頁</strong>
            <span>遮罩 {{ (Number(page.mask_ratio || 0) * 100).toFixed(2) }}%</span>
          </header>
          <div
            class="preview-canvas"
            :class="{ manual: manualToolActive, restore: manualToolMode === 'restore' }"
            @pointerdown="handleManualRegionStart(page.page, $event)"
            @pointermove="handleManualRegionMove"
            @pointerup="handleManualRegionEnd"
            @pointercancel="handleManualRegionEnd"
          >
            <img
              class="preview-image"
              :src="previewLayer === 'cleaned' ? page.cleaned_image : page.image"
              :alt="`第 ${page.page} 頁預覽`"
              draggable="false"
            />
            <img
              v-if="previewLayer === 'mask'"
              class="preview-mask"
              :src="page.mask_overlay"
              alt=""
              draggable="false"
            />
            <span
              v-for="(region, index) in regionsForPage(manualRegions, page.page)"
              :key="`remove-${page.page}-${index}`"
              class="manual-region-box remove"
              :style="regionToStyle(region)"
            ></span>
            <span
              v-for="(region, index) in regionsForPage(pendingManualRegions, page.page)"
              :key="`pending-${page.page}-${index}`"
              class="manual-region-box pending"
              :style="regionToStyle(region)"
            ></span>
            <span
              v-for="(region, index) in regionsForPage(pendingRestoreRegions, page.page)"
              :key="`restore-${page.page}-${index}`"
              class="manual-region-box restore"
              :style="regionToStyle(region)"
            ></span>
            <span
              v-if="activeRegionForPage(page.page)"
              class="manual-region-box pending"
              :class="{ restore: manualToolMode === 'restore' }"
              :style="regionToStyle(activeRegionForPage(page.page))"
            ></span>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <strong>{{ previewStatus === "loading" ? "正在產生預覽..." : "尚未產生預覽" }}</strong>
        <span>{{ file ? "預覽完成後可框選手動清除或恢復。" : "請先選擇要清理的檔案。" }}</span>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { previewHandwriting, removeHandwriting } from "../services/api";

const clampUnit = (value) => Math.max(0, Math.min(1, value));

const fileInput = ref(null);
const file = ref(null);
const dragOver = ref(false);
const strength = ref(3);
const status = ref("idle");
const message = ref("");
const previewStatus = ref("idle");
const previewMessage = ref("");
const previewPages = ref([]);
const previewSignature = ref("");
const confirmedSignature = ref("");
const previewLayer = ref("original");
const manualRegions = ref([]);
const manualActionStack = ref([]);
const pendingManualRegions = ref([]);
const pendingRestoreRegions = ref([]);
const drawingRegion = ref(null);
const manualToolActive = ref(false);
const manualToolMode = ref("erase");
const downloadResult = ref(null);
let previewRequestId = 0;

const manualRegionsSignature = computed(() => JSON.stringify(manualRegions.value));
const currentSignature = computed(() =>
  JSON.stringify({
    file: file.value
      ? [file.value.name, file.value.size, file.value.lastModified || 0].join(":")
      : "",
    strength: strength.value,
    manualRegions: manualRegionsSignature.value,
  }),
);
const manualMarkCount = computed(
  () =>
    manualRegions.value.length +
    pendingManualRegions.value.length +
    pendingRestoreRegions.value.length,
);
const hasPendingManualSelection = computed(
  () =>
    pendingManualRegions.value.length > 0 ||
    pendingRestoreRegions.value.length > 0 ||
    Boolean(drawingRegion.value),
);
const canConfirmMask = computed(
  () =>
    previewStatus.value === "success" &&
    previewPages.value.length > 0 &&
    previewSignature.value === currentSignature.value &&
    !hasPendingManualSelection.value,
);
const maskConfirmed = computed(
  () => canConfirmMask.value && confirmedSignature.value === currentSignature.value,
);
const maskConfirmationLabel = computed(() => {
  if (maskConfirmed.value) return "已清除預覽";
  if (hasPendingManualSelection.value) return "框選未套用";
  if (canConfirmMask.value) return "待確認清除";
  return "更新中";
});
const averageMaskRatio = computed(() => {
  if (!previewPages.value.length) return 0;
  return (
    previewPages.value.reduce((sum, page) => sum + Number(page.mask_ratio || 0), 0) /
    previewPages.value.length
  );
});

watch([file, strength, manualRegionsSignature], () => {
  schedulePreview();
});

function handleFile(selectedFile) {
  if (!selectedFile) return;
  file.value = selectedFile;
  previewLayer.value = "original";
  status.value = "idle";
  message.value = "";
  previewStatus.value = "idle";
  previewMessage.value = "";
  previewPages.value = [];
  previewSignature.value = "";
  confirmedSignature.value = "";
  manualRegions.value = [];
  manualActionStack.value = [];
  pendingManualRegions.value = [];
  pendingRestoreRegions.value = [];
  drawingRegion.value = null;
  manualToolActive.value = false;
  downloadResult.value = null;
}

function handleFileChange(event) {
  handleFile(event.target.files?.[0]);
}

function handleDrop(event) {
  dragOver.value = false;
  handleFile(event.dataTransfer.files?.[0]);
}

function schedulePreview() {
  if (!file.value) return;
  const requestId = previewRequestId + 1;
  previewRequestId = requestId;
  const signature = currentSignature.value;
  const manualSnapshot = JSON.parse(manualRegionsSignature.value);
  const delay = previewPages.value.length ? 650 : 120;

  previewSignature.value = "";
  previewStatus.value = "loading";
  previewMessage.value = previewPages.value.length ? "設定已變更，稍後更新預覽..." : "正在產生預覽...";

  window.setTimeout(async () => {
    if (previewRequestId !== requestId) return;
    const result = await previewHandwriting({
      file: file.value,
      colorMode: "exam_auto",
      strength: strength.value,
      manualRegions: manualSnapshot,
      maxPages: 20,
    });
    if (previewRequestId !== requestId) return;

    if (result.success) {
      previewPages.value = result.pages || [];
      previewSignature.value = signature;
      previewStatus.value = "success";
      previewMessage.value = `已產生 ${result.pages?.length || 0} 頁預覽。`;
      return;
    }

    previewSignature.value = "";
    previewStatus.value = "error";
    previewMessage.value = result.error || "筆跡預覽失敗。";
  }, delay);
}

async function removeMarks() {
  if (!file.value) {
    status.value = "error";
    message.value = "請先選擇 PDF 或圖片檔案。";
    return;
  }
  if (!maskConfirmed.value) {
    status.value = "error";
    message.value = "請先按「確認清除」產生清理預覽，再匯出 PDF。";
    return;
  }

  status.value = "loading";
  message.value = "正在去除筆跡並產生 PDF...";
  downloadResult.value = null;
  const result = await removeHandwriting({
    file: file.value,
    colorMode: "exam_auto",
    outputFormat: "pdf",
    strength: strength.value,
    manualRegions: manualRegions.value,
  });

  if (!result.success) {
    status.value = "error";
    message.value = result.error || "筆跡去除失敗。";
    return;
  }

  downloadResult.value = {
    blob: result.blob,
    filename: result.filename || "cleaned-document.pdf",
  };
  downloadBlob(downloadResult.value.blob, downloadResult.value.filename);
  status.value = "success";
  message.value = "筆跡去除完成，已開始下載。";
}

function confirmMask() {
  if (!canConfirmMask.value) {
    previewMessage.value = hasPendingManualSelection.value
      ? "請先套用或取消框選，再確認清除。"
      : "遮罩預覽完成後才能確認清除。";
    return;
  }
  confirmedSignature.value = currentSignature.value;
  previewLayer.value = "cleaned";
  status.value = "idle";
  message.value = "";
  previewStatus.value = "success";
  previewMessage.value = "已套用清除預覽，可檢查後匯出 PDF。";
}

function toggleManualTool(toolMode) {
  manualToolActive.value =
    manualToolMode.value === toolMode ? !manualToolActive.value : true;
  manualToolMode.value = toolMode;
  pendingManualRegions.value = [];
  pendingRestoreRegions.value = [];
  drawingRegion.value = null;
}

function getPreviewPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - rect.left) / rect.width),
    y: clampUnit((event.clientY - rect.top) / rect.height),
  };
}

function handleManualRegionStart(pageNumber, event) {
  if (!manualToolActive.value) return;
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  const point = getPreviewPointer(event);
  drawingRegion.value = {
    page: pageNumber,
    startX: point.x,
    startY: point.y,
    currentX: point.x,
    currentY: point.y,
  };
}

function handleManualRegionMove(event) {
  if (!drawingRegion.value) return;
  event.preventDefault();
  const point = getPreviewPointer(event);
  drawingRegion.value = {
    ...drawingRegion.value,
    currentX: point.x,
    currentY: point.y,
  };
}

function handleManualRegionEnd(event) {
  if (!drawingRegion.value) return;
  event.preventDefault();
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  const normalized = normalizeDraftRegion(drawingRegion.value);
  drawingRegion.value = null;
  if (!normalized || normalized.width < 0.006 || normalized.height < 0.006) return;

  const isRestore = manualToolMode.value === "restore";
  if (isRestore) {
    pendingRestoreRegions.value = [...pendingRestoreRegions.value, normalized];
  } else {
    pendingManualRegions.value = [...pendingManualRegions.value, normalized];
  }
  previewStatus.value = "idle";
  previewMessage.value = `已框選 ${
    isRestore ? pendingRestoreRegions.value.length : pendingManualRegions.value.length
  } 個區域，可繼續框選或按${isRestore ? "恢復原圖" : "清除"}。`;
}

function applyPendingRemovalRegion() {
  if (!pendingManualRegions.value.length) return;
  const count = pendingManualRegions.value.length;
  manualRegions.value = [...manualRegions.value, ...pendingManualRegions.value];
  manualActionStack.value = [...manualActionStack.value, { type: "remove", count }];
  previewLayer.value = "original";
  manualToolActive.value = false;
  pendingManualRegions.value = [];
  downloadResult.value = null;
  status.value = "idle";
  message.value = "";
  previewMessage.value = `已清除 ${count} 個框選區域，匯出 PDF 時會一併套用。`;
}

function applyPendingRestoreRegion() {
  if (!pendingRestoreRegions.value.length) return;
  const beforeRegions = manualRegions.value;
  const count = pendingRestoreRegions.value.length;
  manualRegions.value = subtractRegions(manualRegions.value, pendingRestoreRegions.value);
  manualActionStack.value = [...manualActionStack.value, { type: "restore", beforeRegions }];
  previewLayer.value = "original";
  manualToolActive.value = false;
  pendingRestoreRegions.value = [];
  downloadResult.value = null;
  status.value = "idle";
  message.value = "";
  previewMessage.value = `已恢復 ${count} 個框選區域，匯出 PDF 時會保留原圖。`;
}

function cancelPendingRegion() {
  pendingManualRegions.value = [];
  pendingRestoreRegions.value = [];
  previewMessage.value = "";
}

function undoManualRegion() {
  if (pendingRestoreRegions.value.length) {
    pendingRestoreRegions.value = pendingRestoreRegions.value.slice(0, -1);
    return;
  }
  if (pendingManualRegions.value.length) {
    pendingManualRegions.value = pendingManualRegions.value.slice(0, -1);
    return;
  }

  const lastAction = manualActionStack.value[manualActionStack.value.length - 1];
  if (!lastAction) return;
  manualActionStack.value = manualActionStack.value.slice(0, -1);
  downloadResult.value = null;
  status.value = "idle";
  message.value = "";
  if (lastAction.type === "restore") {
    manualRegions.value = lastAction.beforeRegions || [];
    previewMessage.value = "已復原最後一次恢復原圖。";
    return;
  }

  const count = lastAction.count || 1;
  manualRegions.value = manualRegions.value.slice(0, Math.max(0, manualRegions.value.length - count));
  previewMessage.value = `已復原最後 ${count} 個清除區域，稍後更新預覽。`;
}

function clearManualRegions() {
  manualRegions.value = [];
  manualActionStack.value = [];
  pendingManualRegions.value = [];
  pendingRestoreRegions.value = [];
  downloadResult.value = null;
  status.value = "idle";
  message.value = "";
  previewMessage.value = "已清除所有手動標記。";
}

function regionsForPage(regions, pageNumber) {
  return regions.filter((region) => region.page === pageNumber);
}

function activeRegionForPage(pageNumber) {
  if (drawingRegion.value?.page !== pageNumber) return null;
  return normalizeDraftRegion(drawingRegion.value);
}

function normalizeDraftRegion(region) {
  if (!region) return null;
  const x = Math.min(region.startX, region.currentX);
  const y = Math.min(region.startY, region.currentY);
  const width = Math.abs(region.currentX - region.startX);
  const height = Math.abs(region.currentY - region.startY);
  return { page: region.page, x, y, width, height };
}

function regionToStyle(region) {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
  };
}

function regionsOverlap(first, second) {
  if (first.page !== second.page) return false;
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

function subtractRegion(region, restoreRegion) {
  if (!regionsOverlap(region, restoreRegion)) return [region];

  const x1 = region.x;
  const y1 = region.y;
  const x2 = region.x + region.width;
  const y2 = region.y + region.height;
  const rx1 = Math.max(x1, restoreRegion.x);
  const ry1 = Math.max(y1, restoreRegion.y);
  const rx2 = Math.min(x2, restoreRegion.x + restoreRegion.width);
  const ry2 = Math.min(y2, restoreRegion.y + restoreRegion.height);
  return [
    { page: region.page, x: x1, y: y1, width: rx1 - x1, height: region.height },
    { page: region.page, x: rx2, y: y1, width: x2 - rx2, height: region.height },
    { page: region.page, x: rx1, y: y1, width: rx2 - rx1, height: ry1 - y1 },
    { page: region.page, x: rx1, y: ry2, width: rx2 - rx1, height: y2 - ry2 },
  ].filter((piece) => piece.width > 0.003 && piece.height > 0.003);
}

function subtractRegions(regions, restoreRegions) {
  return restoreRegions.reduce(
    (currentRegions, restoreRegion) =>
      currentRegions.flatMap((region) => subtractRegion(region, restoreRegion)),
    regions,
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
</script>
