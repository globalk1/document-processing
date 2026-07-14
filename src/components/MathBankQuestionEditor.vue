<template>
  <section class="feature-workspace question-editor-workspace">
    <aside class="control-panel">
      <h2 class="section-title">編輯題目</h2>

      <label class="api-key-field">
        <span>Staff API Key</span>
        <input
          v-model="localStaffApiKey"
          autocomplete="off"
          spellcheck="false"
          type="password"
          placeholder="搜尋與編輯題目時使用"
          @input="handleApiKeyInput"
        />
      </label>

      <section class="action-box">
        <h3>查詢條件</h3>
        <label class="field-label">
          搜尋
          <input
            v-model="filters.search"
            class="text-input"
            type="text"
            placeholder="UUID、題目、答案、詳解、思維"
            @input="scheduleSearch"
          />
        </label>
        <div class="filter-grid two">
          <label>
            <span class="field-label">年級</span>
            <select
              v-model="filters.grade_id"
              class="select-input"
              @change="handleFilterGradeChange"
            >
              <option :value="filterNoneValue">請選擇</option>
              <option :value="filterAllValue">全部年級</option>
              <option v-for="grade in grades" :key="grade.id" :value="grade.id">
                {{ grade.name }}
              </option>
            </select>
          </label>
          <label>
            <span class="field-label">單元</span>
            <select v-model="filters.unit_id" class="select-input" @change="loadQuestions">
              <option :value="filterNoneValue">請選擇</option>
              <option :value="filterAllValue">全部單元</option>
              <option v-for="unit in filteredFilterUnits" :key="unit.id" :value="unit.id">
                {{ unit.name }}
              </option>
            </select>
          </label>
        </div>
        <div class="filter-grid two">
          <label>
            <span class="field-label">難度</span>
            <select v-model="filters.difficulty" class="select-input" @change="loadQuestions">
              <option value="">全部難度</option>
              <option v-for="item in questionDifficulties" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </label>
          <label>
            <span class="field-label">狀態</span>
            <select v-model="filters.status" class="select-input" @change="loadQuestions">
              <option value="">全部狀態</option>
              <option value="draft">草稿</option>
              <option value="published">已發布</option>
              <option value="archived">封存</option>
            </select>
          </label>
        </div>
        <div class="editor-action-row">
          <button class="primary-button full" :disabled="loading" type="button" @click="loadQuestions">
            {{ loading ? "讀取中" : "搜尋題目" }}
          </button>
          <button class="secondary-button full" type="button" @click="resetFilters">
            重設
          </button>
        </div>
      </section>

      <section class="action-box">
        <h3>操作</h3>
        <button class="primary-button full" type="button" @click="startCreateQuestion">
          新增草稿
        </button>
      </section>

      <p v-if="message" class="message" :class="status">{{ message }}</p>

    </aside>

    <section class="output-panel question-editor-panel">
      <template v-if="!editorOpen">
      <div class="question-bank-toolbar">
        <div>
          <h2 class="section-title">查詢結果</h2>
          <p>{{ questions.length }}{{ hasMore ? "+" : "" }} 題符合條件</p>
        </div>
        <div class="icon-group">
          <button class="icon-button" title="重新搜尋" type="button" @click="loadQuestions">
            ↻
          </button>
        </div>
      </div>

      <div v-if="!hasStaffApiKey" class="empty-state">
        請先輸入 Staff API Key。
      </div>
      <div v-else-if="loading" class="empty-state">Loading...</div>
      <div v-else-if="!questions.length" class="empty-state">
        <strong>尚未查到題目</strong>
        <span>請先選擇條件或按「搜尋題目」。</span>
      </div>
      <div v-else class="question-editor-result-board">
        <article
          v-for="question in questions"
          :key="question.id"
          class="question-editor-result-card"
          :class="{ active: selectedQuestionId === question.id }"
        >
          <header>
            <div class="question-bank-meta">
              <span>{{ question.grade?.name || "-" }}</span>
              <span>{{ question.unit?.name || "-" }}</span>
              <span>{{ question.difficulty || "-" }}</span>
              <span :class="['status-badge', question.status]">
                {{ formatStatus(question.status) }}
              </span>
            </div>
            <div class="editor-card-actions">
              <button
                class="ghost-button compact"
                type="button"
                @click="copyText(question.id)"
              >
                複製 UUID
              </button>
              <button
                class="primary-inline-button"
                type="button"
                @click="selectQuestion(question.id)"
              >
                編輯
              </button>
            </div>
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
        <div ref="resultSentinelRef" class="load-more-row compact">
          <span v-if="hasMore">{{ loadingMore ? "載入中" : "往下捲動載入更多" }}</span>
          <span v-else-if="questions.length">已載入全部符合條件的題目</span>
        </div>
      </div>
      </template>

      <form v-else class="question-edit-form question-edit-form-panel" @submit.prevent="saveQuestion">
        <div class="question-bank-toolbar">
          <div>
            <h2 class="section-title">
              {{ editingQuestionId ? "編輯既有題目" : "新增草稿" }}
            </h2>
            <p>{{ formSummary }}</p>
          </div>
          <div class="icon-group">
            <button
              class="secondary-button compact preview-edit-button"
              type="button"
              @click="previewEditorOpen = true"
            >
              預覽編輯
            </button>
            <button
              v-if="editingQuestionId"
              class="icon-button"
              title="複製 UUID"
              type="button"
              @click="copyText(editingQuestionId)"
            >
              ⧉
            </button>
            <button class="icon-button" title="回到列表" type="button" @click="closeEditor">
              ↩
            </button>
          </div>
        </div>

        <div class="question-edit-compare-layout">
          <div class="question-edit-column">
            <section class="word-workflow-section">
              <header class="word-workflow-header">
                <div>
                  <span>01</span>
                  <h3>題目資料</h3>
                </div>
                <strong>{{ editingQuestionId ? shortId(editingQuestionId) : "New" }}</strong>
              </header>

              <div class="filter-grid two">
                <label>
                  <span class="field-label">年級</span>
                  <select v-model="questionForm.grade_id" class="select-input" @change="questionForm.unit_id = ''">
                    <option value="">選擇年級</option>
                    <option v-for="grade in grades" :key="grade.id" :value="grade.id">
                      {{ grade.name }}
                    </option>
                  </select>
                </label>
                <label>
                  <span class="field-label">單元</span>
                  <select v-model="questionForm.unit_id" class="select-input" :disabled="!filteredFormUnits.length">
                    <option value="">{{ questionForm.grade_id ? "選擇單元" : "先選年級" }}</option>
                    <option v-for="unit in filteredFormUnits" :key="unit.id" :value="unit.id">
                      {{ unit.name }}
                    </option>
                  </select>
                </label>
              </div>

              <div class="filter-grid two">
                <label>
                  <span class="field-label">題型</span>
                  <select v-model="questionForm.type" class="select-input">
                    <option v-for="item in questionTypes" :key="item.value" :value="item.value">
                      {{ item.label }}
                    </option>
                  </select>
                </label>
                <label>
                  <span class="field-label">難度</span>
                  <select v-model="questionForm.difficulty" class="select-input">
                    <option v-for="item in questionDifficulties" :key="item.value" :value="item.value">
                      {{ item.label }}
                    </option>
                  </select>
                </label>
              </div>

              <div class="fixed-meta-line">
                <span>儲存狀態：草稿</span>
                <span>員工題庫</span>
                <span v-if="questionForm.created_by_label">作者：{{ questionForm.created_by_label }}</span>
              </div>

              <label class="field-label">
                題目 Markdown / KaTeX
                <textarea
                  v-model="questionForm.prompt_md"
                  class="textarea compact-textarea question-markdown-textarea"
                  placeholder="輸入題目內容。"
                ></textarea>
              </label>

              <label class="field-label">
                答案
                <textarea
                  v-model="questionForm.answer_md"
                  class="textarea compact-textarea answer-textarea"
                  placeholder="輸入答案。"
                ></textarea>
              </label>

              <label class="field-label">
                詳解
                <textarea
                  v-model="questionForm.solution_md"
                  class="textarea compact-textarea solution-textarea"
                  placeholder="輸入詳解。"
                ></textarea>
              </label>

              <label class="field-label">
                思維（每行一項）
                <textarea
                  v-model="questionForm.thinking"
                  class="textarea compact-textarea thinking-textarea"
                  placeholder="例如：座標幾何&#10;外接圓"
                ></textarea>
              </label>
            </section>

            <section class="word-workflow-section">
              <header class="word-workflow-header">
                <div>
                  <span>02</span>
                  <h3>圖片 / 程式資產</h3>
                </div>
                <button class="ghost-button compact" type="button" @click="addAsset">
                  新增資產
                </button>
              </header>

              <div v-if="!questionForm.assets.length" class="empty-state compact">
                沒有資產。純文字題可以略過。
              </div>
              <article
                v-for="(asset, index) in questionForm.assets"
                :key="`asset-${index}`"
                class="asset-edit-card"
              >
                <div class="filter-grid two">
                  <label>
                    <span class="field-label">用途</span>
                    <select v-model="asset.role" class="select-input">
                      <option v-for="item in assetRoles" :key="item.value" :value="item.value">
                        {{ item.label }}
                      </option>
                    </select>
                  </label>
                  <label>
                    <span class="field-label">排序</span>
                    <input v-model.number="asset.sort_order" class="text-input" type="number" min="0" />
                  </label>
                </div>
                <label class="field-label">
                  圖片 URL
                  <input v-model="asset.url" class="text-input" type="text" placeholder="https://..." />
                </label>
                <label class="field-label">
                  Storage Key
                  <input v-model="asset.storage_key" class="text-input" type="text" />
                </label>
                <div class="filter-grid two">
                  <label>
                    <span class="field-label">Alt 文字</span>
                    <input v-model="asset.alt_text" class="text-input" type="text" />
                  </label>
                  <label>
                    <span class="field-label">MIME type</span>
                    <input v-model="asset.mime_type" class="text-input" type="text" placeholder="image/png" />
                  </label>
                </div>
                <label class="field-label">
                  Source Language
                  <select v-model="asset.source_language" class="select-input">
                    <option v-for="item in assetLanguages" :key="item.value" :value="item.value">
                      {{ item.label }}
                    </option>
                  </select>
                </label>
                <label class="field-label">
                  Source Code
                  <textarea
                    v-model="asset.source_code"
                    class="textarea compact-textarea source-code-textarea"
                    placeholder="SVG / TikZ / Python / 其他程式碼"
                  ></textarea>
                </label>
                <label class="field-label">
                  批改 / 補圖備註
                  <textarea
                    v-model="asset.marking_guide"
                    class="textarea compact-textarea"
                  ></textarea>
                </label>
                <button class="ghost-button compact danger" type="button" @click="removeAsset(index)">
                  刪除資產
                </button>
              </article>
            </section>
          </div>

          <aside class="question-preview-column">
            <section class="word-workflow-section question-preview-section">
              <header class="word-workflow-header">
                <div>
                  <span>03</span>
                  <h3>儲存</h3>
                </div>
                <label class="checkbox-row">
                  <input v-model="allowDuplicate" type="checkbox" />
                  <span>允許重複題</span>
                </label>
              </header>

              <button class="secondary-button full preview-edit-button" type="button" @click="previewEditorOpen = true">
                預覽編輯
              </button>

              <div class="editor-action-row">
                <button class="primary-button" :disabled="saving" type="submit">
                  {{ saving ? "儲存中" : editingQuestionId ? "更新題目" : "建立題目" }}
                </button>
                <button
                  v-if="editingQuestionId"
                  class="ghost-button danger"
                  :disabled="saving"
                  type="button"
                  @click="deleteQuestion"
                >
                  刪除題目
                </button>
              </div>
            </section>
          </aside>
        </div>
      </form>
    </section>

    <div
      v-if="previewEditorOpen"
      class="preview-editor-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-editor-title"
    >
      <section class="preview-editor-modal-panel">
        <header class="question-bank-toolbar">
          <div>
            <h2 id="preview-editor-title" class="section-title">預覽編輯</h2>
            <p>左側編輯 Markdown / KaTeX，右側即時預覽。</p>
          </div>
          <button class="icon-button" title="關閉" type="button" @click="previewEditorOpen = false">
            ×
          </button>
        </header>

        <div class="preview-editor-modal-grid">
          <div class="preview-editor-textboxes">
            <label class="field-label">
              題目 Markdown / KaTeX
              <textarea
                v-model="questionForm.prompt_md"
                class="textarea preview-editor-textarea question-modal-textarea"
                placeholder="輸入題目內容。"
              ></textarea>
            </label>

            <label class="field-label">
              答案
              <textarea
                v-model="questionForm.answer_md"
                class="textarea preview-editor-textarea answer-modal-textarea"
                placeholder="輸入答案。"
              ></textarea>
            </label>

            <label class="field-label">
              詳解
              <textarea
                v-model="questionForm.solution_md"
                class="textarea preview-editor-textarea solution-modal-textarea"
                placeholder="輸入詳解。"
              ></textarea>
            </label>
          </div>

          <div class="preview-editor-output">
            <section>
              <strong>題目</strong>
              <p><MathText :content="questionForm.prompt_md" fallback="尚未輸入題目" /></p>
            </section>
            <section class="answer-preview">
              <strong>答案</strong>
              <p><MathText :content="questionForm.answer_md" fallback="尚未輸入答案" /></p>
            </section>
            <section class="solution-preview">
              <strong>詳解</strong>
              <p><MathText :content="questionForm.solution_md" fallback="尚未輸入詳解" /></p>
            </section>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import MathText from "./MathText.vue";
