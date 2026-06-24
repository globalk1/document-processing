export const APP_VERSION = "1.0.1";

const STORAGE_KEY = "huanyu-document-processing-seen-version";
const SWEETALERT_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11.26.24/dist/sweetalert2.all.min.js";
const SWEETALERT_STYLE_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11.26.24/dist/sweetalert2.min.css";

const RELEASE_NOTES = [
  "PDF 最多 20 頁，避免產生過高的 AI 使用費。",
  "每日最多 70 次 AI 請求，畫面會顯示剩餘額度。",
  "數學 LaTeX 文字改為原樣顯示，不再改寫指數與公式。",
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
