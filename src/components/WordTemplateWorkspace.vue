<template>
  <section class="feature-workspace word-template-workspace">
    <aside class="control-panel">
      <h2 class="section-title">Word 套版＋公開草稿入題</h2>

      <label class="api-key-field">
        <span>Staff API Key</span>
        <input
          v-model="localStaffApiKey"
          autocomplete="off"
          spellcheck="false"
          type="password"
          placeholder="入資料庫時使用"
        />
      </label>

      <label class="field-label">
        Word 模板
        <select v-model="templateId" class="select-input" :disabled="templatesLoading">
          <option v-for="template in templates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>
      </label>
      <p class="field-hint">{{ selectedTemplate.description }}</p>

      <div
        class="drop-zone"
        :class="{ over: dragOver }"
        @click="fileInput?.click()"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="handleDrop"
      >
        <div class="file-icon">W</div>
        <strong>{{ wordFile ? wordFile.name : "選擇或拖拉 JSON / Word" }}</strong>
        <span>{{ wordFile ? `${Math.ceil(wordFile.size / 1024)} KB` : "支援 .json、.docx" }}</span>
        <input
          ref="fileInput"
          hidden
          type="file"
          accept=".json,application/json,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          @change="handleFileChange"
        />
      </div>

      <label class="checkbox-row">
        <input v-model="includeAssets" type="checkbox" :disabled="isJsonFile" />
        <span>{{ isJsonFile ? "JSON 不需要解析圖片資產" : "解析圖片資產" }}</span>
      </label>

      <label class="field-label">
        解析模式
        <select v-model="parseMode" class="select-input" :disabled="isJsonFile">
          <option value="accurate">OpenAI 精準分析</option>
          <option value="fast">快速解析</option>
        </select>
      </label>

      <button
        class="primary-button full"
        :disabled="wordStatus === 'loading'"
        type="button"
        @click="parseWord"
      >
        {{ wordStatus === "loading" ? "解析中" : "解析題目" }}
      </button>

      <div v-if="wordDocument" class="stats-grid">
        <div>
          <strong>{{ wordStats.questions }}</strong>
          <span>題目</span>
        </div>
        <div>
          <strong>{{ wordStats.sections }}</strong>
          <span>區段</span>
        </div>
        <div>
          <strong>{{ wordStats.assets }}</strong>
          <span>圖片</span>
        </div>
      </div>

      <section v-if="wordDocument" class="action-box">
        <h3>段考卷套版</h3>
        <label class="field-label">
          下載檔名
          <input v-model="outputFilename" class="text-input" type="text" />
        </label>
        <button
          class="primary-button full"
          :disabled="wordStatus === 'generating'"
          type="button"
          @click="generateWord"
        >
          {{ wordStatus === "generating" ? "產生中" : "產生並下載 Word" }}
        </button>
        <button class="secondary-button full" type="button" @click="downloadEditedJson">
          產生新的 JSON
        </button>
      </section>

      <section v-if="wordDocument" class="action-box">
        <h3>公開草稿大量入題</h3>
        <div class="fixed-meta-line">
          <span>狀態：草稿</span>
          <span>可見性：公開</span>
        </div>

        <label class="field-label">
          年級
          <select v-model="importSettings.gradeId" class="select-input" @change="handleGradeChange">
            <option value="">選擇年級</option>
            <option v-for="grade in grades" :key="getRecordId(grade)" :value="getRecordId(grade)">
              {{ grade.name }}
            </option>
            <option :value="NEW_GRADE_VALUE">+ 手打新增年級</option>
          </select>
        </label>
        <input
          v-if="importSettings.gradeId === NEW_GRADE_VALUE"
          v-model="importSettings.newGradeName"
          class="text-input"
          type="text"
          placeholder="輸入新年級名稱"
        />

        <label class="field-label">
          單元
          <select v-model="importSettings.unitId" class="select-input" :disabled="!importSettings.gradeId">
            <option value="">選擇單元</option>
            <option v-for="unit in filteredImportUnits" :key="getRecordId(unit)" :value="getRecordId(unit)">
              {{ unit.name }}
            </option>
            <option :value="NEW_UNIT_VALUE">+ 手打新增單元</option>
          </select>
        </label>
        <input
          v-if="importSettings.unitId === NEW_UNIT_VALUE || importSettings.gradeId === NEW_GRADE_VALUE"
          v-model="importSettings.newUnitName"
          class="text-input"
          type="text"
          placeholder="輸入新單元名稱"
        />

        <div class="filter-grid two">
          <label>
            <span class="field-label">題型</span>
            <select v-model="importSettings.type" class="select-input">
              <option value="__per_question__">依每題設定</option>
              <option value="calculation">計算題</option>
              <option value="choice">選擇題</option>
              <option value="fill">填充題</option>
              <option value="proof">證明題</option>
            </select>
          </label>
          <label>
            <span class="field-label">難度</span>
            <select v-model="importSettings.difficulty" class="select-input">
              <option value="__per_question__">依每題設定</option>
              <option value="A">A 基礎型</option>
              <option value="B">B 進階型</option>
              <option value="C">C 挑戰型</option>
              <option value="S">S 究極型</option>
            </select>
          </label>
        </div>

        <button
          class="primary-button full"
          :disabled="importStatus === 'loading'"
          type="button"
          @click="importQuestions"
        >
          {{ importStatus === "loading" ? "入庫中" : "題目入資料庫" }}
        </button>
        <p v-if="importMessage" class="message" :class="importStatus">{{ importMessage }}</p>
      </section>

      <p v-if="wordMessage" class="message" :class="wordStatus">{{ wordMessage }}</p>
    </aside>

    <section class="output-panel">
      <div class="panel-header">
        <h2 class="section-title">題目編輯與預覽</h2>
        <div class="icon-group">
          <button class="icon-button" title="複製 JSON" type="button" @click="copyJson">⧉</button>
          <button class="icon-button" title="套用 JSON 到編輯器" type="button" @click="syncPreview">↻</button>
        </div>
      </div>

      <section v-if="wordDocument" class="word-workflow-section">
        <header class="word-workflow-header">
          <div>
            <span>01</span>
            <h3>公開草稿題目清單</h3>
          </div>
          <strong>{{ wordStats.questions }} 題</strong>
        </header>

        <div class="word-editor-shell">
        <label class="field-label">
          文件標題
          <input
            v-model="wordDocument.title"
            class="text-input"
            type="text"
            @input="syncJsonFromDocument"
          />
        </label>

        <section
          v-for="(section, sectionIndex) in wordDocument.sections"
          :key="`section-${sectionIndex}`"
          class="word-section-card"
        >
          <header class="word-section-header">
            <input
              v-model="section.title"
              class="text-input"
              type="text"
              :placeholder="`第 ${sectionIndex + 1} 區段`"
              @input="syncJsonFromDocument"
            />
            <span>{{ section.questions.length }} 題</span>
          </header>

          <article
            v-for="(question, questionIndex) in section.questions"
            :key="`${sectionIndex}-${questionIndex}`"
            class="word-question-card"
          >
            <header class="word-question-header">
              <div>
                <strong>第 {{ question.number || "?" }} 題</strong>
                <span>{{ question.answer ? `答案 ${question.answer}` : "答案未填" }}</span>
              </div>
              <div class="word-question-actions">
                <label class="question-select-toggle">
                  <input
                    type="checkbox"
                    :checked="isQuestionSelected(sectionIndex, questionIndex)"
                    @change="setQuestionSelected(sectionIndex, questionIndex, $event.target.checked)"
                  />
                  <span>入庫</span>
                </label>
                <button
                  class="ghost-button compact danger"
                  type="button"
                  @click="removeQuestion(section, questionIndex)"
                >
                  刪除
                </button>
              </div>
            </header>

            <div class="word-question-edit-panel">
            <div class="filter-grid two">
              <label>
                <span class="field-label">題號</span>
                <input
                  v-model="question.number"
                  class="text-input"
                  type="text"
                  @input="syncJsonFromDocument"
                />
              </label>
              <label>
                <span class="field-label">答案</span>
                <select
                  v-model="question.answer"
                  class="select-input"
                  @change="syncJsonFromDocument"
                >
                  <option value="">待確認</option>
                  <option
                    v-for="option in question.options"
                    :key="option.label"
                    :value="option.label"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </div>

            <div class="filter-grid two">
              <label>
                <span class="field-label">題型</span>
                <select
                  class="select-input"
                  :value="questionType(question)"
                  @change="setQuestionMathBank(question, { type: $event.target.value })"
                >
                  <option value="calculation">計算題</option>
                  <option value="choice">選擇題</option>
                  <option value="fill">填充題</option>
                  <option value="proof">證明題</option>
                </select>
              </label>
              <label>
                <span class="field-label">難度</span>
                <select
                  class="select-input"
                  :value="questionDifficulty(question)"
                  @change="setQuestionMathBank(question, { difficulty: $event.target.value })"
                >
                  <option value="A">A 基礎型</option>
                  <option value="B">B 進階型</option>
                  <option value="C">C 挑戰型</option>
                  <option value="S">S 究極型</option>
                </select>
              </label>
            </div>

            <div class="filter-grid two">
              <label>
                <span class="field-label">入庫年級</span>
                <select
                  class="select-input"
                  :value="questionGradeId(question)"
                  @change="setQuestionMathBank(question, { grade_id: $event.target.value, unit_id: '' })"
                >
                  <option value="">使用左側年級</option>
                  <option
                    v-for="grade in grades"
                    :key="getRecordId(grade)"
                    :value="getRecordId(grade)"
                  >
                    {{ grade.name }}
                  </option>
                </select>
              </label>
              <label>
                <span class="field-label">入庫單元</span>
                <select
                  class="select-input"
                  :value="questionUnitId(question)"
                  :disabled="!filteredQuestionUnits(question).length"
                  @change="setQuestionMathBank(question, { unit_id: $event.target.value })"
                >
                  <option value="">
                    {{ effectiveQuestionGradeId(question) ? "使用左側單元" : "先選年級" }}
                  </option>
                  <option
                    v-for="unit in filteredQuestionUnits(question)"
                    :key="getRecordId(unit)"
                    :value="getRecordId(unit)"
                  >
                    {{ unit.name }}
                  </option>
                </select>
              </label>
            </div>

            <div class="fixed-meta-line">
              <span>入庫狀態：草稿</span>
              <span>可見性：公開</span>
            </div>

            <label class="field-label">
              題幹
              <textarea
                v-model="question.stem"
                class="textarea compact-textarea"
                @input="syncJsonFromDocument"
              ></textarea>
            </label>

            <div class="word-options-header">
              <span class="field-label">選項</span>
              <button class="ghost-button compact" type="button" @click="addOption(question)">
                新增選項
              </button>
            </div>
            <div class="word-option-list">
              <div
                v-for="(option, optionIndex) in question.options"
                :key="`${sectionIndex}-${questionIndex}-option-${optionIndex}`"
                class="word-option-row"
              >
                <input
                  v-model="option.label"
                  class="text-input option-label-input"
                  type="text"
                  @input="option.label = option.label.toUpperCase(); syncJsonFromDocument()"
                />
                <input
                  v-model="option.text"
                  class="text-input"
                  type="text"
                  @input="syncJsonFromDocument"
                />
                <button
                  class="icon-button"
                  title="刪除選項"
                  type="button"
                  @click="removeOption(question, optionIndex)"
                >
                  ×
                </button>
              </div>
            </div>

            <label class="field-label">
              詳解（每行一段）
              <textarea
                class="textarea compact-textarea solution-textarea"
                :value="solutionText(question)"
                @input="setQuestionSolution(question, $event.target.value)"
              ></textarea>
            </label>
            </div>

            <div class="word-question-preview-panel">
              <header class="word-question-preview-title">本題預覽</header>
              <section>
                <strong>題目</strong>
                <p><MathText :content="buildQuestionPrompt(question)" fallback="尚未輸入題目" /></p>
              </section>
              <section>
                <strong>答案</strong>
                <p><MathText :content="question.answer" fallback="尚未輸入答案" /></p>
              </section>
              <section>
                <strong>詳解</strong>
                <p><MathText :content="solutionText(question)" fallback="尚未輸入詳解" /></p>
              </section>
            </div>
          </article>

          <button class="secondary-button full" type="button" @click="addQuestion(section, sectionIndex)">
            新增題目
          </button>
        </section>
        </div>
      </section>

      <section class="word-workflow-section">
        <header class="word-workflow-header">
          <div>
            <span>02</span>
            <h3>JSON 編輯</h3>
          </div>
        </header>

        <textarea
          v-model="wordJsonText"
          class="textarea json-textarea"
          placeholder="解析後的題目 JSON 會出現在這裡，可直接修改後再套版或入庫。"
        ></textarea>
      </section>

      <div v-if="!renderPreviewDocument" class="empty-state">
        <strong>尚未解析題目</strong>
        <span>上傳 JSON 或 DOCX 後，可在這裡校正再套版或入庫。</span>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import MathText from "./MathText.vue";
