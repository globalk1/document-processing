<template>
  <div ref="root" class="markdown-math-text" v-html="renderedHtml"></div>
</template>

<script setup>
import MarkdownIt from "markdown-it";
import { nextTick, onBeforeUnmount, onMounted, onUpdated, ref, watch } from "vue";

const props = defineProps({
  content: { type: String, default: "" },
  fallback: { type: String, default: "" },
});

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: true });
const root = ref(null);
const renderedHtml = ref("");
const KATEX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
const KATEX_AUTO_RENDER_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js";
const KATEX_STYLE_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
let active = true;
let renderToken = 0;

function splitMath(source) {
  const segments = [];
  let cursor = 0;
  while (cursor < source.length) {
    const match = source.slice(cursor).match(/(\$\$|\\\[|\\\(|\$)/);
    if (!match) {
      segments.push({ type: "text", value: source.slice(cursor) });
      break;
    }
    const start = cursor + match.index;
    if (start > cursor) segments.push({ type: "text", value: source.slice(cursor, start) });
    const open = match[0];
    const close = open === "$$" ? "$$" : open === "\\[" ? "\\]" : open === "\\(" ? "\\)" : "\$";
    const end = source.indexOf(close, start + open.length);
    if (end < 0) {
      segments.push({ type: "text", value: source.slice(start) });
      break;
    }
    segments.push({ type: "math", value: source.slice(start, end + close.length), display: open === "$$" || open === "\\[" });
    cursor = end + close.length;
  }
  return segments;
}

function renderMarkdown(source) {
  const formulas = new Map();
  let prefix = "HUANYUMATH";
  while (source.includes(prefix)) prefix += "X";
  const protectedSource = splitMath(source).map((segment) => {
    if (segment.type === "text") return segment.value;
    const marker = `${prefix}${formulas.size}END`;
    formulas.set(marker, segment.value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
    return marker;
  }).join("");
  let html = markdown.render(protectedSource);
  formulas.forEach((formula, marker) => {
    html = html.split(marker).join(formula);
  });
  return html;
}

function ensureStyles() {
  if (document.querySelector(`link[href="${KATEX_STYLE_URL}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = KATEX_STYLE_URL;
  document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ((src === KATEX_SCRIPT_URL && window.katex) || (src === KATEX_AUTO_RENDER_SCRIPT_URL && window.renderMathInElement)) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    const script = existing || Object.assign(document.createElement("script"), { src, async: true, crossOrigin: "anonymous" });
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

async function renderMath() {
  const token = ++renderToken;
  renderedHtml.value = renderMarkdown(String(props.content || props.fallback || ""));
  await nextTick();
  if (!root.value || !active || token !== renderToken) return;
  ensureStyles();
  try {
    await loadScript(KATEX_SCRIPT_URL);
    await loadScript(KATEX_AUTO_RENDER_SCRIPT_URL);
    if (active && token === renderToken && window.renderMathInElement) {
      window.renderMathInElement(root.value, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
        strict: "ignore",
      });
    }
  } catch {
    // Keep the Markdown preview visible even when KaTeX cannot load.
  }
}

onMounted(renderMath);
onUpdated(renderMath);
watch(() => [props.content, props.fallback], renderMath, { flush: "post" });
onBeforeUnmount(() => {
  active = false;
  renderToken += 1;
});
</script>

<style scoped>
.markdown-math-text {
  overflow-wrap: anywhere;
}

.markdown-math-text :deep(p) {
  margin: 0 0 0.6em;
}

.markdown-math-text :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-math-text :deep(ul),
.markdown-math-text :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.6em;
}

.markdown-math-text :deep(pre) {
  white-space: pre-wrap;
}

.markdown-math-text :deep(img) {
  max-width: 100%;
}
</style>
