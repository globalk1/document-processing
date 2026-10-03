import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import HandwritingWorkspace from "../src/components/HandwritingWorkspace.vue";

const api = vi.hoisted(() => ({
  previewHandwriting: vi.fn(),
  removeHandwriting: vi.fn(),
  repairHandwritingImage: vi.fn(),
  getStoredAuthToken: vi.fn(() => ""),
  getStoredAuthUser: vi.fn(() => null),
  loginDocumentProcessing: vi.fn(),
  logoutDocumentProcessing: vi.fn(),
}));
vi.mock("../src/services/api", () => api);
const imageOperations = vi.hoisted(() => ({ readOverlayFile: vi.fn(), cropRepairImage: vi.fn() }));
vi.mock("../src/services/handwritingImageOverlays.js", async (importOriginal) => ({
  ...await importOriginal(),
  ...imageOperations,
}));
const patchImage = "data:image/png;base64,patch";

const page = (number = 1) => ({
  page: number,
  width: 500,
  height: 700,
  processing_width: 1000,
  processing_height: 1400,
  manual_padding: 0,
  image: `original-${number}.png`,
  cleaned_image: `cleaned-${number}.png`,
  mask_overlay: `mask-${number}.png`,
  mask_ratio: 0.01,
});
const file = (name = "exam.pdf") => new File(["pdf"], name, { type: "application/pdf" });
const mounted = [];

