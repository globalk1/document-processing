<template>
  <span ref="root" class="question-filter-select">
    <input v-bind="$attrs" ref="input" class="select-input" role="combobox" type="text"
      :value="displayValue" :placeholder="label" :aria-label="label" :disabled="disabled"
      :aria-expanded="open" :aria-controls="open ? menuId : undefined" aria-autocomplete="list"
      :aria-activedescendant="open && activeIndex >= 0 ? `${menuId}-${activeIndex}` : undefined"
      title="可輸入文字搜尋；長按選項 1 秒或 Shift＋Enter 可複選"
      @focus="openMenu" @input="search" @keydown="handleKeydown"
      @compositionstart="composing = true" @compositionend="composing = false" />
    <button type="button" class="filter-arrow" :aria-label="`展開${label}選單`" :disabled="disabled"
      @pointerdown.prevent @click="open ? closeMenu() : openMenu()">▾</button>
    <Teleport to="body">
      <div v-if="open" :id="menuId" ref="menu" class="question-filter-menu" role="listbox"
        :aria-label="label" :aria-multiselectable="multiple" :style="menuStyle">
        <div v-for="(option, index) in filteredOptions" :id="`${menuId}-${index}`" :key="option.value"
          role="option" :data-value="option.value" :aria-selected="selectedValues.includes(option.value)"
          class="question-filter-option" :class="{ active: activeIndex === index }"
          @pointerdown.prevent="startHold($event, option)" @pointerup="cancelHold" @pointerleave="cancelHold"
          @pointercancel="cancelHold" @contextmenu.prevent @click.stop="clickOption(option)">
          <span v-if="multiple && !isExclusive(option.value)" aria-hidden="true">{{ selectedValues.includes(option.value) ? '☑' : '☐' }}</span>
          <span>{{ option.label }}</span>
        </div>
        <div v-if="!filteredOptions.length" role="status" class="question-filter-empty">沒有符合的選項</div>
      </div>
    </Teleport>
  </span>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, useId, watch } from 'vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  modelValue: { type: [String, Array], default: '' },
  label: { type: String, required: true },
  options: { type: Array, default: () => [] },
  disabled: Boolean,
});
const emit = defineEmits(['update:modelValue', 'change']);
const root = ref(null), input = ref(null), menu = ref(null);
const open = ref(false), query = ref(null), activeIndex = ref(-1), composing = ref(false);
const multipleMode = ref(Array.isArray(props.modelValue)), menuStyle = ref({});
const menuId = `question-filter-${useId()}`;
let holdTimer = null, held = false;
const isExclusive = value => ['', '__none__', '__all__'].includes(value);
const selectedValues = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]);
const multiple = computed(() => multipleMode.value || Array.isArray(props.modelValue));
const filteredOptions = computed(() => props.options.filter(option => option.value !== '__none__' &&
  `${option.label} ${option.value}`.toLocaleLowerCase().includes(String(query.value || '').trim().toLocaleLowerCase())));
