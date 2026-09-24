<template>
  <figure ref="container" class="picker-asset-thumbnail">
    <img
      v-if="imageUrl && !imageFailed"
      :src="imageUrl"
      :alt="asset.alt_text || '題目圖片'"
      loading="lazy"
      @error="handleImageError"
    />
    <div v-else class="picker-asset-placeholder" :class="{ error: imageFailed || renderError }">
      {{ renderError || (imageFailed ? '圖片載入失敗。' : isCodeAsset ? '正在向後端產生圖片...' : '圖片沒有可用網址。') }}
    </div>
    <figcaption v-if="asset.alt_text">{{ asset.alt_text }}</figcaption>
  </figure>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getPublicAssetUrl, renderMatplotlibPreview } from "../services/api";

const props = defineProps({ asset: { type: Object, required: true } });
const container = ref(null);
const visible = ref(false);
const renderedImage = ref("");
const renderError = ref("");
const imageFailed = ref(false);
const failedDirectUrls = ref([]);
let observer = null;
let requestToken = 0;

const code = computed(() => String(props.asset.source_code || "").trim());
const directUrl = computed(() => {
  const candidates = [
    String(props.asset.url || "").trim(),
    props.asset.storage_key ? getPublicAssetUrl(props.asset.storage_key) : "",
  ];
  return candidates.find((candidate) => candidate && !failedDirectUrls.value.includes(candidate)) || "";
});
const isCodeAsset = computed(() => Boolean(code.value && !directUrl.value));
const imageUrl = computed(() => directUrl.value || renderedImage.value);

function handleImageError() {
  if (directUrl.value) {
    failedDirectUrls.value = [...failedDirectUrls.value, directUrl.value];
  } else {
    imageFailed.value = true;
  }
}

onMounted(() => {
  if (typeof IntersectionObserver === "undefined") {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      visible.value = true;
      observer?.disconnect();
    }
  }, { rootMargin: "200px" });
  observer.observe(container.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  requestToken += 1;
});

watch([visible, code, directUrl], async () => {
  requestToken += 1;
  const token = requestToken;
  renderedImage.value = "";
  renderError.value = "";
  imageFailed.value = false;
  if (!visible.value || !isCodeAsset.value) return;

  const result = await renderMatplotlibPreview(code.value);
  if (token !== requestToken) return;
  if (result.success) renderedImage.value = result.image;
  else renderError.value = result.error || "圖片產生失敗。";
}, { immediate: true });
</script>
