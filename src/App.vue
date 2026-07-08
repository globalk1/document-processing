<template>
  <main class="page-shell">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育｜教務部內部使用</div>
        <h1>{{ selectedMode.title }}</h1>
      </div>
      <div class="header-actions">
        <span class="app-version">v{{ APP_VERSION }}</span>
        <span class="status-pill" :class="status">{{ selectedMode.title }}</span>
      </div>
    </header>

    <nav class="tab-bar" aria-label="功能切換">
      <button
        v-for="item in modes"
        :key="item.value"
        class="tab-button"
        :class="{ active: mode === item.value }"
        type="button"
        @click="switchMode(item.value)"
      >
        <span class="tab-icon">{{ item.icon }}</span>
        <span>{{ item.title }}</span>
      </button>
    </nav>

    <HandwritingWorkspace v-if="isHandwritingMode" />
    <WordTemplateWorkspace
      v-else-if="isWordTemplateMode"
      :staff-api-key="staffApiKey"
    />
    <section
      v-else
      class="workspace"
      :class="{
        'question-bank-workspace': isQuestionBankMode,
        'api-guide-workspace': isApiGuideMode,
      }"
    >
      <aside v-if="!isApiGuideMode" class="control-panel">
        <template v-if="isQuestionBankMode">
          <section class="filter-panel">
            <label class="api-key-field">
              <span>Staff API Key</span>
              <input
                v-model="staffApiKey"
                autocomplete="off"
                @input="handleStaffApiKeyInput"
                spellcheck="false"
                type="password"
                placeholder="請輸入 staff API key"
              />
            </label>
          </section>

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
                  <option :value="filterNoneValue">請選擇條件</option>
                  <option :value="filterAllValue">全部年級</option>
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
                  <option :value="filterNoneValue">請選擇條件</option>
                  <option :value="filterAllValue">全部單元</option>
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
              @click="downloadSelectedQuestionsJson"
            >
              下載選題 JSON
            </button>
            <button
              class="secondary-button full"
              :disabled="!selectedMathBankQuestions.length"
              type="button"
              @click="copySelectedQuestions"
            >
              複製選題內容
            </button>
            <div class="selection-action-grid">
              <button class="secondary-button full" disabled type="button">
                生成講義
              </button>
              <button class="secondary-button full" disabled type="button">
                生成考卷
              </button>
            </div>
            <span class="selection-hint">講義與考卷生成功能尚未實作</span>
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
          <h2 class="section-title">文件來源</h2>
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

          <div class="download-button-grid">
            <button
              class="secondary-button full"
              :disabled="!text.trim()"
              type="button"
              @click="downloadTextFile('txt')"
            >
              下載 TXT
            </button>
            <button
              class="secondary-button full"
              :disabled="!text.trim()"
              type="button"
              @click="downloadTextFile('md')"
            >
              下載 Markdown
            </button>
            <button
              class="secondary-button full"
              :disabled="jsonBuilding || !text.trim()"
              type="button"
              @click="downloadMathBankJson"
            >
              {{ jsonBuilding ? "轉換中" : "轉成題目格式 JSON" }}
            </button>
          </div>

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
        <template v-if="isApiGuideMode">
          <div class="api-guide-panel">
            <div class="api-guide-header">
              <div>
                <h2 class="section-title">API 串接入題/下載題目</h2>
                <p>入題使用 POST；下載題目使用 fetch / GET，可依環境複製指令。</p>
              </div>
              <span class="api-guide-badge">遇到重複題預設略過</span>
            </div>

            <div class="api-config-grid">
              <label class="api-key-field">
                <span>Staff API Key</span>
                <input
                  v-model="staffApiKey"
                  autocomplete="off"
                  @input="handleStaffApiKeyInput"
                  spellcheck="false"
                  type="password"
                  placeholder="請輸入 staff API key"
                />
              </label>
              <label class="api-key-field">
                <span>入題 API URL</span>
                <input
                  v-model="staffApiUrl"
                  autocomplete="off"
                  spellcheck="false"
                  type="text"
                />
              </label>
              <label class="api-key-field">
                <span>入題年級</span>
                <select
                  v-model="apiGuideSelection.grade_id"
                  class="select-input"
                  @change="handleApiGuideGradeChange"
                >
                  <option :value="filterNoneValue">請選擇年級</option>
                  <option
                    v-for="grade in mathBankGrades"
                    :key="grade.id"
                    :value="grade.id"
                  >
                    {{ grade.name }} / {{ grade.id }}
                  </option>
                </select>
              </label>
              <label class="api-key-field">
                <span>入題單元</span>
                <select v-model="apiGuideSelection.unit_id" class="select-input">
                  <option :value="filterNoneValue">請選擇單元</option>
                  <option
                    v-for="unit in apiGuideFilteredUnits"
                    :key="unit.id"
                    :value="unit.id"
                  >
                    {{ unit.name }} / {{ unit.id }}
                  </option>
                </select>
              </label>
            </div>
            <p class="api-config-hint">
              入題指令會以這裡選擇的年級與單元覆寫 JSON 內每題的 grade_id / unit_id。
            </p>

            <section class="api-command-section">
              <div class="api-section-heading">
                <h3>入題 API 方式</h3>
                <span>POST /staff/questions/</span>
              </div>
              <ol class="api-step-list">
                <li>把 `math-bank-questions.json` 放在要執行指令的資料夾。</li>
                <li>指令會逐題 POST 到入題 API。</li>
                <li>進度列會顯示目前匯入第幾題；重複題會標示 `DUPLICATE`。</li>
              </ol>

              <div class="api-code-grid">
                <section class="api-code-card">
                  <div class="code-header">
                    <div>
                      <strong>macOS 入題</strong>
                      <span>Terminal / zsh</span>
                    </div>
                    <button class="ghost-button compact" type="button" @click="copyApiCommand(macTimelineImportCommand)">複製</button>
                  </div>
                  <pre>{{ macTimelineImportCommand }}</pre>
                </section>
                <section class="api-code-card">
                  <div class="code-header">
                    <div>
                      <strong>Windows 入題</strong>
                      <span>PowerShell</span>
                    </div>
                    <button class="ghost-button compact" type="button" @click="copyApiCommand(windowsTimelineImportCommand)">複製</button>
                  </div>
                  <pre>{{ windowsTimelineImportCommand }}</pre>
                </section>
              </div>
            </section>

            <section class="api-command-section">
              <div class="api-section-heading">
                <h3>Fetch 方式 / 下載題目</h3>
                <span>GET /questions/search/</span>
              </div>
              <ol class="api-step-list">
                <li>用 Staff API Key 讀取題目清單。</li>
                <li>可調整 `GRADE_ID`、`UNIT_ID`、`DIFFICULTY`、`STATUS`。</li>
                <li>結果會存成 `math-bank-fetch-results.json`。</li>
              </ol>

              <div class="api-code-grid single">
                <section class="api-code-card">
                  <div class="code-header">
                    <div>
                      <strong>Python requests Fetch</strong>
                      <span>下載題目 JSON</span>
                    </div>
                    <button class="ghost-button compact" type="button" @click="copyApiCommand(pythonFetchQuestionsCommand)">複製</button>
                  </div>
                  <pre>{{ pythonFetchQuestionsCommand }}</pre>
                </section>
              </div>
            </section>
          </div>
        </template>

        <template v-else-if="isQuestionBankMode">
          <div class="question-bank-toolbar">
            <div>
              <h2 class="section-title">題庫列表</h2>
              <p v-if="hasMathBankConditions">{{ mathBankQuestions.length }}{{ mathBankHasMore ? "+" : "" }} 題符合條件，{{ selectedMathBankQuestions.length }} 題已選</p>
              <p v-else>請選擇條件</p>
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
          <div v-else-if="!hasMathBankConditions" class="empty-state">
            請選擇條件
          </div>
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
            <div class="load-more-row">
              <button
                v-if="mathBankHasMore"
                class="secondary-button"
                :disabled="mathBankLoadingMore"
                type="button"
                @click="loadMoreMathBankQuestions"
              >
                {{ mathBankLoadingMore ? "載入中" : "載入更多" }}
              </button>
              <span v-else>已載入全部符合條件的題目</span>
            </div>
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
import HandwritingWorkspace from "./components/HandwritingWorkspace.vue";
import MathText from "./components/MathText.vue";
import SolutionReview from "./components/SolutionReview.vue";
import WordTemplateWorkspace from "./components/WordTemplateWorkspace.vue";
import {
  buildMathBankJson,
  extractPdfText,
  getStaffMathBankQuestion,
  listMathBankGrades,
  listMathBankUnits,
  processAiText,
  searchStaffMathBankQuestions,
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
    value: "handwriting",
    icon: "消",
    title: "筆跡去除",
    description: "去除考卷上的筆跡並下載乾淨 PDF。",
    actionTitle: "去除筆跡",
    loadingTitle: "處理中",
  },
  {
    value: "text-extract",
    icon: "TXT",
    title: "圖片/PDF 轉文字",
    description: "上傳 PDF 或圖片後轉成文字。",
    actionTitle: "開始轉文字",
    loadingTitle: "解析中",
  },
  {
    value: "word-template",
    icon: "W",
    title: "Word 套版＋入資料庫",
    description: "JSON / Word 題目套版，並批量新增公開草稿。",
    actionTitle: "解析題目",
    loadingTitle: "解析中",
  },
  {
    value: "question-bank",
    icon: "題",
    title: "題庫挑題",
    description: "搜尋、篩選並複製題目。",
    actionTitle: "讀取題庫",
    loadingTitle: "題庫讀取中",
  },
  {
    value: "api-guide",
    icon: "API",
    title: "API 串接入題/下載題目",
    description: "複製入題與 fetch 下載題目的指令。",
    actionTitle: "查看指令",
    loadingTitle: "讀取中",
  },
];

