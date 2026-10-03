<template>
  <section class="feature-workspace question-entry-workspace">
    <aside class="control-panel draft-list-panel">
      <div class="draft-list-header">
        <div>
          <h2 class="section-title">草稿題目</h2>
          <p>{{ drafts.length }} 題</p>
        </div>
        <button class="secondary-button compact" :disabled="loading" type="button" @click="loadDrafts">
          {{ loading ? "讀取中" : "重新整理" }}
        </button>
      </div>

      <button class="primary-button full" type="button" @click="startCreate">
        新增草稿
      </button>

      <section class="draft-filter-box">
        <label>
          <span class="field-label">搜尋</span>
          <input
            v-model.trim="filters.search"
            class="text-input"
            type="text"
            placeholder="題目、答案、詳解、UUID"
            @input="scheduleDraftLoad"
          />
        </label>
        <div class="filter-grid two">
          <label>
            <span class="field-label">年級</span>
            <select v-model="filters.grade_id" class="select-input" @change="handleFilterGradeChange">
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
              :disabled="!filteredFilterUnits.length"
              @change="loadDrafts"
            >
              <option value="">全部</option>
              <option v-for="unit in filteredFilterUnits" :key="unit.id" :value="unit.id">
                {{ unit.name }}
              </option>
            </select>
          </label>
        </div>
        <label>
          <span class="field-label">難度</span>
          <select v-model="filters.difficulty" class="select-input" @change="loadDrafts">
            <option value="">全部</option>
            <option
              v-for="difficulty in questionDifficulties"
              :key="difficulty.value"
              :value="difficulty.value"
            >
              {{ difficulty.label }}
            </option>
          </select>
        </label>
        <div class="draft-filter-actions">
          <button class="ghost-button compact" :disabled="loading" type="button" @click="resetFilters">
            重設
          </button>
        </div>
      </section>

      <div v-if="loading" class="empty-state compact">讀取草稿中...</div>
      <div v-else-if="!drafts.length" class="empty-state compact">
        目前沒有草稿題目。
      </div>
      <div v-else class="draft-list">
        <button
          v-for="question in drafts"
          :key="question.id"
          class="draft-list-item"
          :class="{ active: selectedId === question.id }"
          type="button"
          @click="selectDraft(question)"
        >
          <span>{{ question.grade?.name || "-" }} / {{ question.unit?.name || "-" }}</span>
          <strong class="draft-list-preview">
            <MarkdownMathText :content="question.prompt_md" fallback="無題目" />
          </strong>
          <small>{{ formatQuestionDifficulty(question.difficulty) }} · 草稿</small>
        </button>
      </div>

      <p v-if="message" class="message" :class="status">{{ message }}</p>
    </aside>

    <section class="output-panel question-entry-editor">
      <div
        v-if="loading && initialQuestionId"
        class="question-entry-loading-overlay"
        role="status"
        aria-live="polite"
      >
        <span class="question-entry-loading-spinner" aria-hidden="true"></span>
        <strong>正在載入題目</strong>
        <span>準備開啟編輯表單...</span>
      </div>
      <form class="simple-question-form" @submit.prevent="saveQuestion">
        <div class="question-bank-toolbar">
          <div>
            <h2 class="section-title">{{ selectedId ? "編輯題目" : "新增草稿" }}</h2>
            <p>{{ selectedId ? `目前狀態：${formatQuestionStatus(editingStatus)}` : "新題目預設為草稿。" }}</p>
            <div v-if="displayedUuid" class="draft-uuid">
              <span>{{ selectedId ? "UUID" : "剛新增 UUID" }}</span>
              <code>{{ displayedUuid }}</code>
              <button class="ghost-button compact" type="button" @click="copyQuestionUuid">
                複製 UUID
              </button>
            </div>
          </div>
          <div class="icon-group">
            <button
              v-if="selectedId && editingStatus !== 'published'"
              class="ghost-button compact danger"
              :disabled="saving"
              type="button"
              @click="deleteQuestion"
            >
              刪除
            </button>
          </div>
        </div>
        <p v-if="lastCreatedId" class="message success" role="status">草稿已新增，表單已清空，可以繼續新增下一題。</p>

        <section class="word-workflow-section">
          <header class="word-workflow-header">
            <div>
              <span>01</span>
              <h3>分類</h3>
            </div>
            <strong>草稿</strong>
          </header>

          <div class="filter-grid two">
            <label>
              <span class="field-label">年級</span>
              <select v-model="form.grade_id" class="select-input" @change="form.unit_id = ''">
                <option value="">選擇年級</option>
                <option v-for="grade in grades" :key="grade.id" :value="grade.id">
                  {{ grade.name }}
                </option>
              </select>
            </label>
            <label>
              <span class="field-label">單元</span>
              <select v-model="form.unit_id" class="select-input" :disabled="!filteredUnits.length">
                <option value="">{{ form.grade_id ? "選擇單元" : "先選年級" }}</option>
                <option v-for="unit in filteredUnits" :key="unit.id" :value="unit.id">
                  {{ unit.name }}
                </option>
              </select>
            </label>
          </div>

          <div class="filter-grid two">
            <label>
              <span class="field-label">題型</span>
              <select v-model="form.type" class="select-input">
                <option v-for="type in questionTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </label>
            <label>
              <span class="field-label">難度</span>
              <select v-model="form.difficulty" class="select-input">
                <option
                  v-for="difficulty in questionDifficulties"
                  :key="difficulty.value"
                  :value="difficulty.value"
                >
                  {{ difficulty.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="field-label question-source-field">
            <label for="draft-question-source">題目來源</label>
            <div ref="questionSourceFieldRef" class="question-source-combobox">
              <input
                id="draft-question-source"
                v-model="form.question_source"
                class="text-input"
                type="text"
                placeholder="輸入或選擇題目來源（可空白）"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="draft-question-source-options"
                :aria-expanded="questionSourceMenuOpen"
                :aria-activedescendant="activeQuestionSourceId"
                autocomplete="off"
                @focus="openQuestionSourceMenu"
                @click="openQuestionSourceMenu"
                @input="handleQuestionSourceInput"
                @keydown="handleQuestionSourceKeydown"
              />
              <div
                v-if="questionSourceMenuOpen"
                id="draft-question-source-options"
                class="question-source-options"
                role="listbox"
              >
                <button
                  v-for="(source, index) in filteredQuestionSources"
                  :id="questionSourceOptionId(index)"
                  :key="source"
                  class="question-source-option"
                  :class="{ active: index === activeQuestionSourceIndex }"
                  type="button"
                  role="option"
                  :aria-selected="source === form.question_source"
                  @mouseenter="activeQuestionSourceIndex = index"
                  @mousedown.prevent
                  @click="selectQuestionSource(source)"
                >
                  {{ source }}
                </button>
                <p v-if="!filteredQuestionSources.length" class="question-source-empty">
                  沒有符合的來源，可直接保留目前文字作為新來源。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="word-workflow-section">
          <header class="word-workflow-header">
            <div>
              <span>02</span>
              <h3>內容</h3>
            </div>
            <strong>LaTeX</strong>
          </header>

          <div class="simple-preview simple-preview-inline">
            <div class="panel-header">
              <h2 class="section-title">預覽</h2>
              <button class="secondary-button compact" type="button" @click="contentEditorOpen = true">
                編輯
              </button>
            </div>
            <div class="question-editor-preview-grid">
              <section class="question-editor-preview-block prompt">
                <strong>題目</strong>
                <p><MarkdownMathText :content="form.prompt_md" fallback="尚未輸入題目" /></p>
                <div v-if="previewImageAssets.some((asset) => asset.url)" class="preview-image-strip">
                  <img
                    v-for="(asset, index) in previewImageAssets.filter((item) => item.url)"
                    :key="`preview-inline-${asset.storage_key || index}`"
                    :src="asset.url"
                    :alt="asset.alt_text || '題目圖片'"
                  />
                </div>
              </section>
              <section class="question-editor-preview-block answer">
                <strong>答案</strong>
                <p><MarkdownMathText :content="form.answer_md" fallback="尚未輸入答案" /></p>
              </section>
              <section class="question-editor-preview-block solution">
                <strong>詳解</strong>
                <p><MarkdownMathText :content="form.solution_md" fallback="尚未輸入詳解" /></p>
              </section>
            </div>
          </div>

          <section
            class="question-image-upload"
            :class="{ dragging: imageDragOver }"
            @dragenter.prevent="imageDragOver = true"
            @dragover.prevent="imageDragOver = true"
            @dragleave.prevent="imageDragOver = false"
            @drop.prevent="handleImageDrop"
          >
            <input
              ref="imageInputRef"
              class="visually-hidden"
              type="file"
              accept="image/*"
              multiple
              @change="handleImagePicker"
            />
            <div>
              <strong>題目圖片</strong>
              <span>選擇、拖曳或 Ctrl / Command + V 貼上圖片。</span>
            </div>
            <button
              class="secondary-button compact"
              :disabled="saving"
              type="button"
              @click="openImagePicker"
            >
              選擇圖片
            </button>
          </section>

          <div class="question-code-editor">
            <label class="field-label" for="draft-figure-code">Figure Code（Python）</label>
            <textarea
              id="draft-figure-code"
              v-model="newImageCode"
              class="textarea compact-textarea source-code-textarea"
              placeholder="輸入 Matplotlib Python 程式碼；預覽由後端產生"
            ></textarea>
            <button class="secondary-button compact" type="button" :disabled="!newImageCode.trim()" @click="addCodeImage">
              加入程式碼圖片
            </button>
          </div>
          <div v-if="form.assets.some((asset) => asset.source_language === 'python')" class="question-code-existing">
            <div v-for="(asset, index) in form.assets.filter((item) => item.source_language === 'python')" :key="index" class="question-code-editor">
              <label class="field-label">已加入的 Figure Code {{ index + 1 }}</label>
              <textarea v-model="asset.source_code" class="textarea compact-textarea source-code-textarea"></textarea>
              <button class="secondary-button compact" type="button" :disabled="!asset.source_code.trim()" @click="renderCodeAsset(asset)">
                重新產生預覽
              </button>
              <button class="ghost-button compact danger" type="button" @click="removeCodeAsset(asset)">
                移除程式碼圖片
              </button>
            </div>
          </div>

          <div v-if="previewImageAssets.length" class="question-image-grid">
            <article
              v-for="(asset, index) in previewImageAssets"
              :key="asset.storage_key || `image-${index}`"
              class="question-image-card"
            >
              <img v-if="asset.url" :src="asset.url" :alt="asset.alt_text || '題目圖片'" />
              <p v-else class="question-image-status">
                {{ asset.preview_status === "loading" ? "正在向後端產生圖片..." : asset.preview_error || "圖片尚無預覽網址。" }}
              </p>
              <div>
                <strong>{{ asset.alt_text || "題目圖片" }}</strong>
                <span>{{ asset.storage_key }}</span>
              </div>
              <button
                class="ghost-button compact danger"
                type="button"
                @click="removeAsset(asset)"
              >
                移除
              </button>
            </article>
          </div>

        </section>

        <section class="word-workflow-section">
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

          <div class="editor-action-row">
            <button class="primary-button" :disabled="saving" type="submit">
              {{ saving ? "儲存中" : selectedId && editingStatus === "published" ? "儲存並保持公開" : selectedId ? "儲存草稿" : "新增草稿" }}
            </button>
            <button
              v-if="selectedId && editingStatus !== 'archived'"
              class="secondary-button"
              :disabled="saving"
              type="button"
              @click="toggleEditingStatus"
            >
              {{ editingStatus === "published" ? "切換為草稿" : "切換為公開" }}
            </button>
            <button class="secondary-button" :disabled="saving" type="button" @click="startCreate">
              清空新增
            </button>
          </div>
        </section>
      </form>

      <div
        v-if="contentEditorOpen"
        class="preview-editor-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-content-editor-title"
        @mousedown.self="contentEditorOpen = false"
      >
        <section class="preview-editor-modal-panel draft-content-editor-modal">
          <header class="question-bank-toolbar">
            <div>
              <h2 id="draft-content-editor-title" class="section-title">左右編輯</h2>
              <p>左側輸入 Markdown／LaTeX，右側即時渲染題目、答案與詳解。</p>
            </div>
            <button class="icon-button" title="關閉左右編輯" type="button" @click="contentEditorOpen = false">×</button>
          </header>

          <div class="preview-editor-modal-grid">
            <div class="preview-editor-textboxes">
              <label class="field-label">
                題目內容（Markdown／LaTeX）
                <textarea
                  v-model="form.prompt_md"
                  class="textarea preview-editor-textarea question-modal-textarea"
                  placeholder="例如：求 $x^2+y^2=1$ 的半徑。選擇題可寫：(A) ..."
                ></textarea>
              </label>
              <label class="field-label">
                答案（Markdown／LaTeX）
                <textarea
                  v-model="form.answer_md"
                  class="textarea preview-editor-textarea answer-modal-textarea"
                  placeholder="輸入答案，例如：$r=1$"
                ></textarea>
              </label>
              <label class="field-label">
                思維（每行一項）
                <textarea
                  v-model="form.thinking"
                  class="textarea preview-editor-textarea thinking-textarea"
                  placeholder="例如：座標幾何&#10;外接圓"
                ></textarea>
              </label>
              <label class="field-label">
                詳解（Markdown／LaTeX）
                <textarea
                  v-model="form.solution_md"
                  class="textarea preview-editor-textarea solution-modal-textarea"
                  placeholder="輸入推導過程與 LaTeX 詳解。"
                ></textarea>
              </label>
            </div>

            <div class="preview-editor-output">
              <section aria-live="polite">
                <strong>題目預覽</strong>
                <p><MarkdownMathText :content="form.prompt_md" fallback="尚未輸入題目" /></p>
                <div v-if="previewImageAssets.some((asset) => asset.url)" class="preview-image-strip">
                  <img
                    v-for="(asset, index) in previewImageAssets.filter((item) => item.url)"
                    :key="`modal-preview-${asset.storage_key || index}`"
                    :src="asset.url"
                    :alt="asset.alt_text || '題目圖片'"
                  />
                </div>
              </section>
              <section class="answer-preview" aria-live="polite">
                <strong>答案預覽</strong>
                <p><MarkdownMathText :content="form.answer_md" fallback="尚未輸入答案" /></p>
              </section>
              <section class="solution-preview" aria-live="polite">
                <strong>詳解預覽</strong>
                <p><MarkdownMathText :content="form.solution_md" fallback="尚未輸入詳解" /></p>
              </section>
            </div>
          </div>
        </section>
      </div>

    </section>
  </section>
</template>

<script setup>
const props = defineProps({
  subject: { type: String, default: "math" },
  initialQuestionId: { type: String, default: "" },
});
const emit = defineEmits(["copy", "saved"]);
import { computed, onActivated, onDeactivated, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import MarkdownMathText from "./MarkdownMathText.vue";
import {
  createStaffMathBankQuestion,
  deleteStaffMathBankQuestion,
  getStaffMathBankQuestion,
  getPublicAssetUrl,
  listMathBankGrades,
  listMathBankQuestionSources,
  listMathBankUnits,
  searchStaffMathBankQuestions,
  renderMatplotlibPreview,
  uploadAssetFile,
  updateStaffMathBankQuestion,
} from "../services/api";

const defaultStaffApiKey =
  import.meta.env.VITE_STAFF_API_KEY ||
  "Q2yu32SCbv8ha21dICnCOZ7vdq0Kl/PEbix44tq52KYhfrWcbRxrcrL9FtK7lqbj";
const goodQuestionFolder = "好題蒐集";
const pageSize = 100;
const questionTypes = [
  { value: "choice", label: "選擇題" },
  { value: "fill", label: "填充題" },
  { value: "calculation", label: "計算題" },
  { value: "proof", label: "證明題" },
  { value: "application", label: "應用題" },
  { value: "short_answer", label: "簡答題" },
  { value: "essay", label: "申論題" },
];
const questionDifficulties = [
  { value: "A", label: "A 挑戰型" },
  { value: "B", label: "B 進階型" },
  { value: "C", label: "C 基礎型" },
  { value: "S", label: "S 究極型" },
  { value: "U", label: "未分類" },
];

function formatQuestionDifficulty(difficulty) {
  const value = difficulty || "U";
  return questionDifficulties.find((item) => item.value === value)?.label || value;
}

function formatQuestionStatus(statusValue) {
  return {
    draft: "草稿",
    published: "公開",
    archived: "封存",
  }[statusValue] || statusValue || "未標示";
}

const grades = ref([]);
const units = ref([]);
const questionSources = ref([]);
const drafts = ref([]);
const selectedId = ref("");
const editingStatus = ref("draft");
const editingVisibility = ref("public");
const lastCreatedId = ref("");
const loading = ref(false);
const saving = ref(false);
const status = ref("idle");
const message = ref("");
const allowDuplicate = ref(false);
const uploadingImages = ref(false);
const imageDragOver = ref(false);
const imageInputRef = ref(null);
const questionSourceFieldRef = ref(null);
const questionSourceMenuOpen = ref(false);
const activeQuestionSourceIndex = ref(-1);
const pendingImages = ref([]);
const newImageCode = ref("");
const contentEditorOpen = ref(false);
const renderedImageStates = reactive({});
const pendingRenders = new Map();
const form = reactive(createEmptyForm());
const filters = reactive({
  search: "",
  grade_id: "",
  unit_id: "",
  difficulty: "",
});
let filterTimer = null;

const filteredUnits = computed(() =>
  form.grade_id
    ? units.value.filter((unit) => getUnitGradeId(unit) === form.grade_id)
    : [],
);
const filteredFilterUnits = computed(() =>
  filters.grade_id
    ? units.value.filter((unit) => getUnitGradeId(unit) === filters.grade_id)
    : units.value,
);
const filteredQuestionSources = computed(() => {
  const keyword = normalizeQuestionSource(form.question_source).toLocaleLowerCase("zh-Hant");
  if (!keyword) return questionSources.value;
  return questionSources.value.filter((source) =>
    source.toLocaleLowerCase("zh-Hant").includes(keyword),
  );
});
const activeQuestionSourceId = computed(() =>
  questionSourceMenuOpen.value && activeQuestionSourceIndex.value >= 0
    ? questionSourceOptionId(activeQuestionSourceIndex.value)
    : undefined,
);
const displayedUuid = computed(() => selectedId.value || lastCreatedId.value);
const imageAssets = computed(() => form.assets.filter(hasAssetContent));
const previewImageAssets = computed(() => [
  ...imageAssets.value.map((asset) => {
    const code = String(asset.source_code || "").trim();
    const renderState = code ? renderedImageStates[code] : null;
    return {
      ...asset,
      sourceAsset: asset,
      url: asset.url || renderState?.image || (code ? "" : asset.storage_key ? getPublicAssetUrl(asset.storage_key) : ""),
      preview_status: renderState?.status || "",
      preview_error: renderState?.error || "",
    };
  }),
  ...pendingImages.value.map((item) =>
    normalizeAsset({
      role: "prompt",
      url: item.previewUrl,
      storage_key: item.id,
      alt_text: item.alt_text,
      mime_type: item.mime_type,
      sort_order: form.assets.length + item.sort_order,
    }),
  ),
]);

async function ensureImageRendered(code) {
  if (renderedImageStates[code]?.status === "success" || pendingRenders.has(code)) return;
  renderedImageStates[code] = { status: "loading", image: "", error: "" };
  const pending = renderMatplotlibPreview(code);
  pendingRenders.set(code, pending);
  const result = await pending;
  pendingRenders.delete(code);
  renderedImageStates[code] = result.success
    ? { status: "success", image: result.image, error: "" }
    : { status: "error", image: "", error: result.error || "圖片產生失敗。" };
}

onActivated(() => window.addEventListener("paste", handlePaste));
onDeactivated(() => window.removeEventListener("paste", handlePaste));

onMounted(async () => {
  document.addEventListener("mousedown", handleQuestionSourceOutsideClick);
  await loadTaxonomy();
  await loadDrafts();
  await openInitialQuestion();
});

watch(
  () => props.initialQuestionId,
  async (questionId, previousQuestionId) => {
    if (questionId && questionId !== previousQuestionId) await openInitialQuestion(questionId);
  },
);

onBeforeUnmount(() => {
  if (filterTimer) window.clearTimeout(filterTimer);
  document.removeEventListener("mousedown", handleQuestionSourceOutsideClick);
  window.removeEventListener("paste", handlePaste);
  clearPendingImages();
});

async function loadTaxonomy() {
  const [gradeResult, unitResult, sourceResult] = await Promise.all([
    listMathBankGrades({}, { subject: props.subject, apiKey: defaultStaffApiKey }),
    listMathBankUnits({}, { subject: props.subject, apiKey: defaultStaffApiKey }),
    listMathBankQuestionSources({}, { subject: props.subject }),
  ]);

  if (gradeResult.success) grades.value = gradeResult.data || [];
  if (unitResult.success) units.value = unitResult.data || [];
  if (sourceResult.success) questionSources.value = normalizeQuestionSources(sourceResult.data);

  if (!gradeResult.success || !unitResult.success || !sourceResult.success) {
    status.value = "error";
    message.value =
      gradeResult.error || unitResult.error || sourceResult.error || "分類或題目來源讀取失敗。";
  }
}

function openQuestionSourceMenu() {
  questionSourceMenuOpen.value = true;
  activeQuestionSourceIndex.value = -1;
}

function closeQuestionSourceMenu() {
  questionSourceMenuOpen.value = false;
  activeQuestionSourceIndex.value = -1;
}

function handleQuestionSourceInput() {
  openQuestionSourceMenu();
}

function handleQuestionSourceKeydown(event) {
  const optionCount = filteredQuestionSources.value.length;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    questionSourceMenuOpen.value = true;
    if (!optionCount) return;
    const offset = event.key === "ArrowDown" ? 1 : -1;
    activeQuestionSourceIndex.value =
      (activeQuestionSourceIndex.value + offset + optionCount) % optionCount;
    return;
  }

  if (event.key === "Enter" && questionSourceMenuOpen.value && activeQuestionSourceIndex.value >= 0) {
    event.preventDefault();
    selectQuestionSource(filteredQuestionSources.value[activeQuestionSourceIndex.value]);
    return;
  }

  if (event.key === "Escape" && questionSourceMenuOpen.value) {
    event.preventDefault();
    closeQuestionSourceMenu();
  }
}

function selectQuestionSource(source) {
  form.question_source = source;
  closeQuestionSourceMenu();
}

function handleQuestionSourceOutsideClick(event) {
  if (!questionSourceFieldRef.value?.contains(event.target)) closeQuestionSourceMenu();
}

function questionSourceOptionId(index) {
  return `draft-question-source-option-${index}`;
}

async function loadDrafts() {
  loading.value = true;
  status.value = "loading";
  message.value = "正在讀取草稿...";

  const allDrafts = [];
  let cursor = "";
  let hasMore = true;

  while (hasMore) {
    const result = await searchStaffMathBankQuestions(
      {
        search: filters.search,
        grade_id: filters.grade_id,
        unit_id: filters.unit_id,
        difficulty: filters.difficulty,
        status: "draft",
        include_details: "true",
        limit: pageSize,
        cursor,
      },
      { subject: props.subject, apiKey: defaultStaffApiKey },
    );

    if (!result.success) {
      loading.value = false;
      status.value = "error";
      message.value = result.error || "草稿讀取失敗。";
      return;
    }

    allDrafts.push(...(result.data.results || []));
    hasMore = Boolean(result.data.has_more && result.data.next_cursor);
    cursor = result.data.next_cursor || "";
  }

  drafts.value = allDrafts;
  loading.value = false;
  status.value = "success";
  message.value = `已讀取 ${allDrafts.length} 題草稿。`;
}

async function openInitialQuestion(questionId = props.initialQuestionId) {
  if (!questionId) return;
  loading.value = true;
  status.value = "loading";
  message.value = "正在載入題目，準備編輯...";
  try {
    const result = await getStaffMathBankQuestion(questionId, {
      subject: props.subject,
      apiKey: defaultStaffApiKey,
    });
    if (!result.success) {
      status.value = "error";
      message.value = result.error || "題目讀取失敗。";
      return;
    }
    selectDraft(result.data);
    message.value = "已從題庫載入題目，可直接編輯。";
  } finally {
    loading.value = false;
  }
}

function handleFilterGradeChange() {
  filters.unit_id = "";
  loadDrafts();
}

function scheduleDraftLoad() {
  if (filterTimer) window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => {
    filterTimer = null;
    loadDrafts();
  }, 300);
}

function resetFilters() {
  filters.search = "";
  filters.grade_id = "";
  filters.unit_id = "";
  filters.difficulty = "";
  loadDrafts();
}

function createEmptyForm() {
  return {
    grade_id: "",
    unit_id: "",
    type: "calculation",
    difficulty: "U",
    question_source: "",
    prompt_md: "",
    answer_md: "",
    solution_md: "",
    thinking: "",
    assets: [],
  };
}

function startCreate() {
  contentEditorOpen.value = false;
  selectedId.value = "";
  editingStatus.value = "draft";
  editingVisibility.value = "public";
  lastCreatedId.value = "";
  allowDuplicate.value = false;
  newImageCode.value = "";
  clearPendingImages();
  Object.assign(form, createEmptyForm());
  status.value = "idle";
  message.value = "";
}

function selectDraft(question) {
  contentEditorOpen.value = false;
  selectedId.value = question.id || "";
  editingStatus.value = question.status || "draft";
  editingVisibility.value = question.visibility || "public";
  lastCreatedId.value = "";
  allowDuplicate.value = false;
  newImageCode.value = "";
  clearPendingImages();
  Object.assign(form, {
    grade_id: stringifyValue(question.grade?.id || question.grade_id),
    unit_id: stringifyValue(question.unit?.id || question.unit_id),
    type: question.type || "calculation",
    difficulty: question.difficulty || "U",
    question_source: normalizeQuestionSource(question.question_source),
    prompt_md: question.prompt_md || "",
    answer_md: question.answer_md || "",
    solution_md: question.solution_md || "",
    thinking: formatThinking(question.thinking),
    assets: Array.isArray(question.assets) ? question.assets.map(normalizeAsset) : [],
  });
  status.value = "idle";
  message.value = "";
  form.assets.forEach((asset) => {
    if (asset.source_code && !asset.url) ensureImageRendered(asset.source_code.trim());
  });
}

function toggleEditingStatus() {
  editingStatus.value = editingStatus.value === "published" ? "draft" : "published";
  message.value = editingStatus.value === "published"
    ? "已切換為公開，按下儲存後才會寫入。"
    : "已切換為草稿，按下儲存後才會寫入。";
}

function buildPayload() {
  const payload = {
    grade_id: form.grade_id,
    unit_id: form.unit_id,
    type: form.type,
    difficulty: form.difficulty,
    question_source: normalizeQuestionSource(form.question_source),
    prompt_md: form.prompt_md.trim(),
    answer_md: form.answer_md.trim(),
    solution_md: form.solution_md.trim(),
    thinking: splitThinking(form.thinking),
    status: selectedId.value ? editingStatus.value : "draft",
    visibility: selectedId.value ? editingVisibility.value : "public",
    assets: form.assets.filter(hasAssetContent).map(normalizeAsset),
  };

  if (allowDuplicate.value) payload.duplicate_policy = "allow";
  return payload;
}

function normalizeQuestionSource(value) {
  return String(value || "").trim();
}

function normalizeQuestionSources(value) {
  const values = Array.isArray(value) ? value : value?.results;
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => normalizeQuestionSource(typeof item === "string" ? item : item?.name))
        .filter(Boolean),
    ),
  ];
}

