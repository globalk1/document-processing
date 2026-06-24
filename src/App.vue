<template>
  <main class="page-shell">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育-教務部內部使用</div>
        <h1>文件解析與錯字檢查</h1>
      </div>
      <div class="header-actions">
        <span class="app-version">v{{ APP_VERSION }}</span>
        <span class="status-pill" :class="status">{{
          selectedMode.title
        }}</span>
      </div>
    </header>

    <section class="workspace">
      <aside class="control-panel">
        <h2 class="section-title">模式</h2>
        <div class="mode-grid">
          <button
            v-for="item in modes"
            :key="item.value"
            class="mode-button"
            :class="{ active: mode === item.value, disabled: item.disabled }"
            :disabled="item.disabled"
            type="button"
            @click="!item.disabled && (mode = item.value)"
          >
            <span class="mode-icon">{{ item.icon }}</span>
            <span>
              {{ item.title }}
              <small v-if="item.disabled" class="disabled-label">暫停使用</small>
            </span>
            <small>{{ item.description }}</small>
          </button>
        </div>

        <h2 class="section-title">檔案</h2>
        <div
          class="drop-zone"
          :class="{ over: dragOver }"
          @click="fileInput?.click()"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="handleDrop"
        >
          <div class="file-icon">▣</div>
          <strong>{{ file ? file.name : "選擇或拖拉 PDF、圖片、Word、TXT" }}</strong>
          <span>{{
            file ? `${Math.ceil(file.size / 1024)} KB` : "PDF、JPG、PNG、WEBP、DOCX、TXT"
          }}</span>
          <input
            ref="fileInput"
            hidden
            type="file"
            accept="application/pdf,image/*,.docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            @change="handleFileChange"
          />
        </div>

        <button
          class="primary-button full"
          :disabled="status === 'loading'"
          type="button"
          @click="handleSelectedMode"
        >
          {{ status === "loading" ? selectedMode.loadingTitle : selectedMode.actionTitle }}
        </button>

        <p class="quota-note">
          今日 AI 請求：已用 {{ aiQuota.used }} / {{ aiQuota.limit }}，
          剩餘 {{ aiQuota.remaining }} 次
        </p>
        <p v-if="message" class="message" :class="status">{{ message }}</p>
        <div v-if="diagnostics" class="diagnostics">
          <strong>後端解析診斷</strong>
          <span>頁數：{{ diagnostics.page_count ?? 0 }}</span>
          <span v-for="page in diagnostics.pages" :key="page.page"
            >Page {{ page.page }}: {{ page.char_count }} chars</span
          >
        </div>
      </aside>

      <section class="output-panel">
        <div class="panel-header">
          <h2 class="section-title">文件文字</h2>
          <div class="icon-group">
            <button
              class="icon-button"
              title="放大解析文字"
              type="button"
              @click="text.trim() && openEditor('text')"
            >
              ⤢
            </button>
            <button
              class="icon-button"
              title="複製解析文字"
              type="button"
              @click="copyText(text)"
            >
              ⧉
            </button>
          </div>
        </div>
        <div
          class="hover-editor-trigger"
          @mouseenter="text.trim() && openEditor('text')"
        >
          <textarea
            v-model="text"
            class="textarea"
            placeholder="解析後的文字會出現在這裡。"
          ></textarea>
        </div>

        <section v-if="proofreadResult" class="proofread-result-panel">
          <div class="proofread-result-header">
            <div>
              <h2 class="section-title">錯字檢查結果</h2>
              <div class="result-meta">
                {{ proofreadResult.engine === "local" ? "數學快速檢查" : "AI 不分科檢查" }}・共
                {{ proofreadResult.summary?.issue_count ?? proofreadResult.issues?.length ?? 0 }} 處
              </div>
            </div>
            <button class="secondary-button" type="button" @click="copyText(proofreadResult.corrected_text)">
              複製修正文
            </button>
          </div>
          <div v-if="proofreadResult.issues?.length" class="issue-list">
            <div
              v-for="(issue, index) in proofreadResult.issues"
              :key="`${issue.start}-${issue.end}-${index}`"
              class="issue-card"
            >
              <div class="issue-line">
                <del>{{ issue.original }}</del>
                <span>→</span>
                <strong>{{ issue.suggestion }}</strong>
                <span class="position-tag">位置 {{ issue.start }}–{{ issue.end }}</span>
              </div>
              <small>{{ issue.reason || "建議修正" }}</small>
            </div>
          </div>
          <div v-else class="no-issues">沒有發現明確錯字。</div>
          <textarea class="textarea corrected-textarea" readonly :value="proofreadResult.corrected_text"></textarea>
        </section>

        <div class="draft-actions">
          <div class="draft-button-group">
            <button
              class="primary-inline-button"
              :disabled="aiStatus === 'loading'"
              type="button"
              @click="handleBuildSolution"
            >
              {{ aiStatus === "loading" ? "生成中" : "AI 寫詳解" }}
            </button>
            <button
              class="secondary-button"
              type="button"
              @click="solutionDraft = ''"
            >
              清空詳解
            </button>
          </div>
          <div class="icon-group">
            <button
              class="icon-button"
              title="編輯詳解內容"
              type="button"
              @click="solutionDraft.trim() && openEditor('solution')"
            >
              ⤢
            </button>
            <button
              class="icon-button"
              title="複製全部詳解"
              type="button"
              @click="copyText(solutionDraft)"
            >
              ⧉
            </button>
          </div>
        </div>

        <SolutionReview
          :value="solutionDraft"
          @edit="solutionDraft.trim() && openEditor('solution')"
          @copy="copyText"
        />
      </section>
    </section>

    <ExpandedEditorModal
      :editor="editorConfig"
      @close="expandedEditor = null"
      @copy="copyText"
    />
    <div v-if="copyMessage" class="copy-toast">{{ copyMessage }}</div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import ExpandedEditorModal from "./components/ExpandedEditorModal.vue";
