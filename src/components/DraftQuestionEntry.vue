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
            <MathText :content="question.prompt_md" fallback="無題目" />
          </strong>
          <small>{{ question.difficulty || "A" }} · 草稿</small>
        </button>
      </div>

      <p v-if="message" class="message" :class="status">{{ message }}</p>
    </aside>

    <section class="output-panel question-entry-editor">
      <form class="simple-question-form" @submit.prevent="saveQuestion">
        <div class="question-bank-toolbar">
          <div>
            <h2 class="section-title">{{ selectedId ? "編輯草稿" : "新增草稿" }}</h2>
            <p>狀態固定為草稿。</p>
          </div>
          <div class="icon-group">
            <button class="secondary-button compact" type="button" @click="copyPayload">
              複製 JSON
            </button>
            <button
              v-if="selectedId"
              class="ghost-button compact danger"
              :disabled="saving"
              type="button"
              @click="deleteQuestion"
            >
              刪除
            </button>
          </div>
        </div>

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
        </section>

        <section class="word-workflow-section">
          <header class="word-workflow-header">
            <div>
              <span>02</span>
              <h3>內容</h3>
            </div>
            <strong>LaTeX</strong>
          </header>

          <label class="field-label">
            題目 Markdown / KaTeX
            <textarea
              v-model="form.prompt_md"
              class="textarea compact-textarea question-markdown-textarea"
              placeholder="輸入題目內容。選擇題可直接寫成：(A) ... (B) ..."
            ></textarea>
          </label>

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
              :disabled="uploadingImages"
              type="button"
              @click="openImagePicker"
            >
              {{ uploadingImages ? "上傳中" : "選擇圖片" }}
            </button>
          </section>

          <div v-if="imageAssets.length" class="question-image-grid">
            <article
              v-for="asset in imageAssets"
              :key="asset.storage_key || asset.url"
              class="question-image-card"
            >
              <img :src="asset.url" :alt="asset.alt_text || '題目圖片'" />
              <div>
                <strong>{{ asset.alt_text || "題目圖片" }}</strong>
                <span>{{ asset.storage_key }}</span>
              </div>
              <button
                class="ghost-button compact danger"
                type="button"
                @click="removeAsset(asset.storage_key || asset.url)"
              >
                移除
              </button>
            </article>
          </div>

          <div class="filter-grid two">
            <label class="field-label">
              答案
              <textarea
                v-model="form.answer_md"
                class="textarea compact-textarea answer-textarea"
                placeholder="輸入答案。"
              ></textarea>
            </label>

            <label class="field-label">
              思維（每行一項）
              <textarea
                v-model="form.thinking"
                class="textarea compact-textarea thinking-textarea"
                placeholder="例如：座標幾何&#10;外接圓"
              ></textarea>
            </label>
          </div>

          <label class="field-label">
            詳解
            <textarea
              v-model="form.solution_md"
              class="textarea compact-textarea solution-textarea"
              placeholder="輸入詳解。"
            ></textarea>
          </label>
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
              {{ saving ? "儲存中" : selectedId ? "儲存草稿" : "新增草稿" }}
            </button>
            <button class="secondary-button" :disabled="saving" type="button" @click="startCreate">
              清空新增
            </button>
          </div>
        </section>
      </form>

      <section class="simple-preview">
        <h2 class="section-title">預覽</h2>
        <div class="question-editor-preview-grid">
          <section class="question-editor-preview-block prompt">
            <strong>題目</strong>
            <p><MathText :content="form.prompt_md" fallback="尚未輸入題目" /></p>
            <div v-if="imageAssets.length" class="preview-image-strip">
              <img
                v-for="asset in imageAssets"
                :key="`preview-${asset.storage_key || asset.url}`"
                :src="asset.url"
                :alt="asset.alt_text || '題目圖片'"
              />
            </div>
          </section>
          <section class="question-editor-preview-block answer">
            <strong>答案</strong>
            <p><MathText :content="form.answer_md" fallback="尚未輸入答案" /></p>
          </section>
          <section class="question-editor-preview-block solution">
            <strong>詳解</strong>
            <p><MathText :content="form.solution_md" fallback="尚未輸入詳解" /></p>
          </section>
        </div>
      </section>
    </section>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import MathText from "./MathText.vue";
import {
  createStaffMathBankQuestion,
  deleteStaffMathBankQuestion,
  listMathBankGrades,
  listMathBankUnits,
  searchStaffMathBankQuestions,
  uploadAssetFile,
  updateStaffMathBankQuestion,
} from "../services/api";

const emit = defineEmits(["copy"]);

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
];
const questionDifficulties = [
  { value: "A", label: "A 基礎型" },
  { value: "B", label: "B 進階型" },
  { value: "C", label: "C 挑戰型" },
  { value: "S", label: "S 究極型" },
];

const grades = ref([]);
const units = ref([]);
const drafts = ref([]);
const selectedId = ref("");
const loading = ref(false);
const saving = ref(false);
const status = ref("idle");
const message = ref("");
const allowDuplicate = ref(false);
const uploadingImages = ref(false);
const imageDragOver = ref(false);
const imageInputRef = ref(null);
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
const imageAssets = computed(() => form.assets.filter(hasAssetContent));

