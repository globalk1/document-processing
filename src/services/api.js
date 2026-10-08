import {
  checkHandwritingCancelled,
  getHandwritingSource,
} from "./handwriting.js";
import { applyImageOverlaysToPdf } from "./handwritingImageOverlays.js";

export const API_URL =
  import.meta.env?.VITE_API_URL ||
  (import.meta.env?.PROD
    ? "https://sunnytseng.com/api"
    : "http://127.0.0.1:8000/api");
const CDN_BASE_URL = "https://assets.sunnytseng.com";
const AUTH_TOKEN_KEY = "auth.token";
const AUTH_USER_KEY = "auth.documentProcessingUser";

export function getStoredAuthToken() {
  return (
    window.localStorage.getItem(AUTH_TOKEN_KEY) ||
    window.sessionStorage.getItem(AUTH_TOKEN_KEY) ||
    ""
  );
}

export function getStoredAuthUser() {
  const raw =
    window.localStorage.getItem(AUTH_USER_KEY) ||
    window.sessionStorage.getItem(AUTH_USER_KEY) ||
    "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeAuthSession({ token, user, stayLoggedIn }) {
  const storage = stayLoggedIn ? window.localStorage : window.sessionStorage;
  const otherStorage = stayLoggedIn ? window.sessionStorage : window.localStorage;
  storage.setItem(AUTH_TOKEN_KEY, token);
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  otherStorage.removeItem(AUTH_TOKEN_KEY);
  otherStorage.removeItem(AUTH_USER_KEY);
}

export function logoutDocumentProcessing() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(AUTH_USER_KEY);
}

