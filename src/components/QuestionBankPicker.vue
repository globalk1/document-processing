<template>
  <section class="feature-workspace question-picker-workspace">
    <aside class="control-panel">
      <div class="draft-list-header">
        <div>
          <h2 class="section-title">題目列表</h2>
          <p>{{ questions.length }}{{ hasMore ? "+" : "" }} 題</p>
        </div>
        <button class="secondary-button compact" :disabled="loading" type="button" @click="loadQuestions">
          {{ loading ? "讀取中" : "重新整理" }}
        </button>
      </div>

      <section class="draft-filter-box">
        <label>
          <span class="field-label">搜尋</span>
          <input
            v-model.trim="filters.search"
            class="text-input"
            type="text"
            placeholder="題目、答案、詳解"
            @input="scheduleLoad"
          />
        </label>
        <label for="question-picker-status">
          <span class="field-label">狀態</span>
          <QuestionFilterSelect
            id="question-picker-status"
            v-model="filters.status"
            @change="loadQuestions"
            label="狀態"
            :options="[{ value: '', label: '全部狀態' }, ...questionStatuses.map(item => ({ value: item.value, label: item.label }))]"
          />
        </label>
        <div class="filter-grid two">
          <label>
            <span class="field-label">年級</span>
            <QuestionFilterSelect
              v-model="filters.grade_id"
              @change="handleGradeChange"
              label="年級"
              :options="[{ value: '', label: '全部年級' }, ...grades.map(grade => ({ value: grade.id, label: grade.name }))]"
            />
          </label>
          <label>
            <span class="field-label">單元</span>
            <QuestionFilterSelect
              v-model="filters.unit_id"
              :disabled="!filteredUnits.length"
              @change="loadQuestions"
              label="單元"
              :options="[{ value: '', label: '全部單元' }, ...filteredUnits.map(unit => ({ value: unit.id, label: unit.name }))]"
            />
          </label>
        </div>
        <label>
          <span class="field-label">來源</span>
          <QuestionFilterSelect
            v-model="filters.question_source"
            @change="loadQuestions"
            label="來源"
            :options="[{ value: '', label: '全部來源' }, ...questionSources.map(source => ({ value: source, label: source }))]"
          />
        </label>
        <label>
          <span class="field-label">難度</span>
          <QuestionFilterSelect
            v-model="filters.difficulty"
            label="難度"
            :options="[...questionDifficulties, { value: '', label: '全部難度' }]"
            @change="loadQuestions"
          />
        </label>
        <div class="draft-filter-actions">
          <button class="ghost-button compact" :disabled="loading" type="button" @click="resetFilters">
            重設
          </button>
        </div>
      </section>

      <section class="action-box">
        <h3>匯出</h3>
        <p class="field-hint">已選 {{ selectedQuestions.length }} 題。</p>
        <label>
          <span class="field-label">模板</span>
          <select v-model="examTemplateId" class="select-input" @change="handleExamTemplateChange">
            <option value="elementary_exam_paper">國小段考卷</option>
            <option value="junior_exam_paper">國中段考卷</option>
            <option value="high_school_exam_paper">高中段考卷</option>
          </select>
        </label>
        <label>
          <span class="field-label">檔名</span>
          <input v-model="filename" class="text-input" type="text" />
        </label>
        <label>
          <span class="field-label">標題</span>
          <input v-model="title" class="text-input" type="text" />
        </label>
        <label>
          <span class="field-label">範圍</span>
          <input v-model="examRange" class="text-input" type="text" />
        </label>
        <label>
          <span class="field-label">版本</span>
          <select v-model="mode" class="select-input">
            <option value="teaching">教師版</option>
            <option value="student">學生版</option>
          </select>
        </label>
        <button
          class="primary-button full"
          :disabled="!selectedQuestions.length || exporting"
          type="button"
          @click="exportSelectedWord"
        >
          {{ exporting ? "產生段考卷中..." : "匯出段考卷 Word" }}
        </button>
        <button
          class="secondary-button full"
          :disabled="!selectedQuestions.length"
          type="button"
          @click="clearSelection"
        >
          清除選取
        </button>
      </section>

      <p v-if="message" class="message" :class="status">{{ message }}</p>
    </aside>

    <section class="output-panel question-picker-panel">
      <div class="question-bank-toolbar">
        <div>
          <h2 class="section-title">題目列表</h2>
          <p>單擊預覽、雙擊編輯；勾選需要輸出的題目。</p>
        </div>
        <div class="icon-group">
          <button class="ghost-button compact" :disabled="!questions.length" type="button" @click="selectAllLoaded">
            全選目前列表
          </button>
        </div>
      </div>

      <div v-if="loading" class="empty-state">讀取題目中...</div>
      <div v-else-if="!questions.length" class="empty-state">
        <strong>目前沒有題目</strong>
        <span>調整條件後重新搜尋。</span>
      </div>
      <div v-else class="question-editor-result-board">
        <article
          v-for="question in questions"
          :key="question.id"
          class="question-editor-result-card question-picker-card"
          :class="{ active: isSelected(question.id), 'focus-target': focusedQuestionId === question.id }"
          :data-question-id="question.id"
          role="button"
          tabindex="0"
          aria-label="單擊預覽題目，雙擊編輯題目"
          aria-haspopup="dialog"
          title="單擊預覽題目，雙擊編輯題目"
          @click="queueQuestionPreview($event, question)"
          @dblclick="editQuestionFromCard($event, question)"
          @keydown="handleCardKeydown($event, question)"
        >
          <header>
            <div class="question-picker-heading">
              <div class="question-bank-meta">
                <span v-if="question.status" class="status-badge" :class="question.status">{{ formatQuestionStatus(question.status) }}</span>
                <span>{{ question.grade?.name || "-" }}</span>
                <span>{{ question.unit?.name || "-" }}</span>
                <span>{{ formatQuestionDifficulty(question.difficulty) }}</span>
                <span v-if="question.question_source">來源：{{ question.question_source }}</span>
              </div>
              <div class="question-picker-uuid">
                <span class="question-uuid-copy-control">
                  <button class="question-uuid-copy" type="button" title="複製題目 UUID" aria-label="複製題目 UUID" @click.stop="copyQuestionUuid(question.id)">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M5 5H3v15a2 2 0 0 0 2 2h11v-2H5V5Zm13-3H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V6l-4-4Zm-1 5V3.5L20.5 7H17Z" />
                    </svg>
                  </button>
                  <span v-if="copyFeedback.id === question.id" class="question-uuid-feedback" :class="{ error: copyFeedback.error }" role="status" aria-live="polite">
                    {{ copyFeedback.message }}
                  </span>
                </span>
                <code :title="question.id">UUID: {{ formatQuestionUuid(question.id) }}</code>
              </div>
            </div>
            <div class="question-picker-actions" @click.stop @dblclick.stop>
              <label class="question-picker-check">
                <input
                  type="checkbox"
                  :checked="isSelected(question.id)"
                  @change="toggleQuestion(question)"
                />
                <span>選取</span>
              </label>
              <button
                class="ghost-button compact"
                type="button"
                @click="openQuestionEditor(question.id)"
              >
                編輯題目
              </button>
            </div>
          </header>

          <section class="question-editor-preview-block prompt">
            <strong>題目</strong>
            <p><MathText :content="question.prompt_md" fallback="尚未輸入題目" /></p>
            <div v-if="getQuestionAssets(question, 'prompt').length" class="picker-asset-strip">
              <QuestionAssetThumbnail
                v-for="(asset, index) in getQuestionAssets(question, 'prompt')"
                :key="asset.id || `prompt-${index}`"
                :asset="asset"
              />
            </div>
          </section>

          <div class="question-editor-preview-grid">
            <section class="question-editor-preview-block answer">
              <strong>答案</strong>
              <p><MathText :content="question.answer_md" fallback="尚未輸入答案" /></p>
              <div v-if="getQuestionAssets(question, 'answer').length" class="picker-asset-strip">
                <QuestionAssetThumbnail
                  v-for="(asset, index) in getQuestionAssets(question, 'answer')"
                  :key="asset.id || `answer-${index}`"
                  :asset="asset"
                />
              </div>
            </section>
            <section class="question-editor-preview-block solution">
              <strong>詳解</strong>
              <div class="question-preview-body solution-preview-body" tabindex="0" role="region" aria-label="詳解預覽內文">
                <p><MathText :content="question.solution_md" fallback="尚未輸入詳解" /></p>
                <div v-if="getQuestionAssets(question, 'solution').length" class="picker-asset-strip">
                  <QuestionAssetThumbnail
                    v-for="(asset, index) in getQuestionAssets(question, 'solution')"
                    :key="asset.id || `solution-${index}`"
                    :asset="asset"
                  />
                </div>
              </div>
            </section>
          </div>
        </article>
        <div ref="questionSentinel" class="load-more-row compact" aria-live="polite">
          <span v-if="hasMore">{{ loadingMore ? "載入更多題目中..." : "滾到底自動載入更多題目" }}</span>
          <span v-else>已載入全部符合條件的題目</span>
        </div>
      </div>
    </section>
    <QuestionPreviewModal v-if="previewQuestion" :question="previewQuestion" :difficulty="formatQuestionDifficulty(previewQuestion.difficulty)" @close="clearQuestionPreview" />
  </section>
