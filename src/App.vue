<template>
  <main class="page-shell">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育-教務部內部使用</div>
        <h1>文件解析與 Word 排版</h1>
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
            :class="{ active: mode === item.value }"
            type="button"
            @click="switchMode(item.value)"
          >
            <span class="mode-icon">{{ item.icon }}</span>
            <span>{{ item.title }}</span>
            <small>{{ item.description }}</small>
          </button>
        </div>

        <section v-if="isWordMode" class="template-panel">
          <div v-if="wordGenerationMaintenance" class="maintenance-notice">
            {{ WORD_GENERATION_MAINTENANCE_NOTICE }}
          </div>

          <label class="field-label" for="word-template">輸出模板</label>
          <select
            id="word-template"
            v-model="selectedWordTemplateId"
            class="select-input"
            :disabled="templatesLoading"
          >
            <option
              v-for="template in wordTemplates"
              :key="template.id"
              :value="template.id"
            >
              {{ template.name }}
            </option>
          </select>
          <p class="template-description">
            {{
              templatesLoading
                ? "正在取得模板..."
                : selectedWordTemplate.description
            }}
          </p>

          <label class="field-label" for="word-output-filename">下載檔名</label>
          <input
            id="word-output-filename"
            v-model="wordOutputFilename"
            class="text-input"
            type="text"
            placeholder="questions-排版.docx"
          />
        </section>

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
          <strong>{{ file ? file.name : "選擇或拖拉 PDF、圖片、Word" }}</strong>
          <span>{{
            file
              ? `${Math.ceil(file.size / 1024)} KB`
              : "PDF、JPG、PNG、WEBP、DOCX"
          }}</span>
          <input
            ref="fileInput"
            hidden
            type="file"
            accept="application/pdf,image/*,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            @change="handleFileChange"
          />
        </div>

        <button
          class="primary-button full"
          :disabled="status === 'loading' || status === 'generating'"
          type="button"
          @click="handleSelectedMode"
        >
          {{ isBusy ? selectedMode.loadingTitle : selectedMode.actionTitle }}
        </button>

        <p class="quota-note">
          今日 AI 請求：已用 {{ aiQuota.used }} / {{ aiQuota.limit }}， 剩餘
          {{ aiQuota.remaining }} 次
        </p>
        <p v-if="message" class="message" :class="status">{{ message }}</p>
        <div v-if="diagnostics" class="diagnostics">
          <strong>後端解析診斷</strong>
          <span>頁數：{{ diagnostics.page_count ?? 0 }}</span>
          <span v-for="page in diagnostics.pages" :key="page.page">
            Page {{ page.page }}: {{ page.char_count }} chars
          </span>
        </div>
      </aside>

      <section class="output-panel">
        <div class="panel-header">
          <h2 class="section-title">
            {{ isWordMode ? "Word Markdown" : "文件文字" }}
          </h2>
          <div class="icon-group">
            <button
              class="icon-button"
              :title="isWordMode ? '放大 Markdown' : '放大解析文字'"
              type="button"
              @click="text.trim() && openEditor('text')"
            >
              ⤢
            </button>
            <button
              class="icon-button"
              :title="isWordMode ? '複製 Markdown' : '複製解析文字'"
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
            :placeholder="
              isWordMode
                ? '解析後的 Markdown 會出現在這裡。Word 產生會使用後端解析出的結構資料。'
                : '解析後的文字會出現在這裡。'
            "
          ></textarea>
        </div>

        <MathMarkdownPreview v-if="isWordMode && text.trim()" :content="text" />

        <section v-if="isWordMode" class="word-result-panel">
          <div class="word-stats">
            <div>
              <strong>{{ wordStats.sections }}</strong>
              <span>區段</span>
            </div>
            <div>
              <strong>{{ wordStats.questions }}</strong>
              <span>題目</span>
            </div>
            <div>
              <strong>{{ wordStats.assets }}</strong>
              <span>圖片/附件</span>
            </div>
          </div>
          <button
            class="primary-inline-button"
            :disabled="
              !text.trim() || status === 'generating' || wordGenerationMaintenance
            "
            type="button"
            @click="handleGenerateWord"
          >
            {{
              wordGenerationMaintenance
                ? "Word API 維護中"
                : status === "generating"
                  ? "產生中"
                  : "套用模板並下載 Word"
            }}
          </button>
        </section>

        <template v-else>
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
        </template>
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
import MathMarkdownPreview from "./components/MathMarkdownPreview.vue";
import SolutionReview from "./components/SolutionReview.vue";
import {
  WORD_GENERATION_MAINTENANCE_NOTICE,
  extractPdfText,
  fetchWordTemplates,
  generateWordDocument,
  isWordGenerationUnderMaintenance,
  parseWordDocument,
  processAiText,
} from "./services/api";
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

