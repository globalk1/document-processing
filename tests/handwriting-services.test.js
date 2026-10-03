// @vitest-environment node
import { test, afterEach, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { previewHandwriting, removeHandwriting, repairHandwritingImage } from "../src/services/api.js";
import { sliceHandwritingPage } from "../src/services/handwriting.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

beforeEach(() => {
  globalThis.window = {
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: () => null },
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

async function pdfFile(count, name = "試卷.pdf") {
  const document = await PDFDocument.create();
  for (let page = 0; page < count; page += 1) document.addPage([200 + page, 300 + page]);
  return new File([await document.save()], name, { type: "application/pdf" });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("single-page slicing preserves source page content and filename", async () => {
  const source = await pdfFile(3);
  const result = await sliceHandwritingPage(source, 2);
  const sliced = await PDFDocument.load(await result.file.arrayBuffer());
  assert.equal(result.pageCount, 3);
  assert.equal(result.pageNumber, 2);
  assert.equal(result.file.name, source.name);
  assert.equal(sliced.getPageCount(), 1);
  assert.equal(sliced.getPage(0).getWidth(), 201);
});

test("preview uploads one page at a time and preserves ordered erase/restore regions", async () => {
  window.localStorage.getItem = () => "existing-other-feature-token";
  const source = await pdfFile(3);
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.match(url, /\/pdf\/public-handwriting\/preview\/$/);
    const uploaded = await PDFDocument.load(await options.body.get("file").arrayBuffer());
    assert.equal(uploaded.getPageCount(), 1);
    assert.equal(uploaded.getPage(0).getWidth(), 199 + calls.length);
    return jsonResponse({ success: true, page_count: 1, pages: [{
      page: 1, mask_ratio: .12, original_image: "original", cleaned_image: "cleaned",
    }] });
  };
  const progress = [];
  const result = await previewHandwriting({
    file: source,
    authToken: "unused-token",
    manualRegions: [
      { page: 2, action: "erase", x: .1, y: .2, width: .2, height: .3 },
      { page: 2, action: "restore", x: .2, y: .3, width: .1, height: .1 },
      { page: 3, action: "erase", x: .3, y: .4, width: .1, height: .1 },
    ],
    onProgress: (page, total, pages) => progress.push([page, total, pages.length]),
  });
  assert.equal(result.success, true);
  assert.equal(result.pageCount, 3);
  assert.deepEqual(result.pages.map((page) => page.page), [1, 2, 3]);
  assert.deepEqual(progress, [[1, 3, 1], [2, 3, 2], [3, 3, 3]]);
  assert.equal(calls[0].options.headers?.Authorization, undefined);
  assert.equal(calls[0].options.body.get("page_number"), "1");
  assert.equal(calls[0].options.body.get("strength"), "2");
  assert.equal(calls[0].options.body.get("manual_regions"), null);
  assert.deepEqual(JSON.parse(calls[1].options.body.get("manual_regions")).map((region) => [region.page, region.action]),
    [[1, "erase"], [1, "restore"]]);
});

test("one requested preview page maps backend numbering back to source numbering", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ success: true, pages: [{ page: 1 }], page_count: 1 });
  };
  const result = await previewHandwriting({ file: await pdfFile(4), pageNumber: 3 });
  assert.equal(result.success, true);
  assert.equal(calls, 1);
  assert.equal(result.pages[0].page, 3);
  assert.equal(result.pageCount, 4);
});

test("original image preview uses anonymous backend rendering and preserves processing-pixel metadata", async () => {
  let calls = 0;
  const original = new File(["image"], "試卷.png", { type: "image/png" });
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.match(url, /\/pdf\/public-handwriting\/preview\/$/);
    assert.equal(options.headers?.Authorization, undefined);
    assert.equal(options.body.get("color_mode"), "manual_only");
    assert.equal(options.body.get("file"), original);
    return jsonResponse({ success: true, page_count: 1, pages: [{
      page: 1, width: 500, height: 800,
      image: "original", cleaned_image: "original", mask_overlay: "", mask_ratio: 0,
      processing_width: 1250, processing_height: 2000, manual_padding: 0,
    }] });
  };
  const result = await previewHandwriting({
    file: original, colorMode: "manual_only",
  });
  assert.equal(result.success, true);
  assert.equal(calls, 1);
  assert.equal(result.pages[0].width, 500);
  assert.equal(result.pages[0].cleaned_image, result.pages[0].image);
  assert.equal(result.pages[0].mask_ratio, 0);
  assert.equal(result.pages[0].processing_width, 1250);
  assert.equal(result.pages[0].processing_height, 2000);
  assert.equal(result.pages[0].manual_padding, 0);
});

