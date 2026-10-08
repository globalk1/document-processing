<template>
  <span class="question-difficulty-select">
    <button
      ref="trigger"
      class="select-input question-difficulty-trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-label="`${label}：${selectedLabel}`"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :aria-activedescendant="open ? `${menuId}-${activeIndex}` : undefined"
      :disabled="disabled"
      @click.stop="toggleMenu"
      @keydown.stop="handleKeydown"
    >
      <span>{{ selectedLabel }}</span>
      <svg class="question-difficulty-arrow" :class="{ open }" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
        <path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        :id="menuId"
        ref="menu"
        class="question-difficulty-menu"
        role="listbox"
        :aria-label="label"
        :style="menuStyle"
      >
        <div
          v-for="(option, index) in options"
          :id="`${menuId}-${index}`"
          :key="option.value"
          class="question-difficulty-option"
          :class="{ active: activeIndex === index, selected: option.value === modelValue }"
          role="option"
          :aria-selected="option.value === modelValue"
          :data-value="option.value"
          @pointerdown.prevent
          @click.stop="choose(option.value)"
        >
          <span>{{ option.label }}</span>
          <span v-if="option.value === modelValue" aria-hidden="true">✓</span>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, useId, watch } from "vue";
import { QUESTION_DIFFICULTIES } from "../constants/questionDifficulties";

const props = defineProps({
  modelValue: { type: String, default: "U" },
  includeAll: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  label: { type: String, default: "難度" },
});
const emit = defineEmits(["update:modelValue", "change"]);
const trigger = ref(null);
const menu = ref(null);
const open = ref(false);
const activeIndex = ref(0);
const menuStyle = ref({});
const menuId = `question-difficulty-${useId()}`;
const options = computed(() => props.includeAll
  ? [...QUESTION_DIFFICULTIES, { value: "", label: "全部難度" }]
  : QUESTION_DIFFICULTIES);
const selectedLabel = computed(() => options.value.find((option) => option.value === props.modelValue)?.label || props.modelValue || "未分類");

function positionMenu() {
  if (!open.value || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  menuStyle.value = {
    left: `${rect.left}px`,
    top: `${rect.bottom + 6}px`,
    width: `${rect.width}px`,
    maxHeight: `${Math.max(40, Math.min(280, window.innerHeight - rect.bottom - 12))}px`,
  };
}

function closeMenu() {
  open.value = false;
}

function openMenu() {
  if (props.disabled) return;
  activeIndex.value = Math.max(0, options.value.findIndex((option) => option.value === props.modelValue));
  open.value = true;
  positionMenu();
}

function toggleMenu() {
  if (open.value) closeMenu();
  else openMenu();
}

function choose(value) {
  closeMenu();
  if (value !== props.modelValue) {
    emit("update:modelValue", value);
    emit("change", value);
  }
  trigger.value?.focus({ preventScroll: true });
}

function handleKeydown(event) {
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const wasOpen = open.value;
    if (!wasOpen) openMenu();
    if (event.key === "Home") activeIndex.value = 0;
    else if (event.key === "End") activeIndex.value = options.value.length - 1;
    else if (wasOpen) activeIndex.value = (activeIndex.value + (event.key === "ArrowDown" ? 1 : -1) + options.value.length) % options.value.length;
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (open.value) choose(options.value[activeIndex.value].value);
    else openMenu();
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
  } else if (event.key === "Tab") {
    closeMenu();
  } else if (open.value && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
    const index = options.value.findIndex((option) => option.value === event.key.toUpperCase());
    if (index >= 0) {
      event.preventDefault();
      activeIndex.value = index;
    }
  }
}

function dismissOutside(event) {
  if (!trigger.value?.contains(event.target) && !menu.value?.contains(event.target)) closeMenu();
}

function removeListeners() {
  document.removeEventListener("pointerdown", dismissOutside, true);
  document.removeEventListener("focusin", dismissOutside);
  window.removeEventListener("resize", positionMenu);
  window.removeEventListener("scroll", positionMenu, true);
}

watch(open, (isOpen) => {
  removeListeners();
  if (!isOpen) return;
  document.addEventListener("pointerdown", dismissOutside, true);
  document.addEventListener("focusin", dismissOutside);
  window.addEventListener("resize", positionMenu);
  window.addEventListener("scroll", positionMenu, true);
}, { flush: "sync" });

watch([open, activeIndex], async () => {
  if (!open.value) return;
  await nextTick();
  const option = menu.value?.children[activeIndex.value];
  if (!option) return;
  if (option.offsetTop < menu.value.scrollTop) menu.value.scrollTop = option.offsetTop;
  else if (option.offsetTop + option.offsetHeight > menu.value.scrollTop + menu.value.clientHeight) {
    menu.value.scrollTop = option.offsetTop + option.offsetHeight - menu.value.clientHeight;
  }
});
watch(() => props.disabled, (disabled) => { if (disabled) closeMenu(); });
onDeactivated(closeMenu);
onBeforeUnmount(removeListeners);
</script>

<style scoped>
.question-difficulty-select {
  display: block;
  width: 100%;
}
.question-difficulty-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.question-difficulty-trigger:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.question-difficulty-arrow {
  flex-shrink: 0;
  transition: transform .15s;
}
.question-difficulty-arrow.open {
  transform: rotate(180deg);
}
.question-difficulty-menu {
  position: fixed;
  z-index: 2000;
  overflow-y: auto;
  overscroll-behavior: contain;
  box-sizing: border-box;
  padding: 4px;
  border: 1px solid var(--theme-border, #d5d7db);
  border-radius: 8px;
  background: var(--theme-surface, #fff);
  color: var(--theme-text, #202124);
  box-shadow: 0 8px 24px rgba(21, 63, 103, .16);
  font-size: 14px;
}
.question-difficulty-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
}
.question-difficulty-option.active,
.question-difficulty-option:hover {
  background: var(--theme-surface-hover, #eef3f8);
}
.question-difficulty-option.selected {
  color: var(--theme-accent, #153f67);
  font-weight: 850;
}
</style>