function button(label, root = document.body) {
  const found = [...root.querySelectorAll("button")].find((element) =>
    element.textContent.trim() === label || element.getAttribute("aria-label") === label || element.title === label,
  );
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}
async function click(label, root = document.body) {
  button(label, root).click();
  await nextTick();
  await flushPromises();
}
async function settlePreview() {
  await nextTick();
  await vi.advanceTimersByTimeAsync(750);
  await flushPromises();
  await nextTick();
}
function mountWorkspace() {
  const wrapper = mount(HandwritingWorkspace, { attachTo: document.body });
  mounted.push(wrapper);
  return wrapper;
}
async function selectFile(wrapper, selected = file()) {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, "files", { configurable: true, value: [selected] });
  await input.trigger("change");
  await settlePreview();
}
function canvas(root = document.body, number = 1) {
  const found = root.querySelector(`[role="group"][aria-label="第 ${number} 頁手動調整"]`);
  if (!found) throw new Error(`Page ${number} canvas not found`);
  return found;
}
function bounds(element, rect = { left: 0, top: 0, width: 500, height: 700 }) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect);
  const image = element.querySelector("[data-preview-base]");
  if (image) vi.spyOn(image, "getBoundingClientRect").mockReturnValue(rect);
}
async function draw(element, start = [50, 70], end = [150, 140]) {
  for (const [type, point] of [["pointerdown", start], ["pointerup", end]]) {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: point[0], clientY: point[1] }));
    await nextTick();
  }
}
async function pointer(element, type, x, y) {
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));
  await nextTick();
}
async function pasteImage() {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { files: [new File(["png"], "patch.png", { type: "image/png" })] } });
  document.body.dispatchEvent(event);
  await flushPromises();
  await nextTick();
}
async function exportResult() {
  await click("確認結果");
  expect(button("匯出 PDF").disabled).toBe(false);
  await click("匯出 PDF");
  return api.removeHandwriting.mock.calls.at(-1)[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  api.getStoredAuthToken.mockReturnValue("");
  api.getStoredAuthUser.mockReturnValue(null);
  api.previewHandwriting.mockResolvedValue({ success: true, pages: [page(1)] });
  api.removeHandwriting.mockResolvedValue({ success: false, error: "測試匯出結束" });
  api.repairHandwritingImage.mockResolvedValue({ success: false, error: "測試修復結束" });
  imageOperations.readOverlayFile.mockReset().mockResolvedValue({ image: patchImage, width: 200, height: 100 });
  imageOperations.cropRepairImage.mockReset().mockResolvedValue(new Blob(["crop"], { type: "image/png" }));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:cleaned"), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("handwriting cleanup workflow", () => {
  it("shows upload and cleanup controls without an account or stored token", async () => {
    api.getStoredAuthToken.mockReturnValue("");
    api.getStoredAuthUser.mockReturnValue(null);
    const wrapper = mountWorkspace();
    expect(wrapper.find('input[aria-label="選擇試卷"]').exists()).toBe(true);
    await selectFile(wrapper);
    expect(button("AI 清除").disabled).toBe(false);
    expect(button("框選清除").disabled).toBe(false);
    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(false);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/帳號|密碼|登入|登出/);
    expect(api.loginDocumentProcessing).not.toHaveBeenCalled();
    expect(api.getStoredAuthToken).not.toHaveBeenCalled();
  });

  it("loads originals before explicit AI cleanup and requires the completed result to be confirmed", async () => {
    let finish;
    api.previewHandwriting.mockImplementation((options) => {
      if (options.colorMode === "manual_only") return Promise.resolve({ success: true, pages: [page(1), page(2)] });
      options.onProgress?.(1, 2, [page(1)]);
      return new Promise((resolve) => { finish = resolve; });
    });
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    expect(api.previewHandwriting.mock.calls[0][0]).toMatchObject({ colorMode: "manual_only", strength: 2 });
    expect(button("確認結果").disabled).toBe(true);
    expect(button("匯出 PDF").disabled).toBe(true);
    await click("AI 清除");
    await settlePreview();
    expect(api.previewHandwriting.mock.calls[1][0].colorMode).toBe("exam_auto");
    expect(button("框選清除").disabled).toBe(true);
    expect(button("確認結果").disabled).toBe(true);
    expect(document.body.textContent).toContain("1/2");
    finish({ success: true, pages: [page(1), page(2)] });
    await flushPromises();
    expect(document.querySelector('img[alt="第 1 頁預覽"]').getAttribute("src")).toBe("cleaned-1.png");
    expect(button("匯出 PDF").disabled).toBe(true);
    await click("確認結果");
    expect(button("匯出 PDF").disabled).toBe(false);
  });

  it("applies erase and exact restore operations locally, supports undoing clear-all, and exports ordered regions", async () => {
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    const target = canvas();
    bounds(target);
    await click("框選清除");
    await draw(target);
    await click("清除");
    await click("框選恢復");
    await draw(target, [75, 90], [100, 110]);
    await click("恢復原圖");
    await click("清除全部框選");
    await click("上一步");
    await settlePreview();
    expect(api.previewHandwriting).toHaveBeenCalledTimes(1);
    const exported = await exportResult();
    expect(exported.colorMode).toBe("manual_only");
    expect(exported.manualRegions).toHaveLength(2);
    expect(exported.manualRegions[0]).toMatchObject({ page: 1, x: 0.1, y: 0.1 });
    expect(exported.manualRegions[0].width).toBeCloseTo(0.2);
    expect(exported.manualRegions[1]).toMatchObject({ page: 1, action: "restore", x: 0.15 });
    expect(exported.manualRegions[1].width).toBeCloseTo(0.05);
  });

  it("keeps drafts when switching tools, undoes the newest draft, and restores confirmation after cancellation", async () => {
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    await click("AI 清除");
    await settlePreview();
    const target = canvas();
    bounds(target);
    await click("框選清除");
    await draw(target);
    await click("框選恢復");
    await draw(target);
    await click("框選清除");
    await draw(target, [200, 300], [250, 350]);
    await click("上一步");
    expect(document.body.textContent).toContain("待清除 1");
    expect(document.body.textContent).toContain("待恢復 1");
    expect(button("確認結果").disabled).toBe(true);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    expect(button("確認結果").disabled).toBe(false);
    expect(api.previewHandwriting).toHaveBeenCalledTimes(2);
  });

  it("preserves narrow reverse selections using the zoomed image bounds", async () => {
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    const target = canvas();
    bounds(target, { left: -50, top: 100, width: 750, height: 1050 });
    await click("框選清除");
    await draw(target, [26.5, 310], [25, 205]);
    await click("清除");
    const exported = await exportResult();
    expect(exported.manualRegions).toHaveLength(1);
    expect(exported.manualRegions[0].x).toBeCloseTo(0.1);
    expect(exported.manualRegions[0].y).toBeCloseTo(0.1);
    expect(exported.manualRegions[0].width).toBeCloseTo(0.002);
    expect(exported.manualRegions[0].height).toBeCloseTo(0.1);
  });

  it("waits for explicit AI cleanup after changing strength and invalidates prior confirmation", async () => {
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    await click("AI 清除");
    await settlePreview();
    await click("確認結果");
    const strength = wrapper.find('input[type="range"]');
    await strength.setValue("4");
    await settlePreview();
    expect(api.previewHandwriting).toHaveBeenCalledTimes(2);
    expect(button("確認結果").disabled).toBe(true);
    expect(button("匯出 PDF").disabled).toBe(true);
    expect(document.body.textContent).toContain("強度 4 尚未套用");
    await click("AI 清除");
    await settlePreview();
    expect(api.previewHandwriting.mock.calls[2][0].strength).toBe(4);
  });

  it("aborts old previews and ignores late results when the source changes", async () => {
    const requests = [];
    api.previewHandwriting.mockImplementation((options) => new Promise((resolve) => requests.push({ resolve, signal: options.signal })));
    const wrapper = mountWorkspace();
    await selectFile(wrapper, file("first.pdf"));
    await selectFile(wrapper, file("second.pdf"));
    expect(requests[0].signal.aborted).toBe(true);
    requests[1].resolve({ success: true, pages: [page(2)] });
    await flushPromises();
    requests[0].resolve({ success: true, pages: [page(99)] });
    await flushPromises();
    expect(document.body.textContent).toContain("第 2 頁");
    expect(document.body.textContent).not.toContain("第 99 頁");
  });

  it("cancels processing and retries without accepting the cancelled response", async () => {
    const requests = [];
    api.previewHandwriting.mockImplementation((options) => new Promise((resolve) => requests.push({ resolve, signal: options.signal })));
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    await click("取消處理");
    expect(requests[0].signal.aborted).toBe(true);
    requests[0].resolve({ success: true, pages: [page(99)] });
    await flushPromises();
    expect(document.body.textContent).not.toContain("第 99 頁");
    await click("重試預覽");
    await settlePreview();
    requests[1].resolve({ success: true, pages: [page(1)] });
    await flushPromises();
    expect(button("框選清除").disabled).toBe(false);
  });

  it("keeps failed AI cleanup unconfirmed and resets a new file to original mode", async () => {
    api.previewHandwriting.mockImplementation((options) => Promise.resolve(options.colorMode === "manual_only"
      ? { success: true, pages: [page(1)] }
      : { success: false, error: "測試中斷" }));
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    await click("AI 清除");
    await settlePreview();
    expect(document.body.textContent).toContain("測試中斷");
    expect(button("確認結果").disabled).toBe(true);
    expect(button("匯出 PDF").disabled).toBe(true);
    await selectFile(wrapper, file("another.pdf"));
    expect(api.previewHandwriting.mock.calls.at(-1)[0].colorMode).toBe("manual_only");
    expect(document.querySelector('img[alt="第 1 頁預覽"]').getAttribute("src")).toBe("original-1.png");
  });

  it("does not download an export that completed after cancellation", async () => {
    let finish;
    api.removeHandwriting.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    await click("AI 清除");
    await settlePreview();
    await click("確認結果");
    await click("匯出 PDF");
    const signal = api.removeHandwriting.mock.calls[0][0].signal;
    await click("取消處理");
    expect(signal.aborted).toBe(true);
    finish({ success: true, blob: new Blob(["pdf"]), filename: "cleaned.pdf" });
    await flushPromises();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("已取消匯出");
  });

  it("shares modal edits and undo, preserves drafts on close, restores focus, and closes on file changes", async () => {
    api.previewHandwriting.mockResolvedValue({ success: true, pages: [page(1), page(2)] });
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    const trigger = button("放大編輯第 1 頁");
    trigger.focus();
    await click("放大編輯第 1 頁");
    let dialog = document.querySelector('[role="dialog"][aria-label="第 1 頁放大編輯"]');
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('img[alt="第 2 頁預覽"]')).toBeNull();
    const target = canvas(dialog);
    bounds(target);
    await click("框選清除", dialog);
    await draw(target);
    await click("清除", dialog);
    expect(dialog.querySelector('[aria-label="已手動清除的區域"]')).not.toBeNull();
    await click("上一步", dialog);
    expect(dialog.querySelector('[aria-label="已手動清除的區域"]')).toBeNull();
    await draw(target);
    await click("清除", dialog);
    await draw(target, [200, 280], [250, 350]);
    await click("關閉放大編輯", dialog);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toContain("待清除 1");
    expect(document.activeElement).toBe(trigger);
    await click("放大編輯第 1 頁");
    dialog = document.querySelector('[role="dialog"]');
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toContain("待清除 1");
    await click("放大編輯第 1 頁");
    await selectFile(wrapper, file("another.pdf"));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[aria-label="已手動清除的區域"]')).toBeNull();
    expect(api.previewHandwriting).toHaveBeenCalledTimes(2);
  });

  it("pastes onto the selected page, moves and resizes overlays, undoes edits, and exports image geometry", async () => {
    api.previewHandwriting.mockResolvedValue({ success: true, pages: [page(1), page(2)] });
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    await wrapper.find('select[aria-label="覆蓋圖片頁碼"]').setValue("2");
    await pasteImage();
    const target = canvas(document.body, 2);
    bounds(target);
    let overlay = target.querySelector('[data-image-overlay]');
    expect(overlay).not.toBeNull();
    expect(overlay.style.left).toBe("30%");
    expect(overlay.style.width).toBe("40%");
    await pointer(overlay, "pointerdown", 200, 350);
    await pointer(overlay, "pointerup", 250, 420);
    expect(overlay.style.left).toBe("40%");
    overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await nextTick();
    expect(overlay.style.left).toBe("30%");
    overlay.click();
    await nextTick();
    await pointer(overlay.querySelector('[data-corner="se"]'), "pointerdown", 350, 400);
    await pointer(overlay, "pointerup", 400, 435);
    expect(overlay.style.width).toBe("50%");
    const exported = await exportResult();
    expect(exported.imageOverlays).toHaveLength(1);
    expect(exported.imageOverlays[0]).toMatchObject({ page: 2, x: 0.3, width: 0.5, image: patchImage });
    expect(api.previewHandwriting).toHaveBeenCalledTimes(1);
    overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await nextTick();
    expect(target.querySelector('[data-image-overlay]')).toBeNull();
    await click("上一步");
    expect(target.querySelector('[data-image-overlay]')).not.toBeNull();
  });

  it("cancels overlay dragging without committing and keeps confirmation available", async () => {
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    await pasteImage();
    bounds(canvas());
    const overlay = document.querySelector('[data-image-overlay]');
    const before = overlay.getAttribute("style");
    await pointer(overlay, "pointerdown", 200, 350);
    await pointer(overlay, "pointermove", 300, 450);
    expect(overlay.getAttribute("style")).not.toBe(before);
    expect(button("確認結果").disabled).toBe(true);
    expect(button("上一步").disabled).toBe(true);
    const draft = overlay.getAttribute("style");
    canvas().dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await nextTick();
    expect(document.querySelector('[data-image-overlay]')).toBe(overlay);
    expect(overlay.getAttribute("style")).toBe(draft);
    await pointer(overlay, "pointercancel", 300, 450);
    expect(overlay.getAttribute("style")).toBe(before);
    expect(button("確認結果").disabled).toBe(false);
    expect(button("上一步").disabled).toBe(false);
  });

  it("repairs only the selected original crop and inserts the returned image at that position", async () => {
    api.repairHandwritingImage.mockResolvedValue({ success: true, image: patchImage });
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    bounds(canvas());
    await click("框選修復");
    await draw(canvas());
    const instructions = wrapper.find('textarea[aria-label="修復需求"]');
    await instructions.setValue("補回線條");
    const repairButton = [...document.querySelectorAll("button")].find((element) => element.textContent.startsWith("修復並覆蓋"));
    repairButton.click();
    await flushPromises();
    expect(imageOperations.cropRepairImage.mock.calls[0][0]).toBe("original-1.png");
    expect(imageOperations.cropRepairImage.mock.calls[0][1]).toMatchObject({ page: 1, x: 0.1, y: 0.1 });
    expect(api.repairHandwritingImage.mock.calls[0][0]).toMatchObject({ instructions: "補回線條" });
    const overlay = document.querySelector('[data-image-overlay][aria-label="覆蓋圖片：AI 修復圖片"]');
    expect(overlay).not.toBeNull();
    expect(overlay.style.left).toBe("10%");
    expect(overlay.style.top).toBe("10%");
    expect(overlay.style.width).toBe("20%");
    await click("上一步");
    expect(document.querySelector('[data-image-overlay]')).toBeNull();
  });

  it("preserves failed repair selections for retry and rejects late replies after a file change", async () => {
    let finish;
    api.repairHandwritingImage.mockResolvedValueOnce({ success: false, error: "額度不足" })
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    bounds(canvas());
    await click("框選修復");
    await draw(canvas());
    let repairButton = [...document.querySelectorAll("button")].find((element) => element.textContent.startsWith("修復並覆蓋"));
    repairButton.click();
    await flushPromises();
    expect(document.body.textContent).toContain("額度不足");
    expect(document.querySelector('[aria-label="待修復區域"]')).not.toBeNull();
    repairButton.click();
    await flushPromises();
    const signal = api.repairHandwritingImage.mock.calls[1][0].signal;
    await selectFile(wrapper, file("another.pdf"));
    expect(signal.aborted).toBe(true);
    finish({ success: true, image: patchImage });
    await flushPromises();
    expect(document.querySelector('[data-image-overlay]')).toBeNull();
    expect(document.querySelector('[aria-label="待修復區域"]')).toBeNull();
  });

  it("does not let late image decoding add an overlay to a newly selected document", async () => {
    let finish;
    imageOperations.readOverlayFile.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const wrapper = mountWorkspace();
    await selectFile(wrapper);
    await pasteImage();
    await selectFile(wrapper, file("another.pdf"));
    finish({ image: patchImage, width: 100, height: 100 });
    await flushPromises();
    expect(document.querySelector('[data-image-overlay]')).toBeNull();
  });
});