import {
  createStaffMathBankGrade,
  createStaffMathBankQuestion,
  createStaffMathBankUnit,
  fetchWordTemplates,
  generateWordDocument,
  listMathBankGrades,
  listMathBankUnits,
  parseWordDocument,
} from "../services/api";

const props = defineProps({
  staffApiKey: {
    type: String,
    default: "",
  },
});

const FALLBACK_TEMPLATES = [
  {
    id: "exam_paper",
    name: "段考卷",
    description: "依段考卷模板產生考卷。",
  },
];
const NEW_GRADE_VALUE = "__new_grade__";
const NEW_UNIT_VALUE = "__new_unit__";
const PER_QUESTION_VALUE = "__per_question__";
const QUESTION_TYPE_LABELS = {
  calculation: "計算題",
  choice: "選擇題",
  fill: "填充題",
  proof: "證明題",
};
const QUESTION_DIFFICULTY_LABELS = {
  A: "A 基礎型",
  B: "B 進階型",
  C: "C 挑戰型",
  S: "S 究極型",
};

const localStaffApiKey = ref(props.staffApiKey);
const fileInput = ref(null);
const wordFile = ref(null);
const dragOver = ref(false);
const templates = ref(FALLBACK_TEMPLATES);
const templateId = ref("exam_paper");
const templatesLoading = ref(true);
const includeAssets = ref(true);
const parseMode = ref("accurate");
const wordStatus = ref("idle");
const wordMessage = ref("");
const wordDocument = ref(null);
const wordJsonText = ref("");
const questionModes = ref({});
const selectedQuestions = ref({});
const outputFilename = ref("exam-paper.docx");
const grades = ref([]);
const units = ref([]);
const importStatus = ref("idle");
const importMessage = ref("");
const importSettings = reactive({
  gradeId: "",
  newGradeName: "",
  unitId: "",
  newUnitName: "",
  type: PER_QUESTION_VALUE,
  difficulty: PER_QUESTION_VALUE,
});

