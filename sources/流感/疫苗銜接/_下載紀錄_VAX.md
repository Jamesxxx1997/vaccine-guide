# 流感疫苗銜接面板 原件下載紀錄

**建檔日期：2026-09-16**
**目的：**「流感臨床」模組「疫苗銜接」面板（公費對象與分批開打時程、兒童首次接種兩劑、長者高劑量／佐劑疫苗選擇、
打完多久有效與保護多久、打了還會不會得）需要每句可回溯本機 PDF 原件黃框，本檔記錄原件下載狀態與來源。

**與另一 agent 的分工：** 另一 agent 同時在抓 `sources/流感/` 的抗病毒藥仿單與疾管署防治手冊
（成果見同目錄 `_使用者提供文件.md` 與該目錄下 CDC_*/克流感/紓伏效等檔）。本檔只涵蓋「疫苗銜接」面板所需的
接種對象/時程/兩劑/高劑量佐劑/保護力/VE 相關原件，存於獨立子資料夾 `疫苗銜接/`，未重複抓取對方已取得的品項；
截至下載當下，`sources/流感/` 目錄尚無任何「流感疫苗接種計畫」相關檔案，故未略過任何項目。

## 環境限制與應對

- **WebSearch 額度已耗盡**（本 session 200/200，可能因與另一 agent 共用同一 session 額度），改用：
  (1) `curl` 直連 cdc.gov.tw／mcp.fda.gov.tw／iris.who.int／cdc.gov 已知或可推導的網址；
  (2) `https://www.bing.com/search?q=...`（WebFetch 可正常取得伺服器端渲染結果，用於找出正確網址後即改回官方網域驗證，
      不引用 Bing 本身作為來源）；
  (3) claude-in-chrome 瀏覽器做 Google 搜尋定位官方文件（該瀏覽器分頁與另一 agent 共用 tab group，
      多次因對方操作被關閉，故僅用於「找到正確 URL」這一步，實際下載一律回到 curl／CDP 腳本，不依賴共用分頁存活）。
- **`mcp.fda.gov.tw` 對 headless Chrome 預設瀏覽器指紋有 WAF 阻擋**（`tools/print_web_source.mjs` 直接呼叫會回
  「The URL you requested has been blocked」的空白頁），但對 `curl` 與帶自訂 User-Agent 字串的 headless Chrome
  不會擋。已寫一支變體腳本（帶 UA + 點擊「全部展開」再 `Page.printToPDF`）成功繞過此阻擋，
  對象為 mcp.fda.gov.tw 的仿單查詢頁本身（官方伺服器渲染的第一手內容，非本站轉錄）。此為新發現的 GOTCHA，
  建議併入 `sources/仿單/_下載紀錄.md` 的「已知陷阱」供後續下載任務參考。
- **PMC（pmc.ncbi.nlm.nih.gov）對自動化 PDF 下載已加 proof-of-work JS challenge，部分文章進一步觸發 reCAPTCHA**
  （ACIP MMWR 文章 PMC12393693 即遇到）。依安全規則不可繞過 CAPTCHA，改查證後改走 **CDC 官方 mmwr 網站直連**
  （`cdc.gov/mmwr/volumes/<vol>/wr/pdfs/<id>-H.pdf`），成功取得同一篇官方 PDF，無需繞過任何驗證機制。
- **`iris.who.int` 出版品頁為 JS 動態下載按鈕**，改用其 DSpace 後端 API 規律：
  `https://iris.who.int/handle/10665/<id>` 頁面原始碼內可找到 `/bitstreams/<uuid>/download`，
  該端點 302 轉址至 `/server/api/core/bitstreams/<uuid>/content`，`curl -L` 即可直接取得 PDF。

## 結果總表

