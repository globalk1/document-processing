import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

async function withPdfDocument(file, callback) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  });

  try {
    return await callback(await loadingTask.promise);
  } finally {
    await loadingTask.destroy();
  }
}

async function renderPage(page, { targetWidth, scale, rotation = 0, type = "dataUrl" }) {
  const outputRotation = ((Number(page.rotate) || 0) + rotation + 360) % 360;
  const baseViewport = page.getViewport({ scale: 1, rotation: outputRotation });
  const renderScale = scale || Math.max(0.1, targetWidth / baseViewport.width);
  const viewport = page.getViewport({ scale: renderScale, rotation: outputRotation });
  const pixelRatio = type === "dataUrl" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.ceil(viewport.width * pixelRatio);
  canvas.height = Math.ceil(viewport.height * pixelRatio);

  await page.render({
    canvasContext: context,
    viewport,
    transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
    background: "white",
  }).promise;

  if (type === "blob") {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG 產生失敗"))),
        "image/png",
      );
    });
  }

  return canvas.toDataURL("image/jpeg", 0.78);
}

export function renderPdfThumbnails(file, pageCount) {
  return withPdfDocument(file, async (pdfDocument) => {
    const thumbnails = [];
    for (let index = 0; index < pageCount; index += 1) {
      const page = await pdfDocument.getPage(index + 1);
      try {
        thumbnails.push(await renderPage(page, { targetWidth: 180 }));
      } finally {
        page.cleanup();
      }
    }
    return thumbnails;
  });
}

export function renderPdfPagePreview(file, pageIndex, rotation = 0) {
  return withPdfDocument(file, async (pdfDocument) => {
    const page = await pdfDocument.getPage(pageIndex + 1);
    try {
      return await renderPage(page, { targetWidth: 1100, rotation });
    } finally {
      page.cleanup();
    }
  });
}

function textItemsToLines(items) {
  const lines = [];
  let line = "";
  let previousY = null;

  items.forEach((item) => {
    const value = String(item.str || "");
    const y = Number(item.transform?.[5]);
    const startsNewLine = previousY !== null && Number.isFinite(y) && Math.abs(y - previousY) > 2;
    if (startsNewLine && line.trim()) {
      lines.push(line.trimEnd());
      line = "";
    }
    if (line && value && !/^\s/.test(value) && !/\s$/.test(line)) line += " ";
    line += value;
    if (item.hasEOL && line.trim()) {
      lines.push(line.trimEnd());
      line = "";
    }
    if (Number.isFinite(y)) previousY = y;
  });

  if (line.trim()) lines.push(line.trimEnd());
  return lines.join("\n").trim();
}

export function extractPdfTextPages(file, pageIndices) {
  return withPdfDocument(file, async (pdfDocument) => {
    const result = {};
    for (const pageIndex of [...new Set(pageIndices)]) {
      const page = await pdfDocument.getPage(pageIndex + 1);
      try {
        const content = await page.getTextContent();
        result[pageIndex] = textItemsToLines(content.items);
      } finally {
        page.cleanup();
      }
    }
    return result;
  });
}

export function renderPdfPagesAsPng(file, pageSpecs) {
  return withPdfDocument(file, async (pdfDocument) => {
    const result = [];
    for (const spec of pageSpecs) {
      const page = await pdfDocument.getPage(spec.pageIndex + 1);
      try {
        result.push({
          id: spec.id,
          blob: await renderPage(page, {
            scale: 2,
            rotation: spec.rotation || 0,
            type: "blob",
          }),
        });
      } finally {
        page.cleanup();
      }
    }
    return result;
  });
}
