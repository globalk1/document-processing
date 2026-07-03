<template>
  <main class="page-shell">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育-教務部內部使用</div>
        <h1>文件解析與題庫挑題</h1>
      </div>
      <div class="header-actions">
        <span class="app-version">v{{ APP_VERSION }}</span>
        <span class="status-pill" :class="status">{{ selectedMode.title }}</span>
      </div>
    </header>

    <section class="workspace" :class="{ 'question-bank-workspace': isQuestionBankMode }">
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

        <template v-if="isQuestionBankMode">
          <section class="filter-panel">
            <div class="filter-panel-header">
              <h2 class="section-title">篩選題目</h2>
              <button
                class="ghost-button compact"
                type="button"
                @click="resetMathBankFilters"
              >
                重設
              </button>
            </div>

            <label class="field-label" for="question-bank-search">搜尋</label>
            <input
              id="question-bank-search"
              v-model="mathBankFilters.search"
              class="text-input"
              type="text"
              placeholder="題目、答案、詳解、思維"
              @input="scheduleMathBankQuestionLoad"
            />

            <div class="filter-grid">
              <label>
                <span class="field-label">年級</span>
                <select
                  v-model="mathBankFilters.grade_id"
                  class="select-input"
                  @change="handleMathBankGradeChange"
                >
                  <option value="">全部年級</option>
                  <option
                    v-for="grade in mathBankGrades"
                    :key="grade.id"
                    :value="grade.id"
                  >
                    {{ grade.name }}
                  </option>
                </select>
              </label>

              <label>
                <span class="field-label">單元</span>
                <select
                  v-model="mathBankFilters.unit_id"
                  class="select-input"
                  @change="loadMathBankQuestions"
                >
                  <option value="">全部單元</option>
                  <option
                    v-for="unit in filteredMathBankUnits"
                    :key="unit.id"
                    :value="unit.id"
                  >
                    {{ unit.name }}
                  </option>
                </select>
              </label>

              <label>
                <span class="field-label">難度</span>
                <select
                  v-model="mathBankFilters.difficulty"
                  class="select-input"
                  @change="loadMathBankQuestions"
                >
                  <option value="">全部難度</option>
                  <option value="A">A 基礎型</option>
                  <option value="B">B 進階型</option>
                  <option value="C">C 挑戰型</option>
                  <option value="S">S 究極型</option>
                </select>
              </label>

              <label>
                <span class="field-label">狀態</span>
                <select
                  v-model="mathBankFilters.status"
                  class="select-input"
                  @change="loadMathBankQuestions"
                >
                  <option value="">全部狀態</option>
                  <option value="draft">草稿</option>
                  <option value="published">已發布</option>
                  <option value="archived">封存</option>
                </select>
              </label>
            </div>

            <button
              class="primary-button full"
              :disabled="mathBankLoading"
              type="button"
              @click="loadMathBankQuestions"
            >
              {{ mathBankLoading ? "讀取中" : "重新讀取題目" }}
            </button>
          </section>

          <section class="selection-panel">
            <div>
              <span class="selection-count">{{ selectedMathBankQuestions.length }}</span>
              <span class="selection-label">已選題目</span>
            </div>
            <button
              class="primary-button full"
              :disabled="!selectedMathBankQuestions.length"
              type="button"
              @click="copySelectedQuestions"
            >
              複製選題內容
            </button>
            <button
              class="secondary-button full"
              :disabled="!selectedMathBankQuestions.length"
              type="button"
              @click="selectedMathBankQuestionIds = []"
            >
              清空選題
            </button>
          </section>

          <p v-if="message" class="message" :class="status">{{ message }}</p>
        </template>

        <template v-else>
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
            <strong>{{ file ? file.name : "選擇或拖拉 PDF、圖片" }}</strong>
            <span>{{ file ? `${Math.ceil(file.size / 1024)} KB` : "PDF、JPG、PNG、WEBP" }}</span>
            <input
              ref="fileInput"
              hidden
              type="file"
              accept="application/pdf,image/*"
              @change="handleFileChange"
            />
          </div>

          <button
            class="primary-button full"
            :disabled="isBusy"
            type="button"
            @click="handleSelectedMode"
          >
            {{ isBusy ? selectedMode.loadingTitle : selectedMode.actionTitle }}
          </button>

          <p v-if="message" class="message" :class="status">{{ message }}</p>
          <div v-if="diagnostics" class="diagnostics">
            <strong>後端解析診斷</strong>
            <span>頁數：{{ diagnostics.page_count ?? 0 }}</span>
            <span v-for="page in diagnostics.pages" :key="page.page">
              Page {{ page.page }}: {{ page.char_count }} chars
            </span>
          </div>
        </template>
      </aside>

      <section class="output-panel">
        <template v-if="isQuestionBankMode">
          <div class="question-bank-toolbar">
            <div>
              <h2 class="section-title">題庫列表</h2>
              <p>{{ mathBankQuestions.length }} 題符合條件，{{ selectedMathBankQuestions.length }} 題已選</p>
            </div>
            <div class="icon-group">
              <button
                class="icon-button"
                title="重新讀取題目"
                type="button"
                @click="loadMathBankQuestions"
              >
                ↻
              </button>
            </div>
          </div>

          <div v-if="mathBankLoading" class="empty-state">Loading...</div>
          <div v-else-if="!mathBankQuestions.length" class="empty-state">
            沒有符合條件的題目。
          </div>
          <div v-else class="question-bank-board">
            <article
              v-for="question in mathBankQuestions"
              :key="question.id"
              class="question-bank-card"
              :class="{ selected: isMathBankQuestionSelected(question.id) }"
            >
              <div class="question-card-topline">
                <button
                  class="question-select-button"
                  :class="{ selected: isMathBankQuestionSelected(question.id) }"
                  type="button"
                  @click="toggleMathBankQuestion(question.id)"
                >
                  {{ isMathBankQuestionSelected(question.id) ? "✓" : "" }}
                </button>
                <div class="question-bank-meta">
                  <span>{{ question.grade?.name || "-" }}</span>
                  <span>{{ question.unit?.name || "-" }}</span>
                  <span>{{ question.difficulty || "-" }}</span>
                  <span :class="['status-badge', question.status]">
                    {{ formatQuestionStatus(question.status) }}
                  </span>
                </div>
              </div>

              <div class="question-bank-card-title">
                <MathText :content="question.prompt_md" />
              </div>

              <div class="question-card-details">
                <section v-if="question.answer_md">
                  <strong>答案</strong>
                  <p><MathText :content="question.answer_md" fallback="" /></p>
                </section>
                <section v-if="question.solution_md">
                  <strong>詳解</strong>
                  <p><MathText :content="question.solution_md" fallback="" /></p>
                </section>
                <section v-if="formatQuestionThinking(question.thinking)">
                  <strong>思維</strong>
                  <p>
                    <MathText
                      :content="formatQuestionThinking(question.thinking)"
                      fallback=""
                    />
                  </p>
                </section>
              </div>

              <div class="question-card-footer">
                <span>{{ question.assets?.length || 0 }} 圖</span>
                <button
                  class="ghost-button compact"
                  type="button"
                  @click="toggleMathBankQuestion(question.id)"
                >
                  {{ isMathBankQuestionSelected(question.id) ? "取消選取" : "加入選題" }}
                </button>
              </div>
            </article>
          </div>
        </template>

        <template v-else>
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
import MathText from "./components/MathText.vue";
import SolutionReview from "./components/SolutionReview.vue";
import {
  extractPdfText,
  listMathBankGrades,
  listMathBankUnits,
  listStaffMathBankQuestions,
  processAiText,
} from "./services/api";
import {
  extractAccuratePdfInPages,
  isPdfFile,
  validatePdfPageLimit,
} from "./services/pdfBatchExtraction";
import {
  APP_VERSION,
  showReleaseAnnouncementIfNeeded,
} from "./services/releaseAnnouncement";