</template>

<script setup>
const props = defineProps({
  subject: { type: String, default: "math" },
  focusQuestion: { type: Object, default: null },
});
const emit = defineEmits(["edit-question"]);
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from "vue";
import MathText from "./MathText.vue";
import QuestionAssetThumbnail from "./QuestionAssetThumbnail.vue";
import QuestionPreviewModal from "./QuestionPreviewModal.vue";
import QuestionFilterSelect from "./QuestionFilterSelect.vue";
import { filterMatches, reconcileUnits } from "../utils/questionFilters";
import { QUESTION_DIFFICULTIES as questionDifficulties } from "../constants/questionDifficulties";
import { useQuestionPages } from "../composables/useQuestionPages";
import {
  generatePublicExamFromBank,
  listMathBankGrades,
  listMathBankQuestionSources,
  listMathBankUnits,
  searchStaffMathBankQuestions,
} from "../services/api";

const defaultStaffApiKey =
  import.meta.env.VITE_STAFF_API_KEY ||
  "Q2yu32SCbv8ha21dICnCOZ7vdq0Kl/PEbix44tq52KYhfrWcbRxrcrL9FtK7lqbj";
const examNames = {
  elementary_exam_paper: "國小段考卷",
  junior_exam_paper: "國中段考卷",
  high_school_exam_paper: "高中段考卷",
};
const questionStatuses = [
  { value: "draft", label: "草稿" },
  { value: "published", label: "公開" },
  { value: "archived", label: "封存" },
];