function rememberQuestionSource(value) {
  const source = normalizeQuestionSource(value);
  if (source && !questionSources.value.includes(source)) {
    questionSources.value = [...questionSources.value, source];
  }
}

function validateForm() {
  if (!form.grade_id) return "請選擇年級。";
  if (!form.unit_id) return "請選擇單元。";
  if (
    !form.prompt_md.trim() &&
    !form.assets.some(hasAssetContent) &&
    !pendingImages.value.length
  ) {
    return "請輸入題目內容或上傳題目圖片。";
  }
  return "";
}

async function saveQuestion() {
  const validationError = validateForm();
  if (validationError) {
    status.value = "error";
    message.value = validationError;
    return;
  }

  saving.value = true;
  status.value = "loading";
  const wasEditing = Boolean(selectedId.value);
  const uploadedImages = await uploadPendingImagesBeforeSave();
  if (uploadedImages === null) {
    saving.value = false;
    return;
  }
  message.value = selectedId.value
    ? editingStatus.value === "published"
      ? "正在儲存並保持公開..."
      : "正在儲存草稿..."
    : "正在新增草稿...";

  const result = selectedId.value
    ? await updateStaffMathBankQuestion(selectedId.value, buildPayload(), {
        subject: props.subject, apiKey: defaultStaffApiKey,
      })
    : await createStaffMathBankQuestion(buildPayload(), { subject: props.subject, apiKey: defaultStaffApiKey });

  if (!result.success) {
    saving.value = false;
    status.value = "error";
    message.value = getSaveError(result);
    return;
  }

  const savedQuestion = result.data || {};
  const savedStatus = savedQuestion.status || editingStatus.value;
  rememberQuestionSource(savedQuestion.question_source || form.question_source);
  startCreate();
  emit("saved", savedQuestion);
  saving.value = false;
  status.value = "success";
  message.value = wasEditing
    ? savedStatus === "published"
      ? "題目已儲存，並保持公開。"
      : "草稿已儲存。"
    : "草稿已新增，表單已清空。";
}

