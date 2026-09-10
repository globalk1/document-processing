<template>
  <section class="feature-workspace question-picker-workspace">
    <aside class="control-panel">
      <div class="draft-list-header">
        <div>
          <h2 class="section-title">公開題目</h2>
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
        <button
          class="primary-button full"
          :disabled="!selectedQuestions.length"
          type="button"
          @click="exportSelectedWord"
        >
          匯出 Word
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
          <p>只顯示公開題目。</p>
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
              <span>{{ question.difficulty || "-" }}</span>
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
          </section>

          <div class="question-editor-preview-grid">
            <section class="question-editor-preview-block answer">
              <strong>答案</strong>
              <p><MathText :content="question.answer_md" fallback="尚未輸入答案" /></p>
            </section>
            <section class="question-editor-preview-block solution">
              <strong>詳解</strong>
              <p><MathText :content="question.solution_md" fallback="尚未輸入詳解" /></p>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import MathText from "./MathText.vue";
import {
  listMathBankGrades,
  listMathBankUnits,
  searchStaffMathBankQuestions,
} from "../services/api";

const defaultStaffApiKey =
  import.meta.env.VITE_STAFF_API_KEY ||
  "Q2yu32SCbv8ha21dICnCOZ7vdq0Kl/PEbix44tq52KYhfrWcbRxrcrL9FtK7lqbj";
const pageSize = 50;
const questionDifficulties = [
  { value: "A", label: "A 基礎型" },
  { value: "B", label: "B 進階型" },
  { value: "C", label: "C 挑戰型" },
  { value: "S", label: "S 究極型" },
];

const grades = ref([]);
const units = ref([]);
const questions = ref([]);
const selectedMap = ref({});
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
  const [gradeResult, unitResult] = await Promise.all([
    listMathBankGrades({}, { apiKey: defaultStaffApiKey }),
    listMathBankUnits({}, { apiKey: defaultStaffApiKey }),
  ]);
  if (gradeResult.success) grades.value = gradeResult.data || [];
  if (unitResult.success) units.value = unitResult.data || [];
  if (!gradeResult.success || !unitResult.success) {
    status.value = "error";
    message.value = gradeResult.error || unitResult.error || "分類讀取失敗。";
  }
}

async function loadQuestions() {
  loading.value = true;
  status.value = "loading";
  message.value = "正在讀取公開題目...";

  const result = await fetchQuestionPage("");
  loading.value = false;
  if (!result.success) {
    status.value = "error";
    message.value = result.error || "題目讀取失敗。";
    return;
  }

  questions.value = filterPublicQuestions(result.data.results || []);
  hasMore.value = Boolean(result.data.has_more && result.data.next_cursor);
  nextCursor.value = result.data.next_cursor || "";
  status.value = "success";
  message.value = `已讀取 ${questions.value.length} 題公開題目。`;
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
  questions.value = [...questions.value, ...filterPublicQuestions(result.data.results || [])];
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
      visibility: "public",
      include_details: "true",
      limit: pageSize,
      cursor,
    },
    { apiKey: defaultStaffApiKey },
  );
}

function filterPublicQuestions(items) {
  return items.filter((question) => !question.visibility || question.visibility === "public");
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

function exportSelectedWord() {
  if (!selectedQuestions.value.length) return;
  const html = buildWordHtml(selectedQuestions.value);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `題庫挑題-${formatDateForFilename(new Date())}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildWordHtml(items) {
  const body = items
    .map(
      (question, index) => `
        <section class="question">
          <h2>第 ${index + 1} 題</h2>
          <p class="meta">${escapeHtml(question.grade?.name || "-")} / ${escapeHtml(
            question.unit?.name || "-",
          )}${question.question_source ? ` / 來源：${escapeHtml(question.question_source)}` : ""}</p>
          <div class="block"><strong>題目</strong>${formatMultiline(question.prompt_md || "")}</div>
          <div class="block"><strong>答案</strong>${formatMultiline(question.answer_md || "")}</div>
          <div class="block"><strong>詳解</strong>${formatMultiline(question.solution_md || "")}</div>
        </section>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>題庫挑題</title>
        <style>
          body { font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif; color: #111; line-height: 1.7; }
          h1 { font-size: 22pt; margin: 0 0 18pt; }
          h2 { font-size: 14pt; margin: 0 0 6pt; }
          .question { page-break-inside: avoid; margin: 0 0 18pt; padding-bottom: 12pt; border-bottom: 1px solid #ddd; }
          .meta { margin: 0 0 8pt; color: #555; }
          .block { margin: 8pt 0; }
          .block strong { display: block; margin-bottom: 3pt; color: #333; }
          p { margin: 0 0 4pt; }
        </style>
      </head>
      <body>
        <h1>題庫挑題</h1>
        ${body}
      </body>
    </html>
  `;
}

function formatMultiline(value) {
  const lines = String(value || "").split(/\r?\n/);
  if (!lines.some((line) => line.trim())) return "<p>（空白）</p>";
  return lines.map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`).join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getUnitGradeId(unit) {
  return String(unit?.grade?.id || unit?.grade_id || unit?.grade || "");
}
</script>
