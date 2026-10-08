import { onActivated, onBeforeUnmount, onDeactivated, ref, watch } from "vue";

export function useQuestionPages({ getFilters, fetchPage, onError, onLoaded, root }) {
  const questions = ref([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(false);
  const sentinel = ref(null);
  const moreError = ref(false);
  const active = ref(true);
  let nextCursor = "";
  let pageFilters = {};
  let requestVersion = 0;
  let observer;

  function disconnect() {
    observer?.disconnect();
    observer = null;
  }

  // Invalidate immediately, including while a search input is being debounced.
  watch(() => JSON.stringify(getFilters()), () => {
    requestVersion += 1;
    hasMore.value = false;
    loading.value = false;
    loadingMore.value = false;
  }, { flush: "sync" });

  async function load(reset = true) {
    if (!reset && (!active.value || loading.value || loadingMore.value || !hasMore.value)) return;
    if (reset) {
      requestVersion += 1;
      pageFilters = { ...getFilters() };
      questions.value = [];
      nextCursor = "";
      hasMore.value = false;
      loadingMore.value = false;
    }
    const version = requestVersion;
    const cursor = reset ? "" : nextCursor;
    const busy = reset ? loading : loadingMore;
    busy.value = true;
    moreError.value = false;

    try {
      const result = await fetchPage({ ...pageFilters, limit: 20, cursor });
      if (version !== requestVersion) return;
      if (!result.success) throw new Error(result.error || "題目讀取失敗。");

      const records = new Map(questions.value.map((question) => [question.id, question]));
      for (const question of result.data.results || []) records.set(question.id, question);
      questions.value = [...records.values()];
      nextCursor = result.data.next_cursor || "";
      hasMore.value = Boolean(result.data.has_more && nextCursor && nextCursor !== cursor);
      onLoaded?.(reset);
    } catch (error) {
      if (version !== requestVersion) return;
      moreError.value = !reset;
      onError(error.message || "題目讀取失敗。");
    } finally {
      if (version === requestVersion) busy.value = false;
    }
  }

  watch([sentinel, () => root?.value, active, loading, loadingMore, hasMore, moreError], () => {
    disconnect();
    if (!active.value || !sentinel.value || loading.value || loadingMore.value || !hasMore.value || moreError.value) return;
    if (root && !root.value) return;
    if (typeof IntersectionObserver === "undefined") return;
    const currentObserver = new IntersectionObserver((entries) => {
      if (observer === currentObserver && entries.some((entry) => entry.isIntersecting)) load(false);
    }, { root: root?.value || null, rootMargin: "0px" });
    observer = currentObserver;
    observer.observe(sentinel.value);
  }, { flush: "post" });

  onActivated(() => { active.value = true; });
  onDeactivated(() => {
    active.value = false;
    disconnect();
  });
  onBeforeUnmount(() => {
    requestVersion += 1;
    disconnect();
  });

  return { questions, loading, loadingMore, hasMore, sentinel, load };
}