async function deleteQuestion() {
  if (!selectedId.value) return;
  if (editingStatus.value === "published") {
    status.value = "error";
    message.value = "公開題目不能刪除，請先切換為草稿並儲存。";
    return;
  }
  if (!window.confirm("確定要刪除這題草稿嗎？")) return;

  saving.value = true;
  status.value = "loading";
  message.value = "正在刪除草稿...";

  const result = await deleteStaffMathBankQuestion(selectedId.value, {
    subject: props.subject, apiKey: defaultStaffApiKey,
  });
  saving.value = false;

  if (!result.success) {
    status.value = "error";
    message.value = result.error || "草稿刪除失敗。";
    return;
  }

  startCreate();
  await loadDrafts();
  status.value = "success";
  message.value = "草稿已刪除。";
}

async function copyQuestionUuid() {
  if (!displayedUuid.value) return;
  try {
    await navigator.clipboard.writeText(displayedUuid.value);
    status.value = "success";
    message.value = "UUID 已複製。";
  } catch {
    status.value = "error";
    message.value = "UUID 複製失敗，請手動選取。";
  }
}

function openImagePicker() {
  imageInputRef.value?.click();
}

function addCodeImage() {
  const code = newImageCode.value.trim();
  if (!code) return;
  form.assets.push(normalizeAsset({
    role: "prompt",
    source_language: "python",
    source_code: code,
    alt_text: "程式碼圖片",
    sort_order: form.assets.length,
  }));
  newImageCode.value = "";
  ensureImageRendered(code);
}

