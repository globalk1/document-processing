import { ensureMixedWordExportStyles, mixedWordExportDialogHtml } from "./mixedWordExportDialog";
// The three UI choices use one export API with a mixed_version parameter.
export function chooseMixedWordExport(signal) {
  if (signal?.aborted) return Promise.resolve(null);
  ensureMixedWordExportStyles();
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "教用學用混合");
    dialog.className = "mixed-word-export-dialog";
    dialog.setAttribute("aria-labelledby", "mixed-export-dialog-title");
    dialog.innerHTML = mixedWordExportDialogHtml();
    let finished = false;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", abort);
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      dialog.remove();
      resolve(value);
    };
    const abort = () => finish(null);
    dialog.querySelectorAll("[data-mixed-version]").forEach((button) => {
      button.addEventListener("click", () => finish(button.dataset.mixedVersion));
    });
    dialog.querySelector("[data-mixed-close]").addEventListener("click", () => finish(null));
    dialog.addEventListener("cancel", () => finish(null));
    dialog.addEventListener("close", () => finish(null));
    signal?.addEventListener("abort", abort, { once: true });
    document.body.appendChild(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });
}
