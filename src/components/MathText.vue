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

  element.textContent = props.content || props.fallback;
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

      element.textContent = props.content || props.fallback;
      window.renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: false },
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
</script>