function renderCodeAsset(asset) {
  const code = String(asset.source_code || "").trim();
  if (!code) return;
  asset.source_language = "python";
  asset.url = "";
  asset.storage_key = "";
  asset.mime_type = "";
  ensureImageRendered(code);
}

function removeCodeAsset(asset) {
  const index = form.assets.indexOf(asset);
  if (index >= 0) form.assets.splice(index, 1);
}

function handleImagePicker(event) {
  queueImages(event.target.files);
  event.target.value = "";
}

function handleImageDrop(event) {
  imageDragOver.value = false;
  queueImages(event.dataTransfer?.files);
}

function handlePaste(event) {
  const files = getImageFilesFromClipboard(event.clipboardData);
  if (!files.length) return;
  event.preventDefault();
  queueImages(files);
}

function queueImages(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) {
    status.value = "error";
    message.value = "請選擇圖片檔。";
    return;
  }

  const nextImages = files.map((file, index) => ({
    id: `pending-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    alt_text: stripExtension(file.name) || "題目圖片",
    mime_type: file.type || "image/png",
    sort_order: pendingImages.value.length + index,
  }));
  pendingImages.value = [...pendingImages.value, ...nextImages];
  status.value = "success";
  message.value = `已加入 ${files.length} 張圖片，儲存草稿時會一起上傳。`;
}

async function uploadPendingImagesBeforeSave() {
  if (!pendingImages.value.length) return [];

  uploadingImages.value = true;
  message.value = `正在上傳 ${pendingImages.value.length} 張圖片...`;
  const uploadedAssets = [];

  for (const item of pendingImages.value) {
    const key = buildGoodQuestionImageKey(item.file.name);
    const result = await uploadAssetFile({
      file: item.file,
      key,
      subject: props.subject, apiKey: defaultStaffApiKey,
    });
    if (!result.success) {
      status.value = "error";
      message.value = result.error || "圖片上傳失敗。";
      uploadingImages.value = false;
      return null;
    }

    uploadedAssets.push(
      normalizeAsset({
        role: "prompt",
        url: result.url,
        storage_key: result.key,
        alt_text: item.alt_text,
        mime_type: item.mime_type,
        sort_order: form.assets.length + uploadedAssets.length,
      }),
    );
  }

  form.assets.push(...uploadedAssets);
  clearPendingImages();
  uploadingImages.value = false;
  return uploadedAssets;
}

function removeAsset(asset) {
  const pendingImage = pendingImages.value.find((item) => item.id === asset.storage_key);
  if (pendingImage) {
    URL.revokeObjectURL(pendingImage.previewUrl);
    pendingImages.value = pendingImages.value.filter((item) => item.id !== asset.storage_key);
    return;
  }
  const assetIndex = form.assets.indexOf(asset.sourceAsset);
  if (assetIndex >= 0) form.assets.splice(assetIndex, 1);
}

function clearPendingImages() {
  pendingImages.value.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  pendingImages.value = [];
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

function hasAssetContent(asset) {
  return Boolean(
    asset?.role === "prompt" &&
      (String(asset.url || "").trim() ||
        String(asset.storage_key || "").trim() ||
        String(asset.source_code || "").trim()),
  );
}

function buildGoodQuestionImageKey(filename) {
  const cleanName = String(filename || "image.png")
    .trim()
    .replace(/^\/+/, "")
    .replace(/[\\/:*?"<>|#%{}[\]^~`]/g, "-")
    .replace(/\s+/g, "-");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${goodQuestionFolder}/${suffix}-${cleanName || "image.png"}`;
}

function stripExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

function getImageFilesFromClipboard(clipboardData) {
  return Array.from(clipboardData?.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item, index) => {
      const file = item.getAsFile();
      if (!file) return null;
      if (file.name) return file;
      const extension = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
      return new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, {
        type: file.type,
      });
    })
    .filter(Boolean);
}

function splitThinking(value) {
  return String(value || "")
    .split(/\r?\n|、|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatThinking(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
  }
  return String(value || "").trim();
}

function stringifyValue(value) {
  return value === undefined || value === null ? "" : String(value);
}

function getUnitGradeId(unit) {
  return String(unit?.grade?.id || unit?.grade_id || unit?.grade || "");
}

function getSaveError(result) {
  const data = result.data || {};
  if (data.duplicate_question_id) {
    return `偵測到可能重複題目：${data.duplicate_question_id}。確認要建立時請勾選「允許重複題」。`;
  }
  return result.error || "草稿儲存失敗。";
}
</script>

<style scoped>
.question-entry-editor {
  position: relative;
}

.question-entry-loading-overlay {
  position: absolute;
  z-index: 5;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  color: #202124;
  text-align: center;
  backdrop-filter: blur(2px);
}

.question-entry-loading-overlay > span:last-child {
  color: #6b7280;
  font-size: 13px;
  font-weight: 700;
}

.question-entry-loading-spinner {
  width: 30px;
  height: 30px;
  border: 4px solid #d9e2ec;
  border-top-color: #153f67;
  border-radius: 50%;
  animation: question-entry-spin 0.8s linear infinite;
}

@keyframes question-entry-spin {
  to { transform: rotate(360deg); }
}

.question-source-field {
  display: grid;
  gap: 6px;
}

.question-source-combobox {
  position: relative;
}

.question-source-options {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  display: grid;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #d5d7db;
  border-radius: 8px;
  padding: 6px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(32, 33, 36, 0.14);
}

.question-source-option {
  width: 100%;
  border: 0;
  border-radius: 6px;
  padding: 9px 10px;
  background: transparent;
  color: #202124;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.question-source-option:hover,
.question-source-option.active {
  background: #f0f2f5;
}

.question-source-empty {
  margin: 0;
  padding: 9px 10px;
  color: #6a707b;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.5;
}
</style>
