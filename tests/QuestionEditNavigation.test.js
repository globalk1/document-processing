import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import App from "../src/App.vue";

const api = vi.hoisted(() => ({
  listMathBankGrades: vi.fn(), listMathBankUnits: vi.fn(), listMathBankQuestionSources: vi.fn(),
  searchStaffMathBankQuestions: vi.fn(), getStaffMathBankQuestion: vi.fn(),
  createStaffMathBankQuestion: vi.fn(), updateStaffMathBankQuestion: vi.fn(), uploadAssetFile: vi.fn(),
}));
vi.mock("../src/services/api", async (importOriginal) => ({ ...await importOriginal(), ...api }));

let wrapper;
let observers;
const question = (index) => ({
  id: `question-${index}`, status: "published", grade_id: "grade-1", unit_id: "unit-1",
  prompt_md: `原本題目 ${index}`, assets: [],
});
async function settle() {
  await flushPromises();
  await vi.advanceTimersByTimeAsync(100);
  await flushPromises();
}
async function tab(label) {
  await wrapper.findAll(".tab-bar button").find((button) => button.text().includes(label)).trigger("click");
  await settle();
}
async function edit(index = 0) {
  await wrapper.find(`[data-question-id="question-${index}"]`).findAll("button").find((button) => button.text() === "編輯題目").trigger("click");
  await settle();
}
async function setup() {
  wrapper = mount(App, {
    attachTo: document.body,
    global: { stubs: { transition: false, MarkdownMathText: true, MathText: true, QuestionAssetThumbnail: true } },
  });
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  observers = [];
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback, options) { Object.assign(this, { callback, options, connected: false }); observers.push(this); }
    observe(target) { this.target = target; this.connected = true; }
    disconnect() { this.connected = false; }
  });
  vi.stubGlobal("scrollX", 0);
  vi.stubGlobal("scrollY", 0);
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:unsaved"), revokeObjectURL: vi.fn() }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  api.listMathBankGrades.mockResolvedValue({ success: true, data: [{ id: "grade-1", name: "七年級" }] });
  api.listMathBankUnits.mockResolvedValue({ success: true, data: [{ id: "unit-1", name: "數與量", grade_id: "grade-1" }] });
  api.listMathBankQuestionSources.mockResolvedValue({ success: true, data: [] });
  api.searchStaffMathBankQuestions.mockImplementation(async ({ cursor }) => ({
    success: true, data: {
      results: Array.from({ length: 20 }, (_, index) => question(index + (cursor ? 20 : 0))),
      has_more: true, next_cursor: cursor ? "page-3" : "page-2",
    },
  }));
  api.getStaffMathBankQuestion.mockImplementation(async (id) => ({ success: true, data: question(Number(id.split("-")[1])) }));
});

describe("copying question UUIDs", () => {
  const uuid = "07462edd-0123-4567-890a-bcdef0867161";

  async function setupQuestion() {
    api.searchStaffMathBankQuestions.mockResolvedValue({
      success: true, data: { results: [{ ...question(0), id: uuid }, question(1)], has_more: false },
    });
    await setup();
    await tab("題庫挑題");
  }

  it("copies the full UUID from the small icon and briefly shows confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await setupQuestion();
    const card = wrapper.find(".question-picker-card");
    expect(card.find(".question-picker-uuid code").text()).toBe("UUID: 07462edd...867161");
    expect(card.find(".question-picker-uuid code").attributes("title")).toBe(uuid);
    await card.find('[aria-label="複製題目 UUID"]').trigger("click");
    await settle();
    expect(writeText).toHaveBeenCalledWith(uuid);
    expect(card.find(".question-uuid-copy-control .question-uuid-feedback").text()).toBe("已複製");
    expect(card.find(".question-uuid-feedback").attributes("role")).toBe("status");
    expect(wrapper.find('[data-question-id="question-1"] .question-uuid-feedback').exists()).toBe(false);
    expect(wrapper.find(".copy-toast").exists()).toBe(false);
    expect(card.find('input[type="checkbox"]').element.checked).toBe(false);
    expect(wrapper.find("h1").text()).toBe("題庫挑題");
    await vi.advanceTimersByTimeAsync(1600);
    expect(card.find(".question-uuid-feedback").exists()).toBe(false);
    expect(wrapper.find(".question-picker-preview").exists()).toBe(false);
  });

  it("shows a failure alert if the clipboard rejects the copy", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    await setupQuestion();
    await wrapper.find(".question-uuid-copy").trigger("click");
    await settle();
    expect(wrapper.find(".question-uuid-feedback.error").text()).toBe("複製失敗");
    expect(wrapper.find(".copy-toast").exists()).toBe(false);
  });
});

