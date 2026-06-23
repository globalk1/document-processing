<template>
  <div v-if="!value.trim()" class="empty-state">
    <strong>尚未產生詳解</strong>
    <span>可以先解析或輸入題目，再按 AI 寫詳解。</span>
  </div>

  <div v-else-if="!questions.length" class="raw-preview">
    <div class="preview-toolbar">
      <span>詳解預覽</span>
      <button class="small-button" type="button" @click="$emit('edit')">✎ 編輯</button>
    </div>
    <pre>{{ value }}</pre>
  </div>

  <section v-else class="review-shell">
    <nav class="question-nav" aria-label="詳解題號導覽">
      <button v-for="question in questions" :key="question.key" class="question-nav-button" type="button" @click="scrollToQuestion(question.key)">
        {{ question.number }}
      </button>
    </nav>

    <div class="question-list">
      <article v-for="question in questions" :id="question.key" :key="question.key" class="question-card">
        <header class="question-header">
          <button class="summary-button" type="button" @click="toggleQuestion(question.key)">
            <span>{{ openKeys.has(question.key) ? "⌄" : "›" }}</span>
            <strong>第 {{ question.number }} 題</strong>
          </button>
          <div class="answer-summary">{{ question.answer || "答案待確認" }}</div>
        </header>

        <div v-if="openKeys.has(question.key)" class="question-body">
          <section v-for="section in question.sections" :key="section.label" class="section-block">
            <h4>{{ section.label }}</h4>
            <ContentFlow :content="section.content" />
          </section>

          <div class="card-actions">
            <button class="small-button" type="button" @click="$emit('copy', question.raw)">⧉ 複製本題</button>
            <button class="small-button" type="button" @click="$emit('edit')">✎ 編輯全部</button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref, watch } from "vue";

const props = defineProps({
  value: { type: String, default: "" },
});
defineEmits(["edit", "copy"]);

const questionHeadingPattern = /^##\s*第\s*([^\s#]+)\s*題.*$/gm;
const sectionPattern = /^(題目|解題思路|詳解|檢查|答案)：\s*(.*)$/;
const fractionPattern = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;
const subscriptDigits = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
const superscriptDigits = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

const openKeys = ref(new Set());
const questions = computed(() => parseSolution(props.value));

onMounted(syncOpenKeys);
watch(questions, syncOpenKeys);

function syncOpenKeys() {
  openKeys.value = new Set(questions.value.length === 1 ? [questions.value[0].key] : []);
}

function toggleQuestion(key) {
  const next = new Set(openKeys.value);
  next.has(key) ? next.delete(key) : next.add(key);
  openKeys.value = next;
}

function scrollToQuestion(key) {
  document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function parseSolution(value) {
  const cleaned = stripCodeFence(value);
  const matches = [...cleaned.matchAll(questionHeadingPattern)];
  if (!matches.length) return [];

  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : cleaned.length;
    const raw = cleaned.slice(start, end).trim();
    const body = cleaned.slice(match.index + match[0].length, end).trim();
    const sections = parseSections(body);
    return {
      key: `solution-question-${index}-${match[1]}`,
      number: match[1],
      raw,
      sections,
      answer: extractAnswer(sections),
    };
  });
}

function stripCodeFence(value) {
  return value
    .replace(/^\s*```(?:markdown)?\s*$/gm, "")
    .replace(/^\s*```\s*$/gm, "")
    .trim();
}

function parseSections(body) {
  const sections = [];
  let current = { label: "內容", lines: [] };

  body.split("\n").forEach((line) => {
    const match = line.match(sectionPattern);
    if (match) {
      pushSection(sections, current);
      current = { label: match[1], lines: match[2] ? [match[2]] : [] };
      return;
    }
    current.lines.push(line);
  });

  pushSection(sections, current);
  return sections;
}

function pushSection(sections, section) {
  const content = section.lines.join("\n").trim();
  if (content) sections.push({ label: section.label, content });
}

function extractAnswer(sections) {
  const answer = sections.find((section) => section.label === "答案")?.content || "";
  return answer
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

const ContentFlow = defineComponent({
  name: "ContentFlow",
  props: { content: { type: String, default: "" } },
  setup(componentProps) {
    return () => h(
      "div",
      { class: "content-flow" },
      componentProps.content
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block, index) => renderBlock(block, index)),
    );
  },
});

function renderBlock(block, index) {
  if (block.startsWith("\\[") && block.endsWith("\\]")) {
    return h("div", { class: "equation-block", key: index }, renderLatex(block.replace(/^\\\[/, "").replace(/\\\]$/, "").trim()));
  }

  const lines = block.split("\n").filter((line) => line.trim());
  const allBullets = lines.every((line) => /^[-*]\s+/.test(line.trim()));
  if (allBullets) {
    return h("ul", { class: "bullet-list", key: index }, lines.map((line) => h("li", { key: line }, renderLatex(line.replace(/^[-*]\s+/, "")))));
  }

  const allSteps = lines.every((line) => /^\d+[.)]\s+/.test(line.trim()));
  if (allSteps) {
    return h("ol", { class: "step-list", key: index }, lines.map((line) => {
      const match = line.trim().match(/^(\d+)[.)]\s+(.*)$/);
      return h("li", { key: line, value: Number(match[1]) }, renderLatex(match[2]));
    }));
  }

  return h("p", { class: "paragraph", key: index }, lines.flatMap((line, lineIndex) => [
    ...renderLatex(line),
    lineIndex + 1 < lines.length ? h("br") : null,
  ]));
}