const isJsonFile = computed(() => wordFile.value?.name?.toLowerCase().endsWith(".json"));
const selectedTemplate = computed(
  () => templates.value.find((template) => template.id === templateId.value) || templates.value[0],
);
const filteredImportUnits = computed(() => {
  if (!importSettings.gradeId || importSettings.gradeId === NEW_GRADE_VALUE) return [];
  return units.value.filter((unit) => getUnitGradeId(unit) === importSettings.gradeId);
});
const wordStats = computed(() => {
  const document = getCurrentDocument({ silent: true });
  const questions = getDocumentQuestions(document);
  return {
    questions: questions.length,
    sections: document?.sections?.length || 0,
    assets: document?.assets?.length || 0,
  };
});
const renderPreviewDocument = computed(() => getCurrentDocument({ silent: true }));

onMounted(async () => {
  const result = await fetchWordTemplates();
  if (result.success && result.templates.length) {
    templates.value = result.templates;
    templateId.value = result.templates.some((template) => template.id === result.defaultTemplateId)
      ? result.defaultTemplateId
      : result.templates[0].id;
  }
  templatesLoading.value = false;
  await loadTaxonomy({ silent: true });
});

function handleFile(selectedFile) {
  if (!selectedFile) return;
  if (!/\.(docx|json)$/i.test(selectedFile.name)) {
    wordStatus.value = "error";
    wordMessage.value = "請選擇 .json 或 .docx 檔案。";
    return;
  }
  wordFile.value = selectedFile;
  wordDocument.value = null;
  wordJsonText.value = "";
  questionModes.value = {};
  selectedQuestions.value = {};
  outputFilename.value = `${selectedFile.name.replace(/\.(docx|json)$/i, "")}-段考卷.docx`;
  wordStatus.value = "idle";
  wordMessage.value = "";
}

