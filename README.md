# 寰宇教育文書處理

Vue + Vite 版本的 PDF / 圖片解析與 AI 詳解介面。

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
挑題列表可按年級、單元、難度與來源篩選；來源選項取自題庫的啟用來源，並由後端搜尋套用。
開放網站的輸出請求使用 `/api/word/public-exams/generate-from-bank/`，支援
檔名、標題、範圍及教師／學生版。