function renderLatex(text) {
  const pieces = [];
  let lastIndex = 0;
  let match;
  fractionPattern.lastIndex = 0;

  while ((match = fractionPattern.exec(text)) !== null) {
    if (match.index > lastIndex) pieces.push(normalizeMathText(text.slice(lastIndex, match.index)));
    pieces.push(h("span", { class: "fraction", key: `fraction-${match.index}` }, [
      h("span", normalizeMathText(match[1])),
      h("span", normalizeMathText(match[2])),
    ]));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) pieces.push(normalizeMathText(text.slice(lastIndex)));
  return pieces;
}

function normalizeMathText(text) {
  return text
    .replace(/\\\(|\\\)|\\\[|\\\]|\$/g, "")
    .replace(/\\qquad|\\quad/g, " ")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\Leftarrow/g, "⇐")
    .replace(/\\Leftrightarrow/g, "⇔")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\left|\\right/g, "")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\text\{([^{}]+)\}/g, "$1")
    .replace(/_\{([0-9]+)\}/g, (_, value) => toSubscript(value))
    .replace(/_([0-9]+)/g, (_, value) => toSubscript(value))
    .replace(/\^\{([0-9]+)\}/g, (_, value) => toSuperscript(value))
    .replace(/\^([0-9]+)/g, (_, value) => toSuperscript(value))
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/_\{([^{}]+)\}/g, "_$1")
    .replace(/\\,/g, " ")
    .replace(/\s{2,}/g, " ");
}

function toSubscript(value) {
  return String(value).split("").map((digit) => subscriptDigits[digit] || digit).join("");
}

function toSuperscript(value) {
  return String(value).split("").map((digit) => superscriptDigits[digit] || digit).join("");
}
</script>

<style scoped>
.review-shell,
.question-list,
.question-body,
.section-block {
  display: grid;
}

.review-shell {
  gap: 12px;
}

.question-nav {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 8px;
}

.question-nav-button {
  min-width: 36px;
  height: 34px;
  border: 1px solid #cfcfcf;
  border-radius: 8px;
  background: #fff;
  color: #1f1f1f;
  font-weight: 750;
  cursor: pointer;
}

.question-list {
  gap: 10px;
}

.question-card {
  scroll-margin-top: 18px;
  border: 1px solid #d4d4d4;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.question-header {
  display: grid;
  grid-template-columns: minmax(130px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f3f3f3;
}

.summary-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  padding: 0;
  background: transparent;
  color: #1f1f1f;
  cursor: pointer;
  text-align: left;
}

.summary-button span {
  color: #555;
  font-size: 18px;
  line-height: 1;
}

.answer-summary {
  color: #333;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.question-body {
  gap: 14px;
  padding: 14px;
}

.section-block {
  gap: 7px;
}

.section-block h4 {
  margin: 0;
  color: #171717;
  font-size: 14px;
  font-weight: 800;
}

:deep(.content-flow) {
  display: grid;
  gap: 8px;
  color: #2b2b2b;
  font-size: 14px;
  line-height: 1.75;
}

:deep(.paragraph) {
  margin: 0;
  overflow-wrap: anywhere;
}

:deep(.equation-block) {
  overflow-x: auto;
  border-left: 3px solid #242424;
  padding: 8px 10px;
  background: #f6f6f6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
}

:deep(.bullet-list),
:deep(.step-list) {
  margin: 0;
  padding-left: 22px;
}

:deep(.fraction) {
  display: inline-grid;
  grid-template-rows: auto auto;
  align-items: center;
  vertical-align: middle;
  margin: 0 3px;
  font-size: 0.92em;
  line-height: 1.05;
  text-align: center;
}

:deep(.fraction span:first-child) {
  border-bottom: 1px solid currentColor;
  padding: 0 3px 1px;
}

:deep(.fraction span:last-child) {
  padding: 1px 3px 0;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}

.small-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #c9c9c9;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  color: #333;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.empty-state {
  display: grid;
  gap: 4px;
  min-height: 180px;
  place-content: center;
  border: 1px dashed #cfcfcf;
  border-radius: 8px;
  background: #fafafa;
  color: #686868;
  text-align: center;
}

.empty-state strong {
  color: #262626;
}

.raw-preview {
  display: grid;
  gap: 8px;
  border: 1px solid #d4d4d4;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 750;
}

.raw-preview pre {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .question-header {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