const modes = [
  {
    value: "text-extract",
    icon: "TXT",
    title: "圖片/PDF 轉文字",
    description: "上傳 PDF 或圖片後轉成文字。",
    actionTitle: "開始轉文字",
    loadingTitle: "解析中",
  },
  {
    value: "question-bank",
    icon: "QB",
    title: "題庫挑題",
    description: "搜尋、篩選並複製題目。",
    actionTitle: "讀取題庫",
    loadingTitle: "題庫讀取中",
  },
];

const fileInput = ref(null);
const file = ref(null);
const mode = ref("text-extract");
const text = ref("");
const solutionDraft = ref("");
const status = ref("idle");
const aiStatus = ref("idle");
const message = ref("");
const diagnostics = ref(null);
const dragOver = ref(false);
const expandedEditor = ref(null);
const copyMessage = ref("");
const mathBankGrades = ref([]);
const mathBankUnits = ref([]);
const mathBankQuestions = ref([]);
const selectedMathBankQuestionIds = ref([]);
const mathBankLoading = ref(false);
const mathBankFilters = ref({
  search: "",
  grade_id: "",
  unit_id: "",
  difficulty: "",
  status: "",
});
let mathBankSearchTimer = null;

const isQuestionBankMode = computed(() => mode.value === "question-bank");
const isBusy = computed(() => status.value === "loading");
const selectedMode = computed(
  () => modes.find((item) => item.value === mode.value) || modes[0],
);
const filteredMathBankUnits = computed(() => {
  if (!mathBankFilters.value.grade_id) return mathBankUnits.value;
  return mathBankUnits.value.filter(
    (unit) => unit.grade?.id === mathBankFilters.value.grade_id,
  );
});
const selectedMathBankQuestions = computed(() => {
  const selectedIds = new Set(selectedMathBankQuestionIds.value);
  return mathBankQuestions.value.filter((question) => selectedIds.has(question.id));
});
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

