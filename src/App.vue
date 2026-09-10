<template>
  <main class="page-shell question-entry-page">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育｜教務部內部使用</div>
        <h1>{{ activePage === "entry" ? "好題入題" : "題庫挑題" }}</h1>
      </div>
      <div class="header-actions">
        <span class="status-pill">{{ activePage === "entry" ? "新增草稿" : "匯出 Word" }}</span>
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
    </nav>

    <DraftQuestionEntry v-if="activePage === 'entry'" @copy="copyText" />
    <QuestionBankPicker v-else />
    <div v-if="copyMessage" class="copy-toast">{{ copyMessage }}</div>
  </main>
</template>

<script setup>
import { ref } from "vue";
import DraftQuestionEntry from "./components/DraftQuestionEntry.vue";
import QuestionBankPicker from "./components/QuestionBankPicker.vue";

const activePage = ref("entry");
const copyMessage = ref("");
let copyTimer = null;

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