describe("question card preview and editing", () => {
  it("opens a full preview after a single click and closes from the background", async () => {
    const record = {
      ...question(0), answer_md: "答案內容", solution_md: "詳解內容",
      assets: ["prompt", "answer", "solution"].map((role) => ({ role, storage_key: `${role}.png` })),
    };
    api.searchStaffMathBankQuestions.mockResolvedValue({ success: true, data: { results: [record], has_more: false } });
    await setup();
    await tab("題庫挑題");
    wrapper.find(".question-picker-card").element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await vi.advanceTimersByTimeAsync(349);
    expect(wrapper.find(".question-picker-preview").exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    const dialog = wrapper.find(".question-picker-preview");
    expect(dialog.attributes("role")).toBe("dialog");
    for (const [role, content] of [["prompt", "原本題目 0"], ["answer", "答案內容"], ["solution", "詳解內容"]]) {
      const section = dialog.find(`.${role}-preview`);
      expect(section.find("math-text-stub").attributes("content")).toBe(content);
      expect(section.findComponent({ name: "QuestionAssetThumbnail" }).props("asset").role).toBe(role);
    }
    expect(api.getStaffMathBankQuestion).not.toHaveBeenCalled();
    await dialog.trigger("click");
    expect(wrapper.find(".question-picker-preview").exists()).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it.each([".prompt-preview math-text-stub", ".solution-preview question-asset-thumbnail-stub", ".question-picker-preview-panel"])("closes with one more click on preview content (%s) without editing or reopening", async (selector) => {
    const record = {
      ...question(0), solution_md: "詳解內容",
      assets: [{ role: "solution", storage_key: "solution.png" }],
    };
    api.searchStaffMathBankQuestions.mockResolvedValue({ success: true, data: { results: [record], has_more: false } });
    await setup();
    await tab("題庫挑題");
    const requestsBeforePreview = api.searchStaffMathBankQuestions.mock.calls.length;
    vi.stubGlobal("scrollY", 920);
    const card = wrapper.find(".question-picker-card");
    card.element.focus();
    card.element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await vi.advanceTimersByTimeAsync(350);
    await flushPromises();
    expect(wrapper.find(".question-picker-preview").exists()).toBe(true);
    await wrapper.find(`.question-picker-preview ${selector}`).trigger("click");
    await vi.advanceTimersByTimeAsync(500);
    expect(wrapper.find(".question-picker-preview").exists()).toBe(false);
    expect(wrapper.find("h1").text()).toBe("題庫挑題");
    expect(api.getStaffMathBankQuestion).not.toHaveBeenCalled();
    expect(api.searchStaffMathBankQuestions).toHaveBeenCalledTimes(requestsBeforePreview);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(card.element);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("cancels the pending single-click preview and edits immediately on double click", async () => {
    await setup();
    await tab("題庫挑題");
    const card = wrapper.find(".question-picker-card");
    card.element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await vi.advanceTimersByTimeAsync(100);
    card.element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    await card.trigger("dblclick");
    await settle();
    expect(wrapper.find("h1").text()).toBe("好題入題");
    expect(wrapper.find(".simple-question-form h2").text()).toBe("編輯題目");
    expect(api.getStaffMathBankQuestion).toHaveBeenCalledWith("question-0", expect.any(Object));
    await vi.advanceTimersByTimeAsync(500);
    expect(wrapper.find(".question-picker-preview").exists()).toBe(false);
  });

  it("does not preview or edit when selecting a question or double-clicking the copy icon", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue() } });
    await setup();
    await tab("題庫挑題");
    const card = wrapper.find(".question-picker-card");
    await card.find(".question-picker-check").trigger("click");
    await card.find(".question-picker-check").trigger("dblclick");
    await card.find(".question-uuid-copy").trigger("click");
    await card.find(".question-uuid-copy").trigger("dblclick");
    await vi.advanceTimersByTimeAsync(500);
    expect(wrapper.find(".question-picker-preview").exists()).toBe(false);
    expect(wrapper.find("h1").text()).toBe("題庫挑題");
    expect(api.getStaffMathBankQuestion).not.toHaveBeenCalled();
  });

  it("supports keyboard preview and closes with Escape without losing the list position", async () => {
    await setup();
    await tab("題庫挑題");
    const card = wrapper.find(".question-picker-card");
    card.element.focus();
    await card.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(wrapper.find(".question-picker-preview").exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.find('[aria-label="關閉預覽"]').element);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(document.activeElement).toBe(wrapper.find(".question-picker-preview .solution-preview-body").element);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(document.activeElement).toBe(wrapper.find('[aria-label="關閉預覽"]').element);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find(".question-picker-preview").exists()).toBe(false);
    expect(document.activeElement).toBe(card.element);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("");
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("cancel editing from the question bank", () => {
  it("discards edits and pending uploads, restores the original scroll position and retains filters, selection and loaded pages", async () => {
    await setup();
    expect(wrapper.findAll("button").some((button) => button.text() === "取消")).toBe(false);
    await tab("題庫挑題");
    await wrapper.find("#question-picker-status").trigger("focus");
    document.querySelector('.question-filter-menu [data-value="published"]').click();
    await settle();
    await wrapper.find('[data-question-id="question-0"] input[type="checkbox"]').setValue(true);
    const observer = observers.findLast((item) => item.connected && !item.options.root);
    observer.callback([{ isIntersecting: true }]);
    await settle();
    expect(wrapper.findAll(".question-picker-card")).toHaveLength(40);
    const requestsBeforeEditing = api.searchStaffMathBankQuestions.mock.calls.length;
    vi.stubGlobal("scrollY", 1750);
    await edit(27);
    expect(wrapper.find(".simple-question-form h2").text()).toBe("編輯題目");
    await wrapper.find(".simple-preview-inline button").trigger("click");
    await wrapper.find(".preview-editor-textarea").setValue("未儲存的變更");
    await wrapper.find('[title="關閉左右編輯"]').trigger("click");
    await wrapper.find(".question-image-upload").trigger("drop", {
      dataTransfer: { files: [new File(["image"], "unsaved.png", { type: "image/png" })] },
    });
    vi.stubGlobal("scrollY", 350);
    await wrapper.findAll(".editor-action-row button").find((button) => button.text() === "取消").trigger("click");
    await settle();

    expect(wrapper.find("h1").text()).toBe("題庫挑題");
    expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 1750, behavior: "instant" });
    expect(wrapper.find("#question-picker-status").element.value).toBe("公開");
    expect(wrapper.findAll(".question-picker-card")).toHaveLength(40);
    expect(wrapper.find('[data-question-id="question-0"] input[type="checkbox"]').element.checked).toBe(true);
    expect(wrapper.find('[data-question-id="question-27"] math-text-stub').attributes("content")).toBe("原本題目 27");
    expect(api.searchStaffMathBankQuestions).toHaveBeenCalledTimes(requestsBeforeEditing);
    expect(api.updateStaffMathBankQuestion).not.toHaveBeenCalled();
    expect(api.createStaffMathBankQuestion).not.toHaveBeenCalled();
    expect(api.uploadAssetFile).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:unsaved");

    await edit(27);
    await wrapper.find(".simple-preview-inline button").trigger("click");
    expect(wrapper.find(".preview-editor-textarea").element.value).toBe("原本題目 27");
    expect(wrapper.findAll(".question-image-card")).toHaveLength(0);
  });

  it("allows cancelling while a question is loading and ignores its late response", async () => {
    await setup();
    await tab("題庫挑題");
    let finish;
    api.getStaffMathBankQuestion.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    vi.stubGlobal("scrollY", 920);
    await edit();
    expect(wrapper.find(".question-entry-loading-overlay").exists()).toBe(true);
    await wrapper.find(".question-entry-loading-overlay button").trigger("click");
    await settle();
    expect(wrapper.find("h1").text()).toBe("題庫挑題");
    expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 920, behavior: "instant" });
    finish({ success: true, data: { ...question(0), prompt_md: "遲到的題目" } });
    await settle();
    await tab("好題入題");
    expect(wrapper.find(".simple-question-form h2").text()).toBe("新增草稿");
    expect(wrapper.find(".question-entry-loading-overlay").exists()).toBe(false);
    expect(wrapper.find(".draft-uuid").exists()).toBe(false);
    await wrapper.find(".simple-preview-inline button").trigger("click");
    expect(wrapper.find(".preview-editor-textarea").element.value).toBe("");
    expect(api.updateStaffMathBankQuestion).not.toHaveBeenCalled();
  });
});
