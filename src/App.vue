<template>
  <main class="page-shell">
    <header class="app-header">
      <div class="title-group">
        <div class="eyebrow">寰宇教育-教務部內部使用</div>
        <h1>PDF / 圖片轉文字</h1>
      </div>
      <div class="header-actions">
        <span class="status-pill" :class="status">{{
          selectedMode.title
        }}</span>
      </div>
    </header>

    <section class="workspace">
      <aside class="control-panel">
        <h2 class="section-title">模式</h2>
        <div class="mode-grid">
          <button
            v-for="item in modes"
            :key="item.value"
            class="mode-button"
            :class="{ active: mode === item.value }"
            type="button"
            @click="mode = item.value"
          >
            <span class="mode-icon">{{
              item.value === "fast" ? "PDF" : "AI"
            }}</span>
            <span>{{ item.title }}</span>
            <small>{{ item.description }}</small>
          </button>
        </div>

        <h2 class="section-title">檔案</h2>
        <div
          class="drop-zone"
          :class="{ over: dragOver }"
          @click="fileInput?.click()"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="handleDrop"
        >
          <div class="file-icon">▣</div>
          <strong>{{ file ? file.name : "選擇或拖拉 PDF / 圖片" }}</strong>
          <span>{{
            file ? `${Math.ceil(file.size / 1024)} KB` : "PDF、JPG、PNG、WEBP"
          }}</span>
          <input
            ref="fileInput"
            hidden
            type="file"
            accept="application/pdf,image/*"
            @change="handleFileChange"
          />
        </div>

        <button
          class="primary-button full"
          :disabled="status === 'loading'"
          type="button"
          @click="handleExtract"
        >
          {{ status === "loading" ? "解析中" : "開始解析" }}
        </button>

        <p v-if="message" class="message" :class="status">{{ message }}</p>
        <div v-if="diagnostics" class="diagnostics">
          <strong>後端解析診斷</strong>
          <span>頁數：{{ diagnostics.page_count ?? 0 }}</span>
          <span v-for="page in diagnostics.pages" :key="page.page"
            >Page {{ page.page }}: {{ page.char_count }} chars</span
          >
        </div>
      </aside>

      <section class="output-panel">
        <div class="panel-header">
          <h2 class="section-title">解析文字</h2>
          <div class="icon-group">
            <button
              class="icon-button"
              title="放大解析文字"
              type="button"
              @click="text.trim() && openEditor('text')"
            >
              ⤢
            </button>
            <button
              class="icon-button"
              title="複製解析文字"
              type="button"
              @click="copyText(text)"
            >
              ⧉
            </button>
          </div>
        </div>
        <div
          class="hover-editor-trigger"
          @mouseenter="text.trim() && openEditor('text')"
        >
          <textarea
            v-model="text"
            class="textarea"
            placeholder="解析後的文字會出現在這裡。"
          ></textarea>
        </div>

        <div class="draft-actions">
          <div class="draft-button-group">
            <button
              class="primary-inline-button"
              :disabled="aiStatus === 'loading'"
              type="button"
              @click="handleBuildSolution"
            >
              {{ aiStatus === "loading" ? "生成中" : "AI 寫詳解" }}
            </button>
            <button
              class="secondary-button"
              type="button"
              @click="solutionDraft = ''"
            >
              清空詳解
            </button>
          </div>
          <div class="icon-group">
            <button
              class="icon-button"
              title="編輯詳解內容"
              type="button"
              @click="solutionDraft.trim() && openEditor('solution')"
            >
              ⤢
            </button>
            <button
              class="icon-button"
              title="複製全部詳解"
              type="button"
              @click="copyText(solutionDraft)"
            >
              ⧉
            </button>
          </div>
        </div>

        <SolutionReview
          :value="solutionDraft"
          @edit="solutionDraft.trim() && openEditor('solution')"
          @copy="copyText"
        />
      </section>
    </section>

    <ExpandedEditorModal
      :editor="editorConfig"
      @close="expandedEditor = null"
      @copy="copyText"
    />
    <div v-if="copyMessage" class="copy-toast">{{ copyMessage }}</div>
  </main>
