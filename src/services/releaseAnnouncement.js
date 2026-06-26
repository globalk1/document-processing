export const APP_VERSION = "1.1.2";

const STORAGE_KEY = "huanyu-document-processing-seen-version";
const SWEETALERT_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11.26.24/dist/sweetalert2.all.min.js";
const SWEETALERT_STYLE_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11.26.24/dist/sweetalert2.min.css";

const RELEASE_NOTES = [
  "新增 Word 模板排版模式，可選 Teams 轉換或國中數學講義模板。",
  "Word 模板排版下載也會計入每日 AI 請求次數。",
  "Word 解析結果改以 Markdown 顯示，不再顯示 JSON。",
  "Markdown 預覽支援 KaTeX 顯示數字與數學式，且預覽區改為固定高度捲動。",
  "移除錯字檢查模式，保留 PDF / OCR 解析與 AI 寫詳解流程。",
];

let sweetAlertPromise;

function hasSeenCurrentVersion() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === APP_VERSION;
  } catch {
    return false;
  }
}

function markCurrentVersionAsSeen() {
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
        ${RELEASE_NOTES.map((note) => `<li>${note}</li>`).join("")}
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
