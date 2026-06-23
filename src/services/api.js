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
    return { success: false, error: "解析請求失敗" };
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