onMounted(() => {
  showReleaseAnnouncementIfNeeded();
});

onBeforeUnmount(() => {
  if (mathBankSearchTimer) window.clearTimeout(mathBankSearchTimer);
});

function switchMode(value) {
  mode.value = value;
  status.value = "idle";
  message.value = "";
  diagnostics.value = null;

  if (value === "question-bank") {
    loadMathBankWorkspace();
  }
}

async function loadMathBankWorkspace() {
  if (mathBankGrades.value.length && mathBankUnits.value.length) {
    loadMathBankQuestions();
    return;
  }

  mathBankLoading.value = true;
  message.value = "正在讀取題庫分類...";
  const [gradeResult, unitResult] = await Promise.all([
    listMathBankGrades(),
    listMathBankUnits(),
  ]);

  if (gradeResult.success) {
    mathBankGrades.value = gradeResult.data || [];
  }
  if (unitResult.success) {
    mathBankUnits.value = unitResult.data || [];
  }

  if (!gradeResult.success || !unitResult.success) {
    status.value = "error";
    message.value = gradeResult.error || unitResult.error || "題庫分類讀取失敗。";
    mathBankLoading.value = false;
    return;
  }

  await loadMathBankQuestions();
}

function scheduleMathBankQuestionLoad() {
  if (mathBankSearchTimer) window.clearTimeout(mathBankSearchTimer);
  mathBankSearchTimer = window.setTimeout(() => {
    mathBankSearchTimer = null;
    loadMathBankQuestions();
  }, 300);
}

function handleMathBankGradeChange() {
  mathBankFilters.value.unit_id = "";
  loadMathBankQuestions();
}

function resetMathBankFilters() {
  mathBankFilters.value = {
    search: "",
    grade_id: "",
    unit_id: "",
    difficulty: "",
    status: "",
  };
  loadMathBankQuestions();
}

async function loadMathBankQuestions() {
  mathBankLoading.value = true;
  status.value = "loading";
  message.value = "正在讀取題目...";

  const result = await listStaffMathBankQuestions({
    search: mathBankFilters.value.search.trim(),
    grade_id: mathBankFilters.value.grade_id,
    unit_id: mathBankFilters.value.unit_id,
    difficulty: mathBankFilters.value.difficulty,
    status: mathBankFilters.value.status,
  });

  if (result.success) {
    mathBankQuestions.value = result.data || [];
    selectedMathBankQuestionIds.value = selectedMathBankQuestionIds.value.filter(
      (id) => mathBankQuestions.value.some((question) => question.id === id),
    );
    status.value = "success";
    message.value = `已讀取 ${mathBankQuestions.value.length} 題。`;
  } else {
    status.value = "error";
    message.value = result.error || "題目讀取失敗。";
  }

  mathBankLoading.value = false;
}