import {
  createStaffMathBankQuestion,
  deleteStaffMathBankQuestion,
  getStaffMathBankQuestion,
  listMathBankGrades,
  listMathBankUnits,
  searchStaffMathBankQuestions,
  updateStaffMathBankQuestion,
} from "../services/api";

const props = defineProps({
  staffApiKey: {
    type: String,
    default: "",
  },
});
const emit = defineEmits(["update:staffApiKey", "copy"]);

const filterNoneValue = "__none__";
const filterAllValue = "__all__";
const pageSize = 30;
const questionTypes = [
  { value: "choice", label: "選擇題" },
  { value: "fill", label: "填充題" },
  { value: "calculation", label: "計算題" },
  { value: "proof", label: "證明題" },
  { value: "application", label: "應用題" },
];
const questionDifficulties = [
  { value: "A", label: "A 基礎型" },
  { value: "B", label: "B 進階型" },
  { value: "C", label: "C 挑戰型" },
  { value: "S", label: "S 究極型" },
];
const assetRoles = [
  { value: "prompt", label: "題目" },
  { value: "answer", label: "答案" },
  { value: "solution", label: "詳解" },
];
const assetLanguages = [
  { value: "", label: "未指定" },
  { value: "python", label: "Python" },
  { value: "svg", label: "SVG" },
  { value: "tikz", label: "TikZ" },
  { value: "latex", label: "LaTeX" },
  { value: "manim", label: "Manim" },
  { value: "mermaid", label: "Mermaid" },
  { value: "javascript", label: "JavaScript" },
  { value: "other", label: "其他" },
];

