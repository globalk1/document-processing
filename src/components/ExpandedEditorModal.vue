<template>
  <Teleport to="body">
    <div v-if="editor" class="editor-overlay" @mousedown="$emit('close')">
      <section class="expanded-editor" @mousedown.stop @mouseleave="closeOnDesktopMouseLeave">
        <header class="expanded-header">
          <h3>{{ editor.title }}</h3>
          <div class="icon-group">
            <button class="text-icon-button" :class="{ active: vimModeEnabled }" type="button" title="切換 Vim 編輯" @click="vimModeEnabled = !vimModeEnabled">
              Vim
            </button>
            <button class="icon-button" type="button" title="複製內容" @click="$emit('copy', editor.value)">⧉</button>
            <button class="icon-button" type="button" title="關閉" @click="$emit('close')">×</button>
          </div>
        </header>

        <VimMarkdownEditor v-if="vimModeEnabled" :model-value="editor.value" @update:model-value="editor.onChange" />
        <textarea v-else class="expanded-textarea" :value="editor.value" autofocus @input="editor.onChange($event.target.value)"></textarea>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from "vue";
import VimMarkdownEditor from "./VimMarkdownEditor.vue";

defineProps({
  editor: { type: Object, default: null },
});
const emit = defineEmits(["close", "copy"]);

const vimModeEnabled = ref(false);

function closeOnDesktopMouseLeave() {
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    emit("close");
  }
}
</script>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(20, 20, 20, 0.5);
}

.expanded-editor {
  width: min(1120px, 94vw);
  height: min(820px, 88vh);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  padding: 16px;
  background: #f8f8f8;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
}

.expanded-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.expanded-header h3 {
  margin: 0;
  font-size: 15px;
}

.icon-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-button,
.text-icon-button {
  height: 38px;
  border: 1px solid #c9c9c9;
  border-radius: 8px;
  background: #fff;
  color: #3d3d3d;
  font-weight: 750;
  cursor: pointer;
}

.icon-button {
  width: 38px;
  font-size: 18px;
}

.text-icon-button {
  padding: 0 12px;
  font-size: 13px;
}

.text-icon-button.active {
  border-color: #242424;
  background: #242424;
  color: #fff;
}

.expanded-textarea {
  width: 100%;
  min-height: 0;
  height: 100%;
  resize: none;
  border: 1px solid #cfcfcf;
  border-radius: 8px;
  padding: 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
  background: #fff;
}

@media (max-width: 640px) {
  .editor-overlay {
    padding: 10px;
  }

  .expanded-editor {
    width: 100%;
    height: 94vh;
    padding: 12px;
  }
}
</style>