test("autoRemove and restoreRegions map to the actual backend contract", async () => {
  let form;
  globalThis.fetch = async (url, options) => {
    form = options.body;
    return jsonResponse({ success: true, pages: [{ page: 1 }], page_count: 1 });
  };
  const result = await previewHandwriting({
    file: await pdfFile(1), autoRemove: false,
    restoreRegions: [{ page: 1, x: .2, y: .3, width: .1, height: .1 }],
  });
  assert.equal(result.success, true);
  assert.equal(form.get("color_mode"), "manual_only");
  assert.equal(form.get("auto_remove"), null);
  assert.equal(form.get("restore_regions"), null);
  assert.equal(JSON.parse(form.get("manual_regions"))[0].action, "restore");
});

test("export merges all cleaned pages, reports progress and decodes filename", async () => {
  let calls = 0;
  const progress = [];
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.match(url, /\/pdf\/public-handwriting\/remove\/$/);
    assert.equal(options.headers?.Authorization, undefined);
    const uploaded = await PDFDocument.load(await options.body.get("file").arrayBuffer());
    assert.equal(uploaded.getPageCount(), 1);
    return new Response(await (await pdfFile(1)).arrayBuffer(), {
      headers: {
        "content-type": "application/pdf", "x-source-pages": "1", "x-processed-pages": "1",
        "x-handwriting-mask-ratio": String(.1 * calls),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent("試卷-cleaned.pdf")}`,
      },
    });
  };
  const result = await removeHandwriting({ file: await pdfFile(3), onProgress: (...values) => progress.push(values) });
  assert.equal(result.success, true);
  assert.equal(result.filename, "試卷-cleaned.pdf");
  assert.equal(result.pageCount, 3);
  assert.equal((await PDFDocument.load(await result.blob.arrayBuffer())).getPageCount(), 3);
  assert.ok(Math.abs(result.maskRatio - .2) < .000001);
  assert.deepEqual(progress, [[1, 3], [2, 3], [3, 3]]);
});

test("cancel after a partial preview prevents further page uploads", async () => {
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ success: true, pages: [{ page: 1 }], page_count: 1 });
  };
  const result = await previewHandwriting({
    file: await pdfFile(3), signal: controller.signal, onProgress: () => controller.abort(),
  });
  assert.equal(result.success, false);
  assert.equal(result.cancelled, true);
  assert.equal(calls, 1);
});

test("limits and malformed page responses fail without partial export", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ success: true, pages: [{ page: 2 }], page_count: 1 });
  };
  const oversized = await previewHandwriting({ file: await pdfFile(81) });
  assert.equal(oversized.success, false);
  assert.match(oversized.error, /80 頁/);
  assert.equal(calls, 0);
  const malformed = await previewHandwriting({ file: await pdfFile(1) });
  assert.equal(malformed.success, false);
  assert.match(malformed.error, /非預期/);
});

test("backend errors retain useful validation text and HTTP status", async () => {
  globalThis.fetch = async () => jsonResponse({ strength: ["請輸入 1 至 5"], code: "invalid_input" }, 400);
  const result = await previewHandwriting({ file: await pdfFile(1) });
  assert.equal(result.success, false);
  assert.equal(result.status, 400);
  assert.equal(result.code, "invalid_input");
  assert.match(result.error, /請輸入 1 至 5/);
});

test("image repair uses anonymous handwriting jobs and returns repaired PNG", async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/pdf\/public-handwriting\/image-repair\/jobs\/$/);
    assert.equal(options.headers?.Authorization, undefined);
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("instructions"), "修復圖形");
    assert.equal(options.body.get("image").name, "crop.png");
    return jsonResponse({ success: true, job: { id: "repair-1", status: "success", image: "data:image/png;base64,repaired" } });
  };
  const result = await repairHandwritingImage({ image: new Blob(["crop"], { type: "image/png" }), instructions: "修復圖形" });
  assert.equal(result.success, true);
  assert.equal(result.image, "data:image/png;base64,repaired");
});

test("image repair cancellation stops polling a queued job", async () => {
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ success: true, job: { id: "repair-1", status: "queued" } });
  };
  const result = await repairHandwritingImage({
    image: new Blob(["crop"]), signal: controller.signal, onProgress: () => controller.abort(),
  });
  assert.equal(result.success, false);
  assert.equal(result.cancelled, true);
  assert.equal(calls, 1);
});