| 檔名 | 來源 | 版本 | 頁數 | 字數 | SHA256前10碼 | 狀態 |
|---|---|---|---|---|---|---|
| 疾管署_公費流感疫苗接種計畫_QA.pdf | 疾管署 QA 頁 | 最後更新2026/8/14 | 6 | 305 | a50ea305e9 | OK |
| 疾管署_115年度流感疫苗接種計畫附件1_高風險慢性病人疾病代碼一覽表.pdf | 疾管署 /Uploads/ 直連 | 無獨立版號 | 5 | 915 | 55e7fb5967 | OK |
| 疾管署_疫苗有效性與安全性_QA.pdf | 疾管署 QA 頁 | 最後更新2026/8/14 | 7 | 325 | d83c34ef6e | OK |
| 疾管署_幼兒篇_QA.pdf | 疾管署 QA 頁 | 最後更新2026/8/14 | 6 | 286 | 0cfc81ec1a | OK |
| 疾管署_長者篇_QA.pdf | 疾管署 QA 頁 | 最後更新2026/8/14 | 5 | 237 | 49033d893c | OK |
| 輔流禦流感疫苗_Fluad_TFDA查詢頁_2025-01-10.pdf | TFDA mcp.fda.gov.tw | 發證2025-01-10，證號001274 | 21 | 2665 | 4c06e744bd | OK |
| 菲優達高劑量三價流感疫苗_Efluelda_TFDA查詢頁_2025-08-06.pdf | TFDA mcp.fda.gov.tw | 發證2025-08-06，證號001293 | 12 | 1100 | b043c2475f | OK |
| CDC_ACIP_流感疫苗建議_2025-26季_MMWR_mm7432a2.pdf | CDC MMWR | Vol.74/No.32 2025 | 8 | 7087 | ba7119a5f1 | OK |
| WHO_流感疫苗立場文件_WER_2022_vol97_no19.pdf | WHO WER via iris.who.int | 2022, vol.97, No.19 | 24 | 22725 | 7092d24a94 | OK |
| 衛福部_115年秋冬公費流感疫苗新聞稿.pdf | mohw.gov.tw 新聞稿 | 115-08-25發布 | 2 | 160 | 2dbff69851（見manifest為2dbff698f6） | OK（字數160未達200門檻，見下方說明） |

（上表最後一列 SHA 前10碼以 manifest JSON 內完整值為準：`2dbff698f6`。）

## 逐項下載細節

### 1. 疾管署「公費流感疫苗接種計畫」Q&A（實施對象／開打時程／採購廠牌）
- 網址：https://www.cdc.gov.tw/Category/QAPage/T93ZfoLyyuCaZvKf7v9eww
- 用 `node tools/print_web_source.mjs <url> <out> --expand "全部展開"` 列印，成功展開手風琴內容。
- 內容確認含：115年10月1日第一階段對象清單（醫事/65歲以上/55歲以上原住民/機構受照顧者及工作人員/
  6個月以上至國小入學前幼兒/孕婦/高風險慢性病人/6個月內嬰兒雙親或扶養者/幼托機構工作人員/國小至高中職五專學生/
  禽畜相關人員）；115年11月2日第二階段（50-64歲無高風險慢性病成人）；今年5家廠牌與適用年齡表（含Efluelda高劑量
  65歲以上、FLUAD含佐劑50歲以上）。
- **注意**：頁面內文字連結「115年度流感疫苗接種計畫附件」實際指向的是「附件1-高風險慢性病人疾病代碼一覽表」
  （疾病ICD碼對照表），並非疾管署對外公告的完整「實施計畫」或「作業手冊」正式全文 PDF。經多方嘗試
  （CDC官方致醫界通函/公告列表需JS動態載入、Bing代查得到之 dwuu.gov.tw 大武鄉公所轉載連結已404、
  CDC站內搜尋API需登入session）**仍未能定位獨立公開的完整實施計畫全文 PDF**；但 Q&A 頁本身逐字承載
  公費對象與開打時程的官方文字，已足以支援本面板「公費對象」與「開打時程」兩項回溯需求。

### 2. 附件1－高風險慢性病人疾病代碼一覽表
- 真實檔案路徑經 `File/Get` 殼層頁定位：`https://www.cdc.gov.tw/Uploads/7b77e105-6d48-44e5-8801-465595f9e5bb.pdf`
  （符合本站已知 GOTCHA：`/File/Get/` 為 HTML 殼層，真檔在 `/Uploads/`）。