function getAuthHeaders(headers = {}) {
  const token = getStoredAuthToken();
  return token
    ? { ...headers, Authorization: `Bearer ${token}` }
    : headers;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function getAuthError(response, result, fallback) {
  if (response.status === 401 || response.status === 403)
    return result.error || result.detail || "權限驗證失敗，請確認操作權限。";
  return result.error || result.detail || fallback;
}

function getApiKeyRequestError(result, fallback) {
  return result.error || result.detail || fallback;
}

function getMathBankRequestError(response, result, fallback, options = {}) {
  if (options.apiKey) return getApiKeyRequestError(result, fallback);
  return getAuthError(response, result, fallback);
}

export async function loginDocumentProcessing({ account, password, stayLoggedIn }) {
  try {
    const response = await fetch(`${API_URL}/document-processing/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });
    const result = await parseJson(response);

    if (!response.ok || !result.access) {
      return {
        success: false,
        error: result.detail || result.error || "登入失敗，請確認帳號密碼。",
        status: response.status,
      };
    }

    const user = {
      account: result.account || account,
      name: result.name || result.account || account,
    };
    storeAuthSession({ token: result.access, user, stayLoggedIn });
    return { success: true, user, token: result.access };
  } catch (error) {
    console.error("loginDocumentProcessing failed", error);
    return { success: false, error: "無法連線至登入服務。", status: 0 };
  }
}

export async function fetchDocumentProcessingMe() {
  try {
    const response = await fetch(`${API_URL}/document-processing/me/`, {
      headers: getAuthHeaders({ Accept: "application/json" }),
    });
    const result = await parseJson(response);

    if (!response.ok) {
      return {
        success: false,
        error: getAuthError(response, result, "登入狀態已失效。"),
        status: response.status,
      };
    }

    return { success: true, user: result };
  } catch (error) {
    console.error("fetchDocumentProcessingMe failed", error);
    return { success: false, error: "無法確認登入狀態。", status: 0 };
  }
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        value.filter(item => item !== undefined && item !== null && item !== "").forEach(item => query.append(key, item));
      } else {
        query.set(key, value);
      }
    }
  });

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function fetchMathBankJson(path, params = {}, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.apiKey) headers["X-API-KEY"] = options.apiKey;

  const response = await fetch(`${API_URL}/math-bank${withQuery(path, { ...params, subject: options.subject ?? params.subject })}`, {
    headers,
  });
  const result = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      error: getMathBankRequestError(response, result, "題庫讀取失敗", options),
      status: response.status,
      data: result,
    };
  }

  return { success: true, data: result };
}

async function postDocumentJson(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  const result = await parseJson(response);

  if (!response.ok || result.success === false) {
    return {
      success: false,
      error: getAuthError(response, result, "請求失敗"),
      code: result.code,
      status: response.status,
      data: result,
    };
  }

  return { success: true, data: result };
}

export function getPublicAssetUrl(key) {
  return `${CDN_BASE_URL}/${encodeURI(key).replace(/%2F/g, "/")}`;
}

export async function renderMatplotlibPreview(code) {
  try {
    const response = await fetch(`${API_URL}/pdf/math-docs-matplotlib-preview/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const result = await parseJson(response);
    if (!response.ok || !result.success || !result.image) {
      return { success: false, error: result.error || "圖片產生失敗。" };
    }
    return { success: true, image: result.image };
  } catch (error) {
    return { success: false, error: error?.message || "無法連線至圖片預覽服務。" };
  }
}

export async function uploadAssetFile({ file, key, apiKey = "" }) {
  const formData = new FormData();
  formData.append("file", file);
  if (key) formData.append("key", key);
  const headers = {};
  if (apiKey) headers["X-API-KEY"] = apiKey;

  try {
    const response = await fetch(`${API_URL}/assets/upload/`, {
      method: "POST",
      headers: apiKey ? headers : getAuthHeaders(headers),
      body: formData,
    });
    const result = await parseJson(response);

    if (!response.ok || !result.success || !result.key) {
      return {
        success: false,
        error: apiKey
          ? getApiKeyRequestError(result, "圖片上傳失敗")
          : getAuthError(response, result, "圖片上傳失敗"),
        status: response.status,
        data: result,
      };
    }

    return {
      success: true,
      key: result.key,
      url: result.url || getPublicAssetUrl(result.key),
      data: result,
    };
  } catch (error) {
    console.error("uploadAssetFile failed", error);
    return { success: false, error: "無法連線至圖片上傳服務", status: 0 };
  }
}

async function postMathBankJson(path, body, options = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (options.apiKey) headers["X-API-KEY"] = options.apiKey;

  const response = await fetch(`${API_URL}/math-bank${withQuery(path, { subject: options.subject })}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const result = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      error: getMathBankRequestError(response, result, "題庫寫入失敗", options),
      status: response.status,
      data: result,
    };
  }

  return { success: true, data: result };
}

async function sendMathBankJson(path, body, options = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (options.apiKey) headers["X-API-KEY"] = options.apiKey;

  const response = await fetch(`${API_URL}/math-bank${withQuery(path, { subject: options.subject })}`, {
    method: options.method || "POST",
    headers,
    body: JSON.stringify(body),
  });
  const result = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      error: getMathBankRequestError(response, result, "題庫寫入失敗", options),
      status: response.status,
      data: result,
    };
  }

  return { success: true, data: result };
}

async function deleteMathBankJson(path, options = {}) {
  const headers = {};
  if (options.apiKey) headers["X-API-KEY"] = options.apiKey;

  const response = await fetch(`${API_URL}/math-bank${withQuery(path, { subject: options.subject })}`, {
    method: "DELETE",
    headers,
  });

  if (response.status === 204) return { success: true, data: null };
  const result = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      error: getMathBankRequestError(response, result, "題庫刪除失敗", options),
      status: response.status,
      data: result,
    };
  }

  return { success: true, data: result };
}

export async function listMathBankGrades(params = {}, options = {}) {
  return fetchMathBankJson("/grades/", params, options);
}

export async function listMathBankUnits(params = {}, options = {}) {
  return fetchMathBankJson("/units/", params, options);
}

export async function listMathBankQuestionSources(params = {}, options = {}) {
  return fetchMathBankJson("/sources/", { is_active: true, ...params }, options);
}

export async function listStaffMathBankQuestions(params = {}, options = {}) {
  return fetchMathBankJson("/staff/questions/", params, options);
}

export async function searchStaffMathBankQuestions(params = {}, options = {}) {
  return fetchMathBankJson("/questions/search/", params, options);
}

export async function getStaffMathBankQuestion(id, options = {}) {
  return fetchMathBankJson(`/staff/questions/${encodeURIComponent(id)}/`, {}, options);
}

export async function createStaffMathBankGrade(data, options = {}) {
  return postMathBankJson("/grades/", data, options);
}

export async function createStaffMathBankUnit(data, options = {}) {
  return postMathBankJson("/units/", data, options);
}

export async function createStaffMathBankQuestion(data, options = {}) {
  return postMathBankJson("/staff/questions/", data, options);
}

export async function createStaffMathBankQuestionsBulk(data, options = {}) {
  return postMathBankJson("/staff/questions/bulk/", data, options);
}

export async function updateStaffMathBankQuestion(id, data, options = {}) {
  return sendMathBankJson(`/staff/questions/${encodeURIComponent(id)}/`, data, {
    ...options,
    method: "PATCH",
  });
}

export async function deleteStaffMathBankQuestion(id, options = {}) {
  return deleteMathBankJson(`/staff/questions/${encodeURIComponent(id)}/`, options);
}

export async function buildMathBankJson({
  text,
  gradeId,
  unitId,
  questionSource = "",
  defaultType = "calculation",
  defaultDifficulty = "U",
}) {
  const result = await postDocumentJson("/pdf/math-bank-json/", {
    text,
    grade_id: gradeId,
    unit_id: unitId,
    question_source: questionSource,
    default_type: defaultType,
    default_difficulty: defaultDifficulty,
  });

  if (!result.success) return result;
  return { success: true, payload: result.data.payload };
}

export async function extractPdfText({ file, mode }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  try {
    const response = await fetch(`${API_URL}/pdf/extract/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });
    const result = await parseJson(response);

    if (response.ok && result.success) {
      return { success: true, text: result.text || "" };
    }

    return {
      success: false,
      error: getAuthError(response, result, "解析失敗"),
      code: result.code,
      diagnostics: result.diagnostics,
      status: response.status,
    };
  } catch (error) {
    console.error("extractPdfText failed", error);
    return { success: false, error: "解析請求失敗", status: 0 };
  }
}

