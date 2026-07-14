const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://sunnytseng.com/api"
    : "http://127.0.0.1:8000/api");
const DOCUMENT_PROCESSING_API_KEY = "huanyu-document-processing-colleague-key";

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function getAuthError(response, result, fallback) {
  if (response.status === 401 || response.status === 403)
    return "後端尚未開通。";
  return result.error || result.detail || fallback;
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function fetchMathBankJson(path, params = {}, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.apiKey) headers["X-API-KEY"] = options.apiKey;

  const response = await fetch(`${API_URL}/math-bank${withQuery(path, params)}`, {
    headers,
  });
  const result = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      error: getAuthError(response, result, "題庫讀取失敗"),
      status: response.status,
      data: result,
    };
  }

  return { success: true, data: result };
}

async function postDocumentJson(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": DOCUMENT_PROCESSING_API_KEY,
    },
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

async function postMathBankJson(path, body, options = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (options.apiKey) headers["X-API-KEY"] = options.apiKey;

  const response = await fetch(`${API_URL}/math-bank${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const result = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      error: getAuthError(response, result, "題庫寫入失敗"),
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

  const response = await fetch(`${API_URL}/math-bank${path}`, {
    method: options.method || "POST",
    headers,
    body: JSON.stringify(body),
  });
  const result = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      error: getAuthError(response, result, "題庫寫入失敗"),
      status: response.status,
      data: result,
    };
  }

  return { success: true, data: result };
}

async function deleteMathBankJson(path, options = {}) {
  const headers = {};
  if (options.apiKey) headers["X-API-KEY"] = options.apiKey;

  const response = await fetch(`${API_URL}/math-bank${path}`, {
    method: "DELETE",
    headers,
  });

  if (response.status === 204) return { success: true, data: null };
  const result = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      error: getAuthError(response, result, "題庫刪除失敗"),
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
  defaultType = "calculation",
  defaultDifficulty = "A",
}) {
  const result = await postDocumentJson("/pdf/math-bank-json/", {
    text,
    grade_id: gradeId,
    unit_id: unitId,
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
      headers: { "X-API-KEY": DOCUMENT_PROCESSING_API_KEY },
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
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": DOCUMENT_PROCESSING_API_KEY,
      },
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

export async function removeHandwriting({
  file,
  colorMode = "exam_auto",
  outputFormat = "pdf",
  strength = 3,
  manualRegions = [],
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("color_mode", colorMode);
  formData.append("output_format", outputFormat);
  formData.append("strength", String(strength));
  if (manualRegions.length) {
    formData.append("manual_regions", JSON.stringify(manualRegions));
  }

  try {
    const response = await fetch(`${API_URL}/pdf/remove-handwriting/`, {
      method: "POST",
      headers: { "X-API-KEY": DOCUMENT_PROCESSING_API_KEY },
      body: formData,
    });
    const contentType = response.headers.get("content-type") || "";
    const isFile =
      contentType.includes("application/pdf") || contentType.startsWith("image/");

    if (response.ok && isFile) {
      const blob = await response.blob();
      return {
        success: true,
        blob,
        filename: getDownloadFilename(response, "cleaned-document.pdf"),
      };
    }

    const result = await parseJson(response);
    return {
      success: false,
      error: getAuthError(response, result, "筆跡去除失敗"),
      status: response.status,
    };
  } catch (error) {
    console.error("removeHandwriting failed", error);
    return { success: false, error: "無法連線至筆跡去除服務", status: 0 };
  }
}

export async function previewHandwriting({
  file,
  colorMode = "exam_auto",
  strength = 3,
  manualRegions = [],
  maxPages = 20,
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("color_mode", colorMode);
  formData.append("strength", String(strength));
  formData.append("max_pages", String(maxPages));
  if (manualRegions.length) {
    formData.append("manual_regions", JSON.stringify(manualRegions));
  }

  try {
    const response = await fetch(`${API_URL}/pdf/preview-handwriting/`, {
      method: "POST",
      headers: { "X-API-KEY": DOCUMENT_PROCESSING_API_KEY },
      body: formData,
    });
    const result = await parseJson(response);

    if (response.ok && result.success) {
      return { success: true, pages: result.pages || [] };
    }

    return {
      success: false,
      error: getAuthError(response, result, "筆跡預覽失敗"),
      status: response.status,
    };
  } catch (error) {
    console.error("previewHandwriting failed", error);
    return { success: false, error: "無法連線至筆跡預覽服務", status: 0 };
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
      headers: { "X-API-KEY": DOCUMENT_PROCESSING_API_KEY },
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
      headers: { "X-API-KEY": DOCUMENT_PROCESSING_API_KEY },
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
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": DOCUMENT_PROCESSING_API_KEY,
      },
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
