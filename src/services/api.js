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