const localStaffApiKey = ref(props.staffApiKey);
const grades = ref([]);
const units = ref([]);
const questions = ref([]);
const questionById = ref({});
const selectedQuestionId = ref("");
const editingQuestionId = ref("");
const nextCursor = ref(null);
const hasMore = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const resultSentinelRef = ref(null);
const editorOpen = ref(false);
const previewEditorOpen = ref(false);
const saving = ref(false);
const status = ref("idle");
const message = ref("");
const allowDuplicate = ref(false);
const searchTimer = ref(null);
let resultObserver = null;
const filters = reactive({
  search: "",
  grade_id: filterNoneValue,
  unit_id: filterNoneValue,
  difficulty: "",
  status: "draft",
});
const questionForm = reactive(createEmptyQuestionForm());

const hasStaffApiKey = computed(() => Boolean(localStaffApiKey.value.trim()));
const filteredFilterUnits = computed(() => {
  if (filters.grade_id === filterNoneValue) return [];
  if (filters.grade_id === filterAllValue) return units.value;
  return units.value.filter((unit) => getUnitGradeId(unit) === filters.grade_id);
});
const filteredFormUnits = computed(() =>
  questionForm.grade_id
    ? units.value.filter((unit) => getUnitGradeId(unit) === questionForm.grade_id)
    : [],
);
const formSummary = computed(() => {
  if (editingQuestionId.value) {
    return "校正題目內容、答案、詳解與補充資產。";
  }
  return "新題目會以草稿建立。";
});

