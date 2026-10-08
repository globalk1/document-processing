<template>
  <div class="question-detail-modal-backdrop question-picker-preview" role="dialog" aria-modal="true" aria-labelledby="question-preview-title" aria-describedby="question-preview-hint" @click="emit('close')">
    <section ref="panel" class="question-detail-modal-panel question-picker-preview-panel">
      <header class="question-bank-toolbar">
        <div>
          <h2 id="question-preview-title" class="section-title">題目預覽</h2>
          <p>{{ [question.grade?.name, question.unit?.name, difficulty].filter(Boolean).join(' · ') }}</p>
          <p id="question-preview-hint" class="field-hint">再點一下即可關閉</p>
        </div>
        <button ref="closeButton" class="icon-button" type="button" title="關閉預覽" aria-label="關閉預覽" @click.stop="emit('close')">×</button>
      </header>
      <div class="question-preview-grid question-picker-preview-content">
        <section v-for="role in roles" :key="role.value" :class="`${role.value}-preview`">
          <strong>{{ role.label }}</strong>
          <div class="question-preview-body" :class="{ 'solution-preview-body': role.value === 'solution' }" :tabindex="role.value === 'solution' ? 0 : undefined" :role="role.value === 'solution' ? 'region' : undefined" :aria-label="role.value === 'solution' ? '詳解預覽內文' : undefined">
            <p><MathText :content="question[`${role.value}_md`]" :fallback="assetsFor(role.value).length ? '' : `尚未輸入${role.label}`" /></p>
            <div v-if="assetsFor(role.value).length" class="picker-asset-strip">
              <QuestionAssetThumbnail v-for="(asset, index) in assetsFor(role.value)" :key="asset.id || `${role.value}-${index}`" :asset="asset" />
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import MathText from "./MathText.vue";
import QuestionAssetThumbnail from "./QuestionAssetThumbnail.vue";

const props = defineProps({ question: { type: Object, required: true }, difficulty: { type: String, default: "" } });
const emit = defineEmits(["close"]);
const closeButton = ref(null);
const panel = ref(null);
const roles = [{ value: "prompt", label: "題目" }, { value: "answer", label: "答案" }, { value: "solution", label: "詳解" }];
let previousFocus;
let previousOverflow;

function assetsFor(role) {
  return (props.question.assets || [])
    .filter((asset) => (asset.role || "prompt") === role && (asset.url || asset.storage_key || asset.source_code))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function handleKeydown(event) {
  if (event.key === "Escape" || event.key === "Enter") {
    event.preventDefault();
    emit("close");
  } else if (event.key === "Tab") {
    event.preventDefault();
    const targets = [...(panel.value?.querySelectorAll('button, [tabindex="0"]') || [])];
    const index = targets.indexOf(document.activeElement);
    const nextIndex = (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
    targets[nextIndex]?.focus({ preventScroll: true });
  }
}

onMounted(() => {
  previousFocus = document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", handleKeydown);
  closeButton.value?.focus({ preventScroll: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  document.body.style.overflow = previousOverflow;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
});
</script>
