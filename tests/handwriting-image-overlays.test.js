// @vitest-environment node
import { expect, it } from "vitest";
import { PDFDocument, PDFName, decodePDFRawStream } from "pdf-lib";
import { applyImageOverlaysToPdf, initialOverlayRect, transformOverlay } from "../src/services/handwritingImageOverlays.js";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";

it("preserves initial image aspect and keeps every corner resize within the page", () => {
  const rect = initialOverlayRect({ width: 200, height: 100 }, { width: 500, height: 700 });
  expect(rect.width * 500 / (rect.height * 700)).toBeCloseTo(2);
  expect(transformOverlay(rect, 10, -10)).toMatchObject({ x: 1 - rect.width, y: 0 });
  for (const corner of ["nw", "ne", "sw", "se"]) {
    for (const delta of [-10, 10]) {
      const resized = transformOverlay(rect, delta, delta, corner);
      expect(resized.x).toBeGreaterThanOrEqual(0);
      expect(resized.y).toBeGreaterThanOrEqual(0);
      expect(resized.width).toBeGreaterThan(0);
      expect(resized.height).toBeGreaterThan(0);
      expect(resized.x + resized.width).toBeLessThanOrEqual(1.000001);
      expect(resized.y + resized.height).toBeLessThanOrEqual(1.000001);
    }
  }
});

it("embeds the actual image only on the selected PDF page with matching preview coordinates", async () => {
  const document = await PDFDocument.create();
  document.addPage([500, 700]);
  document.addPage([800, 600]);
  const source = new Blob([await document.save()], { type: "application/pdf" });
  const result = await applyImageOverlaysToPdf(source, [
    { page: 2, x: 0.1, y: 0.2, width: 0.3, height: 0.25, image: png },
  ]);
  const pdf = await PDFDocument.load(await result.arrayBuffer());
  const [first, second] = pdf.getPages();
  expect(first.node.Resources().lookup(PDFName.of("XObject"))).toBeUndefined();
  expect(second.node.Resources().lookup(PDFName.of("XObject")).keys()).toHaveLength(1);
  const contents = second.node.Contents();
  const text = Array.from({ length: contents.size() }, (_, index) =>
    String.fromCharCode(...decodePDFRawStream(pdf.context.lookup(contents.get(index))).decode()),
  ).join("\n");
  expect(text).toContain("1 0 0 1 80 330 cm");
  expect(text).toContain("240 0 0 150 0 0 cm");
});

it("rejects an invalid overlay page or an already cancelled export", async () => {
  const document = await PDFDocument.create();
  document.addPage([500, 700]);
  const source = new Blob([await document.save()], { type: "application/pdf" });
  await expect(applyImageOverlaysToPdf(source, [
    { page: 2, x: 0.1, y: 0.2, width: 0.3, height: 0.25, image: png },
  ])).rejects.toThrow("頁碼超出");
  const controller = new AbortController();
  controller.abort();
  await expect(applyImageOverlaysToPdf(source, [], controller.signal)).rejects.toThrow("取消匯出");
});
