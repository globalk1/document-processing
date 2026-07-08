export const APP_VERSION = "1.4.2";

const STORAGE_KEY = "huanyu-document-processing-seen-version";
const SWEETALERT_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11.26.24/dist/sweetalert2.all.min.js";
const SWEETALERT_STYLE_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11.26.24/dist/sweetalert2.min.css";

const RELEASE_NOTES = [
  "新版入口調整為筆跡去除、圖片 / PDF 轉文字、Word 套版＋入資料庫、題庫挑題、API 串接。",
  "筆跡去除新增手動框選消除與還原，可先預覽再下載處理後檔案。",
  "圖片 / PDF 轉文字改用 OCR 解析，保留下載 TXT、Markdown 與轉題目 JSON。",
  "Word 套版支援匯入題目 JSON 或 Word，編輯後可下載新版 JSON 並產生套版 Word。",
  "Word 套版與入資料庫區塊改得更明確，每題可切換預覽、編輯或直接刪除。",
  "入資料庫改為整份批次送出，後端會用 Gmail 寄一封 Staff API 摘要通知。",
];

let sweetAlertPromise;

function hasBrowserRuntime() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hasSeenCurrentVersion() {
  if (!hasBrowserRuntime()) return true;

  try {
    return window.localStorage.getItem(STORAGE_KEY) === APP_VERSION;
  } catch {
    return false;
  }
}

function markCurrentVersionAsSeen() {
  if (!hasBrowserRuntime()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, APP_VERSION);
  } catch {
    // Restricted browsers may not allow localStorage.
  }
}

function loadStyle() {
  if (document.querySelector(`link[href="${SWEETALERT_STYLE_URL}"]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = SWEETALERT_STYLE_URL;
  document.head.appendChild(link);
}

function loadSweetAlert() {
  if (!hasBrowserRuntime()) return Promise.resolve(null);
  if (window.Swal) return Promise.resolve(window.Swal);
  if (sweetAlertPromise) return sweetAlertPromise;

  loadStyle();
  sweetAlertPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${SWEETALERT_SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Swal), {
        once: true,
      });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SWEETALERT_SCRIPT_URL;
    script.onload = () => resolve(window.Swal);
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return sweetAlertPromise;
}

function releaseNotesHtml() {
  return `
    <div style="text-align:left; line-height:1.75;">
      <p style="margin:0 0 8px;">這次更新內容：</p>
      <ul style="margin:0; padding-left:22px;">
        ${RELEASE_NOTES.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </div>
  `;
}

export async function showReleaseAnnouncementIfNeeded() {
  if (hasSeenCurrentVersion()) return;

  try {
    const Swal = await loadSweetAlert();
    if (!Swal) return;

    await Swal.fire({
      icon: "info",
      title: `版本更新 v${APP_VERSION}`,
      html: releaseNotesHtml(),
      confirmButtonText: "知道了",
      confirmButtonColor: "#242424",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: markCurrentVersionAsSeen,
    });
  } catch (error) {
    console.error("Unable to show release announcement:", error);
  }
}
