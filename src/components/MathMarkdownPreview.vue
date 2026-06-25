<template>
  <section class="math-markdown-preview">
    <div class="preview-toolbar">
      <span>Markdown 預覽</span>
      <small>{{ katexReady ? "KaTeX 已啟用" : "KaTeX 載入中" }}</small>
    </div>
    <div ref="previewRef" class="markdown-body" v-html="renderedHtml"></div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";

const KATEX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js";
const KATEX_STYLE_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css";

const props = defineProps({
  content: {
    type: String,
    default: "",
  },
});

const previewRef = ref(null);
const katexReady = ref(false);
let katexPromise = null;

const renderedHtml = computed(() => markdownToHtml(props.content));

onMounted(async () => {
  await loadKatex();
  await renderMath();
});

watch(renderedHtml, async () => {
  await nextTick();
  await renderMath();
});

function ensureStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadKatex() {
  if (window.katex) {
    katexReady.value = true;
    return Promise.resolve(window.katex);
  }
  if (katexPromise) return katexPromise;

  ensureStylesheet(KATEX_STYLE_URL);
  katexPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${KATEX_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        katexReady.value = true;
        resolve(window.katex);
      }, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = KATEX_SCRIPT_URL;
    script.onload = () => {
      katexReady.value = true;
      resolve(window.katex);
    };
    script.onerror = reject;
    document.body.appendChild(script);
  }).catch((error) => {
    console.error("Unable to load KaTeX", error);
    katexReady.value = false;
    return null;
  });

  return katexPromise;
}

async function renderMath() {
  const katex = await loadKatex();
  if (!katex || !previewRef.value) return;

  previewRef.value.querySelectorAll("[data-math]").forEach((node) => {
    const expression = node.getAttribute("data-math") || "";
    try {
      katex.render(expression, node, {
        throwOnError: false,
        displayMode: false,
        strict: "ignore",
      });
    } catch {
      node.textContent = expression;
    }
  });
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInline(line)}</p>`);
  }

  closeList();
  return html.join("\n");
}

function renderInline(value) {
  const escaped = escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  return escaped.replace(mathLikePattern(), (match) => {
    if (!shouldRenderAsMath(match)) return match;
    return `<span class="math-inline" data-math="${escapeAttribute(toKatexExpression(match))}"></span>`;
  });
}

function mathLikePattern() {
  return /(?:[A-Za-z][A-Za-z0-9]*|[０-９\d]+(?:\.\d+)?|[＋+\-－−×*÷/=<>≦≤≧≥^()（）√π∞]+|\s+){1,}/g;
}

function shouldRenderAsMath(value) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return false;
  if (!/[０-９\d]/.test(compact)) return false;
  if (/^[０-９\d]+(?:\.\d+)?$/.test(compact)) return true;
  return /[＋+\-－−×*÷/=<>≦≤≧≥^√]/.test(compact);
}

function toKatexExpression(value) {
  return value
    .trim()
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff10 + 48))
    .replace(/＋/g, "+")
    .replace(/[－−]/g, "-")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/≦/g, "\\le ")
    .replace(/≤/g, "\\le ")
    .replace(/≧/g, "\\ge ")
    .replace(/≥/g, "\\ge ")
    .replace(/π/g, "\\pi ")
    .replace(/∞/g, "\\infty ")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
</script>