onMounted(async () => {
  window.addEventListener("paste", handlePaste);
  await loadTaxonomy();
  await loadDrafts();
});

onBeforeUnmount(() => {
  if (filterTimer) window.clearTimeout(filterTimer);
  window.removeEventListener("paste", handlePaste);
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
      { apiKey: defaultStaffApiKey },
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
    difficulty: "A",
    prompt_md: "",
    answer_md: "",
    solution_md: "",
    thinking: "",
    assets: [],
  };
}

function startCreate() {
  selectedId.value = "";
  allowDuplicate.value = false;
  Object.assign(form, createEmptyForm());
  status.value = "idle";
  message.value = "";
}

function selectDraft(question) {
  if (question.status && question.status !== "draft") {
    status.value = "error";
    message.value = "只能編輯草稿題目。";
    return;
  }

  selectedId.value = question.id || "";
  allowDuplicate.value = false;
  Object.assign(form, {
    grade_id: stringifyValue(question.grade?.id || question.grade_id),
    unit_id: stringifyValue(question.unit?.id || question.unit_id),
    type: question.type || "calculation",
    difficulty: question.difficulty || "A",
    prompt_md: question.prompt_md || "",
    answer_md: question.answer_md || "",
    solution_md: question.solution_md || "",
    thinking: formatThinking(question.thinking),
    assets: Array.isArray(question.assets) ? question.assets.map(normalizeAsset) : [],
  });
  status.value = "idle";
  message.value = "";
}

function buildPayload() {
  const payload = {
    grade_id: form.grade_id,
    unit_id: form.unit_id,
    type: form.type,
    difficulty: form.difficulty,
    prompt_md: form.prompt_md.trim(),
    answer_md: form.answer_md.trim(),
    solution_md: form.solution_md.trim(),
    thinking: splitThinking(form.thinking),
    status: "draft",
    visibility: "public",
    assets: form.assets.map(normalizeAsset),
  };

  if (allowDuplicate.value) payload.duplicate_policy = "allow";
  return payload;
}

function validateForm() {
  if (!form.grade_id) return "請選擇年級。";
  if (!form.unit_id) return "請選擇單元。";
  if (!form.prompt_md.trim() && !form.assets.some(hasAssetContent)) {
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
  message.value = selectedId.value ? "正在儲存草稿..." : "正在新增草稿...";
  const wasEditing = Boolean(selectedId.value);

  const result = selectedId.value
    ? await updateStaffMathBankQuestion(selectedId.value, buildPayload(), {
        apiKey: defaultStaffApiKey,
      })
    : await createStaffMathBankQuestion(buildPayload(), { apiKey: defaultStaffApiKey });
  saving.value = false;

  if (!result.success) {
    status.value = "error";
    message.value = getSaveError(result);
    return;
  }

  const savedQuestion = result.data || {};
  await loadDrafts();
  if (savedQuestion.id) {
    const refreshedQuestion = drafts.value.find((question) => question.id === savedQuestion.id);
    selectDraft(refreshedQuestion || savedQuestion);
  } else {
    startCreate();
  }
  status.value = "success";
  message.value = wasEditing ? "草稿已儲存。" : "草稿已新增。";
}

async function deleteQuestion() {
  if (!selectedId.value) return;
  if (!window.confirm("確定要刪除這題草稿嗎？")) return;

  saving.value = true;
  status.value = "loading";
  message.value = "正在刪除草稿...";

  const result = await deleteStaffMathBankQuestion(selectedId.value, {
    apiKey: defaultStaffApiKey,
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

function copyPayload() {
  emit("copy", JSON.stringify(buildPayload(), null, 2));
}

function openImagePicker() {
  imageInputRef.value?.click();
}

function handleImagePicker(event) {
  uploadImages(event.target.files);
  event.target.value = "";
}

function handleImageDrop(event) {
  imageDragOver.value = false;
  uploadImages(event.dataTransfer?.files);
}

function handlePaste(event) {
  const files = getImageFilesFromClipboard(event.clipboardData);
  if (!files.length) return;
  event.preventDefault();
  uploadImages(files);
}

async function uploadImages(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) {
    status.value = "error";
    message.value = "請選擇圖片檔。";
    return;
  }

  uploadingImages.value = true;
  status.value = "loading";
  message.value = `正在上傳 ${files.length} 張圖片...`;

  let successCount = 0;
  for (const file of files) {
    const key = buildGoodQuestionImageKey(file.name);
    const result = await uploadAssetFile({ file, key, apiKey: defaultStaffApiKey });
    if (!result.success) {
      status.value = "error";
      message.value = result.error || "圖片上傳失敗。";
      uploadingImages.value = false;
      return;
    }

    form.assets.push(
      normalizeAsset({
        role: "prompt",
        url: result.url,
        storage_key: result.key,
        alt_text: stripExtension(file.name) || "題目圖片",
        mime_type: file.type || "image/png",
        sort_order: form.assets.length,
      }),
    );
    successCount += 1;
  }

  uploadingImages.value = false;
  status.value = "success";
  message.value = `已上傳 ${successCount} 張圖片，記得儲存草稿。`;
}

function removeAsset(assetKey) {
  form.assets = form.assets.filter(
    (asset) => (asset.storage_key || asset.url) !== assetKey,
  );
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
