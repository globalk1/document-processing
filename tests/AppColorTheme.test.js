import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { flushPromises, mount } from "@vue/test-utils";
import App from "../src/App.vue";
import { THEME_STORAGE_KEY } from "../src/composables/useColorTheme";

vi.mock("../src/components/DraftQuestionEntry.vue", () => ({ default: { template: "<div>入題工作區</div>" } }));
vi.mock("../src/components/QuestionBankPicker.vue", () => ({ default: { template: "<div>挑題工作區</div>" } }));
vi.mock("../src/components/HandwritingWorkspace.vue", () => ({ __esModule: true, default: { name: "HandwritingWorkspace", template: "<div>試卷擦除工作區</div>" } }));
vi.mock("../src/components/OcrWorkspace.vue", () => ({ __esModule: true, default: { name: "OcrWorkspace", template: "<div>文字解析工作區</div>" } }));
vi.mock("../src/components/PdfEditorWorkspace.vue", () => ({ __esModule: true, default: { name: "PdfEditorWorkspace", template: "<div>PDF 工作區</div>" } }));

let wrapper;
let media;
function setup() {
  wrapper = mount(App);
  return wrapper.find(".header-actions .theme-toggle");
}
function changeSystem(matches) {
  media.matches = matches;
  media.dispatchEvent(Object.assign(new Event("change"), { matches }));
}
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", vi.fn(() => media));
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("upper-right day/night toggle", () => {
  it("uses the original my-home blue-gray theme for its main surfaces and controls", () => {
    const themeCss = readFileSync("src/styles/global.css", "utf8");
    const palette = themeCss.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)[1];
    const expectedColors = {
      page: "303338", surface: "3b3f45", "surface-soft": "4f5660",
      "surface-hover": "464c54", text: "eef1f5", muted: "aeb6c1",
      border: "555b63", strong: "4f5660", "strong-border": "cfd5de",
      "accent-bg": "4a5058", accent: "c7cdd5",
    };
    for (const [name, expected] of Object.entries(expectedColors)) {
      const hex = palette.match(new RegExp(`--theme-${name}:\\s*#([0-9a-f]{6})`))[1];
      expect(hex).toBe(expected);
    }
  });

  it("switches the whole document using accessible moon and sun icon buttons", async () => {
    const toggle = setup();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(toggle.attributes("aria-label")).toBe("切換為深夜模式");
    expect(toggle.attributes("aria-pressed")).toBe("false");
    expect(toggle.find(".theme-icon-moon").exists()).toBe(true);
    await toggle.trigger("click");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(toggle.attributes("aria-label")).toBe("切換為日間模式");
    expect(toggle.attributes("aria-pressed")).toBe("true");
    expect(toggle.find(".theme-icon-sun").exists()).toBe(true);
    await toggle.trigger("click");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("remembers a chosen theme after reopening the application", async () => {
    await setup().trigger("click");
    wrapper.unmount();
    const toggle = setup();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(toggle.attributes("aria-pressed")).toBe("true");
  });

  it("follows system preferences until the user explicitly chooses a theme", async () => {
    media.matches = true;
    const toggle = setup();
    expect(document.documentElement.dataset.theme).toBe("dark");
    changeSystem(false);
    await flushPromises();
    expect(document.documentElement.dataset.theme).toBe("light");
    await toggle.trigger("click");
    changeSystem(false);
    await flushPromises();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("uses a saved preference over the system and ignores invalid saved values", () => {
    media.matches = true;
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    setup();
    expect(document.documentElement.dataset.theme).toBe("light");
    wrapper.unmount();
    localStorage.setItem(THEME_STORAGE_KEY, "unknown");
    setup();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("still toggles if browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const toggle = setup();
    await toggle.trigger("click");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("keeps the chosen theme across feature and subject switches", async () => {
    await setup().trigger("click");
    for (const label of ["題庫挑題", "PDF 編輯", "試卷擦除", "文字解析", "好題入題"]) {
      await wrapper.findAll(".tab-bar button").find((button) => button.text().includes(label)).trigger("click");
      await flushPromises();
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(wrapper.find(".theme-toggle").attributes("aria-pressed")).toBe("true");
    }
    await wrapper.findAll(".subject-switcher button").find((button) => button.text().includes("英文")).trigger("click");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("syncs theme changes from another tab and stops listening after unmount", async () => {
    const removeListener = vi.spyOn(media, "removeEventListener");
    setup();
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }));
    await flushPromises();
    expect(document.documentElement.dataset.theme).toBe("dark");
    window.dispatchEvent(new StorageEvent("storage", { key: "other-preference", newValue: "light" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    wrapper.unmount();
    wrapper = null;
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "light" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(removeListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