const filterNoneValue = "__none__";
const filterAllValue = "__all__";
const mathBankPageSize = 30;
const defaultStaffApiKey = "Q2yu32SCbv8ha21dICnCOZ7vdq0Kl/PEbix44tq52KYhfrWcbRxrcrL9FtK7lqbj";
const defaultJsonGradeId = "4e07e7fd-6c12-4a80-b715-464d0b486a71";
const defaultJsonUnitId = "e886b5f1-571c-46b7-afb3-a9501024b8b9";

const fileInput = ref(null);
const file = ref(null);
const mode = ref("handwriting");
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
const mathBankQuestionById = ref({});
const selectedMathBankQuestionIds = ref([]);
const mathBankLoading = ref(false);
const mathBankLoadingMore = ref(false);
const mathBankHasMore = ref(false);
const mathBankNextCursor = ref(null);
const jsonBuilding = ref(false);
const staffApiKey = ref(defaultStaffApiKey);
const staffApiUrl = ref("https://sunnytseng.com/api/math-bank/staff/questions/");
const apiGuideSelection = ref({
  grade_id: filterNoneValue,
  unit_id: filterNoneValue,
});
const mathBankFilters = ref({
  search: "",
  grade_id: filterNoneValue,
  unit_id: filterNoneValue,
  difficulty: "",
  status: "",
});
let mathBankSearchTimer = null;

