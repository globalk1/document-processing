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

    <DraftQuestionEntry v-if="activePage === 'entry'" @copy="copyText" />
    <QuestionBankPicker v-else-if="activePage === 'picker'" />
    <PdfEditorWorkspace v-else />
    <div v-if="copyMessage" class="copy-toast">{{ copyMessage }}</div>
  </main>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from "vue";
import DraftQuestionEntry from "./components/DraftQuestionEntry.vue";
import QuestionBankPicker from "./components/QuestionBankPicker.vue";

const PdfEditorWorkspace = defineAsyncComponent(() => import("./components/PdfEditorWorkspace.vue"));

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