function handleFileChange(event) {
  handleFile(event.target.files?.[0]);
}

function handleDrop(event) {
  dragOver.value = false;
  handleFile(event.dataTransfer.files?.[0]);
}

async function parseWord() {
  if (!wordFile.value) {
    wordStatus.value = "error";
    wordMessage.value = "請先選擇 JSON 或 Word 文件。";
    return;
  }

  wordStatus.value = "loading";
  wordMessage.value = isJsonFile.value ? "正在讀取題庫 JSON..." : "正在解析 Word 題目...";
  const result = await parseWordDocument({
    file: wordFile.value,
    includeAssets: includeAssets.value,
    mode: parseMode.value,
  });

  if (!result.success) {
    wordStatus.value = "error";
    wordMessage.value = result.error || "Word 文件解析失敗。";
    return;
  }

  wordDocument.value = normalizeDocument(result.document);
  wordJsonText.value = JSON.stringify(wordDocument.value, null, 2);
  questionModes.value = {};
  selectedQuestions.value = {};
  applyFirstQuestionMetadata();
  wordStatus.value = "success";
  wordMessage.value = "題目解析完成。";
}

async function generateWord() {
  const document = getCurrentDocument();
  if (!document) return;
  if (!getDocumentQuestions(document).length) {
    wordStatus.value = "error";
    wordMessage.value = "至少需要一題才能產生 Word。";
    return;
  }

  wordStatus.value = "generating";
  wordMessage.value = "正在套用模板並產生 Word...";
  const result = await generateWordDocument({
    document,
    filename: outputFilename.value || "exam-paper.docx",
    templateId: templateId.value,
  });

  if (!result.success) {
    wordStatus.value = "error";
    wordMessage.value = result.error || "Word 文件產生失敗。";
    return;
  }

  downloadBlob(result.blob, result.filename || outputFilename.value);
  wordDocument.value = document;
  wordStatus.value = "success";
  wordMessage.value = "Word 已產生並開始下載。";
}