const isQuestionBankMode = computed(() => mode.value === "question-bank");
const isApiGuideMode = computed(() => mode.value === "api-guide");
const isHandwritingMode = computed(() => mode.value === "handwriting");
const isWordTemplateMode = computed(() => mode.value === "word-template");
const hasStaffApiKey = computed(() => Boolean(staffApiKey.value.trim()));
const isBusy = computed(() => status.value === "loading");
const selectedMode = computed(
  () => modes.find((item) => item.value === mode.value) || modes[0],
);
const filteredMathBankUnits = computed(() => {
  if (mathBankFilters.value.grade_id === filterNoneValue) return [];
  if (mathBankFilters.value.grade_id === filterAllValue) return mathBankUnits.value;
  return mathBankUnits.value.filter(
    (unit) => unit.grade?.id === mathBankFilters.value.grade_id,
  );
});
const apiGuideFilteredUnits = computed(() => {
  if (apiGuideSelection.value.grade_id === filterNoneValue) return [];
  return mathBankUnits.value.filter(
    (unit) => unit.grade?.id === apiGuideSelection.value.grade_id,
  );
});
const selectedApiGuideGradeId = computed(() =>
  apiGuideSelection.value.grade_id === filterNoneValue ? "" : apiGuideSelection.value.grade_id,
);
const selectedApiGuideUnitId = computed(() =>
  apiGuideSelection.value.unit_id === filterNoneValue ? "" : apiGuideSelection.value.unit_id,
);
const hasMathBankConditions = computed(() => Boolean(
  mathBankFilters.value.search.trim() ||
    mathBankFilters.value.grade_id !== filterNoneValue ||
    mathBankFilters.value.unit_id !== filterNoneValue ||
    mathBankFilters.value.difficulty ||
    mathBankFilters.value.status,
));
const selectedMathBankQuestions = computed(() =>
  selectedMathBankQuestionIds.value
    .map((id) => mathBankQuestionById.value[id])
    .filter(Boolean),
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
  if (value === "api-guide") {
    loadMathBankTaxonomy();
  }
}