const FALLBACK_WORD_TEMPLATES = [
  {
    id: "teams_conversion",
    name: "Teams 轉換",
    description:
      "Teams 轉換版型；標題只保留 CH 單元，每一行採 1.5 倍行距且不產生 bullet。",
  },
  {
    id: "junior_math_handout",
    name: "國中數學講義",
    description:
      "國中數學講義版型；依講義規範套用頁面、頁首頁尾、題型與答案格式。",
  },
];

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
    value: "word-template",
    icon: "DOCX",
    title: "Word 模板排版",
    description: "解析 DOCX 題目，選 Teams模板 或國中講義模板後產生 Word",
    actionTitle: "解析 Word",
    loadingTitle: "Word 解析中",
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
const wordTemplates = ref(FALLBACK_WORD_TEMPLATES);
const selectedWordTemplateId = ref("teams_conversion");
const templatesLoading = ref(false);
const wordDocument = ref(null);
const wordOutputFilename = ref("questions-排版.docx");
const wordGenerationMaintenance = isWordGenerationUnderMaintenance();

const isWordMode = computed(() => mode.value === "word-template");
const isBusy = computed(
  () => status.value === "loading" || status.value === "generating",
);
const selectedMode = computed(
  () => modes.find((item) => item.value === mode.value) || modes[0],
);
const selectedWordTemplate = computed(
  () =>
    wordTemplates.value.find(
      (template) => template.id === selectedWordTemplateId.value,
    ) || FALLBACK_WORD_TEMPLATES[0],
);
const wordStats = computed(() => {
  const document = wordDocument.value;
  if (!document) return { sections: 0, questions: 0, assets: 0 };

  return {
    sections: document.sections?.length || 0,
    questions:
      document.sections?.reduce(
        (total, section) => total + (section.questions?.length || 0),
        0,
      ) || 0,
    assets: document.assets?.length || 0,
  };
});
const editorConfig = computed(() => {
  if (expandedEditor.value === "text") {
    return {
      title: isWordMode.value ? "Word Markdown" : "解析文字",
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
  loadWordTemplates();
});

onBeforeUnmount(() => {
  window.removeEventListener("document-processing-quota-change", syncAiQuota);
  window.removeEventListener("storage", syncAiQuota);
});

function switchMode(value) {
  mode.value = value;
  status.value = "idle";
  message.value = "";
  diagnostics.value = null;
}

async function loadWordTemplates() {
  templatesLoading.value = true;
  const result = await fetchWordTemplates();
  if (result.success && result.templates?.length) {
    wordTemplates.value = result.templates;
    selectedWordTemplateId.value = result.templates.some(
      (template) => template.id === result.defaultTemplateId,
    )
      ? result.defaultTemplateId
      : result.templates[0].id;
  }
  templatesLoading.value = false;
}

function handleFile(selectedFile) {
  if (!selectedFile) return;
  file.value = selectedFile;
  text.value = "";
  solutionDraft.value = "";
  message.value = "";
  diagnostics.value = null;
  status.value = "idle";
  wordDocument.value = null;

  if (selectedFile.name?.toLowerCase().endsWith(".docx")) {
    wordOutputFilename.value = `${selectedFile.name.replace(/\.docx$/i, "")}-排版.docx`;
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

async function handleWordParse() {
  if (!file.value) {
    status.value = "error";
    message.value = "請先選擇 Word 檔案。";
    return;
  }
  if (!file.value.name?.toLowerCase().endsWith(".docx")) {
    status.value = "error";
    message.value = "Word 模板排版只支援 .docx 檔案。";
    return;
  }

  status.value = "loading";
  message.value = "正在解析 Word 題目、表格與圖片...";
  const result = await parseWordDocument({
    file: file.value,
    includeAssets: true,
  });

  if (result.success) {
    wordDocument.value = result.document;
    text.value = buildWordMarkdown(result.document);
    status.value = "success";
    message.value =
      "Word 解析完成，已轉成 Markdown 預覽；產生 Word 會使用解析後的結構資料。";
    return;
  }

  status.value = "error";
  message.value = result.error || "Word 文件解析失敗。";
}

function handleSelectedMode() {
  if (isWordMode.value) {
    handleWordParse();
    return;
  }
  handleExtract();
}

function buildWordMarkdown(document) {
  if (!document) return "";

  const lines = [];
  if (document.title) {
    lines.push(`# ${document.title}`, "");
  }

  for (const section of document.sections || []) {
    if (section.title) {
      lines.push(`## ${section.title}`, "");
    }
    for (const instruction of section.instructions || []) {
      lines.push(`> ${instruction}`, "");
    }
    for (const question of section.questions || []) {
      lines.push(...questionToMarkdown(question));
    }
  }

  if (document.unassigned_content?.length) {
    lines.push("## 其他內容", "");
    for (const block of document.unassigned_content) {
      if (block.text) lines.push(block.text, "");
    }
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function questionToMarkdown(question) {
  const lines = [];
  const answer = question.answer ? `（答案：${question.answer}）` : "";
  const number = question.number || "";
  lines.push(`### 第 ${number} 題 ${answer}`.trim(), "");
  if (question.stem) lines.push(question.stem, "");

  for (const block of question.shared_context || []) {
    if (block.text) lines.push(block.text, "");
  }

  for (const option of question.options || []) {
    lines.push(`- (${option.label || ""}) ${option.text || ""}`.trim());
  }
  if (question.options?.length) lines.push("");

  for (const block of question.content_blocks || []) {
    if (block.text) lines.push(block.text, "");
  }

  if (question.solution?.length) {
    lines.push("**詳解**", "");
    for (const line of question.solution) {
      lines.push(line);
    }
    lines.push("");
  }

  return lines;
}

async function handleGenerateWord() {
  const documentPayload = wordDocument.value;
  if (!documentPayload) {
    status.value = "error";
    message.value = "請先解析 Word，再套用模板產生檔案。";
    return;
  }
  if (wordGenerationMaintenance) {
    status.value = "maintenance";
    message.value = WORD_GENERATION_MAINTENANCE_NOTICE;
    return;
  }

  status.value = "generating";
  message.value = "正在套用模板並產生 Word...（會計入 1 次 AI 請求）";
  const result = await generateWordDocument({
    document: documentPayload,
    filename: ensureDocxFilename(wordOutputFilename.value),
    templateId: selectedWordTemplateId.value,
  });

  if (result.success) {
    wordDocument.value = documentPayload;
    downloadBlob(
      result.blob,
      result.filename || ensureDocxFilename(wordOutputFilename.value),
    );
    status.value = "success";
    message.value = "Word 已產生並開始下載。";
    return;
  }

  status.value = "error";
  message.value = result.error || "Word 產生失敗。";
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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ensureDocxFilename(value) {
  const filename = (value || "questions-排版.docx").trim();
  return filename.toLowerCase().endsWith(".docx")
    ? filename
    : `${filename}.docx`;
}

function showCopyMessage(value) {
  copyMessage.value = value;
  window.setTimeout(() => {
    copyMessage.value = "";
  }, 1400);
}
</script>