</template>

<script setup>
import { computed, ref } from "vue";
import ExpandedEditorModal from "./components/ExpandedEditorModal.vue";
import SolutionReview from "./components/SolutionReview.vue";
import { extractPdfText, processAiText } from "./services/api";

const modes = [
  {
    value: "fast",
    title: "快速文字解析",
    description: "僅讀取有文字層的 PDF，不使用 OCR。",
  },
  {
    value: "accurate",
    title: "OpenAI 精準解析",
    description: "用 OCR 處理掃描 PDF、圖片與數學講義。",
  },
];

const fileInput = ref(null);
const file = ref(null);
const mode = ref("fast");
const text = ref("");
const solutionDraft = ref("");
const status = ref("idle");
const aiStatus = ref("idle");
const message = ref("");
const diagnostics = ref(null);
const dragOver = ref(false);
const expandedEditor = ref(null);
const copyMessage = ref("");

const selectedMode = computed(
  () => modes.find((item) => item.value === mode.value) || modes[0],
);
const editorConfig = computed(() => {
  if (expandedEditor.value === "text") {
    return {
      title: "解析文字",
      value: text.value,
      onChange: (value) => {
        text.value = value;
      },
    };
  }
  if (expandedEditor.value === "solution") {
    return {
      title: "詳解內容",
      value: solutionDraft.value,
      onChange: (value) => {
        solutionDraft.value = value;
      },
    };
  }
  return null;
});

function handleFile(selectedFile) {
  if (!selectedFile) return;
  file.value = selectedFile;
  text.value = "";
  solutionDraft.value = "";
  message.value = "";
  diagnostics.value = null;
  status.value = "idle";
}

function handleFileChange(event) {
  handleFile(event.target.files?.[0]);
}

function handleDrop(event) {
  dragOver.value = false;
  handleFile(event.dataTransfer.files?.[0]);
}

async function handleExtract() {
  if (!file.value) {
    status.value = "error";
    message.value = "請先選擇 PDF 或圖片檔案。";
    return;
  }

  status.value = "loading";
  message.value = "";
  diagnostics.value = null;

  const result = await extractPdfText({ file: file.value, mode: mode.value });
  if (result.success && result.text?.trim()) {
    text.value = result.text || "";
    status.value = "success";
    message.value = "解析完成。";
    return;
  }

  status.value = "error";
  diagnostics.value = result.diagnostics || null;
  message.value =
    result.error || "沒有抽到文字。這份檔案可能需要 OCR / AI 精準模式。";
}

async function handleBuildSolution() {
  if (!text.value.trim()) {
    aiStatus.value = "error";
    status.value = "error";
    message.value = "請先輸入或解析題目文字，再產生詳解。";
    return;
  }

  aiStatus.value = "loading";
  message.value = "正在產生詳解...";

  const result = await processAiText({ text: text.value.trim() });
  if (result.success && result.text?.trim()) {
    solutionDraft.value = result.text || "";
    aiStatus.value = "success";
    status.value = "success";
    message.value = "詳解生成完成。";
    return;
  }

  aiStatus.value = "error";
  status.value = "error";
  message.value = result.error || "詳解生成失敗，請稍後再試。";
  if (result.status === 401 || result.status === 403) {
    window.alert("AI 詳解後端尚未開通。");
  }
}

function openEditor(kind) {
  expandedEditor.value = kind;
}

async function copyText(value) {
  if (!value) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    showCopyMessage("已複製");
  } catch {
    showCopyMessage("複製失敗");
  }
}

function showCopyMessage(value) {
  copyMessage.value = value;
  window.setTimeout(() => {
    copyMessage.value = "";
  }, 1400);
}
</script>