async function importQuestions() {
  const document = getCurrentDocument();
  if (!document || !validateImport(document)) return;

  importStatus.value = "loading";
  importMessage.value = "正在建立公開草稿題目...";

  try {
    const gradeId = await ensureGrade();
    const unitId = await ensureUnit(gradeId);
    const payload = buildMathBankPayload(getSelectedImportDocument(document), {
      grade_id: gradeId,
      unit_id: unitId,
      type: importSettings.type === PER_QUESTION_VALUE ? undefined : importSettings.type,
      difficulty:
        importSettings.difficulty === PER_QUESTION_VALUE
          ? undefined
          : importSettings.difficulty,
    });

    for (const [index, question] of payload.questions.entries()) {
      const result = await createStaffMathBankQuestion(question, {
        apiKey: localStaffApiKey.value,
      });
      if (!result.success) {
        throw new Error(`第 ${index + 1} 題入庫失敗：${result.error || "未知錯誤"}`);
      }
    }

    importStatus.value = "success";
    importMessage.value = `已新增 ${payload.questions.length} 題公開草稿。`;
    await loadTaxonomy({ silent: true });
  } catch (error) {
    importStatus.value = "error";
    importMessage.value = error.message || "批次入庫失敗。";
  }
}

function validateImport(document) {
  if (!localStaffApiKey.value.trim()) {
    importStatus.value = "error";
    importMessage.value = "請先輸入 Staff API Key。";
    return false;
  }
  if (!getDocumentQuestions(getSelectedImportDocument(document)).length) {
    importStatus.value = "error";
    importMessage.value = "至少需要勾選一題才能入資料庫。";
    return false;
  }
  if (!importSettings.gradeId) {
    importStatus.value = "error";
    importMessage.value = "請選擇年級，或手打新增年級。";
    return false;
  }
  if (importSettings.gradeId === NEW_GRADE_VALUE && !importSettings.newGradeName.trim()) {
    importStatus.value = "error";
    importMessage.value = "請輸入新年級名稱。";
    return false;
  }
  if (!importSettings.unitId) {
    importStatus.value = "error";
    importMessage.value = "請選擇單元，或手打新增單元。";
    return false;
  }
  if (
    (importSettings.unitId === NEW_UNIT_VALUE || importSettings.gradeId === NEW_GRADE_VALUE) &&
    !importSettings.newUnitName.trim()
  ) {
    importStatus.value = "error";
    importMessage.value = "請輸入新單元名稱。";
    return false;
  }
  return true;
}

