const PDF_LIB_URL =
  "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
const MAX_PDF_PAGES = 400;
const MAX_ATTEMPTS_PER_PAGE = 3;
const MAX_CONCURRENT_PAGE_REQUESTS = 2;

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

function joinedContiguousText(outputs) {
  const ready = [];
  for (const output of outputs) {
    if (!output) break;
    ready.push(output);
  }
  return ready.join("\n\n");
}

function shouldSplitForOcr(result) {
  return Boolean(result?.diagnostics?.requires_page_split);
}

export function isPdfFile(file) {
  return (
    file?.type === "application/pdf" ||
    file?.name?.toLowerCase().endsWith(".pdf")
  );
}

export async function extractPdfAutomatically({
  file,
  requestExtract,
  onProgress,
  onPartialText,
}) {
  onProgress("");
  const initialResult = await requestExtract(file, "auto");
  if (initialResult.success || !shouldSplitForOcr(initialResult)) {
    return initialResult;
  }

  return extractAccuratePdfInPages({
    file,
    requestExtract,
    onProgress,
    onPartialText,
  });
}

export async function extractAccuratePdfInPages({
  file,
  requestExtract,
  onProgress,
  onPartialText,
}) {
  try {
    onProgress("");
    const { PDFDocument } = await loadPdfLib();
    const sourcePdf = await PDFDocument.load(await file.arrayBuffer());
    const totalPages = sourcePdf.getPageCount();

    if (totalPages > MAX_PDF_PAGES) {
      return {
        success: false,
        error: `PDF 共 ${totalPages} 頁，目前最多支援 ${MAX_PDF_PAGES} 頁。`,
      };
    }

    const outputs = Array(totalPages).fill("");
    let nextPageIndex = 0;
    let failure = null;

    const extractPage = async (pageIndex) => {
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
        onProgress("");
        pageResult = await requestExtract(pageFile, "auto");
        if (pageResult.success || !shouldRetry(pageResult)) break;
        await sleep(1000 * attempt);
      }

      if (!pageResult?.success) {
        const partialText = joinedContiguousText(outputs).trim();
        if (partialText) onPartialText(partialText);
        const firstMissingPage = outputs.findIndex((output) => !output);
        const preservedPageCount =
          firstMissingPage === -1 ? outputs.length : firstMissingPage;
        return {
          ...pageResult,
          success: false,
          error:
            `第 ${pageNumber} / ${totalPages} 頁解析失敗，` +
            `已保留前 ${preservedPageCount} 頁。` +
            (pageResult?.error ? ` ${pageResult.error}` : ""),
        };
      }

      const pageText = normalizePageMarker(pageResult.text, pageNumber);
      if (pageText) outputs[pageIndex] = pageText;
      onPartialText(joinedContiguousText(outputs));
    };

    const worker = async () => {
      while (!failure) {
        const pageIndex = nextPageIndex;
        nextPageIndex += 1;
        if (pageIndex >= totalPages) return;

        try {
          const pageFailure = await extractPage(pageIndex);
          if (pageFailure) {
            failure = pageFailure;
            return;
          }
        } catch (error) {
          failure = error;
          return;
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT_PAGE_REQUESTS, totalPages) },
      () => worker(),
    );
    await Promise.all(workers);

    if (failure) return failure;

    return { success: true, text: outputs.filter(Boolean).join("\n\n") };
  } catch (error) {
    console.error("Unable to split PDF for extraction:", error);
    return {
      success: false,
      error: "無法分割 PDF，請確認檔案未加密或損壞。",
    };
  }
}
