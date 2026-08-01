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

- 438 題：原創 1-1 的 62 題，加上第一章多來源原型 376 題。
- 71 個觀念：原創 16 個，加上原型 55 個。
- 38 個 lecture／題目 asset、1 個講義專案與 11 個 revision。

原型資料保留來源追溯、題目—觀念關聯和 image／Python asset variant。此目錄只提供資料庫層；
`document-processing` 的 Vue UI 要操作它，仍需要下一階段加入相容的 localhost API。
