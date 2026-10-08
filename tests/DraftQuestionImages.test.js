import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import DraftQuestionEntry from "../src/components/DraftQuestionEntry.vue";

const api = vi.hoisted(() => ({
  listMathBankGrades: vi.fn(),
  listMathBankUnits: vi.fn(),
  listMathBankQuestionSources: vi.fn(),
  searchStaffMathBankQuestions: vi.fn(),
  createStaffMathBankQuestion: vi.fn(),
  updateStaffMathBankQuestion: vi.fn(),
  uploadAssetFile: vi.fn(),
  renderMatplotlibPreview: vi.fn(),
  getPublicAssetUrl: vi.fn(),
}));
vi.mock("../src/services/api", async (importOriginal) => ({ ...await importOriginal(), ...api }));

let wrapper;
const files = () => ["prompt.png", "answer.png", "solution.png"].map((name) => new File(["image"], name, { type: "image/png" }));
const images = (role) => wrapper.findAll(`.simple-preview-inline .${role} img`);
const positions = () => wrapper.findAll(".question-image-card select");
async function click(label) {
  await wrapper.findAll("button").find((button) => button.text() === label).trigger("click");
  await flushPromises();
}
async function setup() {
  wrapper = mount(DraftQuestionEntry, {
    global: { stubs: { MarkdownMathText: true } },
  });
  await flushPromises();
}
async function classify() {
  const selects = wrapper.findAll(".word-workflow-section select");
  await selects[0].setValue("grade-1");
  await selects[1].setValue("unit-1");
}
async function chooseImages() {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, "files", { configurable: true, value: files() });
  await input.trigger("change");
}
async function submit() {
  await wrapper.find("form").trigger("submit");
  await flushPromises();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL: vi.fn(),
  }));
  api.listMathBankGrades.mockResolvedValue({ success: true, data: [{ id: "grade-1", name: "七年級" }] });
  api.listMathBankUnits.mockResolvedValue({ success: true, data: [{ id: "unit-1", name: "數與量", grade_id: "grade-1" }] });
  api.listMathBankQuestionSources.mockResolvedValue({ success: true, data: [] });
  api.searchStaffMathBankQuestions.mockResolvedValue({ success: true, data: { results: [], has_more: false } });
  api.uploadAssetFile.mockImplementation(async ({ file }) => ({ success: true, url: `https://assets.example/${file.name}`, key: file.name }));
  api.createStaffMathBankQuestion.mockResolvedValue({ success: true, data: { id: "created", status: "draft" } });
  api.updateStaffMathBankQuestion.mockResolvedValue({ success: true, data: { id: "existing", status: "draft" } });
  api.renderMatplotlibPreview.mockResolvedValue({ success: true, image: "data:image/png;base64,python" });
  api.getPublicAssetUrl.mockImplementation((key) => `https://assets.example/${key}`);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