function handleStaffApiKeyInput() {
  mathBankGrades.value = [];
  mathBankUnits.value = [];
  apiGuideSelection.value = {
    grade_id: filterNoneValue,
    unit_id: filterNoneValue,
  };
  clearMathBankQuestions();
  if (isQuestionBankMode.value || isApiGuideMode.value) {
    status.value = hasStaffApiKey.value ? "idle" : "error";
    message.value = hasStaffApiKey.value ? "請重新讀取題庫分類。" : "請先輸入 Staff API Key。";
  }
}

function requireStaffApiKey() {
  if (hasStaffApiKey.value) return true;
  status.value = "error";
  message.value = "請先輸入 Staff API Key。";
  return false;
}

async function loadMathBankWorkspace() {
  if (!requireStaffApiKey()) return;
  const taxonomyLoaded = await loadMathBankTaxonomy();
  if (taxonomyLoaded && hasMathBankConditions.value) {
    await loadMathBankQuestions();
  }
}

async function loadMathBankTaxonomy() {
  if (!requireStaffApiKey()) return false;
  if (mathBankGrades.value.length && mathBankUnits.value.length) return true;

  mathBankLoading.value = true;
  message.value = "正在讀取題庫分類...";
  const [gradeResult, unitResult] = await Promise.all([
    listMathBankGrades({}, { apiKey: staffApiKey.value }),
    listMathBankUnits({}, { apiKey: staffApiKey.value }),
  ]);

  if (gradeResult.success) {
    mathBankGrades.value = gradeResult.data || [];
  }
  if (unitResult.success) {
    mathBankUnits.value = unitResult.data || [];
  }

  mathBankLoading.value = false;

  if (!gradeResult.success || !unitResult.success) {
    status.value = "error";
    message.value = gradeResult.error || unitResult.error || "題庫分類讀取失敗。";
    return false;
  }

  if (!message.value || message.value === "正在讀取題庫分類...") {
    message.value = "題庫分類已讀取。";
  }
  return true;
}

function scheduleMathBankQuestionLoad() {
  if (mathBankSearchTimer) window.clearTimeout(mathBankSearchTimer);
  mathBankSearchTimer = window.setTimeout(() => {
    mathBankSearchTimer = null;
    loadMathBankQuestions();
  }, 300);
}

function handleMathBankGradeChange() {
  mathBankFilters.value.unit_id =
    mathBankFilters.value.grade_id === filterNoneValue
      ? filterNoneValue
      : filterAllValue;
  loadMathBankQuestions();
}

function handleApiGuideGradeChange() {
  apiGuideSelection.value.unit_id = filterNoneValue;
}

function resetMathBankFilters() {
  mathBankFilters.value = {
    search: "",
    grade_id: filterNoneValue,
    unit_id: filterNoneValue,
    difficulty: "",
    status: "",
  };
  clearMathBankQuestions();
  status.value = "idle";
  message.value = "請選擇條件";
}

