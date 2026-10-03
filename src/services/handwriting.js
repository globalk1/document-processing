export const HANDWRITING_MAX_FILE_SIZE = 30 * 1024 * 1024;
export const HANDWRITING_MAX_PAGES = 80;

const pdfSources = new WeakMap();

export function checkHandwritingCancelled(signal) {
  if (signal?.aborted) {
    const error = new Error("已取消筆跡處理。");
    error.name = "AbortError";
    throw error;
  }
}

export function isHandwritingPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

export function validateHandwritingFile(file) {
  if (!file) throw new Error("請先選擇 PDF 或圖片。");
  if (file.size > HANDWRITING_MAX_FILE_SIZE) {
    throw new Error("筆跡去除檔案上限為 30 MB。");
  }
  if (!isHandwritingPdf(file) && !/^image\//.test(file.type || "") &&
      !/\.(jpe?g|png|webp|bmp|tiff?)$/i.test(file.name || "")) {
    throw new Error("請選擇 PDF 或圖片檔案。");
  }
}

function validatePageCount(pageCount, maxPages) {
  const limit = Math.min(HANDWRITING_MAX_PAGES, Number(maxPages) || HANDWRITING_MAX_PAGES);
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > limit) {
    throw new Error(`筆跡去除支援最多 ${limit} 頁。`);
  }
}

async function loadPdfSource(file) {
  if (!pdfSources.has(file)) {
    const loading = (async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        return await PDFDocument.load(await file.arrayBuffer());
      } catch {
        throw new Error("無法讀取 PDF，請確認檔案未加密或損壞。");
      }
    })();
    pdfSources.set(file, loading);
    loading.catch(() => pdfSources.delete(file));
  }
  return pdfSources.get(file);
}

// Keep the source document in the browser and send only the page being processed.
// Region coordinates stay normalized; only the page number changes to 1.
export async function getHandwritingSource(file, {
  signal,
  maxPages = HANDWRITING_MAX_PAGES,
} = {}) {
  validateHandwritingFile(file);
  checkHandwritingCancelled(signal);
  const pdf = isHandwritingPdf(file) ? await loadPdfSource(file) : null;
  checkHandwritingCancelled(signal);
  const pageCount = pdf ? pdf.getPageCount() : 1;
  validatePageCount(pageCount, maxPages);

  return {
    pageCount,
    isPdf: Boolean(pdf),
    async getPageFile(pageNumber) {
      checkHandwritingCancelled(signal);
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
        throw new Error("指定頁碼超出文件範圍。");
      }
      if (!pdf || pageCount === 1) return file;
      const { PDFDocument } = await import("pdf-lib");
      const document = await PDFDocument.create();
      const [page] = await document.copyPages(pdf, [pageNumber - 1]);
      document.addPage(page);
      const bytes = await document.save();
      checkHandwritingCancelled(signal);
      // Preserve the source name so the backend download filename remains useful.
      return new File([bytes], file.name || "document.pdf", { type: "application/pdf" });
    },
  };
}

export async function sliceHandwritingPage(file, pageNumber, options = {}) {
  const source = await getHandwritingSource(file, options);
  return {
    file: await source.getPageFile(pageNumber),
    pageNumber,
    pageCount: source.pageCount,
  };
}