async function ensureGrade() {
  if (importSettings.gradeId !== NEW_GRADE_VALUE) return importSettings.gradeId;
  const result = await createStaffMathBankGrade(
    {
      name: importSettings.newGradeName.trim(),
      order_index: grades.value.length,
      is_active: true,
    },
    { apiKey: localStaffApiKey.value },
  );
  if (!result.success) throw new Error(result.error || "新增年級失敗。");
  const id = getRecordId(result.data);
  if (!id) throw new Error("新增年級後未取得 ID。");
  grades.value = [...grades.value, result.data];
  importSettings.gradeId = id;
  importSettings.newGradeName = "";
  return id;
}

async function ensureUnit(gradeId) {
  if (
    importSettings.unitId !== NEW_UNIT_VALUE &&
    importSettings.gradeId !== NEW_GRADE_VALUE
  ) {
    return importSettings.unitId;
  }
  const result = await createStaffMathBankUnit(
    {
      grade_id: gradeId,
      parent_id: null,
      name: importSettings.newUnitName.trim(),
      order_index: filteredImportUnits.value.length,
      is_active: true,
    },
    { apiKey: localStaffApiKey.value },
  );
  if (!result.success) throw new Error(result.error || "新增單元失敗。");
  const id = getRecordId(result.data);
  if (!id) throw new Error("新增單元後未取得 ID。");
  units.value = [...units.value, result.data];
  importSettings.unitId = id;
  importSettings.newUnitName = "";
  return id;
}

async function loadTaxonomy({ silent = false } = {}) {
  if (!localStaffApiKey.value.trim()) return;
  if (!silent) {
    importStatus.value = "loading";
    importMessage.value = "正在讀取年級與單元...";
  }
  const [gradeResult, unitResult] = await Promise.all([
    listMathBankGrades({}, { apiKey: localStaffApiKey.value }),
    listMathBankUnits({}, { apiKey: localStaffApiKey.value }),
  ]);
  if (gradeResult.success) grades.value = gradeResult.data || [];
  if (unitResult.success) units.value = unitResult.data || [];
  if (!gradeResult.success || !unitResult.success) {
    importStatus.value = "error";
    importMessage.value = gradeResult.error || unitResult.error || "題庫分類讀取失敗。";
  } else if (!silent) {
    importStatus.value = "success";
    importMessage.value = "題庫分類已讀取。";
  }
}

function handleGradeChange() {
  importSettings.unitId =
    importSettings.gradeId === NEW_GRADE_VALUE ? NEW_UNIT_VALUE : "";
}

function getCurrentDocument({ silent = false } = {}) {
  if (!wordJsonText.value.trim()) return wordDocument.value;
  try {
    return normalizeDocument(JSON.parse(wordJsonText.value));
  } catch (error) {
    if (!silent) {
      wordStatus.value = "error";
      wordMessage.value = "題目 JSON 格式錯誤，請修正後再操作。";
    }
    return null;
  }
}