export async function processAiText({ text }) {
  try {
    const response = await fetch(`${API_URL}/ai/process/`, {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ text, workflow: "solution" }),
    });
    const result = await parseJson(response);

    if (response.ok && result.success) {
      return { success: true, text: result.text || "" };
    }

    return {
      success: false,
      error: getAuthError(response, result, "詳解生成失敗"),
      status: response.status,
    };
  } catch (error) {
    console.error("processAiText failed", error);
    return { success: false, error: "詳解請求失敗" };
  }
}

function handwritingErrorMessage(result, fallback) {
  if (result?.error || result?.detail) return result.error || result.detail;
  const fieldError = Object.entries(result || {})
    .find(([key, value]) => key !== "success" && key !== "code" && value);
  return fieldError
    ? `${fieldError[0]}: ${Array.isArray(fieldError[1]) ? fieldError[1].join("、") : String(fieldError[1])}`
    : fallback;
}

function handwritingFailure(error, fallback) {
  return {
    success: false,
    error: error?.message || fallback,
    status: error?.status || 0,
    ...(error?.code ? { code: error.code } : {}),
    ...(error?.name === "AbortError" ? { cancelled: true } : {}),
  };
}

function handwritingOptions(options) {
  const manualRegions = Array.isArray(options.manualRegions) ? options.manualRegions : [];
  const restores = Array.isArray(options.restoreRegions) ? options.restoreRegions : [];
  return {
    ...options,
    colorMode: options.autoRemove === false ? "manual_only" : options.colorMode || "exam_auto",
    // The shared backend applies erase/restore regions in order in one array.
    manualRegions: [...manualRegions, ...restores.map((region) => ({ ...region, action: "restore" }))],
  };
}

function handwritingPageRegions(regions, pageNumber) {
  return regions
    .filter((region) => Number(region.page || 1) === pageNumber)
    .map((region) => ({ ...region, page: 1 }));
}