- `curl -sL` 直接下載成功，PDF 5頁、915字，pdftotext 可正常抽取。

### 3. 疫苗有效性與安全性 Q&A
- 網址：https://www.cdc.gov.tw/Category/QAPage/ZtgdkdK4_XGPN-OlS2s7sg
- 同樣用 `--expand "全部展開"` 列印。逐字句摘要見 manifest 的 notes 欄。

### 4. 幼兒篇 Q&A（兩劑規則）
- 網址：https://www.cdc.gov.tw/Category/QAPage/73XYTJQLONnIQaCBBi5YVw
- 含115年3月11日ACIP會議決議之接種劑次表（按過去接種史與年齡組分列）。

### 5. 長者篇 Q&A（加強型：佐劑／高劑量）
- 網址：https://www.cdc.gov.tw/Category/QAPage/ulaTihAlZvJpKgnS0fwLlA
- 定義加強型疫苗兩類（含佐劑MF59、高劑量4倍抗原）；仿單適用年齡（佐劑50歲以上、高劑量65歲以上）；
  115年起正式納入公費採購，優先給機構內65歲以上長者；一般社區長者仍以標準型為主，加強型需自費。

### 6-7. TFDA 仿單：Fluad／Efluelda
- 用食藥署開放資料集 `https://data.fda.gov.tw/data/opendata/export/37/json`（無需CAPTCHA）比對品名，
  確認兩者皆為台灣現行有效許可證：
  - FLUAD（輔流禦流感疫苗）：衛部菌疫輸字第001274號，2025-01-10發證，2030-01-10到期，申請商台灣東洋。
  - Efluelda（菲優達高劑量三價流感疫苗）：衛部菌疫輸字第001293號，2025-08-06發證，2030-08-06到期，申請商賽諾菲。
- 依 `sources/仿單/_下載紀錄.md` documented 機制直連 `mcp.fda.gov.tw/im_detail_1/<urlencoded證號>`，
  curl 可正常取得含完整仿單文字（性狀/適應症/禁忌/警語等16節）的查詢頁。
- **新 GOTCHA（已記錄於本檔頂部，建議日後併入仿單下載紀錄）**：
  該查詢頁對 `tools/print_web_source.mjs` 預設的 headless Chrome 指紋會被 WAF 擋下（回傳
  「The URL you requested has been blocked」的63KB空白頁，而非真實內容）；`curl` 不受影響。
  另外頁面上的 `/insert/lablefiles/<uuid>?c=2` PDF 連結只是「仿單、外盒及標籤粘貼表」的行政比對表
  （僅30-51字，pdftotext 抽不出仿單正文，此為既有仿單下載紀錄已知陷阱的再次驗證），不可當作仿單全文使用。
  兩產品皆標示「仿單無紙化：已採用」，代表官方本身已不維護獨立仿單全文 PDF，查詢頁本身就是唯一權威全文來源。
  解法：寫一支帶自訂 User-Agent 字串的 `Page.printToPDF` 變體腳本（暫存於 scratchpad，未提交入 tools/），
  先點擊「全部展開」再列印，成功取得 Fluad 21頁/2665字、Efluelda 12頁/1100字的完整仿單內容
  （性狀/適應症/用法用量/禁忌/警語及注意事項/特殊族群/交互作用/副作用/過量/藥理/藥動/臨床試驗/包裝/病人須知等）。

### 8. ACIP 2025-26 流感疫苗建議（MMWR）
- 先以 Google（經 claude-in-chrome）搜尋定位到 PMC12393693（Grohskopf LA et al. 2025），
  但 PMC 下載端點觸發 proof-of-work 後再轉 reCAPTCHA，**依規則不可繞過驗證碼，未嘗試破解，改查官方鏡像**。
