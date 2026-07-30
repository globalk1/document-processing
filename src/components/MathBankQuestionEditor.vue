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
        <input
          ref="jsonFileInputRef"
          class="visually-hidden"
          type="file"
          accept=".json,application/json"
          @change="handleJsonFileUpload"
        />
        <div class="create-source-group">
          <span class="field-label">建立方式</span>
          <div class="create-source-grid">
            <button class="primary-button full" type="button" @click="startCreateQuestion">
              手動新增題目
            </button>
            <button class="primary-button full" type="button" @click="openJsonFilePicker">
              匯入 JSON 檔
            </button>
          </div>
        </div>
        <p v-if="importedJsonQuestions.length" class="import-summary">
          {{ importedJsonFilename || "JSON" }} · {{ importedJsonQuestions.length }} 題已讀取
        </p>
        <div class="cloud-save-group">
          <button class="primary-button full" :disabled="saving" type="button" @click="saveQuestionFromShortcut">
            {{ cloudSaveLabel }}
          </button>
        </div>
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

              <section v-if="importedJsonQuestions.length" class="imported-question-list">
                <header>
                  <strong>選擇要編輯的題目</strong>
                  <span>{{ importedJsonSelectedIndex + 1 }} / {{ importedJsonQuestions.length }}</span>
                </header>
                <article
                  v-for="(question, index) in displayedImportedJsonQuestions"
                  :key="`imported-question-${index}`"
                  class="imported-question-card"
                  :class="{ active: importedJsonSelectedIndex === index }"
                  @click="selectImportedQuestion(index)"
                >
                  <header>
                    <div>
                      <span>第 {{ index + 1 }} 題</span>
                      <small>{{ question.difficulty || "A" }} · {{ question.type || "calculation" }}</small>
                    </div>
                    <button
                      class="primary-inline-button compact"
                      type="button"
                      @click.stop="selectImportedQuestion(index)"
                    >
                      編輯
                    </button>
                  </header>
                  <section>
                    <strong>題目</strong>
                    <p>{{ importedQuestionPrompt(question, index) }}</p>
                  </section>
                  <div class="imported-question-detail-grid">
                    <section>
                      <strong>答案</strong>
                      <p>{{ importedQuestionAnswer(question) }}</p>
                    </section>
                    <section>
                      <strong>詳解</strong>
                      <p>{{ importedQuestionSolution(question) }}</p>
                    </section>
                  </div>
                </article>
              </section>

              <div
                v-if="questionDetailEditorOpen"
                class="question-detail-modal-backdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="question-detail-editor-title"
              >
                <section class="question-detail-modal-panel">
                  <header class="question-bank-toolbar">
                    <div>
                      <h2 id="question-detail-editor-title" class="section-title">
                        {{ importedJsonQuestions.length ? `編輯第 ${importedJsonSelectedIndex + 1} 題` : editingQuestionId ? "編輯題目" : "新增題目" }}
                      </h2>
                      <p>編輯題目內容、答案、詳解、思維與圖片資產。</p>
                    </div>
                    <button class="icon-button" title="關閉" type="button" @click="closeQuestionDetailEditor">
                      ×
                    </button>
                  </header>

                  <div class="question-detail-modal-grid">
                    <section class="word-workflow-section question-detail-fields-section">
                      <header class="word-workflow-header">
                        <div>
                          <h3>題目內容</h3>
                        </div>
                        <strong>{{ importedJsonQuestions.length ? `第 ${importedJsonSelectedIndex + 1} 題` : editingQuestionId ? shortId(editingQuestionId) : "New" }}</strong>
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
                </section>
              </div>

            </section>

            <section class="word-workflow-section question-json-section">
              <header class="word-workflow-header">
                <div>
                  <span>02</span>
                  <h3>JSON 編輯</h3>
                </div>
                <strong>匯入 / 自動輸出</strong>
              </header>

              <div class="json-editor-actions">
                <button class="secondary-button compact" type="button" @click="openJsonFilePicker">
                  匯入 JSON 檔
                </button>
                <button class="ghost-button compact" type="button" @click="copyOutputJson">
                  複製目前 JSON
                </button>
                <button class="primary-inline-button compact" :disabled="saving" type="button" @click="saveQuestionFromShortcut">
                  {{ cloudSaveLabel }}
                </button>
                <button class="primary-inline-button compact" type="button" @click="downloadOutputJson">
                  輸出 JSON
                </button>
              </div>

              <label
                class="field-label json-drop-zone"
                @dragover.prevent
                @drop.prevent="handleJsonFileDrop"
              >
                <span class="json-input-header">
                  <span>Input JSON</span>
                  <button class="secondary-button compact" type="button" @click="applyJsonToForm">
                    讀取貼上內容
                  </button>
                </span>
                <textarea
                  v-model="jsonEditorText"
                  class="textarea compact-textarea question-json-textarea"
                  spellcheck="false"
                  placeholder='貼上單題 JSON，或包含 questions 陣列的 JSON。'
                ></textarea>
              </label>

              <p v-if="jsonParseError" class="message error">{{ jsonParseError }}</p>

              <label class="field-label">
                目前表單 JSON（自動更新）
                <textarea
                  class="textarea compact-textarea question-json-textarea output"
                  readonly
                  spellcheck="false"
                  :value="outputJsonText"
                ></textarea>
              </label>
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
  createStaffMathBankQuestionsBulk,
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
const jsonFileInputRef = ref(null);
const editorOpen = ref(false);
const questionDetailEditorOpen = ref(false);
const previewEditorOpen = ref(false);
const saving = ref(false);
const status = ref("idle");
const message = ref("");
const allowDuplicate = ref(false);
const jsonEditorText = ref("");
const jsonParseError = ref("");
const importedJsonQuestions = ref([]);
const importedJsonFilename = ref("");
const importedJsonSelectedIndex = ref(0);
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
  if (importedJsonQuestions.value.length > 1) {
    return `已讀取 ${importedJsonQuestions.value.length} 題 JSON，目前表單顯示第 ${importedJsonSelectedIndex.value + 1} 題。`;
  }
  if (editingQuestionId.value) {
    return "校正題目內容、答案、詳解與補充資產。";
  }
  return "新題目會以草稿建立。";
});
const outputJsonText = computed(() => JSON.stringify(buildOutputJsonPayload(), null, 2));
const displayedImportedJsonQuestions = computed(() =>
  importedJsonQuestions.value.map((question, index) =>
    index === importedJsonSelectedIndex.value && !editingQuestionId.value
      ? { ...question, ...buildPayload() }
      : question,
  ),
);
const cloudSaveLabel = computed(() => {
  if (saving.value) return "儲存中";
  if (importedJsonQuestions.value.length > 1) {
    return `全部存入題庫（${importedJsonQuestions.value.length} 題）`;
  }
  return "存入題庫";
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
  clearJsonSource();
  editorOpen.value = true;
  questionDetailEditorOpen.value = true;
  status.value = "success";
  message.value = "題目已載入。";
}

function startCreateQuestion() {
  resetQuestionForm();
  clearJsonSource();
  editorOpen.value = true;
  questionDetailEditorOpen.value = true;
}

function startCreateQuestionFromJson() {
  resetQuestionForm();
  clearJsonSource();
  editorOpen.value = true;
  questionDetailEditorOpen.value = false;
  status.value = "idle";
  message.value = "";
}

function resetQuestionForm() {
  selectedQuestionId.value = "";
  editingQuestionId.value = "";
  allowDuplicate.value = false;
  importedJsonQuestions.value = [];
  importedJsonFilename.value = "";
  importedJsonSelectedIndex.value = 0;
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
  jsonParseError.value = "";
}

function closeEditor() {
  editorOpen.value = false;
  questionDetailEditorOpen.value = false;
  previewEditorOpen.value = false;
}

function closeQuestionDetailEditor() {
  saveCurrentImportedQuestionDraft();
  questionDetailEditorOpen.value = false;
}

function applyQuestionToForm(question) {
  importedJsonQuestions.value = [];
  importedJsonFilename.value = "";
  importedJsonSelectedIndex.value = 0;
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

function buildOutputJsonPayload() {
  if (importedJsonQuestions.value.length > 1 && !editingQuestionId.value) {
    return {
      questions: importedJsonQuestions.value.map((question, index) =>
        index === importedJsonSelectedIndex.value
          ? { ...question, ...buildPayload() }
          : normalizeQuestionJsonPayload(question),
      ),
    };
  }
  return {
    ...(editingQuestionId.value ? { id: editingQuestionId.value } : {}),
    ...buildPayload(),
  };
}

function clearJsonSource() {
  jsonEditorText.value = "";
  jsonParseError.value = "";
  importedJsonQuestions.value = [];
  importedJsonFilename.value = "";
  importedJsonSelectedIndex.value = 0;
}

function saveCurrentImportedQuestionDraft() {
  if (!importedJsonQuestions.value.length || editingQuestionId.value) return;
  const index = importedJsonSelectedIndex.value;
  importedJsonQuestions.value = importedJsonQuestions.value.map((question, questionIndex) =>
    questionIndex === index ? { ...question, ...buildPayload() } : question,
  );
}

function selectImportedQuestion(index) {
  if (index === importedJsonSelectedIndex.value) {
    questionDetailEditorOpen.value = true;
    return;
  }
  const question = importedJsonQuestions.value[index];
  if (!question) return;
  saveCurrentImportedQuestionDraft();
  importedJsonSelectedIndex.value = index;
  applyQuestionJsonToForm(question);
  questionDetailEditorOpen.value = true;
  jsonParseError.value = "";
  status.value = "success";
  message.value = `正在編輯第 ${index + 1} 題。`;
}

function openJsonFilePicker() {
  jsonFileInputRef.value?.click();
}

async function handleJsonFileUpload(event) {
  const input = event.target;
  const selectedFile = input.files?.[0];
  if (!selectedFile) return;

  if (!editorOpen.value) {
    resetQuestionForm();
    editorOpen.value = true;
    await nextTick();
  }
  await importJsonFile(selectedFile);
  input.value = "";
}

async function handleJsonFileDrop(event) {
  const selectedFile = event.dataTransfer?.files?.[0];
  if (!selectedFile) return;
  if (!editorOpen.value) {
    resetQuestionForm();
    editorOpen.value = true;
    await nextTick();
  }
  await importJsonFile(selectedFile);
}

async function importJsonFile(selectedFile) {
  try {
    importedJsonFilename.value = selectedFile.name;
    jsonEditorText.value = await selectedFile.text();
    applyJsonToForm();
    if (!jsonParseError.value) {
      const count = importedJsonQuestions.value.length;
      message.value = `已匯入 ${selectedFile.name}，共 ${count} 題，可按「${cloudSaveLabel.value}」。`;
    }
  } catch (error) {
    jsonParseError.value = `JSON 檔案讀取失敗：${error.message}`;
    status.value = "error";
    message.value = jsonParseError.value;
  }
}

function applyJsonToForm() {
  const rawJson = jsonEditorText.value.trim();
  if (!rawJson) {
    importedJsonQuestions.value = [];
    jsonParseError.value = "請先貼上或輸入 JSON。";
    status.value = "error";
    message.value = jsonParseError.value;
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    importedJsonQuestions.value = [];
    jsonParseError.value = `JSON 格式錯誤：${error.message}`;
    status.value = "error";
    message.value = jsonParseError.value;
    return;
  }

  const questionList = extractQuestionJsonList(parsed);
  if (!questionList.length) {
    jsonParseError.value = "找不到可套用的題目 JSON。";
    status.value = "error";
    message.value = jsonParseError.value;
    return;
  }

  importedJsonQuestions.value = questionList;
  importedJsonSelectedIndex.value = 0;
  applyQuestionJsonToForm(questionList[0]);
  jsonParseError.value = "";
  status.value = "success";
  message.value =
    questionList.length > 1
    ? `JSON 已讀取 ${questionList.length} 題，表單先顯示第 1 題。`
      : "JSON 已讀取，確認內容後可按「存入題庫」。";
}

function saveQuestionFromShortcut() {
  if (!editorOpen.value) {
    status.value = "error";
    message.value = "請先新增草稿或匯入 JSON 檔，再存入題庫。";
    return;
  }
  if (importedJsonQuestions.value.length > 1 && !editingQuestionId.value) {
    return saveImportedQuestionsBulk();
  }
  return saveQuestion();
}

function copyOutputJson() {
  copyText(outputJsonText.value);
  status.value = "success";
  message.value = "已複製目前表單 JSON。";
}

function downloadOutputJson() {
  const suffix = editingQuestionId.value ? shortId(editingQuestionId.value) : "new";
  triggerDownload(
    outputJsonText.value,
    `math-bank-question-${suffix}.json`,
    "application/json;charset=utf-8",
  );
  status.value = "success";
  message.value = "已下載目前表單 JSON。";
}

async function saveImportedQuestionsBulk() {
  if (!requireApiKey()) return;
  saveCurrentImportedQuestionDraft();
  const payload = {
    questions: importedJsonQuestions.value.map(normalizeQuestionJsonPayload),
  };
  const validationError = validateQuestionPayloads(payload.questions);
  if (validationError) {
    status.value = "error";
    message.value = validationError;
    return;
  }

  saving.value = true;
  status.value = "loading";
  message.value = `正在把 ${payload.questions.length} 題存入題庫...`;
  const result = await createStaffMathBankQuestionsBulk(payload, {
    apiKey: localStaffApiKey.value,
  });
  saving.value = false;

  if (!result.success) {
    status.value = "error";
    message.value = result.error || "JSON 題目批次入庫失敗。";
    return;
  }

  importedJsonQuestions.value = [];
  importedJsonFilename.value = "";
  editorOpen.value = false;
  questionDetailEditorOpen.value = false;
  previewEditorOpen.value = false;
  await loadQuestions();
  if (status.value !== "error") {
    status.value = "success";
    message.value = `已新增 ${payload.questions.length} 題到題庫草稿。`;
  }
}

function validateQuestionPayloads(questionPayloads) {
  const invalidIndex = questionPayloads.findIndex((question) => {
    if (!question.grade_id || !question.unit_id) return true;
    return !String(question.prompt_md || "").trim() &&
      !(question.assets || []).some(hasAssetContent);
  });
  if (invalidIndex < 0) return "";
  return `第 ${invalidIndex + 1} 題缺少年級、單元或題目內容，請先補齊再存入題庫。`;
}

function extractQuestionJsonList(value) {
  if (Array.isArray(value)) return value.filter(isPlainObject);
  if (!isPlainObject(value)) return [];
  if (Array.isArray(value.questions)) return value.questions.filter(isPlainObject);
  if (isPlainObject(value.question)) return [value.question];
  return [value];
}

function normalizeQuestionJsonPayload(questionJson = {}) {
  const payload = {
    grade_id: stringifyFormValue(firstDefined(questionJson.grade_id, questionJson.grade?.id)),
    unit_id: stringifyFormValue(firstDefined(questionJson.unit_id, questionJson.unit?.id)),
    type: stringifyFormValue(firstDefined(questionJson.type, "calculation")) || "calculation",
    difficulty: stringifyFormValue(firstDefined(questionJson.difficulty, "A")) || "A",
    prompt_md: stringifyFormValue(firstDefined(questionJson.prompt_md, questionJson.prompt)),
    answer_md: stringifyFormValue(firstDefined(questionJson.answer_md, questionJson.answer)),
    solution_md: stringifyFormValue(firstDefined(questionJson.solution_md, questionJson.solution)),
    status: "draft",
    visibility: "public",
    thinking: Array.isArray(questionJson.thinking)
      ? questionJson.thinking.map((item) => String(item || "").trim()).filter(Boolean)
      : splitThinking(questionJson.thinking),
    assets: Array.isArray(questionJson.assets) ? questionJson.assets.map(normalizeAsset) : [],
  };
  if (allowDuplicate.value) payload.duplicate_policy = "allow";
  return payload;
}

function importedQuestionPrompt(questionJson, index) {
  return previewQuestionJsonText(
    firstDefined(questionJson?.prompt_md, questionJson?.prompt),
    `第 ${index + 1} 題尚未填題目`,
    260,
  );
}

function importedQuestionAnswer(questionJson) {
  return previewQuestionJsonText(
    firstDefined(questionJson?.answer_md, questionJson?.answer),
    "尚未填答案",
    120,
  );
}

function importedQuestionSolution(questionJson) {
  return previewQuestionJsonText(
    firstDefined(questionJson?.solution_md, questionJson?.solution),
    "尚未填詳解",
    120,
  );
}

function previewQuestionJsonText(value, fallback, maxLength) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function applyQuestionJsonToForm(questionJson) {
  const thinkingValue = hasOwn(questionJson, "thinking")
    ? questionJson.thinking
    : questionForm.thinking;
  Object.assign(questionForm, {
    grade_id: stringifyFormValue(
      firstDefined(questionJson.grade_id, questionJson.grade?.id, questionForm.grade_id),
    ),
    unit_id: stringifyFormValue(
      firstDefined(questionJson.unit_id, questionJson.unit?.id, questionForm.unit_id),
    ),
    type: stringifyFormValue(firstDefined(questionJson.type, questionForm.type)) || "calculation",
    difficulty: stringifyFormValue(firstDefined(questionJson.difficulty, questionForm.difficulty)) || "A",
    prompt_md: stringifyFormValue(
      firstDefined(questionJson.prompt_md, questionJson.prompt, questionForm.prompt_md),
    ),
    answer_md: stringifyFormValue(
      firstDefined(questionJson.answer_md, questionJson.answer, questionForm.answer_md),
    ),
    solution_md: stringifyFormValue(
      firstDefined(questionJson.solution_md, questionJson.solution, questionForm.solution_md),
    ),
    thinking: formatThinking(thinkingValue),
    status: stringifyFormValue(firstDefined(questionJson.status, questionForm.status)) || "draft",
    visibility:
      stringifyFormValue(firstDefined(questionJson.visibility, questionForm.visibility)) || "public",
    assets: Array.isArray(questionJson.assets)
      ? questionJson.assets.map(normalizeAsset)
      : questionForm.assets,
  });
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function stringifyFormValue(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
  clearJsonSource();
  editorOpen.value = false;
  questionDetailEditorOpen.value = false;
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
  questionDetailEditorOpen.value = false;
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
