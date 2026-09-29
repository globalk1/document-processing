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
        <div class="filter-grid two">
          <label>
            <span class="field-label">年級</span>
            <select v-model="filters.grade_id" class="select-input" @change="handleGradeChange">
              <option value="">全部</option>
              <option v-for="grade in grades" :key="grade.id" :value="grade.id">
                {{ grade.name }}
              </option>
            </select>
          </label>
          <label>
            <span class="field-label">單元</span>
            <select
              v-model="filters.unit_id"
              class="select-input"
              :disabled="!filteredUnits.length"
              @change="loadQuestions"
            >
              <option value="">全部</option>
              <option v-for="unit in filteredUnits" :key="unit.id" :value="unit.id">
                {{ unit.name }}
              </option>
            </select>
          </label>
        </div>
        <label>
          <span class="field-label">來源</span>
          <select v-model="filters.question_source" class="select-input" @change="loadQuestions">
            <option value="">全部來源</option>
            <option v-for="source in questionSources" :key="source" :value="source">
              {{ source }}
            </option>
          </select>
        </label>
        <label>
          <span class="field-label">難度</span>
          <select v-model="filters.difficulty" class="select-input" @change="loadQuestions">
            <option value="">全部</option>
            <option v-for="item in questionDifficulties" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
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
          <p>選取需要輸出的題目。</p>
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
          :class="{ active: isSelected(question.id) }"
        >
          <header>
            <div class="question-bank-meta">
              <span>{{ question.grade?.name || "-" }}</span>
              <span>{{ question.unit?.name || "-" }}</span>
              <span>{{ formatQuestionDifficulty(question.difficulty) }}</span>
              <span v-if="question.question_source">來源：{{ question.question_source }}</span>
            </div>
            <label class="question-picker-check">
              <input
                type="checkbox"
                :checked="isSelected(question.id)"
                @change="toggleQuestion(question)"
              />
              <span>選取</span>
            </label>
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
              <p><MathText :content="question.solution_md" fallback="尚未輸入詳解" /></p>
              <div v-if="getQuestionAssets(question, 'solution').length" class="picker-asset-strip">
                <QuestionAssetThumbnail
                  v-for="(asset, index) in getQuestionAssets(question, 'solution')"
                  :key="asset.id || `solution-${index}`"
                  :asset="asset"
                />
              </div>
            </section>
          </div>
        </article>
        <div class="load-more-row compact">
          <button
            v-if="hasMore"
            class="secondary-button compact"
            :disabled="loadingMore"
            type="button"
            @click="loadMore"
          >
            {{ loadingMore ? "載入中" : "載入更多" }}
          </button>
          <span v-else>已載入全部符合條件的題目</span>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
const props = defineProps({ subject: { type: String, default: "math" } });
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import MathText from "./MathText.vue";
import QuestionAssetThumbnail from "./QuestionAssetThumbnail.vue";
import {
  generatePublicExamFromBank,
  listMathBankGrades,
  listMathBankQuestionSources,
  listMathBankUnits,
  searchStaffMathBankQuestions,
} from "../services/api";

const pageSize = 50;
const examNames = {
  elementary_exam_paper: "國小段考卷",
  junior_exam_paper: "國中段考卷",
  high_school_exam_paper: "高中段考卷",
};
const questionDifficulties = [
  { value: "A", label: "A 挑戰型" },
  { value: "B", label: "B 進階型" },
  { value: "C", label: "C 基礎型" },
  { value: "S", label: "S 究極型" },
  { value: "U", label: "未分類" },
];

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
const questions = ref([]);
const selectedMap = ref({});
const examTemplateId = ref("junior_exam_paper");
const filename = ref("國中段考卷.docx");
const title = ref("國中段考卷");
const examRange = ref("");
const mode = ref("teaching");
const exporting = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const nextCursor = ref("");
const status = ref("idle");
const message = ref("");
const filters = reactive({
  search: "",
  grade_id: "",
  unit_id: "",
  difficulty: "",
  question_source: "",
});
let loadTimer = null;

const filteredUnits = computed(() =>
  filters.grade_id
    ? units.value.filter((unit) => getUnitGradeId(unit) === filters.grade_id)
    : units.value,
);
const selectedQuestions = computed(() => Object.values(selectedMap.value));

onMounted(async () => {
  await loadTaxonomy();
  await loadQuestions();
});

onBeforeUnmount(() => {
  if (loadTimer) window.clearTimeout(loadTimer);
});

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
  loading.value = true;
  status.value = "loading";
  message.value = "正在讀取題目...";

  const result = await fetchQuestionPage("");
  loading.value = false;
  if (!result.success) {
    status.value = "error";
    message.value = result.error || "題目讀取失敗。";
    return;
  }

  questions.value = result.data.results || [];
  hasMore.value = Boolean(result.data.has_more && result.data.next_cursor);
  nextCursor.value = result.data.next_cursor || "";
  status.value = "success";
  message.value = `已讀取 ${questions.value.length} 題。`;
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  loadingMore.value = true;
  const result = await fetchQuestionPage(nextCursor.value);
  loadingMore.value = false;
  if (!result.success) {
    status.value = "error";
    message.value = result.error || "更多題目讀取失敗。";
    return;
  }
  questions.value = [...questions.value, ...(result.data.results || [])];
  hasMore.value = Boolean(result.data.has_more && result.data.next_cursor);
  nextCursor.value = result.data.next_cursor || "";
}

function fetchQuestionPage(cursor) {
  return searchStaffMathBankQuestions(
    {
      search: filters.search,
      grade_id: filters.grade_id,
      unit_id: filters.unit_id,
      difficulty: filters.difficulty,
      question_source: filters.question_source,
      include_details: "true",
      limit: pageSize,
      cursor,
    },
    { subject: props.subject },
  );
}

function handleGradeChange() {
  filters.unit_id = "";
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
  filters.grade_id = "";
  filters.unit_id = "";
  filters.difficulty = "";
  filters.question_source = "";
  loadQuestions();
}

function isSelected(id) {
  return Boolean(selectedMap.value[id]);
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
