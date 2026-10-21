import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import App from "../src/App.vue";
import DraftQuestionEntry from "../src/components/DraftQuestionEntry.vue";
import QuestionBankPicker from "../src/components/QuestionBankPicker.vue";

const api = vi.hoisted(() => ({
  listMathBankGrades: vi.fn(), listMathBankUnits: vi.fn(), listMathBankQuestionSources: vi.fn(),
  searchStaffMathBankQuestions: vi.fn(), getStaffMathBankQuestion: vi.fn(), updateStaffMathBankQuestion: vi.fn(),
}));
vi.mock("../src/services/api", () => ({
  ...api,
  createStaffMathBankQuestion: vi.fn(), deleteStaffMathBankQuestion: vi.fn(),
  generatePublicExamFromBank: vi.fn(), uploadAssetFile: vi.fn(), renderMatplotlibPreview: vi.fn(),
  getPublicAssetUrl: (value) => value,
}));
let wrapper;
const question = { id: "q1", category: "physics", grade_id: "g1", unit_id: "u1", prompt_md: "測量速度", assets: [], status: "draft" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  api.listMathBankGrades.mockResolvedValue({ success: true, data: [{ id: "g1", name: "七年級" }] });
  api.listMathBankUnits.mockResolvedValue({ success: true, data: [{ id: "u1", name: "測量", grade_id: "g1" }] });
  api.listMathBankQuestionSources.mockResolvedValue({ success: true, data: [] });
  api.searchStaffMathBankQuestions.mockResolvedValue({ success: true, data: { results: [], has_more: false } });
  api.getStaffMathBankQuestion.mockResolvedValue({ success: true, data: question });
  api.updateStaffMathBankQuestion.mockResolvedValue({ success: true, data: question });
});
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); });

it("uses the main site's five subjects and switches to the social question bank", async () => {
  wrapper = mount(App);
  await flushPromises();
  const buttons = wrapper.findAll('.subject-switcher button');
  expect(buttons.map(b => b.find('strong').text())).toEqual(['數學', '國文', '英文', '理化科', '社會科']);
  await buttons[4].trigger('click');
  await flushPromises();
  expect(api.searchStaffMathBankQuestions).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ subject: 'social' }));
  expect(wrapper.find('select[aria-label="科目分類"]').text()).toContain('歷史');
});

for (const component of [DraftQuestionEntry, QuestionBankPicker]) {
  it(`${component.__name} sends category filters and clears them on reset`, async () => {
    wrapper = mount(component, { props: { subject: 'science' } });
    await flushPromises();
    const select = wrapper.find('select[aria-label="科目分類"]');
    await select.setValue('unassigned');
    await flushPromises();
    expect(api.searchStaffMathBankQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'unassigned' }), expect.objectContaining({ subject: 'science' }));
    await wrapper.findAll('button').find(b => b.text() === '重設').trigger('click');
    await flushPromises();
    expect(api.searchStaffMathBankQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ category: '' }), expect.anything());
  });
}

it("loads and saves a question's category, including clearing it to unassigned", async () => {
  wrapper = mount(DraftQuestionEntry, { props: { subject: 'science', initialQuestionId: 'q1' } });
  await flushPromises();
  const select = wrapper.find('select[aria-label="分類"]');
  expect(select.element.value).toBe('physics');
  await select.setValue('chemistry');
  await wrapper.find('form').trigger('submit');
  await flushPromises();
  expect(api.updateStaffMathBankQuestion).toHaveBeenCalledWith('q1', expect.objectContaining({ category: 'chemistry' }), expect.objectContaining({ subject: 'science' }));
  wrapper.unmount();
  wrapper = mount(DraftQuestionEntry, { props: { subject: 'science', initialQuestionId: 'q1' } });
  await flushPromises();
  await wrapper.find('select[aria-label="分類"]').setValue('');
  await wrapper.find('form').trigger('submit');
  await flushPromises();
  expect(api.updateStaffMathBankQuestion).toHaveBeenLastCalledWith('q1', expect.objectContaining({ category: '' }), expect.anything());
});