function clearMathBankQuestions() {
  mathBankQuestions.value = [];
  mathBankQuestionById.value = {};
  selectedMathBankQuestionIds.value = [];
  mathBankHasMore.value = false;
  mathBankNextCursor.value = null;
}

function getMathBankSearchParams(cursor = "") {
  return {
    search: mathBankFilters.value.search.trim(),
    grade_id:
      mathBankFilters.value.grade_id === filterNoneValue ||
      mathBankFilters.value.grade_id === filterAllValue
        ? ""
        : mathBankFilters.value.grade_id,
    unit_id:
      mathBankFilters.value.unit_id === filterNoneValue ||
      mathBankFilters.value.unit_id === filterAllValue
        ? ""
        : mathBankFilters.value.unit_id,
    difficulty: mathBankFilters.value.difficulty,
    status: mathBankFilters.value.status,
    limit: mathBankPageSize,
    cursor,
  };
}

function mergeMathBankQuestions(items, reset = false) {
  const nextById = reset ? {} : { ...mathBankQuestionById.value };
  const nextIds = reset ? [] : mathBankQuestions.value.map((question) => question.id);
  const idSet = new Set(nextIds);

  items.forEach((question) => {
    nextById[question.id] = {
      ...(nextById[question.id] || {}),
      ...question,
    };
    if (!idSet.has(question.id)) {
      nextIds.push(question.id);
      idSet.add(question.id);
    }
  });

  mathBankQuestionById.value = nextById;
  mathBankQuestions.value = nextIds.map((id) => nextById[id]).filter(Boolean);
  selectedMathBankQuestionIds.value = selectedMathBankQuestionIds.value.filter(
    (id) => Boolean(nextById[id]),
  );
}

async function loadMathBankQuestions() {
  if (!requireStaffApiKey()) return;
  if (!hasMathBankConditions.value) {
    clearMathBankQuestions();
    status.value = "idle";
    message.value = "請選擇條件";
    return;
  }

  mathBankLoading.value = true;
  status.value = "loading";
  message.value = "正在讀取題目...";

  const result = await searchStaffMathBankQuestions(getMathBankSearchParams(), {
    apiKey: staffApiKey.value,
  });

  if (result.success) {
    mergeMathBankQuestions(result.data.results || [], true);
    mathBankHasMore.value = Boolean(result.data.has_more);
    mathBankNextCursor.value = result.data.next_cursor || null;
    status.value = "success";
    message.value = `已讀取 ${mathBankQuestions.value.length}${mathBankHasMore.value ? "+" : ""} 題。`;
  } else {
    status.value = "error";
    message.value = result.error || "題目讀取失敗。";
  }

  mathBankLoading.value = false;
}

async function loadMoreMathBankQuestions() {
  if (!requireStaffApiKey()) return;
  if (!mathBankHasMore.value || !mathBankNextCursor.value || mathBankLoadingMore.value) {
    return;
  }

  mathBankLoadingMore.value = true;
  const result = await searchStaffMathBankQuestions(
    getMathBankSearchParams(mathBankNextCursor.value),
    { apiKey: staffApiKey.value },
  );

  if (result.success) {
    mergeMathBankQuestions(result.data.results || [], false);
    mathBankHasMore.value = Boolean(result.data.has_more);
    mathBankNextCursor.value = result.data.next_cursor || null;
    status.value = "success";
    message.value = `已讀取 ${mathBankQuestions.value.length}${mathBankHasMore.value ? "+" : ""} 題。`;
  } else {
    status.value = "error";
    message.value = result.error || "載入更多題目失敗。";
  }

  mathBankLoadingMore.value = false;
}

