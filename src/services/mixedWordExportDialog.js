const fileIcon = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>';
const hiddenIcon = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h2M14 16l4 4m0-4-4 4"/>';
const pairIcon = '<path d="M9 4V2H3v15h3M9 5h8l4 4v13H9Z"/><path d="M17 5v4h4M12 14h6M12 18h4"/>';
const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const mixedWordExportDialogHtml = () => `
  <header class="mixed-export-header"><span class="mixed-export-eyebrow">WORD 匯出</span><h2 id="mixed-export-dialog-title">教用學用混合</h2><p>選擇下載版本，兩種版本皆不含詳解。</p></header>
  <div class="mixed-export-options" data-choices role="group" aria-label="選擇下載版本">
    ${[["teacher", "教用", "顯示簡答", "1 份 Word", fileIcon], ["student", "學用", "隱藏簡答", "1 份 Word", hiddenIcon], ["both", "兩份", "教用＋學用", "2 份 Word · ZIP", pairIcon]].map(([value, title, description, format, icon]) => `<button type="button" class="mixed-export-option" data-mixed-version="${value}" aria-label="${title}" aria-describedby="mixed-desc-${value} mixed-format-${value}"><span class="mixed-export-icon">${svg(icon)}</span><span class="mixed-export-option-title">${title}</span><span class="mixed-export-description" id="mixed-desc-${value}">${description}</span><span class="mixed-export-format" id="mixed-format-${value}">${format}</span></button>`).join("")}
  </div>
  <footer class="mixed-export-footer">學用的簡答會保留，可在 Word 中取消隱藏。</footer>
  <button type="button" class="mixed-export-close" data-mixed-close aria-label="關閉">${svg('<path d="m6 6 12 12M18 6 6 18"/>')}</button>`;

export function ensureMixedWordExportStyles() {
  if (document.getElementById("mixed-word-export-styles")) return;
  const style = document.createElement("style");
  style.id = "mixed-word-export-styles";
  style.textContent = `
    .mixed-word-export-dialog { --mw-bg:var(--app-surface,#fff); --mw-text:var(--app-surface-text,#17202e); --mw-muted:var(--app-muted-text,#64748b); --mw-line:var(--app-border,#dce2e9); --mw-card:var(--app-input-bg,#fff); --mw-soft:#f2f5f9; --mw-accent:#385b9c; box-sizing:border-box; position:relative; width:min(580px,calc(100vw - 32px)); max-width:calc(100vw - 32px); padding:28px!important; border:1px solid var(--mw-line); border-radius:16px; background:var(--mw-bg)!important; color:var(--mw-text); box-shadow:0 22px 70px #11182726; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; text-align:left; }
    .mixed-word-export-dialog * { box-sizing:border-box; }
    .mixed-word-export-dialog .swal2-html-container { margin:0!important; padding:0!important; text-align:left!important; color:inherit; font:inherit; overflow:visible; }
    .mixed-export-header { padding-right:28px; }
    .mixed-export-eyebrow { display:block; color:var(--mw-muted); font-size:11px; letter-spacing:.12em; font-weight:700; margin-bottom:8px; }
    .mixed-export-header h2 { margin:0; padding:0; font-size:23px; line-height:1.35; font-weight:750; color:var(--mw-text); }
    .mixed-export-header p { margin:9px 0 22px; color:var(--mw-muted); font-size:14px; }
    .mixed-export-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .mixed-export-option { appearance:none; display:flex; flex-direction:column; align-items:flex-start; min-width:0; padding:17px 14px 14px; border:1px solid var(--mw-line); border-radius:11px; background:var(--mw-card); color:var(--mw-text); font:inherit; cursor:pointer; text-align:left; transition:border-color .15s,box-shadow .15s,transform .15s; }
    .mixed-export-option:hover { border-color:var(--mw-accent); box-shadow:0 4px 14px #33415512; transform:translateY(-2px); }
    .mixed-export-option:focus-visible,.mixed-export-close:focus-visible { outline:2px solid var(--mw-accent); outline-offset:3px; }
    .mixed-export-icon { display:grid; place-items:center; width:37px; height:37px; margin-bottom:13px; border-radius:9px; background:var(--mw-soft); color:var(--mw-accent); }
    .mixed-export-icon svg { width:21px; height:21px; }
    .mixed-export-option-title { font-size:17px; font-weight:750; line-height:1.4; }
    .mixed-export-description { margin-top:3px; color:var(--mw-muted); font-size:13px; white-space:nowrap; }
    .mixed-export-format { display:block; margin-top:17px; padding-top:10px; width:100%; border-top:1px solid var(--mw-line); color:var(--mw-muted); font-size:11px; white-space:nowrap; }
    .mixed-export-footer { margin-top:20px; padding-top:16px; border-top:1px solid var(--mw-line); color:var(--mw-muted); font-size:12px; }
    .mixed-export-close { position:absolute; top:18px; right:18px; display:grid; place-items:center; width:30px; height:30px; padding:6px; border:0; border-radius:7px; background:transparent; color:var(--mw-muted); cursor:pointer; }
    .mixed-export-close:hover { background:var(--mw-soft); color:var(--mw-text); }
    .mixed-export-close svg { width:18px; height:18px; }
    dialog.mixed-word-export-dialog { position:fixed; inset:0; margin:auto; height:fit-content; max-height:calc(100dvh - 32px); overflow:auto; }
    dialog.mixed-word-export-dialog::backdrop { background:#11182766; }
    body[data-auth-theme="night"] .mixed-word-export-dialog,html[data-theme="night"] .mixed-word-export-dialog,html[data-theme="dark"] .mixed-word-export-dialog,body[data-theme="dark"] .mixed-word-export-dialog,.mixed-word-export-dialog[data-theme="dark"] { --mw-bg:#1d242e; --mw-text:#edf1f7; --mw-muted:#a8b3c4; --mw-line:#3b4655; --mw-card:#252e3a; --mw-soft:#303e51; --mw-accent:#a5c5ff; }
    @media(max-width:520px) { .mixed-word-export-dialog { padding:22px!important; } .mixed-export-options { grid-template-columns:1fr; gap:9px; } .mixed-export-option { display:grid; grid-template-columns:38px minmax(0,1fr) auto; column-gap:12px; align-items:center; padding:13px; } .mixed-export-icon { grid-column:1; grid-row:1 / 3; margin:0; } .mixed-export-option-title { grid-column:2; } .mixed-export-description { grid-column:2; margin:1px 0 0; } .mixed-export-format { grid-column:3; grid-row:1 / 3; border:0; margin:0; padding:0; width:auto; font-size:10px; } .mixed-export-header h2 { font-size:21px; } .mixed-export-header p { margin-bottom:18px; font-size:13px; } }
    @media(prefers-reduced-motion:reduce) { .mixed-export-option { transition:none; } }
  `;
  document.head.appendChild(style);
}
