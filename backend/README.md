# 疾管署搜尋 A/B：本機試用與公開部署

原本只供本機試用（Codex 2026-09 版）；2026-09-13 使用者決定三件事都做：每日快照改由本機（台灣 IP）同步、A 模式與 B 模式公開部署。
GitHub Pages 仍是靜態站，不會執行這個 Node 服務；公開後端另跑在 Cloud Run（台灣機房），前端只在正式站網域對它連線。

## 每日快照本機同步（第 1 條）

GitHub Actions 的美國主機抓 `od.cdc.gov.tw` 常逾時（2026-09-12 兩次失敗，網站保留 9/6 資料）。改在使用者的 Mac 每天 07:30 跑
`tools/local_sync_and_push.sh`：獨立 worktree（`~/.cache/vaccine-guide-sync`）→ `sync_travel_data.mjs` → `verify_current_travel.cjs` →
只有成功且有變動才 commit/push 到 main（CI 收到 push 會部署）；失敗不推、不覆蓋線上「上次成功」資料。log 在 `~/Library/Logs/vaccine-guide-sync.log`。
排程檔 `~/Library/LaunchAgents/com.jamesxxx1997.vaccine-guide-sync.plist` 由使用者自行安裝（`launchctl bootstrap gui/$(id -u) <plist>`）。

## 公開部署（第 2、3 條）：Cloud Run asia-east1

- 伺服器以 `PUBLIC=1` 啟動時：綁 `0.0.0.0:$PORT`、Origin 白名單來自 `ALLOWED_ORIGINS`（含 `https://jamesxxx1997.github.io`）、
  Host 白名單 `PUBLIC_HOSTS`（首次部署前留空＝接受任何 Host，拿到網址後填入再部署一次）、每 IP 每 10 分鐘 `RATE_LIMIT`（預設 60）次、
  並行上限 4、上游逾時 20 秒、工作階段 ≤100 個／15 分鐘，全部沿用。`/api/health` 回 `scope:"public"`。
- B 模式的工作階段不再依賴 Cookie（跨站 iframe 的第三方 Cookie 在 Safari 會被擋）：初始頁面注入 `window.__vaccineRelaySession`，
  `proxy-client.js` 以 `X-Relay-Session` 標頭送回；Cookie（公開模式 `SameSite=None; Secure`）只是備援。
- 現行服務（2026-09-13 部署）：`https://vaccine-cdc-relay-mf2uneq2fa-de.a.run.app`（GCP 專案 `vaccine-guide-relay`，asia-east1）；
  `travel-live.js` 的 `PUBLIC_SERVICE` 指向它。首次 `gcloud run deploy --source` 曾因自動建立 Artifact Registry 倉庫逾時而失敗，
  先手動 `gcloud artifacts repositories create cloud-run-source-deploy --repository-format=docker --location=asia-east1` 再部署即可。
- 部署：`PROJECT=<gcp-project-id> zsh backend/deploy_cloud_run.sh`（根目錄 `Dockerfile`、`.gcloudignore`；`gcloud run deploy --source .`）。
  部署後把 `travel-live.js` 的 `PUBLIC_SERVICE` 填成服務網址、跑 `npm test`、commit/push；再以 `HOSTS=<主機名>` 重跑一次收緊 Host 檢查。
- 費用：Cloud Run 免費額度每月 200 萬次請求、`min-instances 0`（閒置不計費；冷啟動約 2–4 秒，前端會提示「可能正在喚醒」）。
- 授權提醒（沿用下方安全與範圍）：B 模式是把疾管署旅遊搜尋頁轉送到自己的 origin，**不是官方授權嵌入**；頁面保留非官方轉送提示與版權文字。
  使用者已知悉並決定公開；若疾管署要求停止，關掉 Cloud Run 服務即可，前端會自動退回每日快照。

以下為原本機試用說明。

## 啟動與使用

專案根目錄執行 `npm ci`（包含既有 jsdom 測試／解析依賴），再執行 `npm run start:travel`。原本的 `python3 tools/serve.py 8899` 疫苗介面需同時運行。

開啟 `http://localhost:8899/index.html` → 成人時程 → 旅遊目的地／疫苗查詢：

- 每日快照：維持既有可查證資料與實際同步狀態。每日排程是否成功仍以狀態提示為準。
- A · 即時代查：每次正常取得官方匿名搜尋表單及權杖，再 POST 查詢，解析官方疾病、地區、等級、發布日期與連結。只傳送搜尋字詞，不傳送臨床勾選或年齡。可開啟既有疫苗說明與 PDF 高亮。
- B · 官方畫面代理：保留完整旅遊搜尋頁的畫面、搜尋及前端換頁。匿名 Cookie 僅保留於服務記憶體，瀏覽器只持有本機短效識別碼。其他官方文章／國家詳細資料另開官網，**不是整個 CDC 網站的全面代理**。保留來源與版權文字，附非官方轉送提示。

不要用 `file://` 或直接點 CSV 進入即時模式。A/B 僅在上述本機 HTTP 位址可用；正式 GitHub 頁面明示尚未配置常駐後端，不會靜默改用快照冒充即時資料。服務或電腦停止後，試用即停止。

## 安全與範圍

- 只監聽 `127.0.0.1:8901`；校驗 Host、Origin，拒絕任意上游 URL、額外臨床欄位、重複表單欄位與任意 POST。不是可轉送任意站點的開放代理。
- 只連 `https://www.cdc.gov.tw` 的固定搜尋頁、正常搜尋結果端點和必要靜態資源；不轉送使用者的官方登入 Cookie，不繞過登入、CAPTCHA 或 TLS 驗證。
- iframe 位於不同 port 的獨立 origin，限制 top navigation、其他 iframe、非搜尋表單及第三方腳本；只允許本站本機 origin 嵌入。本機 HTTP 僅供 loopback，不能原樣公開暴露。
- A 模式對來源結構變更採失敗提示。未知欄位、HTTP 失敗與無法解析，不會顯示為無疫情。新查詢與模式切換會清除前次結果、疫苗說明及過期請求。
- B 模式將官方頁面轉送到自己的試用 origin 並使用自己的限制設定，**不是疾管署原站放寬 iframe 限制或官方授權嵌入**。尚未取得整站轉送的個別授權；公開部署前需確認授權範圍、營運條件、限流、雲端連線與 Cookie 行為。
- 對官網進行「當下查詢」不等於公告今天發布，也不等於疫苗說明及 PDF 是即時更新。結果到疫苗只作相關閱讀，不自動判定個人施打適應症。

## 計時口徑

A 記錄送出至收到並解析 JSON，含該次取得官方匿名表單。B 分開記錄頁面 load、搜尋回應到 DOM 更新，以及首次 navigation 至首筆結果。B 再次按框內搜尋會沿用已載入畫面與匿名工作階段。靜態資源可快取；疫情搜尋結果不快取。

本機速度不代表雲端或其他網路，不能將 B 的單次 AJAX 時間與 A 的完整首次流程當作同口徑比較。測試筆數少，不推定穩定平均或保證秒數。

## 驗證

`npm test` 包含既有 PDF／CSV／旅遊資料回歸，以及 `tools/test_cdc_relay.mjs`、`tools/test_travel_live.cjs`。單元測試使用合成官方結構，與真瀏覽器的網路實測分開記錄。