import SolutionReview from "./components/SolutionReview.vue";
import { extractPdfText, processAiText, proofreadDocument } from "./services/api";
import {
  extractAccuratePdfInPages,
  isPdfFile,
  validatePdfPageLimit,
} from "./services/pdfBatchExtraction";
import { getDailyAiRequestQuota } from "./services/dailyRequestQuota";
import {
  APP_VERSION,
  showReleaseAnnouncementIfNeeded,
} from "./services/releaseAnnouncement";

const modes = [
  {
    value: "fast",
    icon: "PDF",
    title: "快速文字解析",
    description: "僅讀取有文字層的 PDF，不使用 OCR。",
    actionTitle: "開始快速解析",
    loadingTitle: "解析中",
  },
  {
    value: "accurate",
    icon: "AI",
    title: "OpenAI 精準解析",
    description: "用 OCR 處理掃描 PDF、圖片與一般文件。",
    actionTitle: "開始精準解析",
    loadingTitle: "OCR 解析中",
  },
  {
    value: "local-proofread",
    icon: "⚡",
    title: "數學快速檢查",
    description: "免費內建數學詞庫，不使用 AI。",
    actionTitle: "開始數學快速檢查",
    loadingTitle: "檢查中",
    disabled: true,
  },
  {
    value: "ai-proofread",
    icon: "AI",
    title: "AI 不分科檢查",
    description: "依上下文檢查各類文件錯字。",
    actionTitle: "開始 AI 不分科檢查",
    loadingTitle: "AI 檢查中",
    disabled: true,
  },
];

const fileInput = ref(null);
const file = ref(null);
const mode = ref("fast");
const text = ref("");
const solutionDraft = ref("");
const status = ref("idle");
const aiStatus = ref("idle");
const message = ref("");
const diagnostics = ref(null);
const dragOver = ref(false);
const expandedEditor = ref(null);
const copyMessage = ref("");
const aiQuota = ref(getDailyAiRequestQuota());
const proofreadResult = ref(null);

const selectedMode = computed(
  () => modes.find((item) => item.value === mode.value) || modes[0],
);
const editorConfig = computed(() => {
  if (expandedEditor.value === "text") {
    return {
      title: "解析文字",
      value: text.value,
      onChange: (value) => {
        text.value = value;
      },
    };
  }
  if (expandedEditor.value === "solution") {
    return {
      title: "詳解內容",
      value: solutionDraft.value,
      onChange: (value) => {
        solutionDraft.value = value;
      },
    };
  }
  return null;
});

function syncAiQuota() {
  aiQuota.value = getDailyAiRequestQuota();
}

onMounted(() => {
  window.addEventListener("document-processing-quota-change", syncAiQuota);
  window.addEventListener("storage", syncAiQuota);
  showReleaseAnnouncementIfNeeded();
});

