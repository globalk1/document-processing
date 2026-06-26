import { consumeDailyAiRequest } from "./dailyRequestQuota";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://sunnytseng.com/api"
    : "http://127.0.0.1:8000/api");
const DOCUMENT_PROCESSING_API_KEY = "huanyu-document-processing-colleague-key";

export const WORD_GENERATION_MAINTENANCE_NOTICE =
  "Teams 版面近期大幅調整，Word 模板建立 API 維護中；請先使用 Markdown 預覽內容，待維護完成後再產生 Word。";

export const isWordGenerationUnderMaintenance = () => true;

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

export async function extractPdfText({ file, mode }) {
  if (mode === "accurate") {
    const quota = consumeDailyAiRequest();
    if (!quota.allowed) {
      return {
        success: false,
        code: "daily_ai_request_limit",
        error: `今日 AI 請求已達 ${quota.limit} 次上限，請明天再試。`,
        status: 429,
      };
    }
  }

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
  const quota = consumeDailyAiRequest();
  if (!quota.allowed) {
    return {
      success: false,
      code: "daily_ai_request_limit",
      error: `今日 AI 請求已達 ${quota.limit} 次上限，請明天再試。`,
      status: 429,
    };
  }

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
        defaultTemplateId: result.default_template_id || "teams_conversion",
      };
    }

    return {
      success: false,
      error: getAuthError(response, result, "無法取得 Word 模板"),
      status: response.status,
    };
  } catch (error) {
    console.error("fetchWordTemplates failed", error);
    return { success: false, error: "Word 模板請求失敗", status: 0 };
  }
}

export async function parseWordDocument({ file, includeAssets = true }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("include_assets", includeAssets ? "true" : "false");

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
    return { success: false, error: "Word 解析請求失敗", status: 0 };
  }
}

export async function generateWordDocument({
  document,
  filename = "questions.docx",
  templateId = "teams_conversion",
}) {
  if (isWordGenerationUnderMaintenance()) {
    return {
      success: false,
      code: "word_generation_maintenance",
      error: WORD_GENERATION_MAINTENANCE_NOTICE,
      status: 503,
    };
  }

  const quota = consumeDailyAiRequest();
  if (!quota.allowed) {
    return {
      success: false,
      code: "daily_ai_request_limit",
      error: `今日 AI 請求已達 ${quota.limit} 次上限，請明天再試。`,
      status: 429,
    };
  }

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
    return { success: false, error: "Word 產生請求失敗", status: 0 };
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
