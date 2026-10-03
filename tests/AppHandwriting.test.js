import { afterEach, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import App from "../src/App.vue";

vi.mock("../src/components/DraftQuestionEntry.vue", () => ({ default: { template: "<div>入題工作區</div>" } }));
vi.mock("../src/components/QuestionBankPicker.vue", () => ({ default: { template: "<div>挑題工作區</div>" } }));
vi.mock("../src/components/HandwritingWorkspace.vue", () => ({ __esModule: true, default: { name: "HandwritingWorkspace", template: "<div>試卷擦除工作區</div>" } }));
vi.mock("../src/components/OcrWorkspace.vue", () => ({ __esModule: true, default: { name: "OcrWorkspace", template: "<div>免費 OCR 工作區</div>" } }));

let wrapper;
afterEach(() => wrapper?.unmount());

it("opens handwriting cleanup from the feature navigation with the matching page title", async () => {
  wrapper = mount(App);
  const entry = wrapper.findAll("nav.tab-bar button").find((button) => button.text().includes("試卷擦除"));
  expect(entry).toBeDefined();
  await entry.trigger("click");
  await flushPromises();
  expect(wrapper.find("h1").text()).toBe("試卷擦除");
  expect(entry.attributes("aria-current")).toBe("page");
  expect(wrapper.text()).toContain("試卷擦除工作區");
  expect(wrapper.find('nav[aria-label="題庫科目"]').exists()).toBe(false);
});

it("opens free text OCR without showing subject filters", async () => {
  wrapper = mount(App);
  const entry = wrapper.findAll("nav.tab-bar button").find((button) => button.text().includes("文字解析"));
  await entry.trigger("click");
  await flushPromises();
  expect(wrapper.find("h1").text()).toBe("文字解析");
  expect(wrapper.text()).toContain("免費 OCR 工作區");
  expect(wrapper.text()).toContain("4 GB 主機");
  expect(entry.attributes("aria-current")).toBe("page");
  expect(wrapper.find('nav[aria-label="題庫科目"]').exists()).toBe(false);
});