watch(
  () => props.staffApiKey,
  (value) => {
    if (value !== localStaffApiKey.value) localStaffApiKey.value = value;
  },
);

onMounted(async () => {
  await loadTaxonomy({ silent: true });
  resetQuestionForm();
});

onBeforeUnmount(() => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
  stopResultObserver();
});

function handleApiKeyInput() {
  emit("update:staffApiKey", localStaffApiKey.value);
  grades.value = [];
  units.value = [];
  clearQuestions();
  if (hasStaffApiKey.value) {
    loadTaxonomy({ silent: true });
  }
}

async function loadTaxonomy({ silent = false } = {}) {
  if (!requireApiKey()) return false;
  if (!silent) {
    status.value = "loading";
    message.value = "正在讀取年級與單元...";
  }

  const [gradeResult, unitResult] = await Promise.all([
    listMathBankGrades({}, { apiKey: localStaffApiKey.value }),
    listMathBankUnits({}, { apiKey: localStaffApiKey.value }),
  ]);
  if (gradeResult.success) grades.value = gradeResult.data || [];
  if (unitResult.success) units.value = unitResult.data || [];
  if (!gradeResult.success || !unitResult.success) {
    status.value = "error";
    message.value = gradeResult.error || unitResult.error || "題庫分類讀取失敗。";
    return false;
  }
  if (!silent) {
    status.value = "success";
    message.value = "題庫分類已讀取。";
  }
  return true;
}

