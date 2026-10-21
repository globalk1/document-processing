<template>
  <label v-if="options" class="question-category-field">
    <span class="field-label">{{ label }}</span>
    <select class="select-input" :aria-label="label" :value="modelValue" @change="update($event.target.value)">
      <option value="">{{ filter ? '全部分類' : '未分類' }}</option>
      <option v-if="filter" value="unassigned">未分類</option>
      <option v-for="[id, name] in options" :key="id" :value="id">{{ name }}</option>
    </select>
  </label>
</template>

<script setup>
import { computed } from "vue";
import { SUBJECT_CATEGORIES } from "../constants/subjects";
const props = defineProps({
  subject: { type: String, required: true },
  modelValue: { type: String, default: "" },
  filter: { type: Boolean, default: false },
  label: { type: String, default: "分類" },
});
const emit = defineEmits(["update:modelValue", "change"]);
const options = computed(() => SUBJECT_CATEGORIES[props.subject]);
function update(value) {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>
