import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { h, KeepAlive, nextTick, ref } from "vue";
import DraftQuestionEntry from "../src/components/DraftQuestionEntry.vue";
import QuestionBankPicker from "../src/components/QuestionBankPicker.vue";
import QuestionFilterSelect from "../src/components/QuestionFilterSelect.vue";
import { chooseMixedWordExport } from "../src/services/mixedWordExport";
vi.mock("../src/services/mixedWordExport", () => ({ chooseMixedWordExport: vi.fn() }));

const api = vi.hoisted(() => ({
  searchStaffMathBankQuestions: vi.fn(),
  listMathBankGrades: vi.fn(),
  listMathBankUnits: vi.fn(),
  listMathBankQuestionSources: vi.fn(),
  getStaffMathBankQuestion: vi.fn(),
  generatePublicExamFromBank: vi.fn(),
  generateWordFromBank: vi.fn(),
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

async function chooseFilter(label, value) {
  const select = wrapper.findAllComponents(QuestionFilterSelect).find(item => item.props("label") === label);
  await select.find("input").trigger("focus");
  document.querySelector(`.question-filter-menu [data-value="${value}"]`).click();
  await settle();
}

beforeEach(() => {
  vi.resetAllMocks();
  chooseMixedWordExport.mockResolvedValue("teacher");
  api.generatePublicExamFromBank.mockResolvedValue({ success: false, error: "export checked" });
  api.generateWordFromBank.mockResolvedValue({ success: false, error: "export checked" });
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

    it("starts with a field placeholder, orders difficulty choices and preserves chosen values", async () => {
      await setup();
      const select = wrapper.findAllComponents(QuestionFilterSelect).find(item => item.props("label") === "難度");
      expect(select.find("input").attributes("placeholder")).toBe("難度");
      expect(select.props("modelValue")).toBe("");
      await select.find("input").trigger("focus");
      expect([...document.querySelectorAll('.question-filter-menu [role="option"]')].map(option => option.dataset.value)).toEqual(["U", "C", "B", "A", "S", ""]);
      document.querySelector('.question-filter-menu [data-value="C"]').click();
      await settle();
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0]).toMatchObject({ difficulty: "C", cursor: "", limit: 20 });
      await chooseFilter("難度", "");
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0].difficulty).toBe("");
      await click("重設");
      expect(select.props("modelValue")).toBe("");
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0].difficulty).toBe("");
    });

    it("preserves multiple grades and units across search, pagination and grade changes", async () => {
      api.listMathBankGrades.mockResolvedValue({ success: true, data: [{ id: 'g1', name: '國一' }, { id: 'g2', name: '國二' }] });
      api.listMathBankUnits.mockResolvedValue({ success: true, data: [{ id: 'u1', name: '單元一', grade_id: 'g1' }, { id: 'u2', name: '單元二', grade_id: 'g2' }] });
      await setup();
      const field = label => wrapper.findAllComponents(QuestionFilterSelect).find(item => item.props('label') === label).find('input');
      await field('年級').trigger('focus');
      await field('年級').trigger('keydown', { key: 'Enter', shiftKey: true });
      document.querySelector('.question-filter-menu [data-value="g1"]').click(); await settle();
      document.querySelector('.question-filter-menu [data-value="g2"]').click(); await settle();
      await field('年級').trigger('keydown', { key: 'Escape' });
      await field('單元').setValue('單元');
      await field('單元').trigger('keydown', { key: 'Enter', shiftKey: true });
      document.querySelector('.question-filter-menu [data-value="u1"]').click(); await settle();
      document.querySelector('.question-filter-menu [data-value="u2"]').click(); await settle();
      expect(field('單元').element.value).toBe('單元');
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0]).toMatchObject({ grade_id: ['g1', 'g2'], unit_id: ['u1', 'u2'], cursor: '' });
      intersect(); await settle();
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0]).toMatchObject({ grade_id: ['g1', 'g2'], unit_id: ['u1', 'u2'], cursor: 'next-page' });
      await field('單元').trigger('keydown', { key: 'Escape' });
      await field('年級').trigger('focus');
      document.querySelector('.question-filter-menu [data-value="g1"]').click(); await settle();
      expect(api.searchStaffMathBankQuestions.mock.lastCall[0]).toMatchObject({ grade_id: ['g2'], unit_id: ['u2'], cursor: '' });
    });

    if (component === QuestionBankPicker) {
      it.each(["draft", "published", "archived"])("filters by %s and preserves the status on subsequent 20-question pages", async (status) => {
        await setup();
        await wrapper.find("#question-picker-status").trigger("focus");
        expect([...document.querySelectorAll(".question-filter-menu [role=option]")].map(option => option.textContent)).toEqual(["全部狀態", "草稿", "公開", "封存"]);
        await wrapper.find("#question-picker-status").trigger("keydown", { key: "Escape" });
        intersect();
        await settle();
        expect(api.searchStaffMathBankQuestions.mock.calls[1][0].cursor).toBe("next-page");
        await chooseFilter("狀態", status);
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
        await chooseFilter("狀態", "draft");
        await settle();
        await click("重設");
        expect(wrapper.find("#question-picker-status").element.value).toBe("");
        expect(api.searchStaffMathBankQuestions.mock.calls[2][0]).toMatchObject({ status: "", cursor: "", limit: 20 });
      });

      it("keeps saved questions outside the chosen status out of the filtered list", async () => {
        await setup();
        await chooseFilter("狀態", "draft");
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

it.each(["teacher", "student", "both"])("staff picker sends mixed %s through the staff-capable bank export", async (variant) => {
  chooseMixedWordExport.mockResolvedValue(variant);
  wrapper = mount(QuestionBankPicker, {
    props: { subject: "english" },
    global: { stubs: { MarkdownMathText: true, MathText: true, QuestionAssetThumbnail: true, VimMarkdownEditor: true } },
  });
  await settle();
  await click("全選目前列表");
  const mode = wrapper.findAll("select").find((select) => select.find('option[value="mixed"]').exists());
  await mode.setValue("mixed");
  await click("匯出段考卷 Word");
  expect(api.generatePublicExamFromBank).not.toHaveBeenCalled();
  expect(api.generateWordFromBank).toHaveBeenCalledTimes(1);
  const payload = api.generateWordFromBank.mock.calls[0][0];
  expect(payload).toMatchObject({ mode: "mixed", mixedVersion: variant, subject: "english", sectionMode: "selected", signal: expect.any(AbortSignal) });
  expect(Boolean(payload.apiKey)).toBe(true);
  expect(payload.apiKey === api.searchStaffMathBankQuestions.mock.calls[0][1].apiKey).toBe(true);
});

it.each(["teaching_brief", "teaching_detailed", "student"])("staff picker exports %s directly with the selected subject, order and range", async (mode) => {
  wrapper = mount(QuestionBankPicker, { props: { subject: "english" },
    global: { stubs: { MarkdownMathText: true, MathText: true, QuestionAssetThumbnail: true } } });
  await settle();
  const checks = wrapper.findAll('.question-picker-check input');
  await checks[2].setValue(true); await checks[0].setValue(true);
  const form = wrapper.find('.action-box');
  await form.findAll('select')[1].setValue(mode);
  await form.findAll('input')[2].setValue('第三冊第一章');
  expect(form.text()).toContain('草稿 2 題');
  await click('匯出段考卷 Word');
  expect(chooseMixedWordExport).not.toHaveBeenCalled();
  expect(api.generatePublicExamFromBank).not.toHaveBeenCalled();
  expect(api.generateWordFromBank.mock.lastCall[0]).toMatchObject({
    mode, subject: 'english', examRange: '第三冊第一章', questionIds: ['question-2', 'question-0'], sectionMode: 'selected',
  });
  expect(api.generateWordFromBank.mock.lastCall[0]).not.toHaveProperty('mixedVersion');
  expect(form.findAll('select')[1].element.disabled).toBe(false);
});

it('export locks version controls and cancels the request when the picker is deactivated', async () => {
  const result = deferred(); api.generateWordFromBank.mockReturnValue(result.promise);
  wrapper = mount(QuestionBankPicker, { props: { subject: 'english' },
    global: { stubs: { MarkdownMathText: true, MathText: true, QuestionAssetThumbnail: true } } });
  await settle(); await click('全選目前列表'); await click('匯出段考卷 Word');
  expect(wrapper.find('.action-box').findAll('input, select, button').every(field => field.element.disabled)).toBe(true);
  const signal = api.generateWordFromBank.mock.lastCall[0].signal;
  wrapper.unmount(); wrapper = null;
  expect(signal.aborted).toBe(true);
  result.resolve({ success: false, cancelled: true }); await settle();
});

it('closing the mixed choice makes no export request and restores the form', async () => {
  chooseMixedWordExport.mockResolvedValue(null);
  wrapper = mount(QuestionBankPicker, { props: { subject: 'english' },
    global: { stubs: { MarkdownMathText: true, MathText: true, QuestionAssetThumbnail: true } } });
  await settle(); await click('全選目前列表');
  await wrapper.find('.action-box').findAll('select')[1].setValue('mixed');
  await click('匯出段考卷 Word');
  expect(api.generateWordFromBank).not.toHaveBeenCalled();
  expect(wrapper.find('.action-box').findAll('select')[1].element.disabled).toBe(false);
});

it('describes each version and rejects over 200 selected questions before sending a request', async () => {
  api.searchStaffMathBankQuestions.mockResolvedValue(page(0, 201, null));
  wrapper = mount(QuestionBankPicker, { props: { subject: 'english' },
    global: { stubs: { MarkdownMathText: true, MathText: true, QuestionAssetThumbnail: true } } });
  await settle();
  const modes = wrapper.find('.action-box').findAll('select')[1];
  await modes.setValue('student'); expect(wrapper.find('[data-export-version-hint]').text()).toContain('只輸出題目');
  await modes.setValue('teaching_brief'); expect(wrapper.find('[data-export-version-hint]').text()).toBe('顯示簡答與來源，不含詳解。');
  await click('全選目前列表'); await click('匯出段考卷 Word');
  expect(wrapper.text()).toContain('一次最多匯出 200 題'); expect(api.generateWordFromBank).not.toHaveBeenCalled();
});