function requireApiKey() {
  if (hasStaffApiKey.value) return true;
  status.value = "error";
  message.value = "請先輸入 Staff API Key。";
  return false;
}

function scheduleSearch() {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
  searchTimer.value = window.setTimeout(() => {
    searchTimer.value = null;
    loadQuestions();
  }, 300);
}

function handleFilterGradeChange() {
  filters.unit_id = filters.grade_id === filterNoneValue ? filterNoneValue : filterAllValue;
  loadQuestions();
}

function getSearchParams(cursor = "") {
  return {
    search: filters.search.trim(),
    grade_id:
      filters.grade_id === filterNoneValue || filters.grade_id === filterAllValue
        ? ""
        : filters.grade_id,
    unit_id:
      filters.unit_id === filterNoneValue || filters.unit_id === filterAllValue
        ? ""
        : filters.unit_id,
    difficulty: filters.difficulty,
    status: filters.status,
    include_details: "true",
    limit: pageSize,
    cursor,
  };
}

async function loadQuestions() {
  if (!requireApiKey()) return;
  loading.value = true;
  status.value = "loading";
  message.value = "正在搜尋題目...";
  const result = await searchStaffMathBankQuestions(getSearchParams(), {
    apiKey: localStaffApiKey.value,
  });
  loading.value = false;

  if (!result.success) {
    status.value = "error";
    message.value = result.error || "題目讀取失敗。";
    return;
  }

  mergeQuestions(result.data.results || [], true);
  hasMore.value = Boolean(result.data.has_more);
  nextCursor.value = result.data.next_cursor || null;
  setupResultObserver();
  status.value = "success";
  message.value = `已讀取 ${questions.value.length}${hasMore.value ? "+" : ""} 題。`;
}

async function loadMoreQuestions() {
  if (!requireApiKey() || !hasMore.value || !nextCursor.value || loadingMore.value) return;
  loadingMore.value = true;
  const result = await searchStaffMathBankQuestions(getSearchParams(nextCursor.value), {
    apiKey: localStaffApiKey.value,
  });
  loadingMore.value = false;
  if (!result.success) {
    status.value = "error";
    message.value = result.error || "載入更多題目失敗。";
    return;
  }
  mergeQuestions(result.data.results || [], false);
  hasMore.value = Boolean(result.data.has_more);
  nextCursor.value = result.data.next_cursor || null;
  setupResultObserver();
}

async function setupResultObserver() {
  stopResultObserver();
  if (!hasMore.value) return;
  await nextTick();
  const sentinel = resultSentinelRef.value;
  if (!sentinel) return;

  resultObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (
        entry?.isIntersecting &&
        hasMore.value &&
        !loading.value &&
        !loadingMore.value
      ) {
        loadMoreQuestions();
      }
    },
    { rootMargin: "320px 0px" },
  );
  resultObserver.observe(sentinel);
}

