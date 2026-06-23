<template>
  <div class="vim-editor-shell">
    <div v-if="loadError" class="vim-error">{{ loadError }}</div>
    <div v-else ref="containerRef"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const containerRef = ref(null);
const loadError = ref("");
let editor = null;
let disposed = false;

let codeMirrorLoadPromise;

function loadCodeMirrorFromCdn() {
  if (window.CodeMirror) return Promise.resolve(window.CodeMirror);
  if (codeMirrorLoadPromise) return codeMirrorLoadPromise;

  const styles = [
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/codemirror.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/theme/monokai.min.css",
  ];
  const scripts = [
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/codemirror.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/keymap/vim.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/mode/markdown/markdown.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/addon/selection/active-line.min.js",
  ];

  styles.forEach((href) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  });

  const loadScript = (src) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      if (window.CodeMirror) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

  codeMirrorLoadPromise = scripts
    .reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve())
    .then(() => {
      const CodeMirror = window.CodeMirror;
      if (CodeMirror?.Vim) {
        CodeMirror.Vim.map("jk", "<Esc>", "insert");
        CodeMirror.Vim.map("L", "$", "normal");
        CodeMirror.Vim.map("H", "0", "normal");
      }
      return CodeMirror;
    });

  return codeMirrorLoadPromise;
}

onMounted(() => {
  loadCodeMirrorFromCdn()
    .then((CodeMirror) => {
      if (disposed || !containerRef.value) return;
      editor = CodeMirror(containerRef.value, {
        value: props.modelValue,
        mode: { name: "markdown", highlightFormatting: true },
        keyMap: "vim",
        theme: "monokai",
        lineNumbers: true,
        styleActiveLine: true,
        lineWrapping: true,
        extraKeys: {
          "Ctrl-C": (cm) => {
            const selection = cm.getSelection();
            if (selection) navigator.clipboard?.writeText(selection);
          },
        },
      });
      editor.on("change", (cm) => emit("update:modelValue", cm.getValue()));
      setTimeout(() => {
        editor?.refresh();
        window.CodeMirror?.Vim?.handleKey(editor, "i");
      }, 0);
    })
    .catch(() => {
      loadError.value = "Vim editor 載入失敗，請檢查網路或 CDN。";
    });
});

watch(
  () => props.modelValue,
  (value) => {
    if (editor && editor.getValue() !== value) editor.setValue(value);
  },
);

onBeforeUnmount(() => {
  disposed = true;
  if (editor) {
    editor.getWrapperElement().remove();
    editor = null;
  }
});
</script>

<style scoped>
.vim-editor-shell {
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
}

.vim-editor-shell :deep(.CodeMirror) {
  height: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
}

.vim-error {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #fff;
  color: #8c1d18;
}
</style>
