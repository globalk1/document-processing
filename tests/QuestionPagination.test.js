import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { h, KeepAlive, nextTick, ref } from "vue";
import DraftQuestionEntry from "../src/components/DraftQuestionEntry.vue";
import QuestionBankPicker from "../src/components/QuestionBankPicker.vue";
import QuestionDifficultySelect from "../src/components/QuestionDifficultySelect.vue";

const api = vi.hoisted(() => ({
  searchStaffMathBankQuestions: vi.fn(),
  listMathBankGrades: vi.fn(),
  listMathBankUnits: vi.fn(),
  listMathBankQuestionSources: vi.fn(),
  getStaffMathBankQuestion: vi.fn(),
}));
vi.mock("../src/services/api", async (importOriginal) => ({ ...await importOriginal(), ...api }));

let wrapper;
let observers;
function page(start, count = 20, next = "next-page") {
  return {
    success: true,
    data: {
      results: Array.from({ length: count }, (_, index) => ({
        id: `question-${start + index}`, prompt_md: `題目 ${start + index}`, assets: [], status: "draft",
      })),
      has_more: Boolean(next), next_cursor: next,
    },
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
}
const currentObserver = () => observers.findLast((observer) => observer.connected);
function intersect(observer = currentObserver()) {
  observer.callback([{ isIntersecting: true, target: observer.target }]);
}
async function settle() {
  await flushPromises();
  await nextTick();
}
async function click(label) {
  await wrapper.findAll("button").find((button) => button.text() === label).trigger("click");
  await settle();
}

beforeEach(() => {
  vi.resetAllMocks();
  observers = [];
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback, options) {
      Object.assign(this, { callback, options, connected: false });
      observers.push(this);
    }
    observe(target) { this.target = target; this.connected = true; }
    disconnect() { this.connected = false; }
  });
  api.listMathBankGrades.mockResolvedValue({ success: true, data: [] });
  api.listMathBankUnits.mockResolvedValue({ success: true, data: [] });
  api.listMathBankQuestionSources.mockResolvedValue({ success: true, data: [] });
  api.searchStaffMathBankQuestions.mockResolvedValue(page(0));
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

