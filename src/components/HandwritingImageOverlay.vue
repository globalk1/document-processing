<template>
  <div
    ref="frame"
    data-image-overlay
    class="handwriting-image-overlay"
    :class="{ selected: selected && !disabled, disabled }"
    role="button"
    :aria-label="accessibleLabel || `覆蓋圖片：${overlay.label || '圖片'}`"
    :aria-pressed="selected"
    :aria-disabled="disabled"
    :tabindex="disabled ? -1 : 0"
    :style="rectStyle"
    @click.stop="selectOverlay"
    @keydown="handleKeyDown"
    @pointerdown="startInteraction"
    @pointermove="moveInteraction"
    @pointerup="finishInteraction($event)"
    @pointercancel="finishInteraction($event, true)"
    @lostpointercapture="finishInteraction($event, true)"
  >
    <img :src="overlay.image" alt="" :draggable="false" :style="resolvedImageStyle" />
    <template v-if="selected && !disabled">
      <span
        v-for="corner in corners"
        :key="corner"
        class="overlay-handle"
        :class="corner"
        :data-corner="corner"
        :aria-label="`縮放圖片 ${corner}`"
        aria-hidden="true"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { transformOverlay } from "../services/handwritingImageOverlays.js";

const props = defineProps({
  overlay: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  imageStyle: { type: [Function, Object], default: null },
  accessibleLabel: { type: String, default: "" },
});
const emit = defineEmits(["change", "select", "delete", "interacting"]);
const frame = ref(null);
const draft = shallowRef(null);
const corners = ["nw", "ne", "sw", "se"];
let interaction = null;

const current = computed(() => draft.value || props.overlay);
const rectStyle = computed(() => ({
  left: `${current.value.x * 100}%`,
  top: `${current.value.y * 100}%`,
  width: `${current.value.width * 100}%`,
  height: `${current.value.height * 100}%`,
}));
const resolvedImageStyle = computed(() => typeof props.imageStyle === "function"
  ? props.imageStyle(current.value)
  : props.imageStyle);

function selectOverlay() {
  if (!props.disabled) emit("select", props.overlay.id);
}

function changed(start, next) {
  return ["x", "y", "width", "height"].some((key) => next[key] !== start[key]);
}

function handleKeyDown(event) {
  if (props.disabled || interaction) return;
  if (event.key === "Enter" || event.key === " ") {
    event.stopPropagation();
    event.preventDefault();
    selectOverlay();
    return;
  }
  if (props.selected && ["Delete", "Backspace"].includes(event.key)) {
    event.stopPropagation();
    event.preventDefault();
    emit("delete", props.overlay.id);
    return;
  }
  const step = event.shiftKey ? 0.01 : 0.002;
  const delta = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[event.key];
  if (!delta) return;
  event.stopPropagation();
  event.preventDefault();
  selectOverlay();
  const next = transformOverlay(props.overlay, ...delta);
  if (changed(props.overlay, next)) emit("change", next);
}

function startInteraction(event) {
  event.stopPropagation();
  if (props.disabled || interaction || event.isPrimary === false || event.button !== 0) return;
  const root = event.currentTarget.parentElement;
  const imageRect = root?.querySelector("[data-preview-base]")?.getBoundingClientRect();
  const rect = imageRect?.width ? imageRect : root?.getBoundingClientRect();
  if (!rect?.width || !rect.height) return;
  event.preventDefault();
  selectOverlay();
  interaction = {
    start: { ...props.overlay },
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    rect,
    corner: event.target?.dataset?.corner || "move",
  };
  emit("interacting", true);
  event.currentTarget.focus({ preventScroll: true });
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function transformAtPointer(event) {
  const { start, clientX, clientY, rect, corner } = interaction;
  return transformOverlay(start,
    (event.clientX - clientX) / rect.width,
    (event.clientY - clientY) / rect.height,
    corner);
}

function moveInteraction(event) {
  if (!interaction || event.pointerId !== interaction.pointerId) return;
  event.stopPropagation();
  event.preventDefault();
  draft.value = transformAtPointer(event);
}

function releaseInteraction() {
  if (!interaction) return;
  const pointerId = interaction.pointerId;
  interaction = null;
  draft.value = null;
  if (frame.value?.hasPointerCapture?.(pointerId)) frame.value.releasePointerCapture(pointerId);
  emit("interacting", false);
}

function finishInteraction(event, cancel = false) {
  if (!interaction || event.pointerId !== interaction.pointerId) return;
  event.stopPropagation();
  const start = interaction.start;
  const next = cancel ? start : transformAtPointer(event);
  releaseInteraction();
  // Commit once at the end so a drag or corner resize is one undo action.
  if (!cancel && changed(start, next)) emit("change", next);
}

watch(() => props.disabled, (disabled) => {
  if (disabled) releaseInteraction();
});
watch(() => props.overlay.id, releaseInteraction);
onBeforeUnmount(releaseInteraction);
</script>

<style scoped>
.handwriting-image-overlay {
  position: absolute;
  touch-action: none;
  user-select: none;
  cursor: move;
  outline: none;
  outline-offset: 1px;
}
.handwriting-image-overlay.selected,
.handwriting-image-overlay:focus-visible {
  outline: 2px solid #2563eb;
}
.handwriting-image-overlay.disabled { cursor: default; pointer-events: none; }
.handwriting-image-overlay img {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.overlay-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #fff;
  border: 2px solid #2563eb;
  box-sizing: border-box;
  border-radius: 2px;
}
.overlay-handle.nw, .overlay-handle.ne { top: -6px; }
.overlay-handle.sw, .overlay-handle.se { bottom: -6px; }
.overlay-handle.nw, .overlay-handle.sw { left: -6px; }
.overlay-handle.ne, .overlay-handle.se { right: -6px; }
.overlay-handle.nw, .overlay-handle.se { cursor: nwse-resize; }
.overlay-handle.ne, .overlay-handle.sw { cursor: nesw-resize; }
</style>
