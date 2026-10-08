<template>
  <main class="page-shell question-entry-page">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育｜教務部內部使用</div>
        <h1>{{ pageTitle }}</h1>
      </div>
      <div class="header-actions">
        <span class="status-pill">{{ pageStatus }}</span>
        <button class="theme-toggle" type="button" :aria-pressed="isDark" :aria-label="isDark ? '切換為日間模式' : '切換為深夜模式'" :title="isDark ? '切換為日間模式' : '切換為深夜模式'" @click="toggleTheme">
          <svg v-if="isDark" class="theme-icon-sun" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
          <svg v-else class="theme-icon-moon" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z" />
          </svg>
        </button>
      </div>
    </header>

    <nav v-if="['entry', 'picker'].includes(activePage)" class="subject-switcher" aria-label="題庫科目">
      <button v-for="[id, label] in subjects" :key="id" type="button"
        :aria-pressed="subject === id" @click="subject = id">
        <strong>{{ label }}</strong><small>{{ label }}題庫</small>
      </button>
    </nav>

    <nav class="tab-bar" aria-label="功能切換">
      <button
        class="tab-button"
        :class="{ active: activePage === 'entry' }"
        type="button"
        :aria-current="activePage === 'entry' ? 'page' : undefined"
        @click="activePage = 'entry'"
      >
        <span class="tab-icon">題</span>
        <span>好題入題</span>
      </button>
      <button
        class="tab-button"
        :class="{ active: activePage === 'picker' }"
        type="button"
        :aria-current="activePage === 'picker' ? 'page' : undefined"
        @click="activePage = 'picker'"
      >
        <span class="tab-icon">選</span>
        <span>題庫挑題</span>
      </button>
      <button
        class="tab-button"
        :class="{ active: activePage === 'pdf' }"
        type="button"
        :aria-current="activePage === 'pdf' ? 'page' : undefined"
        @click="activePage = 'pdf'"
      >
        <span class="tab-icon">PDF</span>
        <span>PDF 編輯</span>
      </button>
      <button class="tab-button" :class="{ active: activePage === 'handwriting' }"
        type="button" :aria-current="activePage === 'handwriting' ? 'page' : undefined"
        @click="activePage = 'handwriting'">
        <span class="tab-icon">擦</span>
        <span>試卷擦除</span>
      </button>
      <button class="tab-button" :class="{ active: activePage === 'ocr' }"
        type="button" :aria-current="activePage === 'ocr' ? 'page' : undefined" @click="activePage = 'ocr'">
        <span class="tab-icon">文</span><span>文字解析</span>
      </button>
    </nav>

    <Transition name="question-page" mode="out-in" @after-enter="restoreQuestionPickerPosition">
      <KeepAlive>
        <component v-if="['entry', 'picker'].includes(activePage)" :is="activePage === 'entry' ? DraftQuestionEntry : QuestionBankPicker"
          :key="`${subject}-${activePage}`" :subject="subject" :initial-question-id="questionEditorInitialQuestionId"
          :focus-question="questionPickerFocusQuestion" @copy="copyText" @edit-question="openQuestionEditor"
          @saved="handleQuestionSaved" @cancel="cancelQuestionEditing" />
        <HandwritingWorkspace v-else-if="activePage === 'handwriting'" />
        <OcrWorkspace v-else-if="activePage === 'ocr'" />
      </KeepAlive>
    </Transition>
    <PdfEditorWorkspace v-if="activePage === 'pdf'" />
    <div v-if="copyMessage" class="copy-toast" role="status" aria-live="polite">{{ copyMessage }}</div>
  </main>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from "vue";
import DraftQuestionEntry from "./components/DraftQuestionEntry.vue";
import QuestionBankPicker from "./components/QuestionBankPicker.vue";
import { useColorTheme } from "./composables/useColorTheme";

const { isDark, toggleTheme } = useColorTheme();

const PdfEditorWorkspace = defineAsyncComponent(() => import("./components/PdfEditorWorkspace.vue"));
const HandwritingWorkspace = defineAsyncComponent(() => import("./components/HandwritingWorkspace.vue"));
const OcrWorkspace = defineAsyncComponent(() => import("./components/OcrWorkspace.vue"));

const subjects = [["math", "數學"], ["chinese", "國文"], ["english", "英文"], ["physics", "物理"], ["chemistry", "化學"], ["biology", "生物"], ["earth_science", "地科"]];
const subject = ref("math");
const activePage = ref("entry");
const questionEditorInitialQuestionId = ref("");
const questionPickerFocusQuestion = ref(null);
const copyMessage = ref("");
let copyTimer = null;
let questionPickerReturnPosition = null;
let pendingQuestionPickerPosition = null;

onBeforeUnmount(() => {
  if (copyTimer) window.clearTimeout(copyTimer);
});

const pageTitle = computed(() => ({
  entry: "好題入題",
  picker: "題庫挑題",
  pdf: "PDF 編輯",
  handwriting: "試卷擦除",
  ocr: "文字解析",
})[activePage.value]);

const pageStatus = computed(() => ({
  entry: "新增草稿",
  picker: "匯出 Word",
  pdf: "瀏覽器內處理",
  handwriting: "清除筆跡・匯出 PDF",
  ocr: "免費 OCR・4 GB 主機",
})[activePage.value]);

async function copyText(value, label = "") {
  const text = String(value || "");
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copyMessage.value = label ? `${label} 已複製` : "已複製";
  } catch {
    copyMessage.value = label ? `${label} 複製失敗` : "複製失敗";
  }

  if (copyTimer) window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyMessage.value = "";
  }, 1600);
}

function openQuestionEditor(questionId) {
  questionPickerReturnPosition = { subject: subject.value, left: window.scrollX, top: window.scrollY };
  pendingQuestionPickerPosition = null;
  questionPickerFocusQuestion.value = null;
  questionEditorInitialQuestionId.value = String(questionId || "");
  activePage.value = "entry";
}

function cancelQuestionEditing() {
  pendingQuestionPickerPosition = questionPickerReturnPosition;
  if (questionPickerReturnPosition) subject.value = questionPickerReturnPosition.subject;
  questionEditorInitialQuestionId.value = "";
  questionPickerFocusQuestion.value = null;
  activePage.value = "picker";
}

function restoreQuestionPickerPosition() {
  if (activePage.value !== "picker" || !pendingQuestionPickerPosition) return;
  const { left, top } = pendingQuestionPickerPosition;
  window.scrollTo({ left, top, behavior: "instant" });
  pendingQuestionPickerPosition = null;
  questionPickerReturnPosition = null;
}

function handleQuestionSaved(question) {
  questionPickerReturnPosition = null;
  pendingQuestionPickerPosition = null;
  questionEditorInitialQuestionId.value = "";
  questionPickerFocusQuestion.value = question || null;
  activePage.value = "picker";
}
</script>

<style scoped>
.subject-switcher { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin: 20px 0; }
.subject-switcher button { display: grid; gap: 6px; min-height: 82px; padding: 14px; border: 2px solid var(--theme-border, #dbe4ed); border-radius: 16px; background: var(--theme-surface, white); color: var(--theme-muted, #334155); cursor: pointer; }
.subject-switcher strong { font-size: 22px; }
.subject-switcher small { font-size: 12px; opacity: .75; }
.subject-switcher button[aria-pressed="true"] { background: var(--theme-strong, #153f67); color: white; border-color: var(--theme-accent, #153f67); }
.subject-switcher button:focus-visible { outline: 3px solid var(--theme-warning-border, #e6ab4b); outline-offset: 3px; }
</style>