const displayValue = computed(() => {
  if (query.value !== null) return query.value;
  if (Array.isArray(props.modelValue)) {
    if (props.modelValue.length > 1) return `已選 ${props.modelValue.length} 項`;
    return props.options.find(option => option.value === props.modelValue[0])?.label || '';
  }
  if (!props.modelValue || props.modelValue === '__none__') return '';
  return props.options.find(option => option.value === props.modelValue)?.label || '';
});
function positionMenu() {
  if (!open.value || !root.value) return;
  const rect = root.value.getBoundingClientRect();
  menuStyle.value = { left: `${rect.left}px`, top: `${rect.bottom + 6}px`, width: `${rect.width}px`,
    maxHeight: `${Math.max(40, Math.min(280, window.innerHeight - rect.bottom - 12))}px` };
}
function cancelHold() { clearTimeout(holdTimer); holdTimer = null; }
function closeMenu() { cancelHold(); open.value = false; query.value = null; activeIndex.value = -1; }
function openMenu() { if (props.disabled) return; open.value = true; positionMenu(); }
function search(event) { query.value = event.target.value; activeIndex.value = -1; openMenu(); }
function update(value) { emit('update:modelValue', value); emit('change', value); }
function choose(option) {
  if (!option) return;
  if (!multiple.value || isExclusive(option.value)) {
    multipleMode.value = false; update(option.value); closeMenu(); return;
  }
  const current = selectedValues.value.filter(value => !isExclusive(value));
  update(current.includes(option.value) ? current.filter(value => value !== option.value) : [...current, option.value]);
}
function startHold(event, option) {
  cancelHold(); held = false;
  if ((event.button !== undefined && event.button !== 0) || isExclusive(option.value)) return;
  holdTimer = setTimeout(() => {
    held = true; multipleMode.value = true;
    update([...new Set([...selectedValues.value.filter(value => !isExclusive(value)), option.value])]);
  }, 1000);
}
function clickOption(option) { if (held) { held = false; return; } choose(option); }
function handleKeydown(event) {
  if (composing.value || event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault(); openMenu(); multipleMode.value = true;
    if (!Array.isArray(props.modelValue)) update(selectedValues.value.filter(value => !isExclusive(value)));
  } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault(); openMenu();
    const count = filteredOptions.value.length;
    if (count) activeIndex.value = (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
  } else if (event.key === 'Enter') {
    event.preventDefault(); if (!open.value) openMenu();
    else choose(filteredOptions.value[activeIndex.value >= 0 ? activeIndex.value : 0]);
  } else if (event.key === 'Escape' || event.key === 'Tab') closeMenu();
}
function dismissOutside(event) {
  if (!root.value?.contains(event.target) && !menu.value?.contains(event.target)) closeMenu();
}
function removeListeners() {
  document.removeEventListener('pointerdown', dismissOutside, true);
  document.removeEventListener('focusin', dismissOutside);
  window.removeEventListener('resize', positionMenu);
  window.removeEventListener('scroll', positionMenu, true);
}
watch(open, value => {
  removeListeners(); if (!value) return;
  document.addEventListener('pointerdown', dismissOutside, true);
  document.addEventListener('focusin', dismissOutside);
  window.addEventListener('resize', positionMenu);
  window.addEventListener('scroll', positionMenu, true);
}, { flush: 'sync' });
watch(() => props.modelValue, value => { if (!Array.isArray(value)) { multipleMode.value = false; query.value = null; } });
watch(() => props.disabled, value => { if (value) closeMenu(); });
watch([activeIndex, filteredOptions], async () => {
  if (!open.value) return;
  await nextTick(); menu.value?.querySelectorAll('[role="option"]')[activeIndex.value]?.scrollIntoView?.({ block: 'nearest' });
});
onDeactivated(closeMenu);
onBeforeUnmount(() => { cancelHold(); removeListeners(); });
</script>

<style scoped>
.question-filter-select { position: relative; display: block; width: 100%; }
.question-filter-select input { padding-right: 32px; width: 100%; }
.filter-arrow { position: absolute; right: 6px; top: 0; bottom: 0; border: 0; background: transparent; color: var(--theme-text, #202124); cursor: pointer; padding: 0 6px; }
.question-filter-menu { position: fixed; z-index: 2000; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box; padding: 4px; border: 1px solid var(--theme-border, #d5d7db); border-radius: 8px; background: var(--theme-surface, #fff); color: var(--theme-text, #202124); box-shadow: 0 8px 24px rgba(21,63,103,.16); font-size: 14px; }
.question-filter-option { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 6px 10px; border-radius: 5px; cursor: pointer; user-select: none; touch-action: pan-y; }
.question-filter-option.active, .question-filter-option:hover { background: var(--theme-surface-hover, #eef3f8); }
.question-filter-option[aria-selected="true"] { color: var(--theme-accent, #153f67); font-weight: 850; }
.question-filter-empty { padding: 10px; }
</style>
