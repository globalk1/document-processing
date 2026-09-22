<template>
  <main class="page-shell question-entry-page">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育｜教務部內部使用</div>
        <h1>{{ pageTitle }}</h1>
      </div>
      <div class="header-actions">
        <span class="status-pill">{{ pageStatus }}</span>
      </div>
    </header>

    <nav v-if="activePage !== 'pdf'" class="subject-switcher" aria-label="題庫科目">
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
    </nav>

    <KeepAlive>
      <component v-if="activePage !== 'pdf'" :is="activePage === 'entry' ? DraftQuestionEntry : QuestionBankPicker"
        :key="`${subject}-${activePage}`" :subject="subject" @copy="copyText" />
    </KeepAlive>
    <PdfEditorWorkspace v-if="activePage === 'pdf'" />
    <div v-if="copyMessage" class="copy-toast">{{ copyMessage }}</div>
  </main>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from "vue";
import DraftQuestionEntry from "./components/DraftQuestionEntry.vue";
import QuestionBankPicker from "./components/QuestionBankPicker.vue";

const PdfEditorWorkspace = defineAsyncComponent(() => import("./components/PdfEditorWorkspace.vue"));

const subjects = [["math", "數學"], ["chinese", "國文"], ["english", "英文"], ["physics", "物理"], ["chemistry", "化學"], ["biology", "生物"], ["earth_science", "地科"]];
const subject = ref("math");
const activePage = ref("entry");
const copyMessage = ref("");
let copyTimer = null;

const pageTitle = computed(() => ({
  entry: "好題入題",
  picker: "題庫挑題",
  pdf: "PDF 編輯",
})[activePage.value]);

const pageStatus = computed(() => ({
  entry: "新增草稿",
  picker: "匯出 Word",
  pdf: "瀏覽器內處理",
})[activePage.value]);

async function copyText(value) {
  const text = String(value || "");
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copyMessage.value = "已複製";
  } catch {
    copyMessage.value = "複製失敗";
  }

  if (copyTimer) window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyMessage.value = "";
  }, 1600);
}
</script>

<style scoped>
.subject-switcher { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin: 20px 0; }
.subject-switcher button { display: grid; gap: 6px; min-height: 82px; padding: 14px; border: 2px solid #dbe4ed; border-radius: 16px; background: white; color: #334155; cursor: pointer; }
.subject-switcher strong { font-size: 22px; }
.subject-switcher small { font-size: 12px; opacity: .75; }
.subject-switcher button[aria-pressed="true"] { background: #153f67; color: white; border-color: #153f67; }
.subject-switcher button:focus-visible { outline: 3px solid #e6ab4b; outline-offset: 3px; }
</style>