function isMathBankQuestionSelected(id) {
  return selectedMathBankQuestionIds.value.includes(id);
}

function toggleMathBankQuestion(id) {
  selectedMathBankQuestionIds.value = isMathBankQuestionSelected(id)
    ? selectedMathBankQuestionIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedMathBankQuestionIds.value, id];
}

function formatQuestionStatus(statusValue) {
  const labels = {
    draft: "草稿",
    published: "已發布",
    archived: "封存",
  };
  return labels[statusValue] || statusValue || "-";
}

function formatQuestionThinking(thinking) {
  if (Array.isArray(thinking)) {
    return thinking
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join("、");
  }

  return String(thinking || "").trim();
}

function buildSelectedQuestionsText() {
  return selectedMathBankQuestions.value
    .map((question, index) => {
      const parts = [
        `${index + 1}. ${question.prompt_md || "無題目"}`,
        question.answer_md ? `答案：${question.answer_md}` : "",
        question.solution_md ? `詳解：${question.solution_md}` : "",
        formatQuestionThinking(question.thinking)
          ? `思維：${formatQuestionThinking(question.thinking)}`
          : "",
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n\n");
}

function copySelectedQuestions() {
  copyText(buildSelectedQuestionsText());
}

function handleFile(selectedFile) {
  if (!selectedFile) return;
  file.value = selectedFile;
  text.value = "";
  solutionDraft.value = "";
  message.value = "";
  diagnostics.value = null;
  status.value = "idle";
}

function handleFileChange(event) {
  handleFile(event.target.files?.[0]);
}

function handleDrop(event) {
  dragOver.value = false;
  handleFile(event.dataTransfer.files?.[0]);
}

async function validateSelectedFile() {
  if (!file.value) {
    status.value = "error";
    message.value = "請先選擇 PDF 或圖片檔案。";
    return false;
  }

  if (isPdfFile(file.value)) {
    message.value = "正在檢查 PDF 頁數...";
    const pageValidation = await validatePdfPageLimit(file.value);
    if (!pageValidation.success) {
      status.value = "error";
      message.value = pageValidation.error;
      return false;
    }
  }

  return true;
}

async function runAccurateExtraction() {
  if (isPdfFile(file.value)) {
    return extractAccuratePdfInPages({
      file: file.value,
      requestExtract: (pageFile, pageMode) =>
        extractPdfText({ file: pageFile, mode: pageMode }),
      onProgress: (value) => {
        message.value = value;
      },
      onPartialText: (value) => {
        text.value = value;
      },
    });
  }

  return extractPdfText({ file: file.value, mode: "accurate" });
}

async function handleExtract() {
  if (!(await validateSelectedFile())) return;

  status.value = "loading";
  diagnostics.value = null;
  message.value = "正在使用免費解析...";

  const freeResult = await extractPdfText({ file: file.value, mode: "fast" });
  if (freeResult.success && freeResult.text?.trim()) {
    text.value = freeResult.text || "";
    status.value = "success";
    message.value = "免費解析完成。";
    return;
  }

  diagnostics.value = freeResult.diagnostics || null;
  message.value = "免費解析沒有取得文字，正在改用 AI / OCR...";
  const accurateResult = await runAccurateExtraction();

  if (accurateResult.success && accurateResult.text?.trim()) {
    text.value = accurateResult.text || "";
    status.value = "success";
    message.value = "AI / OCR 解析完成。";
    return;
  }

  status.value = "error";
  diagnostics.value = accurateResult.diagnostics || freeResult.diagnostics || null;
  message.value =
    accurateResult.error ||
    freeResult.error ||
    "沒有抽到文字，請確認檔案內容或稍後再試。";
}

function handleSelectedMode() {
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