function stopResultObserver() {
  if (!resultObserver) return;
  resultObserver.disconnect();
  resultObserver = null;
}

function mergeQuestions(items, reset) {
  const nextById = reset ? {} : { ...questionById.value };
  const ids = reset ? [] : questions.value.map((question) => question.id);
  const idSet = new Set(ids);
  items.forEach((question) => {
    nextById[question.id] = {
      ...(nextById[question.id] || {}),
      ...question,
    };
    if (!idSet.has(question.id)) {
      ids.push(question.id);
      idSet.add(question.id);
    }
  });
  questionById.value = nextById;
  questions.value = ids.map((id) => nextById[id]).filter(Boolean);
}

function clearQuestions() {
  stopResultObserver();
  questions.value = [];
  questionById.value = {};
  selectedQuestionId.value = "";
  hasMore.value = false;
  nextCursor.value = null;
}

function resetFilters() {
  filters.search = "";
  filters.grade_id = filterNoneValue;
  filters.unit_id = filterNoneValue;
  filters.difficulty = "";
  filters.status = "draft";
  clearQuestions();
  status.value = "idle";
  message.value = "";
}

async function selectQuestion(id) {
  if (!requireApiKey()) return;
  selectedQuestionId.value = id;
  status.value = "loading";
  message.value = "正在讀取題目詳情...";
  const result = await getStaffMathBankQuestion(id, { apiKey: localStaffApiKey.value });
  if (!result.success) {
    status.value = "error";
    message.value = result.error || "題目詳情讀取失敗。";
    return;
  }
  questionById.value = {
    ...questionById.value,
    [id]: result.data,
  };
  applyQuestionToForm(result.data);
  editorOpen.value = true;
  status.value = "success";
  message.value = "題目已載入。";
}

function startCreateQuestion() {
  resetQuestionForm();
  editorOpen.value = true;
}

function resetQuestionForm() {
  selectedQuestionId.value = "";
  editingQuestionId.value = "";
  allowDuplicate.value = false;
  Object.assign(questionForm, createEmptyQuestionForm(), {
    grade_id:
      filters.grade_id === filterNoneValue || filters.grade_id === filterAllValue
        ? ""
        : filters.grade_id,
    unit_id:
      filters.unit_id === filterNoneValue || filters.unit_id === filterAllValue
        ? ""
        : filters.unit_id,
  });
}

function closeEditor() {
  editorOpen.value = false;
  previewEditorOpen.value = false;
}

function applyQuestionToForm(question) {
  editingQuestionId.value = question.id || "";
  allowDuplicate.value = false;
  Object.assign(questionForm, {
    grade_id: question.grade?.id || question.grade_id || "",
    unit_id: question.unit?.id || question.unit_id || "",
    type: question.type || "calculation",
    difficulty: question.difficulty || "A",
    prompt_md: question.prompt_md || "",
    answer_md: question.answer_md || "",
    solution_md: question.solution_md || "",
    thinking: formatThinking(question.thinking),
    status: "draft",
    visibility: "public",
    created_by_auth_type: question.created_by_auth_type || "",
    created_by_key_name: question.created_by_key_name || "",
    created_by_label: question.created_by_label || "",
    assets: (question.assets || []).map(normalizeAsset),
  });
}

function createEmptyQuestionForm() {
  return {
    grade_id: "",
    unit_id: "",
    type: "calculation",
    difficulty: "A",
    prompt_md: "",
    answer_md: "",
    solution_md: "",
    thinking: "",
    status: "draft",
    visibility: "public",
    created_by_auth_type: "",
    created_by_key_name: "",
    created_by_label: "",
    assets: [],
  };
}

function normalizeAsset(asset = {}) {
  return {
    role: asset.role || "prompt",
    url: asset.url || "",
    storage_key: asset.storage_key || "",
    alt_text: asset.alt_text || "",
    mime_type: asset.mime_type || "",
    source_language: asset.source_language || "",
    source_code: asset.source_code || "",
    marking_guide: asset.marking_guide || "",
    sort_order: Number(asset.sort_order) || 0,
  };
}

