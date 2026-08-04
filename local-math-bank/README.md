# Local Math Bank snapshot

Current snapshot: 502 questions, 72 concepts, 2 lecture projects, 29 lecture revisions, and 66 shared lecture assets. It contains the local CH1-1 and CH1-2 Global Handout data needed by the sandbox workflow; it does not replace the parent application's Vue UI or API.

這個目錄是 `YeeHong` 分支的可攜 MySQL 題庫快照。它不會修改 `main`，也不會直接讓 Vue
前端連線到資料庫；後續應由 localhost API／正式後端使用同一份 schema 與資料契約。

## 建立本機資料庫

```powershell
Copy-Item .env.mysql.example .env.mysql
npm install
npm run db:up
npm run db:seed
npm run db:check
```

資料庫只綁定 `127.0.0.1:3308`，與本地題庫沙盒的 3307 分開。`.env.mysql` 和 Docker volume
不可提交。`db:seed` 會清空這個容器的資料庫後，由 JSON 快照完整重建。

## 快照內容

- 502 題、72 個觀念。
- 66 個 shared lecture asset、2 個講義專案與 29 個 revision。
- 包含 CH1-1／CH1-2 的可重建本機題庫資料、題目—觀念關聯、來源追溯及 image／Python asset variant。

以 `npm run db:check` 的固定數量檢查作為此分支的快照驗收。此目錄只提供資料庫層；
`document-processing` 的 Vue UI 要操作它，仍需要相容的 localhost API。

## 與本地題庫沙盒的同步範圍

`YeeHong` 是資料快照下游分支，不是本地題庫沙盒的鏡像。只同步本目錄既有的 seed、seed
檢查與本 README；不直接同步沙盒的 Vue、mock-server、Word renderer、講義草稿 UI 或其他工具。
若未來要擴大範圍，須先定義相容 API 與責任邊界。