function syncPreview() {
  const document = getCurrentDocument();
  if (!document) return;
  wordDocument.value = document;
  wordJsonText.value = JSON.stringify(document, null, 2);
  questionModes.value = {};
  selectedQuestions.value = {};
  wordStatus.value = "success";
  wordMessage.value = "預覽已更新。";
}

function downloadEditedJson() {
  const document = getCurrentDocument();
  if (!document) return;
  downloadJson(buildMathBankPayload(document), getOutputBasename(outputFilename.value) + ".json");
}

function copyJson() {
  if (wordJsonText.value) navigator.clipboard?.writeText(wordJsonText.value);
}

function questionKey(sectionIndex, questionIndex) {
  return `${sectionIndex}-${questionIndex}`;
}

function questionMode(sectionIndex, questionIndex) {
  return questionModes.value[questionKey(sectionIndex, questionIndex)] || "preview";
}

function setQuestionMode(sectionIndex, questionIndex, mode) {
  questionModes.value = {
    ...questionModes.value,
    [questionKey(sectionIndex, questionIndex)]: mode,
  };
}

function isQuestionSelected(sectionIndex, questionIndex) {
  return selectedQuestions.value[questionKey(sectionIndex, questionIndex)] !== false;
}

function setQuestionSelected(sectionIndex, questionIndex, checked) {
  selectedQuestions.value = {
    ...selectedQuestions.value,
    [questionKey(sectionIndex, questionIndex)]: checked,
  };
}

function syncJsonFromDocument() {
  if (!wordDocument.value) return;
  wordDocument.value = normalizeDocument(wordDocument.value);
  wordJsonText.value = JSON.stringify(wordDocument.value, null, 2);
}

function questionType(question) {
  return question.math_bank?.type || inferQuestionType(question);
}

function questionDifficulty(question) {
  return question.math_bank?.difficulty || "A";
}

function questionGradeId(question) {
  return String(question.math_bank?.grade_id || "");
}

function questionUnitId(question) {
  return String(question.math_bank?.unit_id || "");
}

function filteredQuestionUnits(question) {
  const gradeId = effectiveQuestionGradeId(question);
  if (!gradeId || gradeId === NEW_GRADE_VALUE) return [];
  return units.value.filter((unit) => getUnitGradeId(unit) === gradeId);
}

function effectiveQuestionGradeId(question) {
  return questionGradeId(question) || importSettings.gradeId;
}

function formatQuestionType(type) {
  return QUESTION_TYPE_LABELS[type] || type || "-";
}

function formatQuestionDifficulty(difficulty) {
  return QUESTION_DIFFICULTY_LABELS[difficulty] || difficulty || "-";
}

function ensureQuestionMathBank(question) {
  if (!question.math_bank) question.math_bank = {};
  return question.math_bank;
}

function setQuestionMathBank(question, patch) {
  question.math_bank = {
    ...ensureQuestionMathBank(question),
    ...patch,
  };
  syncJsonFromDocument();
}

function solutionText(question) {
  return Array.isArray(question.solution)
    ? question.solution.join("\n")
    : String(question.solution || "");
}

function questionSharedContextText(question) {
  return arrayText(question?.shared_context);
}

function arrayText(value) {
  if (!Array.isArray(value)) return String(value || "").trim();
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.text || item?.content || "";
    })
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("\n");
}

function setQuestionSolution(question, value) {
  question.solution = String(value || "").split("\n");
  syncJsonFromDocument();
}

function addOption(question) {
  const options = question.options || [];
  const labels = ["A", "B", "C", "D"];
  const nextLabel =
    labels.find((label) => !options.some((option) => option.label === label)) ||
    String(options.length + 1);
  question.options = [...options, { label: nextLabel, text: "" }];
  syncJsonFromDocument();
}

function removeOption(question, optionIndex) {
  question.options = (question.options || []).filter((_, index) => index !== optionIndex);
  syncJsonFromDocument();
}

function addQuestion(section, sectionIndex) {
  const nextNumber =
    Math.max(
      0,
      ...getDocumentQuestions(wordDocument.value).map(
        (question) => Number(question.number) || 0,
      ),
    ) + 1;
  const nextIndex = section.questions.length;
  section.questions.push(createEmptyQuestion(String(nextNumber)));
  syncJsonFromDocument();
  setQuestionMode(sectionIndex, nextIndex, "edit");
}