function buildPayload() {
  return {
    grade_id: questionForm.grade_id,
    unit_id: questionForm.unit_id,
    type: questionForm.type,
    difficulty: questionForm.difficulty,
    prompt_md: questionForm.prompt_md,
    answer_md: questionForm.answer_md,
    solution_md: questionForm.solution_md,
    status: "draft",
    visibility: "public",
    thinking: splitThinking(questionForm.thinking),
    assets: questionForm.assets.map(normalizeAsset),
    duplicate_policy: allowDuplicate.value ? "allow" : undefined,
  };
}

function validateForm() {
  if (!questionForm.grade_id) return "請選擇年級。";
  if (!questionForm.unit_id) return "請選擇單元。";
  if (!questionForm.prompt_md.trim() && !questionForm.assets.some(hasAssetContent)) {
    return "請輸入題目文字，或至少新增一個有內容的題目資產。";
  }
  return "";
}

async function saveQuestion() {
  if (!requireApiKey()) return;
  const validationError = validateForm();
  if (validationError) {
    status.value = "error";
    message.value = validationError;
    return;
  }

  saving.value = true;
  status.value = "loading";
  message.value = editingQuestionId.value ? "正在更新題目..." : "正在建立題目...";
  const wasEditing = Boolean(editingQuestionId.value);
  const payload = buildPayload();
  const result = editingQuestionId.value
    ? await updateStaffMathBankQuestion(editingQuestionId.value, payload, {
        apiKey: localStaffApiKey.value,
      })
    : await createStaffMathBankQuestion(payload, { apiKey: localStaffApiKey.value });
  saving.value = false;

  if (!result.success) {
    status.value = "error";
    message.value = getSaveError(result);
    return;
  }

  const savedQuestion = result.data;
  editingQuestionId.value = savedQuestion.id || editingQuestionId.value;
  selectedQuestionId.value = editingQuestionId.value;
  mergeQuestions([savedQuestion], false);
  applyQuestionToForm(savedQuestion);
  editorOpen.value = false;
  previewEditorOpen.value = false;
  status.value = "success";
  message.value = wasEditing ? "題目已儲存。" : "題目已建立。";
}

async function deleteQuestion() {
  if (!editingQuestionId.value || !requireApiKey()) return;
  if (!window.confirm("確定要刪除這道題目嗎？")) return;
  saving.value = true;
  status.value = "loading";
  message.value = "正在刪除題目...";
  const result = await deleteStaffMathBankQuestion(editingQuestionId.value, {
    apiKey: localStaffApiKey.value,
  });
  saving.value = false;
  if (!result.success) {
    status.value = "error";
    message.value = result.error || "題目刪除失敗。";
    return;
  }
  const deletedId = editingQuestionId.value;
  questionById.value = Object.fromEntries(
    Object.entries(questionById.value).filter(([id]) => id !== deletedId),
  );
  questions.value = questions.value.filter((question) => question.id !== deletedId);
  resetQuestionForm();
  editorOpen.value = false;
  previewEditorOpen.value = false;
  status.value = "success";
  message.value = "題目已刪除。";
}

function addAsset() {
  questionForm.assets.push(normalizeAsset({ sort_order: questionForm.assets.length }));
}

function removeAsset(index) {
  questionForm.assets.splice(index, 1);
}

function hasAssetContent(asset) {
  return Boolean(
    asset.role === "prompt" &&
      (String(asset.url || "").trim() ||
        String(asset.storage_key || "").trim() ||
        String(asset.source_code || "").trim()),
  );
}

function getSaveError(result) {
  const data = result.data || {};
  if (data.duplicate_question_id) {
    return `偵測到可能重複題目：${data.duplicate_question_id}。確認要建立時請勾選「允許重複題」。`;
  }
  return result.error || "題目儲存失敗。";
}

function splitThinking(value) {
  return String(value || "")
    .split(/\r?\n|、|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatThinking(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
  return String(value || "").trim();
}

function compactPrompt(value) {
  const text = String(value || "無題目").replace(/\s+/g, " ").trim();
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function shortId(id) {
  return String(id || "").slice(0, 8);
}

function getUnitGradeId(unit) {
  return String(unit?.grade?.id || unit?.grade_id || unit?.grade || "");
}

function formatStatus(value) {
  return { draft: "草稿", published: "已發布", archived: "封存" }[value] || value || "-";
}

function copyText(value) {
  emit("copy", value);
}
</script>
