<template>
  <span ref="textRef" class="math-text"></span>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, onUpdated, ref, watch } from "vue";

const KATEX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
const KATEX_AUTO_RENDER_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js";
const KATEX_STYLE_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
const KATEX_READY_PROMISE_KEY = "__huanyuKatexReadyPromise";

const props = defineProps({
  content: { type: String, default: "" },
  fallback: { type: String, default: "無題目" },
});

const textRef = ref(null);
let isActive = true;
let renderToken = 0;

onMounted(renderMath);
onUpdated(renderMath);
onBeforeUnmount(() => {
  isActive = false;
  renderToken += 1;
});
watch(() => [props.content, props.fallback], renderMath, { flush: "post" });

function ensureKatexStylesheet() {
  if (document.querySelector(`link[href="${KATEX_STYLE_URL}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = KATEX_STYLE_URL;
  document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (isScriptReady(src)) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(`script[src="${src}"]`);

    if (existingScript?.dataset.loaded === "true" || isScriptReady(src)) {
      resolve();
      return;
    }

    const script = existingScript || document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    const handleLoad = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    const handleError = () => reject(new Error(`Unable to load ${src}`));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) document.head.appendChild(script);
  });
}

function isScriptReady(src) {
  if (src === KATEX_SCRIPT_URL) return Boolean(window.katex);
  if (src === KATEX_AUTO_RENDER_SCRIPT_URL) {
    return Boolean(window.renderMathInElement);
  }
  return false;
}

function ensureKatexReady() {
  ensureKatexStylesheet();
  if (window.katex && window.renderMathInElement) {
    return Promise.resolve();
  }
  if (!window[KATEX_READY_PROMISE_KEY]) {
    window[KATEX_READY_PROMISE_KEY] = loadScript(KATEX_SCRIPT_URL)
      .then(() => loadScript(KATEX_AUTO_RENDER_SCRIPT_URL))
      .catch((error) => {
        window[KATEX_READY_PROMISE_KEY] = null;
        throw error;
      });
  }

  return window[KATEX_READY_PROMISE_KEY];
}

async function renderMath() {
  const currentToken = (renderToken += 1);
  await nextTick();
  const element = textRef.value;
  if (!element || !isActive) return;

  element.textContent = normalizeMathSource(props.content || props.fallback);
  ensureKatexReady()
    .then(() => {
      if (
        !isActive ||
        currentToken !== renderToken ||
        !element.isConnected ||
        !window.renderMathInElement
      ) {
        return;
      }

      element.textContent = normalizeMathSource(props.content || props.fallback);
      window.renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
        strict: "ignore",
      });
    })
    .catch(() => {});
}

function normalizeMathSource(value) {
  const normalized = String(value || "")
    .replace(/＄/g, "$")
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");
  return protectBareLatexSegments(normalized);
}

function protectBareLatexSegments(value) {
  const source = String(value || "");
  const segments = [];
  let index = 0;

  while (index < source.length) {
    const delimiter = findNextMathDelimiter(source, index);
    if (!delimiter) {
      segments.push(wrapBareLatex(source.slice(index)));
      break;
    }
    if (delimiter.index > index) {
      segments.push(wrapBareLatex(source.slice(index, delimiter.index)));
    }
    const closeIndex = source.indexOf(delimiter.close, delimiter.index + delimiter.open.length);
    if (closeIndex === -1) {
      segments.push(source.slice(delimiter.index));
      break;
    }
    segments.push(source.slice(delimiter.index, closeIndex + delimiter.close.length));
    index = closeIndex + delimiter.close.length;
  }

  return segments.join("");
}

function findNextMathDelimiter(source, startIndex) {
  for (let index = startIndex; index < source.length; index += 1) {
    if (source[index - 1] === "\\") continue;
    if (source.startsWith("\\[", index)) return { index, open: "\\[", close: "\\]" };
    if (source.startsWith("\\(", index)) return { index, open: "\\(", close: "\\)" };
    if (source.startsWith("$$", index)) return { index, open: "$$", close: "$$" };
    if (source[index] === "$") return { index, open: "$", close: "$" };
  }
  return null;
}

function wrapBareLatex(value) {
  const commandPattern =
    /\\(?:d?frac|tfrac)\{[^{}\n]+\}\{[^{}\n]+\}|\\sqrt(?:\[[^\]\n]+\])?\{[^{}\n]+\}|\\(?:overline|underline|vec|bar|hat)\{[^{}\n]+\}|\\(?:alpha|beta|gamma|delta|theta|lambda|mu|pi|phi|omega|Delta|Omega|angle|triangle|cdots|ldots|times|div|leq|geq|neq|infty|parallel|perp)\b/g;
  return String(value || "").replace(commandPattern, (match) => `\\(${match}\\)`);
}
</script>