function formatQuestionStatus(value) {
  return questionStatuses.find((item) => item.value === value)?.label || value;
}

function formatQuestionUuid(value) {
  const id = String(value || "");
  const compact = id.replaceAll("-", "");
  return compact.length > 16 ? `${compact.slice(0, 8)}...${compact.slice(-6)}` : id;
}

function formatQuestionDifficulty(difficulty) {
  return questionDifficulties.find((item) => item.value === difficulty)?.label || difficulty || "-";
}

function getQuestionAssets(question, role) {
  return (question.assets || [])
    .filter((asset) => (asset.role || "prompt") === role)
    .filter((asset) => asset.url || asset.storage_key || asset.source_code)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

const grades = ref([]);
const units = ref([]);
const questionSources = ref([]);
const selectedMap = ref({});
const examTemplateId = ref("junior_exam_paper");
const filename = ref("國中段考卷.docx");
const title = ref("國中段考卷");
const examRange = ref("");
const mode = ref("teaching");
const exporting = ref(false);
const status = ref("idle");
const message = ref("");
const focusedQuestionId = ref("");
const copyFeedback = ref({ id: "", message: "", error: false });
const previewQuestion = ref(null);
const filters = reactive({
  search: "",
  status: "",
  grade_id: "",
  unit_id: "",
  difficulty: "",
  question_source: "",
});
const {
  questions,
  loading,
  loadingMore,
  hasMore,
  sentinel: questionSentinel,
  load: loadQuestionPage,
} = useQuestionPages({
  getFilters: () => ({ ...filters, include_details: "true" }),
  fetchPage: (params) => searchStaffMathBankQuestions(params, { subject: props.subject, apiKey: defaultStaffApiKey }),
  onError: (error) => {
    status.value = "error";
    message.value = error;
  },
  onLoaded: () => {
    status.value = "success";
    message.value = `已讀取 ${questions.value.length} 題。`;
  },
});
let loadTimer = null;
let focusTimer = null;
let copyTimer = null;
let copyRequest = 0;
let previewTimer = null;

const filteredUnits = computed(() =>
  units.value.filter((unit) => filterMatches(filters.grade_id, getUnitGradeId(unit))),
);
const selectedQuestions = computed(() => Object.values(selectedMap.value));

onMounted(async () => {
  await loadTaxonomy();
  await loadQuestions();
});

onActivated(() => {
  if (props.focusQuestion?.id) focusSavedQuestion(props.focusQuestion);
});

onDeactivated(() => {
  clearCopyFeedback();
  clearQuestionPreview();
});

onBeforeUnmount(() => {
  if (loadTimer) window.clearTimeout(loadTimer);
  if (focusTimer) window.clearTimeout(focusTimer);
  clearCopyFeedback();
  clearQuestionPreview();
});

watch(
  () => props.focusQuestion,
  (question) => {
    if (question?.id) focusSavedQuestion(question);
  },
);

async function loadTaxonomy() {
  const [gradeResult, unitResult, sourceResult] = await Promise.all([
    listMathBankGrades({}, { subject: props.subject }),
    listMathBankUnits({}, { subject: props.subject }),
    listMathBankQuestionSources({}, { subject: props.subject }),
  ]);
  if (gradeResult.success) grades.value = gradeResult.data || [];
  if (unitResult.success) units.value = unitResult.data || [];
  if (sourceResult.success) {
    const sources = Array.isArray(sourceResult.data)
      ? sourceResult.data
      : sourceResult.data?.results || [];
    questionSources.value = [...new Set(sources
      .map((source) => String(typeof source === "string" ? source : source?.name || "").trim())
      .filter(Boolean))];
  }
  if (!gradeResult.success || !unitResult.success || !sourceResult.success) {
    status.value = "error";
    message.value = gradeResult.error || unitResult.error || sourceResult.error || "分類或來源讀取失敗。";
  }
}

async function loadQuestions() {
  clearQuestionPreview();
  if (loadTimer) window.clearTimeout(loadTimer);
  loadTimer = null;
  status.value = "loading";
  message.value = "正在讀取題目...";
  await loadQuestionPage();
}

async function focusSavedQuestion(updatedQuestion) {
  const questionId = updatedQuestion.id;
  if (!filterMatches(filters.status, updatedQuestion.status)) {
    questions.value = questions.value.filter((question) => question.id !== questionId);
    return;
  }
  const questionIndex = questions.value.findIndex((question) => question.id === questionId);
  if (questionIndex >= 0) {
    const nextQuestions = [...questions.value];
    nextQuestions[questionIndex] = updatedQuestion;
    questions.value = nextQuestions;
  } else {
    questions.value = [updatedQuestion, ...questions.value];
  }

  await nextTick();
  const card = document.querySelector(`[data-question-id="${questionId}"]`);
  if (!card) return;
  focusedQuestionId.value = questionId;
  card.scrollIntoView({ behavior: "auto", block: "center" });
  if (focusTimer) window.clearTimeout(focusTimer);
  focusTimer = window.setTimeout(() => {
    focusedQuestionId.value = "";
    focusTimer = null;
  }, 2200);
}

function handleGradeChange() {
  filters.unit_id = reconcileUnits(filters.unit_id, filters.grade_id, units.value, getUnitGradeId);
  loadQuestions();
}

function scheduleLoad() {
  if (loadTimer) window.clearTimeout(loadTimer);
  loadTimer = window.setTimeout(() => {
    loadTimer = null;
    loadQuestions();
  }, 300);
}

function resetFilters() {
  filters.search = "";
  filters.status = "";
  filters.grade_id = "";
  filters.unit_id = "";
  filters.difficulty = "";
  filters.question_source = "";
  loadQuestions();
}

function isSelected(id) {
  return Boolean(selectedMap.value[id]);
}

function cancelQuestionPreviewTimer() {
  if (previewTimer) window.clearTimeout(previewTimer);
  previewTimer = null;
}

function clearQuestionPreview() {
  cancelQuestionPreviewTimer();
  previewQuestion.value = null;
}

function isCardControl(event) {
  return Boolean(event.target.closest("button, input, label, a, select, textarea"));
}

function queueQuestionPreview(event, question) {
  cancelQuestionPreviewTimer();
  if (isCardControl(event) || event.detail > 1) return;
  previewTimer = window.setTimeout(() => {
    previewTimer = null;
    previewQuestion.value = question;
  }, 350);
}

function openQuestionEditor(id) {
  clearQuestionPreview();
  emit("edit-question", id);
}

function editQuestionFromCard(event, question) {
  if (!isCardControl(event)) openQuestionEditor(question.id);
}

function handleCardKeydown(event, question) {
  if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  cancelQuestionPreviewTimer();
  previewQuestion.value = question;
}

function clearCopyFeedback() {
  copyRequest += 1;
  if (copyTimer) window.clearTimeout(copyTimer);
  copyTimer = null;
  copyFeedback.value = { id: "", message: "", error: false };
}

async function copyQuestionUuid(id) {
  cancelQuestionPreviewTimer();
  clearCopyFeedback();
  const request = copyRequest;
  let failed = false;
  try {
    await navigator.clipboard.writeText(String(id));
  } catch {
    failed = true;
  }
  if (request !== copyRequest) return;
  copyFeedback.value = { id, message: failed ? "複製失敗" : "已複製", error: failed };
  copyTimer = window.setTimeout(clearCopyFeedback, 1600);
}

function toggleQuestion(question) {
  const next = { ...selectedMap.value };
  if (next[question.id]) {
    delete next[question.id];
  } else {
    next[question.id] = question;
  }
  selectedMap.value = next;
}

function selectAllLoaded() {
  const next = { ...selectedMap.value };
  questions.value.forEach((question) => {
    next[question.id] = question;
  });
  selectedMap.value = next;
}

function clearSelection() {
  selectedMap.value = {};
}

function handleExamTemplateChange() {
  const nextName = examNames[examTemplateId.value];
  if (!title.value.trim() || Object.values(examNames).includes(title.value.trim())) title.value = nextName;
  if (!filename.value.trim() || Object.values(examNames).some((name) => filename.value.trim() === `${name}.docx`)) {
    filename.value = `${nextName}.docx`;
  }
}

async function exportSelectedWord() {
  if (!selectedQuestions.value.length || exporting.value) return;
  exporting.value = true;
  status.value = "loading";
  message.value = "正在產生段考卷 Word...";
  const defaultName = examNames[examTemplateId.value];
  const outputFilename = (filename.value.trim() || `${defaultName}.docx`).replace(/\.docx$/i, "") + ".docx";
  try {
    const result = await generatePublicExamFromBank({
      questionIds: selectedQuestions.value.map((question) => question.id),
      filename: outputFilename,
      title: title.value.trim() || defaultName,
      templateId: examTemplateId.value,
      examRange: examRange.value.trim(),
      mode: mode.value,
    });
    if (!result.success) {
      status.value = "error";
      message.value = result.error || "段考卷產生失敗。";
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename || outputFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.value = "success";
    message.value = "段考卷 Word 已開始下載。";
  } finally {
    exporting.value = false;
  }
}

function getUnitGradeId(unit) {
  return String(unit?.grade?.id || unit?.grade_id || unit?.grade || "");
}
</script>