for (const [name, component, selector] of [
  ["草稿", DraftQuestionEntry, ".draft-list-item"],
  ["公開挑題", QuestionBankPicker, ".question-picker-card"],
]) {
  describe(`${name}分批載入`, () => {
    async function setup(props = {}) {
      wrapper = mount(component, {
        props: { subject: "english", ...props },
        global: { stubs: { MarkdownMathText: true, MathText: true, QuestionAssetThumbnail: true, VimMarkdownEditor: true } },
      });
      await settle();
    }

    it("defaults to unclassified, orders downward choices as C, B, A, S and preserves filter values", async () => {
      await setup();
      const selects = wrapper.findAllComponents(QuestionDifficultySelect);
      expect(selects).toHaveLength(component === DraftQuestionEntry ? 2 : 1);
      for (const select of selects) {
        expect(select.props("modelValue")).toBe("U");
        await select.find("button").trigger("click");
        const options = [...document.querySelectorAll('.question-difficulty-menu [role="option"]')]
          .filter((option) => option.dataset.value);
        expect(options.map((option) => option.dataset.value)).toEqual(["U", "C", "B", "A", "S"]);
        expect(options.map((option) => option.textContent.replace("✓", "").trim())).toEqual(["未分類", "C 基礎型", "B 進階型", "A 挑戰型", "S 究極型"]);
        await select.find("button").trigger("keydown", { key: "Escape" });
      }
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0].difficulty).toBe("U");
      await selects[0].find("button").trigger("click");
      document.querySelector('.question-difficulty-menu [data-value="C"]').click();
      await settle();
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0]).toMatchObject({ difficulty: "C", cursor: "", limit: 20 });
      await selects[0].find("button").trigger("click");
      document.querySelector('.question-difficulty-menu [data-value=""]').click();
      await settle();
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0].difficulty).toBe("");
      await click("重設");
      expect(selects[0].props("modelValue")).toBe("U");
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0].difficulty).toBe("U");
    });

    if (component === QuestionBankPicker) {
      it.each(["draft", "published", "archived"])("filters by %s and preserves the status on subsequent 20-question pages", async (status) => {
        await setup();
        expect(wrapper.find("#question-picker-status").findAll("option").map((option) => option.text())).toEqual(["全部狀態", "草稿", "公開", "封存"]);
        intersect();
        await settle();
        expect(api.searchStaffMathBankQuestions.mock.calls[1][0].cursor).toBe("next-page");
        await wrapper.find("#question-picker-status").setValue(status);
        await settle();
        expect(api.searchStaffMathBankQuestions.mock.calls[2][0]).toMatchObject({ status, cursor: "", limit: 20 });
        expect(wrapper.findAll(selector)).toHaveLength(20);
        intersect();
        await settle();
        expect(api.searchStaffMathBankQuestions.mock.calls[3][0]).toMatchObject({ status, cursor: "next-page", limit: 20 });
      });

      it("defaults to all statuses and restores that choice when resetting filters", async () => {
        await setup();
        expect(api.searchStaffMathBankQuestions.mock.calls[0][0].status).toBe("");
        await wrapper.find("#question-picker-status").setValue("draft");
        await settle();
        await click("重設");
        expect(wrapper.find("#question-picker-status").element.value).toBe("");
        expect(api.searchStaffMathBankQuestions.mock.calls[2][0]).toMatchObject({ status: "", cursor: "", limit: 20 });
      });

      it("keeps saved questions outside the chosen status out of the filtered list", async () => {
        await setup();
        await wrapper.find("#question-picker-status").setValue("draft");
        await settle();
        await wrapper.setProps({ focusQuestion: { id: "question-0", status: "published", prompt_md: "已公開" } });
        await settle();
        expect(wrapper.findAll(selector)).toHaveLength(19);
        expect(wrapper.find('[data-question-id="question-0"]').exists()).toBe(false);
        await wrapper.setProps({ focusQuestion: { id: "archived-question", status: "archived" } });
        await settle();
        expect(wrapper.findAll(selector)).toHaveLength(19);
      });
    }

    it("only fetches 20 initially, then loads at the correct scroll boundary and stops at the last page", async () => {
      await setup();
      expect(api.searchStaffMathBankQuestions).toHaveBeenCalledTimes(1);
      expect(api.searchStaffMathBankQuestions.mock.calls[0][0]).toMatchObject({ limit: 20, cursor: "", include_details: "true" });
      expect(api.searchStaffMathBankQuestions.mock.calls[0][1]).toMatchObject({ subject: "english" });
      if (component === DraftQuestionEntry) {
        expect(api.searchStaffMathBankQuestions.mock.calls[0][0].status).toBe("draft");
        expect(currentObserver().options.root).toBe(wrapper.find(".draft-list").element);
      } else {
        expect(currentObserver().options.root).toBeNull();
      }
      expect(currentObserver().options.rootMargin).toBe("0px");
      expect(wrapper.findAll(selector)).toHaveLength(20);
      expect(wrapper.text()).toContain("20+ 題");
      expect(wrapper.findAll(".load-more-row button")).toHaveLength(0);

      const secondPage = deferred();
      api.searchStaffMathBankQuestions.mockReturnValueOnce(secondPage.promise);
      const observer = currentObserver();
      intersect(observer);
      intersect(observer);
      expect(api.searchStaffMathBankQuestions).toHaveBeenCalledTimes(2);
      expect(api.searchStaffMathBankQuestions.mock.calls[1][0]).toMatchObject({ limit: 20, cursor: "next-page" });
      await nextTick();
      expect(wrapper.findAll(selector)).toHaveLength(20);
      secondPage.resolve(page(20, 3, null));
      await settle();
      expect(wrapper.findAll(selector)).toHaveLength(23);
      expect(wrapper.text()).toContain("23 題");
      expect(currentObserver()).toBeUndefined();
      intersect(observer);
      expect(api.searchStaffMathBankQuestions).toHaveBeenCalledTimes(2);
    });

    it("ignores a late page after changing filters, resets the cursor and deduplicates overlapping pages", async () => {
      await setup();
      const oldPage = deferred();
      api.searchStaffMathBankQuestions.mockReturnValueOnce(oldPage.promise);
      intersect();
      await wrapper.find('input[type="text"]').setValue("新的搜尋");
      api.searchStaffMathBankQuestions.mockResolvedValueOnce(page(100));
      await click("重新整理");
      expect(api.searchStaffMathBankQuestions.mock.calls[2][0]).toMatchObject({ search: "新的搜尋", cursor: "", limit: 20 });
      oldPage.resolve(page(20));
      await settle();
      expect(wrapper.findAll(selector)).toHaveLength(20);
      const preview = component === DraftQuestionEntry ? "MarkdownMathText" : "MathText";
      expect(wrapper.findAllComponents({ name: preview })[0].props("content")).toBe("題目 100");
      api.searchStaffMathBankQuestions.mockResolvedValueOnce(page(119, 2, null));
      intersect();
      await settle();
      expect(wrapper.findAll(selector)).toHaveLength(21);
      expect(wrapper.findAll(selector).at(-1).findComponent({ name: preview }).props("content")).toBe("題目 120");
    });

    it("preserves loaded questions on a failed next page and allows refreshing without an automatic request loop", async () => {
      await setup();
      api.searchStaffMathBankQuestions.mockRejectedValueOnce(new Error("網路中斷"));
      intersect();
      await settle();
      expect(wrapper.findAll(selector)).toHaveLength(20);
      expect(wrapper.text()).toContain("網路中斷");
      expect(currentObserver()).toBeUndefined();
      api.searchStaffMathBankQuestions.mockResolvedValueOnce(page(100));
      await click("重新整理");
      expect(api.searchStaffMathBankQuestions.mock.calls[2][0].cursor).toBe("");
      expect(wrapper.findAll(selector)).toHaveLength(20);
      expect(currentObserver()).toBeDefined();
    });

    it("shows the first page without load buttons when IntersectionObserver is unavailable", async () => {
      vi.stubGlobal("IntersectionObserver", undefined);
      await setup();
      expect(wrapper.findAll(selector)).toHaveLength(20);
      expect(wrapper.findAll(".load-more-row button")).toHaveLength(0);
      expect(api.searchStaffMathBankQuestions).toHaveBeenCalledTimes(1);
    });

    it("disconnects when switching tabs and reuses the loaded page on return", async () => {
      const visible = ref(true);
      wrapper = mount({
        setup: () => () => h(KeepAlive, null, {
          default: () => visible.value ? h(component, { key: "questions" }) : null,
        }),
      }, {
        global: { stubs: { MarkdownMathText: true, MathText: true, QuestionAssetThumbnail: true, VimMarkdownEditor: true } },
      });
      await settle();
      const observer = currentObserver();
      visible.value = false;
      await nextTick();
      expect(observer.connected).toBe(false);
      intersect(observer);
      expect(api.searchStaffMathBankQuestions).toHaveBeenCalledTimes(1);
      visible.value = true;
      await settle();
      expect(wrapper.findAll(selector)).toHaveLength(20);
      expect(api.searchStaffMathBankQuestions).toHaveBeenCalledTimes(1);
      expect(currentObserver()).toBeDefined();
    });
  });
}