onBeforeUnmount(() => {
  window.removeEventListener("document-processing-quota-change", syncAiQuota);
  window.removeEventListener("storage", syncAiQuota);
});

function handleFile(selectedFile) {
  if (!selectedFile) return;
  file.value = selectedFile;
  text.value = "";
  solutionDraft.value = "";
  message.value = "";
  diagnostics.value = null;
  status.value = "idle";
  proofreadResult.value = null;
}

function isProofreadFile(selectedFile) {
  return /\.(docx|txt)$/i.test(selectedFile?.name || "");
}

async function handleProofread(engine) {
  if (!file.value) {
    status.value = "error";
    message.value = "請先選擇 Word 或 TXT 檔案。";
    return;
  }
  if (!isProofreadFile(file.value)) {
    status.value = "error";
    message.value = "錯字檢查目前只支援 DOCX 或 TXT 檔案。";
    return;
  }

  status.value = "loading";
  message.value = engine === "ai" ? "AI 正在進行不分科檢查..." : "正在進行數學快速檢查...";
  const result = await proofreadDocument({ file: file.value, engine });

  if (result.success) {
    proofreadResult.value = result;
    text.value = result.original_text || "";
    status.value = "success";
    message.value = `檢查完成，共找到 ${result.summary?.issue_count ?? result.issues?.length ?? 0} 處。`;
  } else {
    status.value = "error";
    message.value = result.error || "錯字檢查失敗，請稍後再試。";
  }
}

function handleFileChange(event) {
  handleFile(event.target.files?.[0]);
}

function handleDrop(event) {
  dragOver.value = false;
  handleFile(event.dataTransfer.files?.[0]);
}

async function handleExtract() {
  if (!file.value) {
    status.value = "error";
    message.value = "請先選擇 PDF 或圖片檔案。";
    return;
  }

  status.value = "loading";
  message.value = "";
  diagnostics.value = null;

  if (isPdfFile(file.value)) {
    message.value = "正在檢查 PDF 頁數...";
    const pageValidation = await validatePdfPageLimit(file.value);
    if (!pageValidation.success) {
      status.value = "error";
      message.value = pageValidation.error;
      return;
    }
  }

  const result =
    mode.value === "accurate" && isPdfFile(file.value)
      ? await extractAccuratePdfInPages({
          file: file.value,
          requestExtract: (pageFile, pageMode) =>
            extractPdfText({ file: pageFile, mode: pageMode }),
          onProgress: (value) => {
            message.value = value;
          },
          onPartialText: (value) => {
            text.value = value;
          },
        })
      : await extractPdfText({ file: file.value, mode: mode.value });
  if (result.success && result.text?.trim()) {
    text.value = result.text || "";
    status.value = "success";
    message.value = "解析完成。";
    return;
  }

  status.value = "error";
  diagnostics.value = result.diagnostics || null;
  message.value =
    result.error || "沒有抽到文字。這份檔案可能需要 OCR / AI 精準模式。";
}

function handleSelectedMode() {
  if (mode.value === "local-proofread") {
    handleProofread("local");
    return;
  }
  if (mode.value === "ai-proofread") {
    handleProofread("ai");
    return;
  }
  handleExtract();
}

async function handleBuildSolution() {
  if (!text.value.trim()) {
    aiStatus.value = "error";
    status.value = "error";
    message.value = "請先輸入或解析題目文字，再產生詳解。";
    return;
  }

  aiStatus.value = "loading";
  message.value = "正在產生詳解...";

  const result = await processAiText({ text: text.value.trim() });
  if (result.success && result.text?.trim()) {
    solutionDraft.value = result.text || "";
    aiStatus.value = "success";
    status.value = "success";
    message.value = "詳解生成完成。";
    return;
  }

  aiStatus.value = "error";
  status.value = "error";
  message.value = result.error || "詳解生成失敗，請稍後再試。";
  if (result.status === 401 || result.status === 403) {
    window.alert("AI 詳解後端尚未開通。");
  }
}

function openEditor(kind) {
  expandedEditor.value = kind;
}

async function copyText(value) {
  if (!value) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    showCopyMessage("已複製");
  } catch {
    showCopyMessage("複製失敗");
  }
}

function showCopyMessage(value) {
  copyMessage.value = value;
  window.setTimeout(() => {
    copyMessage.value = "";
  }, 1400);
}
</script>
