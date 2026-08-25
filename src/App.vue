<template>
  <main class="page-shell question-entry-page">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育｜教務部內部使用</div>
        <h1>好題入題</h1>
      </div>
      <div class="header-actions">
        <span class="status-pill">新增草稿</span>
      </div>
    </header>

    <nav class="tab-bar" aria-label="功能切換">
      <button class="tab-button active" type="button" aria-current="page">
        <span class="tab-icon">題</span>
        <span>好題入題</span>
      </button>
    </nav>

    <DraftQuestionEntry @copy="copyText" />
    <div v-if="copyMessage" class="copy-toast">{{ copyMessage }}</div>
  </main>
</template>

<script setup>
import { ref } from "vue";
import DraftQuestionEntry from "./components/DraftQuestionEntry.vue";

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