async function requestHandwritingPage({
  file,
  colorMode,
  outputFormat,
  strength,
  manualRegions,
  authToken,
  signal,
  pageNumber,
}, preview) {
  checkHandwritingCancelled(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 25000);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("color_mode", colorMode);
  formData.append("strength", String(strength));
  formData.append("page_number", "1");
  if (outputFormat) formData.append("output_format", outputFormat);
  if (preview) formData.append("max_pages", "1");
  if (manualRegions.length) {
    formData.append("manual_regions", JSON.stringify(manualRegions));
  }

  try {
    const response = await fetch(`${API_URL}/pdf/public-handwriting/${preview ? "preview" : "remove"}/`, {
      method: "POST",
      headers: {},
      body: formData,
      signal: controller.signal,
    });
    if (preview) {
      const result = await parseJson(response);
      if (!response.ok || !result.success) {
        const error = new Error(handwritingErrorMessage(result, "筆跡預覽失敗"));
        error.status = response.status;
        error.code = result.code;
        throw error;
      }
      if (result.pages?.length !== 1 || Number(result.pages[0].page) !== 1 ||
          Number(result.page_count || 1) !== 1) {
        throw new Error("逐頁預覽回傳了非預期的頁數或頁碼。");
      }
      return { ...result.pages[0], page: pageNumber };
    }

    const contentType = response.headers.get("content-type") || "";
    const isFile =
      contentType.includes("application/pdf") || contentType.startsWith("image/");
    if (response.ok && isFile) {
      if (Number(response.headers.get("x-source-pages") || 1) !== 1 ||
          Number(response.headers.get("x-processed-pages") || 1) !== 1) {
        throw new Error("逐頁匯出回傳了非預期的頁數。");
      }
      const blob = await response.blob();
      return {
        blob,
        filename: getDownloadFilename(response,
          contentType.includes("application/pdf") ? "cleaned-document.pdf" : "cleaned-document.png"),
        maskRatio: Number(response.headers.get("x-handwriting-mask-ratio") || 0),
      };
    }

    const result = await parseJson(response);
    const error = new Error(handwritingErrorMessage(result, "筆跡去除服務沒有回傳可下載的檔案。"));
    error.status = response.status;
    error.code = result.code;
    throw error;
  } catch (error) {
    if (error.name === "AbortError") {
      if (signal?.aborted) checkHandwritingCancelled(signal);
      throw new Error(`第 ${pageNumber} 頁處理逾時，請稍後再試或縮小檔案。`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export async function removeHandwriting({
  file,
  colorMode = "exam_auto",
  outputFormat = "pdf",
  strength = 2,
  manualRegions = [],
  restoreRegions = [],
  autoRemove,
  imageOverlays = [],
  authToken,
  signal,
  onProgress,
}) {
  try {
    const options = handwritingOptions({
      colorMode, strength, manualRegions, restoreRegions, autoRemove,
      outputFormat, authToken, signal,
    });
    const source = await getHandwritingSource(file, { signal });
    let merged;
    if (source.pageCount > 1) {
      const { PDFDocument } = await import("pdf-lib");
      merged = await PDFDocument.create();
    }
    let first;
    let ratio = 0;
    for (let pageNumber = 1; pageNumber <= source.pageCount; pageNumber += 1) {
      checkHandwritingCancelled(signal);
      const result = await requestHandwritingPage({
        ...options,
        file: await source.getPageFile(pageNumber),
        pageNumber,
        manualRegions: handwritingPageRegions(options.manualRegions, pageNumber),
      }, false);
      checkHandwritingCancelled(signal);
      first ||= result;
      ratio += result.maskRatio;
      if (merged) {
        const { PDFDocument } = await import("pdf-lib");
        const document = await PDFDocument.load(await result.blob.arrayBuffer());
        if (document.getPageCount() !== 1) throw new Error("逐頁匯出回傳了非預期的頁數。");
        const [page] = await merged.copyPages(document, [0]);
        merged.addPage(page);
      }
      onProgress?.(pageNumber, source.pageCount);
    }
    checkHandwritingCancelled(signal);
    const blob = merged
      ? new Blob([await merged.save()], { type: "application/pdf" })
      : first.blob;
    return {
      success: true,
      blob: await applyImageOverlaysToPdf(blob, imageOverlays, signal),
      filename: first.filename,
      pageCount: source.pageCount,
      maskRatio: ratio / source.pageCount,
      mask_ratio: ratio / source.pageCount,
    };
  } catch (error) {
    return handwritingFailure(error, "無法連線至筆跡去除服務");
  }
}

export async function previewHandwriting({
  file,
  colorMode = "exam_auto",
  strength = 2,
  manualRegions = [],
  restoreRegions = [],
  autoRemove,
  maxPages = 80,
  pageNumber,
  authToken,
  signal,
  onProgress,
}) {
  try {
    const options = handwritingOptions({
      colorMode, strength, manualRegions, restoreRegions, autoRemove, authToken, signal,
    });
    const source = await getHandwritingSource(file, { signal, maxPages });
    if (pageNumber !== undefined && (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > source.pageCount)) {
      throw new Error("指定頁碼超出文件範圍。");
    }
    const pageNumbers = pageNumber === undefined
      ? Array.from({ length: source.pageCount }, (_, index) => index + 1)
      : [pageNumber];
    const pages = [];
    for (const number of pageNumbers) {
      checkHandwritingCancelled(signal);
      const regions = handwritingPageRegions(options.manualRegions, number);
      const page = await requestHandwritingPage({
        ...options,
        file: await source.getPageFile(number),
        pageNumber: number,
        manualRegions: regions,
      }, true);
      checkHandwritingCancelled(signal);
      pages.push(page);
      onProgress?.(number, source.pageCount, [...pages]);
    }
    return { success: true, pages, pageCount: source.pageCount };
  } catch (error) {
    return handwritingFailure(error, "無法連線至筆跡預覽服務");
  }
}

export async function repairHandwritingImage({
  image,
  instructions = "",
  authToken,
  signal,
  onProgress,
}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 330000);
  const request = async (path, options = {}) => {
    const response = await fetch(`${API_URL}/pdf/public-handwriting/image-repair/jobs/${path}`, {
      ...options,
      headers: {},
      signal: controller.signal,
    });
    const result = await parseJson(response);
    if (!response.ok || !result.success) {
      const error = new Error(handwritingErrorMessage(result, "圖片修復失敗。"));
      error.status = response.status;
      error.code = result.code;
      throw error;
    }
    return result.job;
  };
  const pause = () => new Promise((resolve, reject) => {
    const done = () => {
      controller.signal.removeEventListener("abort", cancel);
      resolve();
    };
    const waitTimer = setTimeout(done, 1500);
    const cancel = () => {
      clearTimeout(waitTimer);
      controller.signal.removeEventListener("abort", cancel);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (controller.signal.aborted) cancel();
    else controller.signal.addEventListener("abort", cancel, { once: true });
  });
  try {
    checkHandwritingCancelled(signal);
    if (!image) throw new Error("請先框選需要修復的圖片。");
    const form = new FormData();
    form.append("image", image, "crop.png");
    form.append("instructions", instructions);
    let job = await request("", { method: "POST", body: form });
    if (!job?.id) throw new Error("未收到圖片修復工作編號。");
    const id = job.id;
    while (job.status === "queued" || job.status === "running") {
      onProgress?.(job.status === "queued" ? "圖片修復排隊中…" : "正在修復框選圖片…");
      await pause();
      job = await request(`${encodeURIComponent(id)}/`);
    }
    if (job.status !== "success" || !job.image?.startsWith("data:image/png;base64,")) {
      throw new Error(job.error || "未收到可用的修復圖片。");
    }
    checkHandwritingCancelled(signal);
    return { success: true, image: job.image };
  } catch (error) {
    if (error.name === "AbortError") {
      return { success: false, cancelled: Boolean(signal?.aborted), error: signal?.aborted
        ? "已停止等待修復。" : "圖片修復逾時，請稍後重試。", status: 0 };
    }
    return handwritingFailure(error, "無法連線至圖片修復服務。");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export async function parseWordDocument({
  file,
  includeAssets = true,
  mode = "accurate",
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("include_assets", includeAssets ? "true" : "false");
  formData.append("mode", mode);

  try {
    const response = await fetch(`${API_URL}/word/parse/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });
    const result = await parseJson(response);

    if (response.ok && result.success && result.document) {
      return { success: true, document: result.document };
    }

    return {
      success: false,
      error: getAuthError(response, result, "Word 文件解析失敗"),
      code: result.code,
      status: response.status,
    };
  } catch (error) {
    console.error("parseWordDocument failed", error);
    return { success: false, error: "無法連線至 Word 解析服務", status: 0 };
  }
}

export async function fetchWordTemplates() {
  try {
    const response = await fetch(`${API_URL}/word/templates/`, {
      headers: getAuthHeaders({ Accept: "application/json" }),
    });
    const result = await parseJson(response);

    if (response.ok && result.success) {
      return {
        success: true,
        templates: result.templates || [],
        defaultTemplateId: result.default_template_id || "exam_paper",
      };
    }

    return {
      success: false,
      error: getAuthError(response, result, "無法取得 Word 模板"),
      status: response.status,
    };
  } catch (error) {
    console.error("fetchWordTemplates failed", error);
    return { success: false, error: "無法連線至 Word 模板服務", status: 0 };
  }
}

export async function generateWordDocument({
  document,
  filename = "exam-paper.docx",
  templateId = "exam_paper",
}) {
  try {
    const response = await fetch(`${API_URL}/word/generate/`, {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        document,
        filename,
        template_id: templateId,
      }),
    });

    if (response.ok) {
      const blob = await response.blob();
      return {
        success: true,
        blob,
        filename: getDownloadFilename(response, filename),
      };
    }

    const result = await parseJson(response);
    return {
      success: false,
      error: getAuthError(response, result, "Word 文件產生失敗"),
      code: result.code,
      status: response.status,
    };
  } catch (error) {
    console.error("generateWordDocument failed", error);
    return { success: false, error: "無法連線至 Word 產生服務", status: 0 };
  }
}

export async function generateWordFromBank({
  questionIds = [],
  filename = "題庫選題講義.docx",
  title = "題庫選題講義",
  templateId = "high_school_math_handout",
  mode = "teaching",
  sectionMode = "unit",
  apiKey = "",
}) {
  try {
    const headers = getAuthHeaders({
      "Content-Type": "application/json",
    });
    if (apiKey.trim()) headers["X-API-KEY"] = apiKey.trim();

    const response = await fetch(`${API_URL}/word/generate-from-bank/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        question_ids: questionIds,
        filename,
        title,
        template_id: templateId,
        mode,
        section_mode: sectionMode,
      }),
    });

    if (response.ok) {
      const blob = await response.blob();
      return {
        success: true,
        blob,
        filename: getDownloadFilename(response, filename),
      };
    }

    const result = await parseJson(response);
    return {
      success: false,
      error: getAuthError(response, result, "題庫講義產生失敗"),
      code: result.code,
      status: response.status,
      data: result,
    };
  } catch (error) {
    console.error("generateWordFromBank failed", error);
    return { success: false, error: "無法連線至題庫講義產生服務", status: 0 };
  }
}

export async function generatePublicExamFromBank({
  questionIds,
  filename,
  title,
  templateId,
  examRange = "",
  mode = "teaching",
}) {
  try {
    const response = await fetch(`${API_URL}/word/public-exams/generate-from-bank/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_ids: questionIds,
        filename,
        title,
        template_id: templateId,
        exam_range: examRange,
        mode,
        section_mode: "selected",
      }),
    });
    if (response.ok) {
      return {
        success: true,
        blob: await response.blob(),
        filename: getDownloadFilename(response, filename),
      };
    }
    const result = await parseJson(response);
    return {
      success: false,
      error: result.error || result.detail || "段考卷產生失敗",
      status: response.status,
    };
  } catch (error) {
    console.error("generatePublicExamFromBank failed", error);
    return { success: false, error: "無法連線至段考卷產生服務", status: 0 };
  }
}

function getDownloadFilename(response, fallback) {
  const disposition = response.headers.get("content-disposition") || "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] || fallback;
}