async function ensureMathBankQuestionDetail(id) {
  if (!requireStaffApiKey()) return null;
  const current = mathBankQuestionById.value[id];
  if (
    current &&
    Object.prototype.hasOwnProperty.call(current, "answer_md") &&
    Object.prototype.hasOwnProperty.call(current, "solution_md")
  ) {
    return current;
  }

  const result = await getStaffMathBankQuestion(id, { apiKey: staffApiKey.value });
  if (!result.success) {
    status.value = "error";
    message.value = result.error || "題目詳情讀取失敗。";
    return current;
  }

  mathBankQuestionById.value = {
    ...mathBankQuestionById.value,
    [id]: {
      ...(current || {}),
      ...result.data,
    },
  };
  mathBankQuestions.value = mathBankQuestions.value.map((question) =>
    question.id === id ? mathBankQuestionById.value[id] : question,
  );
  return mathBankQuestionById.value[id];
}

function isMathBankQuestionSelected(id) {
  return selectedMathBankQuestionIds.value.includes(id);
}

async function toggleMathBankQuestion(id) {
  if (isMathBankQuestionSelected(id)) {
    selectedMathBankQuestionIds.value = selectedMathBankQuestionIds.value.filter(
      (selectedId) => selectedId !== id,
    );
    return;
  }

  const detail = await ensureMathBankQuestionDetail(id);
  if (!detail) return;
  selectedMathBankQuestionIds.value = [...selectedMathBankQuestionIds.value, id];
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

async function copySelectedQuestions() {
  if (!requireStaffApiKey()) return;
  await Promise.all(
    selectedMathBankQuestionIds.value.map((id) => ensureMathBankQuestionDetail(id)),
  );
  copyText(buildSelectedQuestionsText());
}

function toQuestionJsonPayload(question) {
  return {
    grade_id: question.grade?.id || question.grade_id || "",
    unit_id: question.unit?.id || question.unit_id || "",
    type: question.type || "calculation",
    difficulty: question.difficulty || "A",
    prompt_md: question.prompt_md || "",
    answer_md: question.answer_md || "",
    solution_md: question.solution_md || "",
    status: question.status || "draft",
    visibility: question.visibility || "public",
    thinking: Array.isArray(question.thinking)
      ? question.thinking
      : formatQuestionThinking(question.thinking)
        ? [formatQuestionThinking(question.thinking)]
        : [],
    assets: question.assets || [],
  };
}

async function downloadSelectedQuestionsJson() {
  if (!requireStaffApiKey()) return;
  if (!selectedMathBankQuestionIds.value.length) {
    status.value = "error";
    message.value = "請先選擇題目。";
    return;
  }

  await Promise.all(
    selectedMathBankQuestionIds.value.map((id) => ensureMathBankQuestionDetail(id)),
  );
  const payload = {
    questions: selectedMathBankQuestions.value.map(toQuestionJsonPayload),
  };
  downloadJson(payload, "selected-math-bank-questions.json");
  status.value = "success";
  message.value = `已下載 ${payload.questions.length} 題選題 JSON。`;
}

function triggerDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(payload, filename) {
  triggerDownload(
    JSON.stringify(payload, null, 2),
    filename,
    "application/json;charset=utf-8",
  );
}

function downloadTextFile(format) {
  const content = text.value.trim();
  if (!content) {
    status.value = "error";
    message.value = "請先有解析文字。";
    return;
  }

  const baseName = file.value?.name
    ? file.value.name.replace(/\.[^.]+$/, "")
    : "extracted-text";
  const extension = format === "md" ? "md" : "txt";
  const mimeType = format === "md"
    ? "text/markdown;charset=utf-8"
    : "text/plain;charset=utf-8";

  triggerDownload(content, `${baseName}.${extension}`, mimeType);
  status.value = "success";
  message.value = `已下載 ${extension.toUpperCase()} 文字檔。`;
}

async function downloadMathBankJson() {
  if (!text.value.trim()) {
    status.value = "error";
    message.value = "請先有解析文字。";
    return;
  }

  jsonBuilding.value = true;
  status.value = "loading";
  message.value = "正在判斷文字是否可轉成題目格式 JSON...";

  const result = await buildMathBankJson({
    text: text.value,
    gradeId: defaultJsonGradeId,
    unitId: defaultJsonUnitId,
    defaultType: "calculation",
    defaultDifficulty: "A",
  });

  if (result.success) {
    downloadJson(result.payload, "math-bank-questions.json");
    status.value = "success";
    message.value = `已產生 ${result.payload?.questions?.length || 0} 題 JSON。`;
  } else {
    status.value = "error";
    message.value = result.error || "題目格式 JSON 轉換失敗。";
  }

  jsonBuilding.value = false;
}

const apiKeyForCommand = computed(() => staffApiKey.value.trim() || "請輸入_staff_api_key");
const apiUrlForCommand = computed(() => staffApiUrl.value.trim() || "https://sunnytseng.com/api/math-bank/staff/questions/");
const apiGuideGradeIdForCommand = computed(() => selectedApiGuideGradeId.value || "請先選擇年級_UUID");
const apiGuideUnitIdForCommand = computed(() => selectedApiGuideUnitId.value || "請先選擇單元_UUID");
const fetchApiUrlForCommand = computed(() => {
  const importUrl = apiUrlForCommand.value;
  if (importUrl.includes("/staff/questions/")) {
    return importUrl.replace("/staff/questions/", "/questions/search/");
  }
  return "https://sunnytseng.com/api/math-bank/questions/search/";
});

function copyApiCommand(command) {
  if (!staffApiKey.value.trim()) {
    status.value = "error";
    message.value = "請先輸入 Staff API Key。";
    return;
  }
  if (!selectedApiGuideGradeId.value || !selectedApiGuideUnitId.value) {
    status.value = "error";
    message.value = "請先選擇年級與單元，系統會自動帶入 UUID。";
    return;
  }
  copyText(command);
}

const macTimelineImportCommand = computed(() => String.raw`API_KEY="${apiKeyForCommand.value}"
FILE="./math-bank-questions.json"
API_URL="${apiUrlForCommand.value}"
GRADE_ID="${apiGuideGradeIdForCommand.value}"
UNIT_ID="${apiGuideUnitIdForCommand.value}"
FORCE_DUPLICATES=0

case "$GRADE_ID:$UNIT_ID" in *請先選擇*) echo "請先在 UI 選擇年級與單元後再複製指令"; exit 1;; esac
command -v jq >/dev/null || { echo "缺少 jq，請先安裝 jq"; exit 1; }
[ -f "$FILE" ] || { echo "找不到檔案：$FILE"; exit 1; }

TOTAL=$(jq ".questions | length" "$FILE")
OK=0
SKIP=0
FAIL=0
START=$(date +%s)
echo "開始匯入：$TOTAL 題"

i=0
while read -r body; do
  i=$((i + 1))
  body=$(printf '%s' "$body" | jq -c --arg grade "$GRADE_ID" --arg unit "$UNIT_ID" '. + {grade_id: $grade, unit_id: $unit}')
  if [ "$FORCE_DUPLICATES" = "1" ]; then
    body=$(printf '%s' "$body" | jq -c '. + {duplicate_policy: "allow"}')
  fi
  title=$(printf '%s' "$body" | jq -r '.prompt_md // "" | gsub("\\n"; " ") | .[0:36]')
  printf "[%s/%s] %s ... " "$i" "$TOTAL" "$title"

  response=$(curl -sS -w '\n%{http_code}' -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: $API_KEY" \
    -d "$body")
  http_code=$(printf "%s" "$response" | tail -n 1)
  response_body=$(printf "%s" "$response" | sed '$d')

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    id=$(printf "%s" "$response_body" | jq -r ".id // empty")
    echo "OK $id"
    OK=$((OK + 1))
  else
    duplicate_id=$(printf '%s' "$response_body" | jq -r '.duplicate_question_id[0] // .duplicate_question_id // empty')
    if [ -n "$duplicate_id" ]; then
      echo "DUPLICATE $duplicate_id"
      SKIP=$((SKIP + 1))
    else
      echo "FAIL HTTP $http_code"
      printf "%s\n" "$response_body"
      FAIL=$((FAIL + 1))
    fi
  fi
done < <(jq -c '.questions[]' "$FILE")

END=$(date +%s)
echo "完成：成功 $OK / 重複略過 $SKIP / 失敗 $FAIL / 耗時 $((END - START)) 秒"`);

const windowsTimelineImportCommand = computed(() => String.raw`$ApiKey = "${apiKeyForCommand.value}"
$File = ".\math-bank-questions.json"
$ApiUrl = "${apiUrlForCommand.value}"
$GradeId = "${apiGuideGradeIdForCommand.value}"
$UnitId = "${apiGuideUnitIdForCommand.value}"
$ForceDuplicates = $false

if ($GradeId -like "請先選擇*" -or $UnitId -like "請先選擇*") { throw "請先在 UI 選擇年級與單元後再複製指令" }
if (!(Test-Path $File)) { throw "找不到檔案：$File" }
$Data = Get-Content $File -Raw | ConvertFrom-Json
$Questions = @($Data.questions)
$Total = $Questions.Count
$Ok = 0
$Skip = 0
$Fail = 0
$Index = 0
$Start = Get-Date
Write-Host "開始匯入：$Total 題"

foreach ($Question in $Questions) {
  $Index++
  $Question | Add-Member -NotePropertyName "grade_id" -NotePropertyValue $GradeId -Force
  $Question | Add-Member -NotePropertyName "unit_id" -NotePropertyValue $UnitId -Force
  if ($ForceDuplicates) { $Question | Add-Member -NotePropertyName "duplicate_policy" -NotePropertyValue "allow" -Force }
  $Title = (($Question.prompt_md -replace "\s+", " ").Trim())
  if ($Title.Length -gt 36) { $Title = $Title.Substring(0, 36) }
  Write-Host "[$Index/$Total] $Title ... " -NoNewline
  $Body = $Question | ConvertTo-Json -Depth 20 -Compress
  try {
    $Result = Invoke-RestMethod -Method Post -Uri $ApiUrl -Headers @{ "X-API-KEY" = $ApiKey; "Content-Type" = "application/json" } -Body $Body
    Write-Host "OK $($Result.id)"
    $Ok++
  } catch {
    $ErrorJson = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    $DuplicateId = @($ErrorJson.duplicate_question_id)[0]
    if ($DuplicateId) {
      Write-Host "DUPLICATE $DuplicateId"
      $Skip++
    } else {
      Write-Host "FAIL"
      Write-Host $_.Exception.Message
      $Fail++
    }
  }
}

$Elapsed = [int]((Get-Date) - $Start).TotalSeconds
Write-Host "完成：成功 $Ok / 重複略過 $Skip / 失敗 $Fail / 耗時 $Elapsed 秒"`);

const pythonFetchQuestionsCommand = computed(() => String.raw`import json
import requests

API_KEY = "${apiKeyForCommand.value}"
API_URL = "${fetchApiUrlForCommand.value}"
OUTPUT = "math-bank-fetch-results.json"

params = {
    "limit": 50,
    "grade_id": "${apiGuideGradeIdForCommand.value}",
    "unit_id": "${apiGuideUnitIdForCommand.value}",
    "difficulty": "",
    "status": "",
}
if "請先選擇" in params["grade_id"] or "請先選擇" in params["unit_id"]:
    raise SystemExit("請先在 UI 選擇年級與單元後再複製程式碼")
params = {key: value for key, value in params.items() if value != ""}

response = requests.get(
    API_URL,
    headers={"X-API-KEY": API_KEY, "Accept": "application/json"},
    params=params,
    timeout=30,
)
response.raise_for_status()

with open(OUTPUT, "w", encoding="utf-8") as file:
    json.dump(response.json(), file, ensure_ascii=False, indent=2)

print(f"已下載題目 JSON：{OUTPUT}")`);

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
  message.value = "正在使用 OCR 解析...";
  const accurateResult = await runAccurateExtraction();

  if (accurateResult.success && accurateResult.text?.trim()) {
    text.value = accurateResult.text || "";
    status.value = "success";
    message.value = "OCR 解析完成。";
    return;
  }

  status.value = "error";
  diagnostics.value = accurateResult.diagnostics || null;
  message.value =
    accurateResult.error ||
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