function removeQuestion(section, questionIndex) {
  if (!window.confirm("確定要刪除這一題嗎？")) return;
  section.questions.splice(questionIndex, 1);
  questionModes.value = {};
  selectedQuestions.value = {};
  syncJsonFromDocument();
}

function createEmptyQuestion(number) {
  return {
    number,
    answer: "",
    stem: "",
    options: [],
    solution: [],
    shared_context: [],
    content_blocks: [],
    asset_ids: [],
    math_bank: {
      type: "calculation",
      difficulty: "A",
      status: "draft",
      visibility: "public",
    },
  };
}

function normalizeDocument(document) {
  return {
    title: document?.title || "",
    metadata: document?.metadata || {},
    sections: (document?.sections || []).map((section) => ({
      title: section.title || "",
      instructions: section.instructions || [],
      questions: (section.questions || []).map((question) => ({
        number: question.number || "",
        answer: question.answer || "",
        stem: question.stem || "",
        options: question.options || [],
        solution: question.solution || [],
        shared_context: question.shared_context || [],
        content_blocks: question.content_blocks || [],
        asset_ids: question.asset_ids || [],
        math_bank: {
          ...(question.math_bank || {}),
          status: "draft",
          visibility: "public",
        },
      })),
    })),
    unassigned_content: document?.unassigned_content || [],
    assets: document?.assets || [],
  };
}

function applyFirstQuestionMetadata() {
  const metadata = getDocumentQuestions(wordDocument.value)
    .map((question) => question.math_bank || {})
    .find((item) => item.grade_id || item.unit_id);
  if (!metadata) return;
  importSettings.gradeId = importSettings.gradeId || String(metadata.grade_id || "");
  importSettings.unitId = importSettings.unitId || String(metadata.unit_id || "");
}

function getDocumentQuestions(document) {
  return (document?.sections || []).flatMap((section) => section.questions || []);
}

function getSelectedImportDocument(document) {
  return {
    ...document,
    sections: (document?.sections || []).map((section, sectionIndex) => ({
      ...section,
      questions: (section.questions || []).filter((_, questionIndex) =>
        isQuestionSelected(sectionIndex, questionIndex),
      ),
    })),
  };
}

function buildMathBankPayload(document, overrides = {}) {
  return {
    format: "math_bank_staff_questions_v1",
    title: document.title || "",
    questions: getDocumentQuestions(document).map((question) => {
      const metadata = question.math_bank || {};
      return {
        grade_id: metadata.grade_id || overrides.grade_id || "",
        unit_id: metadata.unit_id || overrides.unit_id || "",
        type: overrides.type || metadata.type || inferQuestionType(question),
        difficulty: overrides.difficulty || metadata.difficulty || "A",
        prompt_md: buildQuestionPrompt(question),
        answer_md: question.answer || metadata.answer_md || "",
        solution_md: Array.isArray(question.solution)
          ? question.solution.filter((line) => String(line || "").trim()).join("\n\n")
          : String(question.solution || ""),
        status: "draft",
        visibility: "public",
        thinking: metadata.thinking || [],
        assets: metadata.assets || [],
      };
    }),
  };
}

function buildQuestionPrompt(question) {
  const stem = String(question?.stem || "").trim();
  const options = (question?.options || [])
    .filter((option) => String(option.label || option.text || "").trim())
    .map((option) => `(${option.label || ""}) ${option.text || ""}`.trim());
  return [stem, ...options].filter(Boolean).join("\n");
}

function inferQuestionType(question) {
  return (question?.options || []).some((option) => String(option?.text || "").trim())
    ? "choice"
    : "calculation";
}

function getRecordId(record) {
  return String(record?.id || record?.uuid || record?.pk || "");
}

function getUnitGradeId(unit) {
  return String(unit?.grade?.id || unit?.grade_id || unit?.grade || "");
}

function getOutputBasename(filename) {
  return String(filename || "questions").replace(/\.(?:docx|txt|md|json)$/i, "").trim() || "questions";
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
</script>