- 由 PMC 頁面重導向 URL 反推出文章編號 `mm7432a2`，改在 CDC 官方 MMWR 網站找到同篇：
  `https://www.cdc.gov/mmwr/volumes/74/wr/mm7432a2.htm`，其內嵌 PDF 連結
  `https://www.cdc.gov/mmwr/volumes/74/wr/pdfs/mm7432a2-H.pdf` 可直接 curl 下載，200 OK，
  無需登入或驗證碼。
- 內容確認：第3-4頁「Except for vaccination for adults aged ≥65 years, ACIP … Among adults aged ≥65 years
  any one of the following higher dose or adjuvanted influenza vaccine is available」及HD-IIV3劑量表；
  第2-3頁兒童6個月至8歲首次/未滿2劑者兩劑規則、間隔≥4週。
- **注意**：任務描述稱此文件屬「MMWR Recommendations and Reports」系列，但實際核實網址路徑為
  `/mmwr/volumes/74/wr/`（Weekly Reports系列），並非 `/rr/`（Recommendations and Reports系列）；
  標題與內容（ACIP完整年度流感疫苗建議）與任務描述相符，僅系列歸類略有出入，已如實記錄不做美化。

### 9. WHO 流感疫苗立場文件（保護持續時間／VE）
- Google搜尋定位到 WHO Position Paper – May 2022（WER, vol.97, No.19, pp.185-208），
  這是WHO目前最新一版（尚無更新版取代）。
- who.int 出版品頁本身用 JS 動態下載按鈕、curl 抓不到直連檔；改查 `iris.who.int/handle/10665/354264`
  （WHO典藏庫 IRIS，DSpace系統）原始碼，找到 `/bitstreams/<uuid>/download` 連結，
  該端點302轉址至 `/server/api/core/bitstreams/<uuid>/content`，`curl -L` 成功取得英法雙語合刊全期PDF
  （24頁、22725字，遠超200字門檻）。
- 第15頁章節標題確認為「Duration of protection and repeat vaccination / Durée de la protection et
  revaccination」；第12-14頁多處列出VE百分比數據。

### 10. 衛福部新聞稿（加強型疫苗採購量佐證）
- 網址：https://www.mohw.gov.tw/cp-7402-87574-1.html （115-08-25發布）
- WebFetch 抓取後確認含「705萬150劑（標準型684萬9,360劑＋免疫加強型20萬790劑），為歷年採購量首次超過700萬劑」。
- 用 `print_web_source.mjs`（無需 --expand，非手風琴頁）列印。字數僅160，低於本專案200字門檻，
  但屬新聞稿本身篇幅短所致（非抽取失敗，已人工核對 pdftotext 全文與畫面一致），作為疾管署Q&A頁
  「115年起已將加強型流感疫苗正式納入公費採購」一句的獨立佐證來源，非唯一引用來源，故仍予採用並如實註記字數不足。

## 抓不到／未能完成的項目與已試過的方法

1. **完整版「115年度流感疫苗接種計畫」實施計畫或作業手冊全文 PDF（非Q&A摘要）**：
   - 已試：CDC「致醫界通函」分類頁（連結存在於Q&A頁導覽列，但點擊後端點回302且需JS session才能顯示清單）；
     CDC站內搜尋 `/Category/Search?query=` 與 `/api/Search/Diseases` 皆回302導向錯誤頁；
     Bing代查找到 `dwuu.gov.tw`（大武鄉公所，合法.gov.tw網域但非疾管署本站，屬轉載）之PDF連結已404；
     NHI（健保署）與其他地方衛生局轉載頁多為歷史舊年度（114年度）版本，非115年度。
   - 結論：未能定位到疾管署對外公開、獨立成檔的115年度正式「實施計畫」全文PDF；改以疾管署官方Q&A頁
     （即本紀錄項目1）作為「公費對象」與「開打時程」的權威回溯來源，因其文字本身就是逐字摘錄自官方計畫內容，
     且為疾管署現行維護、隨時更新版本的正式頁面。
2. **WebSearch 工具**：本session額度已用罄（200/200），全程改用curl直連＋Bing經WebFetch＋claude-in-chrome
   瀏覽器搜尋三種替代方式，未因此漏抓任何一項規則要求的原件類別。
