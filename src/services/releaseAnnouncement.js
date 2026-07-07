export const APP_VERSION = "1.3.0";

const STORAGE_KEY = "huanyu-document-processing-seen-version";
const SWEETALERT_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11.26.24/dist/sweetalert2.all.min.js";
const SWEETALERT_STYLE_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11.26.24/dist/sweetalert2.min.css";

const RELEASE_NOTES = [
  "保留圖片 / PDF 轉文字流程，可下載 TXT 與 Markdown。",
  "新增轉成題目格式 JSON，會先檢查文字是否能切成題目。",
  "API 串接頁支援入題與下載題目，提供 macOS 與 Windows 指令。",
  "年級與單元改為動態讀取，選擇後自動帶入 UUID，不需要手動填寫。",
  "題庫挑題可篩選、勾選、下載選題 JSON，講義與考卷按鈕先保留入口。",
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
