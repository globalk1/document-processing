const PDF_LIB_URL =
  "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
const MAX_PDF_PAGES = 20;
const MAX_ATTEMPTS_PER_PAGE = 3;

let pdfLibPromise;

function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (pdfLibPromise) return pdfLibPromise;

  pdfLibPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PDF_LIB_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.PDFLib), {
        once: true,
      });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = PDF_LIB_URL;
    script.onload = () => resolve(window.PDFLib);
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return pdfLibPromise;
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function pageFileName(filename, pageNumber) {
  const stem = filename.replace(/\.pdf$/i, "");
  return `${stem}-page-${pageNumber}.pdf`;
}

function normalizePageMarker(text, pageNumber) {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";

  if (/^---\s*Page\s+1\s*---/m.test(trimmed)) {
    return trimmed.replace(
      /^---\s*Page\s+1\s*---/m,
      `--- Page ${pageNumber} ---`,
    );
  }
  return `--- Page ${pageNumber} ---\n${trimmed}`;
}

function shouldRetry(result) {
  return !result?.status || result.status === 429 || result.status >= 500;
}

export function isPdfFile(file) {
  return (
    file?.type === "application/pdf" ||
    file?.name?.toLowerCase().endsWith(".pdf")
  );
}

export async function validatePdfPageLimit(file) {
  try {
    const { PDFDocument } = await loadPdfLib();
    const sourcePdf = await PDFDocument.load(await file.arrayBuffer());
    const totalPages = sourcePdf.getPageCount();

    if (totalPages > MAX_PDF_PAGES) {
      return {
        success: false,
        pageCount: totalPages,
        error: `PDF 共 ${totalPages} 頁，目前最多支援 ${MAX_PDF_PAGES} 頁。`,
      };
    }

    return { success: true, pageCount: totalPages };
  } catch (error) {
    console.error("Unable to inspect PDF page count:", error);
    return {
      success: false,
      error: "無法讀取 PDF 頁數，請確認檔案未加密或損壞。",
    };
  }
}

export async function extractAccuratePdfInPages({
  file,
  requestExtract,
  onProgress,
  onPartialText,
}) {
  try {
    onProgress("正在準備 PDF OCR 分頁...");
    const { PDFDocument } = await loadPdfLib();
    const sourcePdf = await PDFDocument.load(await file.arrayBuffer());
    const totalPages = sourcePdf.getPageCount();

    if (totalPages > MAX_PDF_PAGES) {
      return {
        success: false,
        error: `PDF 共 ${totalPages} 頁，目前最多支援 ${MAX_PDF_PAGES} 頁。`,
      };
    }

    const outputs = [];
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      const pageNumber = pageIndex + 1;
      const pagePdf = await PDFDocument.create();
      const [copiedPage] = await pagePdf.copyPages(sourcePdf, [pageIndex]);
      pagePdf.addPage(copiedPage);
      const pageBytes = await pagePdf.save();
      const pageFile = new File(
        [pageBytes],
        pageFileName(file.name, pageNumber),
        { type: "application/pdf" },
      );

      let pageResult;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PAGE; attempt += 1) {
        onProgress(
          attempt === 1
            ? `正在 OCR 第 ${pageNumber} / ${totalPages} 頁...`
            : `第 ${pageNumber} 頁 OCR 重試中（${attempt}/${MAX_ATTEMPTS_PER_PAGE}）...`,
        );
        pageResult = await requestExtract(pageFile, "accurate");
        if (pageResult.success || !shouldRetry(pageResult)) break;
        await sleep(1000 * attempt);
      }

      if (!pageResult?.success) {
        const partialText = outputs.join("\n\n").trim();
        if (partialText) onPartialText(partialText);
        return {
          ...pageResult,
          error:
            `第 ${pageNumber} / ${totalPages} 頁解析失敗，` +
            `已保留前 ${pageNumber - 1} 頁。` +
            (pageResult?.error ? ` ${pageResult.error}` : ""),
        };
      }

      const pageText = normalizePageMarker(pageResult.text, pageNumber);
      if (pageText) outputs.push(pageText);
      onPartialText(outputs.join("\n\n"));
    }

    return { success: true, text: outputs.join("\n\n") };
  } catch (error) {
    console.error("Unable to split PDF for extraction:", error);
    return {
      success: false,
      error: "無法分割 PDF，請確認檔案未加密或損壞。",
    };
  }
}
