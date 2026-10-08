# 寰宇教育文書處理

Vue + Vite 版本的 PDF / 圖片解析與 AI 詳解介面。
右上角月亮／太陽圖示可切換日間與深夜模式，記住瀏覽器內的選擇；尚未設定時跟隨系統色彩偏好。深夜模式使用中性深灰色，涵蓋題庫、編輯預覽、PDF、試卷擦除與 OCR，原始圖片與匯出內容不變。

## 開發

```bash
npm install
npm run dev
```

如需切換 API，建立 `.env.local`：

```bash
VITE_API_URL=<api-base-url>
```

## GitHub Pages

此專案使用相對路徑輸出，`npm run build` 後的 `dist/` 可放在 GitHub Pages 專案頁面或子路徑。

「題庫挑題」由後端決定可用題目；國小、國中及高中段考卷由後端產生 `.docx`。
挑題列表可按狀態（全部、草稿、公開、封存）、年級、單元、難度與來源篩選；來源選項取自題庫的啟用來源，並由後端搜尋套用。
草稿與挑題列表每次載入 20 題，捲動至列表底部才自動載入下一批。
更換搜尋或篩選條件會重新載入第一批，草稿列表使用左側列表本身的捲動位置。
從題庫挑題開啟編輯後，可按「取消」放棄未儲存變更，回到原本題庫科目、篩選條件、已載入列表與捲動位置。
每張挑題卡片顯示縮短的 UUID 與複製圖示；點擊圖示複製完整 UUID，在該圖示右側顯示短暫小提示。
題目卡片單擊開啟放大預覽，雙擊直接編輯；預覽支援題目、答案、詳解及各位置圖片，再點一下預覽內容或背景即可關閉，也可按 Esc、Enter 或關閉按鈕。難度選單固定向下展開，依「未分類、C、B、A、S」排列；新增與篩選預設未分類，篩選仍可選全部難度，編輯既有題目則保留原難度。
新增／編輯草稿的每張圖片可指定「題目、答案、詳解」，預覽及儲存皆依圖片位置處理；上傳、拖曳、貼上與 Python 圖片共用此設定。
詳解預覽維持固定高度，標題保留在上方，長文字與圖片可在內文區獨立捲動，不會撐長整頁。
開放網站的輸出請求使用 `/api/word/public-exams/generate-from-bank/`，支援
檔名、標題、範圍及教師／學生版。

## 試卷擦除

「試卷擦除」分頁可直接使用，不需要帳號密碼，連接同一個 `VITE_API_URL` 後端。
支援選擇、拖拉或貼上 PDF／圖片（最多 30 MB、80 頁），先載入原稿，按「AI 清除」套用強度 1–5。
調整強度後須再次按「AI 清除」才會重新辨識。

可切換原圖、遮罩及清理預覽，連續框選清除／恢復，或加入覆蓋圖片。
覆蓋圖片可指定頁碼、拖曳移動、拉四角縮放、方向鍵微調及刪除；支援 PNG／JPEG／WebP。
框選修復使用原稿區塊建立 AI 圖片修復工作，可填寫需求，完成後覆蓋原位置。
AI 圖片修復使用後端的 OpenAI API 額度，請檢查文字與圖形。

主預覽可放大至 300%；點選頁面或「放大編輯」開啟單頁編輯，支援 25–300% 縮放。
主頁與放大頁共用框選、圖片及復原紀錄。⌘／Ctrl + Z 復原、Esc 取消草稿（放大頁中為關閉）、Delete 刪除選中圖片。
按「確認結果」後即可匯出 PDF；後續編輯須重新確認。

手動編輯在瀏覽器即時呈現。PDF 自動清除與匯出逐頁上傳，最後在瀏覽器依原頁序合併並嵌入覆蓋圖片。
支援處理進度、取消及預覽重試；換檔會取消舊請求。
後端需提供 `/api/pdf/public-handwriting/preview/`、`/api/pdf/public-handwriting/remove/`、`/api/pdf/public-handwriting/image-repair/jobs/`。
這些公開端點已加入共用 `my-web/api-backend`，上線時須同步更新後端。

## 免費文字解析（4 GB OCR 主機）

「文字解析」分頁免登入，提供 `local_ocr` 逐字文字與 `local_ocr_latex` 數學文字兩種模式。
支援選檔、拖拉、貼上 PDF／圖片（最多 32 MB、80 頁）、排隊資訊、逐頁文字與進度、停止工作、
重新整理後恢復查詢、結果編輯、複製及 TXT／Markdown 下載。

透過既有後端排隊，再由目前的 4 GB DigitalOcean OCR worker 領取，不呼叫 OpenAI。
瀏覽器不需要帳密或 worker 金鑰，也不直接連接 OCR 主機。
公開 API 只允許上述兩種 OCR 模式，不提供所有使用者的工作清單。

- `POST /api/pdf/public-ocr/jobs/`：multipart `file`、`mode`、UUID 格式的 `client_request_id`，回傳 `job.id`。
- `GET /api/pdf/public-ocr/jobs/<job_id>/`：進度、逐頁 `text` 及 `diagnostics`。
- `POST /api/pdf/public-ocr/jobs/<job_id>/cancel/`：停止已知工作。
- `POST /api/pdf/public-ocr/jobs/cancel/`：JSON `client_request_id`，即使上傳尚未回覆也可確認停止。

需同步發布新增公開 API 的 `api-backend`，並沿用既有遠端 OCR 環境設定。
worker 的領件／回報協定及辨識模式不變，本次不需要更新 4 GB 主機上的辨識程式。
數學式、答案對應、手寫及表格請對照原稿人工核對。

## 驗證

```bash
npm test
npm run build
```
