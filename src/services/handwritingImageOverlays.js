export function loadOverlayImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片讀取失敗，請使用 PNG、JPEG 或 WebP。"));
    image.src = src;
  });
}

function canvasContext(canvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("無法處理圖片，請重新載入頁面後再試。");
  return context;
}

export async function readOverlayFile(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("請使用 PNG、JPEG 或 WebP 圖片。");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("覆蓋圖片上限為 8 MB。");
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("圖片讀取失敗。"));
    reader.readAsDataURL(file);
  });
  const image = await loadOverlayImage(src);
  if (image.naturalWidth * image.naturalHeight > 20_000_000) {
    throw new Error("圖片過大，請先縮小至 2,000 萬像素以下。");
  }
  const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvasContext(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);
  return { image: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

export function initialOverlayRect(image, page) {
  const aspect = image.width / image.height * page.height / page.width;
  const width = Math.min(0.4, 0.4 * aspect);
  const height = width / aspect;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// The source should be the original page image, before handwriting removal.
export async function cropRepairImage(src, region) {
  const image = await loadOverlayImage(src);
  const values = [region?.x, region?.y, region?.width, region?.height];
  if (!values.every(Number.isFinite) || region.width <= 0 || region.height <= 0) {
    throw new Error("修復範圍無效，請重新框選。");
  }
  const x = Math.floor(clamp(region.x, 0, 1) * image.naturalWidth);
  const y = Math.floor(clamp(region.y, 0, 1) * image.naturalHeight);
  const width = Math.min(image.naturalWidth - x, Math.round(region.width * image.naturalWidth));
  const height = Math.min(image.naturalHeight - y, Math.round(region.height * image.naturalHeight));
  if (Math.min(width, height) < 8) throw new Error("修復範圍太小，請框選稍大的區塊。");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvasContext(canvas).drawImage(image, x, y, width, height, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("無法擷取修復區塊。")),
    "image/png",
  ));
}

export function transformOverlay(start, dx, dy, corner = "move") {
  if (corner === "move") {
    return {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    };
  }
  const west = corner.includes("w");
  const north = corner.includes("n");
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const x = west ? clamp(start.x + dx, 0, right - 0.005) : start.x;
  const y = north ? clamp(start.y + dy, 0, bottom - 0.005) : start.y;
  return {
    ...start,
    x,
    y,
    width: west ? right - x : clamp(start.width + dx, 0.005, 1 - x),
    height: north ? bottom - y : clamp(start.height + dy, 0.005, 1 - y),
  };
}

function checkExportSignal(signal) {
  if (signal?.aborted) throw new Error("已取消匯出。");
}

export async function applyImageOverlaysToPdf(blob, overlays = [], signal) {
  checkExportSignal(signal);
  if (!overlays.length) return blob;
  const { PDFDocument } = await import("pdf-lib");
  checkExportSignal(signal);
  const document = await PDFDocument.load(await blob.arrayBuffer());
  const pages = document.getPages();
  for (const overlay of overlays) {
    checkExportSignal(signal);
    const page = Number.isInteger(overlay.page) ? pages[overlay.page - 1] : null;
    if (!page) throw new Error("覆蓋圖片的頁碼超出文件範圍。");
    const image = await document.embedPng(overlay.image);
    const { width, height } = page.getSize();
    page.drawImage(image, {
      x: overlay.x * width,
      y: (1 - overlay.y - overlay.height) * height,
      width: overlay.width * width,
      height: overlay.height * height,
    });
  }
  checkExportSignal(signal);
  const bytes = await document.save();
  checkExportSignal(signal);
  return new Blob([bytes], { type: "application/pdf" });
}