describe("draft image positions", () => {
  it("keeps complete solution text and images inside a separate scrollable preview body", async () => {
    await setup();
    await classify();
    await chooseImages();
    await positions()[2].setValue("solution");
    await click("編輯");
    const solution = Array.from({ length: 50 }, (_, index) => `詳解第 ${index + 1} 步`).join("\n");
    await wrapper.find(".solution-modal-textarea").setValue(solution);
    for (const selector of [".simple-preview-inline .solution", ".preview-editor-output .solution-preview"]) {
      const section = wrapper.find(selector);
      const body = section.find(".solution-preview-body");
      expect(body.attributes("role")).toBe("region");
      expect(body.attributes("tabindex")).toBe("0");
      expect(body.find("strong").exists()).toBe(false);
      expect(body.findComponent({ name: "MarkdownMathText" }).props("content")).toBe(solution);
      expect(body.find("img").attributes("src")).toBe("blob:solution.png");
    }
  });

  it("previews each uploaded image in its chosen section and sends all three roles to the backend", async () => {
    await setup();
    await classify();
    await chooseImages();
    expect(images("prompt")).toHaveLength(3);
    expect(positions()[0].findAll("option").map((option) => option.text())).toEqual(["題目", "答案", "詳解"]);
    await positions()[1].setValue("answer");
    await positions()[2].setValue("solution");
    for (const role of ["prompt", "answer", "solution"]) expect(images(role)).toHaveLength(1);
    expect(images("solution")[0].attributes("src")).toBe("blob:solution.png");

    await click("編輯");
    expect(wrapper.find(".preview-editor-output .solution-preview img").attributes("src")).toBe("blob:solution.png");
    expect(wrapper.findAll(".preview-editor-output .prompt-preview img")).toHaveLength(1);
    expect(wrapper.findAll(".preview-editor-output .answer-preview img")).toHaveLength(1);
    await submit();
    const payload = api.createStaffMathBankQuestion.mock.calls[0][0];
    expect(payload.assets.map((asset) => asset.role)).toEqual(["prompt", "answer", "solution"]);
    expect(payload.assets[2]).toMatchObject({ url: "https://assets.example/solution.png", storage_key: "solution.png" });
    expect(payload.assets.map((asset) => asset.sort_order)).toEqual([0, 1, 2]);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it("preserves existing answer and solution assets when editing and saving a draft", async () => {
    api.searchStaffMathBankQuestions.mockResolvedValueOnce({
      success: true, data: { has_more: false, results: [{
        id: "existing", grade_id: "grade-1", unit_id: "unit-1", prompt_md: "題目文字", status: "draft",
        assets: ["prompt", "answer", "solution"].map((role) => ({ role, storage_key: `${role}.png`, sort_order: 0 })),
      }] },
    });
    await setup();
    await wrapper.find(".draft-list-item").trigger("click");
    expect(positions().map((position) => position.element.value)).toEqual(["prompt", "answer", "solution"]);
    for (const role of ["prompt", "answer", "solution"]) expect(images(role)).toHaveLength(1);
    await positions()[0].setValue("solution");
    expect(images("prompt")).toHaveLength(0);
    expect(images("solution")).toHaveLength(2);
    await submit();
    const [id, payload] = api.updateStaffMathBankQuestion.mock.calls[0];
    expect(id).toBe("existing");
    expect(payload.assets.map((asset) => asset.role)).toEqual(["solution", "answer", "solution"]);
    expect(payload.assets).toHaveLength(3);
    expect(api.uploadAssetFile).not.toHaveBeenCalled();
  });

  it("supports the same positions for Python images without persisting their generated preview", async () => {
    await setup();
    await classify();
    await click("編輯");
    await wrapper.find(".preview-editor-textarea").setValue("題目文字");
    await wrapper.find("#draft-figure-code").setValue("plt.plot([1, 2])");
    await click("加入程式碼圖片");
    await positions()[0].setValue("solution");
    expect(images("prompt")).toHaveLength(0);
    expect(images("solution")).toHaveLength(1);
    expect(wrapper.findAll(".preview-editor-output .solution-preview img")).toHaveLength(1);
    await submit();
    expect(api.createStaffMathBankQuestion.mock.calls[0][0].assets).toEqual([
      expect.objectContaining({ role: "solution", source_language: "python", source_code: "plt.plot([1, 2])", url: "" }),
    ]);
  });

  it("requires prompt text or a prompt image even when solution images are present", async () => {
    await setup();
    await classify();
    const file = files()[0];
    await wrapper.find(".question-image-upload").trigger("drop", { dataTransfer: { files: [file] } });
    await positions()[0].setValue("solution");
    await submit();
    expect(wrapper.text()).toContain("請輸入題目內容或上傳題目圖片。");
    expect(api.uploadAssetFile).not.toHaveBeenCalled();
    expect(api.createStaffMathBankQuestion).not.toHaveBeenCalled();
    await positions()[0].setValue("prompt");
    await submit();
    expect(api.createStaffMathBankQuestion).toHaveBeenCalledTimes(1);
  });
});
