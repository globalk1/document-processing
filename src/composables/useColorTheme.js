import { computed, onBeforeUnmount, onMounted, ref } from "vue";

export const THEME_STORAGE_KEY = "huanyu-document-processing-theme";
const validTheme = (value) => value === "dark" || value === "light";

export function useColorTheme() {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  let savedTheme = null;
  try {
    savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
  let hasPreference = validTheme(savedTheme);
  const theme = ref(hasPreference ? savedTheme : media?.matches ? "dark" : "light");
  const isDark = computed(() => theme.value === "dark");

  function applyTheme(value) {
    theme.value = value;
    document.documentElement.dataset.theme = value;
  }

  function toggleTheme() {
    hasPreference = true;
    applyTheme(isDark.value ? "light" : "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme.value);
    } catch {
      // Keep the current session usable in private or restricted browsers.
    }
  }

  function handleSystemChange(event) {
    if (!hasPreference) applyTheme(event.matches ? "dark" : "light");
  }

  function handleStorageChange(event) {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    hasPreference = validTheme(event.newValue);
    applyTheme(hasPreference ? event.newValue : media?.matches ? "dark" : "light");
  }

  applyTheme(theme.value);
  onMounted(() => {
    media?.addEventListener?.("change", handleSystemChange);
    window.addEventListener("storage", handleStorageChange);
  });
  onBeforeUnmount(() => {
    media?.removeEventListener?.("change", handleSystemChange);
    window.removeEventListener("storage", handleStorageChange);
  });

  return { theme, isDark, toggleTheme };
}
