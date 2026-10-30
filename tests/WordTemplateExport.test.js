import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import WordTemplateWorkspace from "../src/components/WordTemplateWorkspace.vue";
import { chooseMixedWordExport } from "../src/services/mixedWordExport";
const api = vi.hoisted(() => ({ fetchWordTemplates: vi.fn(), parseWordDocument: vi.fn(), generateWordDocument: vi.fn(),
  listMathBankGrades: vi.fn(), listMathBankUnits: vi.fn() }));
vi.mock("../src/services/api", async (original) => ({ ...await original(), ...api }));
vi.mock("../src/services/mixedWordExport", () => ({ chooseMixedWordExport: vi.fn() }));
let wrapper;
beforeEach(() => {
  vi.resetAllMocks();
  api.fetchWordTemplates.mockResolvedValue({ success: true, templates: [{ id: "exam_paper", name: "段考卷" }], defaultTemplateId: "exam_paper" });
  api.listMathBankGrades.mockResolvedValue({ success: true, data: [] });
  api.listMathBankUnits.mockResolvedValue({ success: true, data: [] });
  api.generateWordDocument.mockResolvedValue({ success: false, error: "export checked" });
});
afterEach(() => wrapper?.unmount());

async function prepare(mode) {
  api.parseWordDocument.mockResolvedValue({ success: true, document: { title: "測試", metadata: { mode },
    sections: [{ title: "題目", questions: [{ number: "1", stem: "題幹", answer: "答案", solution: ["詳解"] }] }], assets: [] } });
  wrapper = mount(WordTemplateWorkspace, { global: { stubs: { MarkdownMathText: true, VimMarkdownEditor: true } } });
  await flushPromises();
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, "files", { value: [new File(["docx"], "測試.docx")] });
  await input.trigger("change");
  await wrapper.findAll("button").find((button) => button.text() === "解析題目").trigger("click");
  await flushPromises();
}

it.each(["teacher", "student", "both"])("parsed-document mixed export forwards %s through the existing function", async (variant) => {
  chooseMixedWordExport.mockResolvedValue(variant);
  await prepare("mixed");
  await wrapper.findAll("button").find((button) => button.text().includes("下載 Word")).trigger("click");
  await flushPromises();
  expect(api.generateWordDocument).toHaveBeenCalledTimes(1);
  expect(api.generateWordDocument.mock.calls[0][0]).toMatchObject({ document: { metadata: { mode: "mixed" } }, mixedVersion: variant });
});

it("brief export remains direct and closing the mixed choice never exports", async () => {
  await prepare("teaching_brief");
  await wrapper.findAll("button").find((button) => button.text().includes("下載 Word")).trigger("click");
  await flushPromises();
  expect(chooseMixedWordExport).not.toHaveBeenCalled();
  expect(api.generateWordDocument.mock.calls[0][0]).not.toHaveProperty("mixedVersion");
  wrapper.unmount();
  api.generateWordDocument.mockClear();
  chooseMixedWordExport.mockResolvedValue(null);
  await prepare("mixed");
  await wrapper.findAll("button").find((button) => button.text().includes("下載 Word")).trigger("click");
  await flushPromises();
  expect(api.generateWordDocument).not.toHaveBeenCalled();
});
