# 家醫科疫苗接種速查

本機靜態疫苗速查工具，整合衛福部疾管署現行接種指引與 TFDA 中文仿單。
**主資料擷取日：2026-08-07；補充分類查核：2026-09-05。** 本頁不是即時政策資料庫。

## 開啟方式

線上使用：[家醫科疫苗接種速查](https://jamesxxx1997.github.io/vaccine-guide/)。
由 GitHub Actions 驗證、同步資料，再把明確允許的靜態檔案發布至 GitHub Pages；不發布交接文件、開發依賴或私密設定。
網站程式推送、手動執行工作流程及每日排程均可重新發布，無需在電腦上啟動服務。

雙擊 `index.html` 可離線使用；請保留整個資料夾（含 `review/`、`sources/`、
`reference-ui.js`、`reference-ui.css`、`reference-geometry.js`、`reference-scopes.js`、`reference-tables.js`），不要只單獨複製 HTML。
建議使用下方本機網址，完整 PDF 的頁碼跳轉會較可靠。

若要用瀏覽器自動化測試（Chrome 擴充功能打不開 `file://`）：

```bash
cd ~/vaccine-guide && python3 tools/serve.py 8899
# 然後開 http://localhost:8899/index.html
```

## 內容

七個分頁：

| 分頁 | 內容 |
|---|---|
| 接種前篩檢 | 輸入年齡＋勾選病人狀況 → **20 支疫苗**各給 ⛔禁忌／⚠️需評估／✓無觸發，每條附來源版本與**原文欄位** |
| 兒童時程 | **接種進度推算器**（輸入出生日期或月齡 → 依時程應已完成／剛到期／尚未到期）＋114 年 1 月版時程表＋輪狀病毒 2027 公費預告 |
| 成人時程 | 每支疫苗一張**可展開卡片**（抗體判讀已併入 B 肝與 MMR）＋**風險族群評估**（IPD 高風險、性行為風險、年齡、原住民身分 → 自動列出建議疫苗）＋**旅遊目的地查詢** |
| 間隔規則 | 兩劑疫苗間隔檢查器＋**活性減毒／不活化分類折疊表**＋間隔通則＋血液製劑間隔＋最小年齡表＋4 天寬限期 |
| 禁忌總表 | 依原文兩欄呈現；自費疫苗標「仿單」並附許可證字號 |
| 補種 | **補種劑次計算器**（選疫苗＋已完成劑次＋最近 1 劑年齡／JE 路徑 → 補幾劑、什麼間隔）＋間隔符號對照＋原文備註 |
| 來源與版本 | 來源代碼與版本對照表，文件名連官方來源、版本號連本機存檔 |

所有來源標註都是**可點選的超連結**：文件名 → 疾管署／TFDA 官方原始檔，版本號 → 本機存檔。

## 為什麼每條規則都標「列於原文『接種禁忌』欄／『注意事項』欄」

疾管署《各項常規疫苗接種禁忌與注意事項》是三欄式表格：**疫苗｜接種禁忌｜注意事項**。
兩欄的臨床意義完全不同，把注意事項當成禁忌會讓病人白白不能打疫苗。

而且**同一個條件在不同疫苗可能落在不同欄**——例如「出生未滿 6 週」在五合一是**禁忌欄**，
在 PCV 卻是**注意事項欄**。本工具標出每條規則的原文欄位，讓使用者不必相信整理者的分類。

## 資料來源

| 代碼 | 文件 | 版本 |
|---|---|---|
| S1 | 各項常規疫苗接種禁忌與注意事項 | 112.09（最舊，且只含公費常規疫苗） |
| S2 | 各項預防接種間隔時間一覽表 | 115.05 |
| S3 | 各項常規疫苗最小接種年齡與最短接種間隔 | 114.4 |
| S4 | 成人預防接種建議時程表 | 115 年 5 月 |
| S5 | 我國現行兒童預防接種時程 | 114 年 1 月 |
| S6 | B 肝表面抗體陰性者之建議措施（ACIP） | — |
| S7 / S8 | 補種相關指引 | — |
| S9 | TFDA 中文仿單（6 支自費疫苗，逐張許可證驗證） | 擷取 2026-08-07 |
| S10 | 衛福部新聞稿：輪狀病毒納入公費 | 建檔 115-06-30 |
| S11 | 疾管署狂犬病 Q&A | 更新 2018-07-27 |
| S12 | COVID-19 疫苗接種須知（莫德納 XFG／Novavax XFG） | 2026-07-07 |

原始來源存於 `sources/`；純文字版在 `sources/_text/`；TFDA 仿單摘錄在 `sources/仿單/_TFDA仿單摘錄.md`。
S12N 為 Novavax 須知；S13–S17 為新增 FDA／EMA／CDC 官方 PDF，S18–S19 為 CDC 官方網頁。
國際文件僅補充分類與證據差異，不自動取代台灣適應症或接種政策。詳見 [補充分類查核紀錄](review/classification_review.md)。

2026-09-06 新增 [旅遊疫苗官方 PDF 資料庫](sources/旅遊疫苗/2026-09-06/README.md)：28 份新 PDF 加 6 份既有來源，共 34 份、653 頁，涵蓋常見旅遊、常規免疫檢視及特殊暴露主題。
其中已整理 16 組疫苗／預防用藥導覽、38 段來源片段及 31 頁真實 PDF 預覽，接入 hover 高亮及點字側欄。這不表示整個資料庫均已逐句核對，也不會自動新增臨床禁忌判斷規則。

## 使用時務必留意

- **S1 為 112.09 版（2023-09）**，是核心文件中最舊的一份，且**只涵蓋公費常規疫苗**。
- **COVID-19 已收錄**（依疾管署 2026-07-07 莫德納 XFG／Novavax XFG 接種須知，S12）。Mpox、狂犬病、黃熱病的禁忌症仍**未納入前台判斷規則**；旅遊疫苗資料庫已有相關 PDF，使用時仍需核對原文。
- 疾管署部分疫苗衛教頁「最後更新」停在 2013–2019 年，政策異動改以**醫界通函**公告。
- **HPV 公費政策主管機關是國民健康署**（hpa.gov.tw），不是疾管署。
- **已知兩份官方文件不一致**：Abrysvo 孕婦接種週數，疾管署為 28–36 週、仿單為 24–36 週。本工具兩者並陳。
- 公費身分與年度接種計畫每年調整，本頁所載為擷取當日狀態。

## 工具

### `fetch_sources.sh` — 疾管署文件下載器

cdc.gov.tw 的 `/File/Get/<id>` 是 HTML 殼層，真檔在 `/Uploads/files/<uuid>.pdf` 或
`/Uploads/<uuid>.pdf`（兩種路徑都有，檔名可能是中文）。

```bash
./fetch_sources.sh list "<分類頁網址>"                    # 列出該頁所有可下載檔案
./fetch_sources.sh grab "<File/Get網址>" <子目錄> <檔名>   # 下載單一檔案
```

下載紀錄在 `sources/_download_log.tsv`。

### 旅遊搜尋、每日同步與原始資料核對

```bash
node tools/sync_travel_data.mjs     # 完整驗證兩份官方資料後，更新現行資料包
node tools/verify_current_travel.cjs # 逐筆核對來源雜湊、原始字串及摘要身分
python3 update_travel.py            # 相容入口：呼叫上方同步器
python3 update_travel.py --offline  # 僅重現舊 2026-08-07 存檔；不取代現行資料包
```

資料來自疾管署**開放資料**（非爬網頁）：

| 資料集 | 網址 | 更新頻率 |
|---|---|---|
| 國際旅遊疫情建議等級（完整 CSV，含歷史／解除） | `https://www.cdc.gov.tw/CountryEpidLevel/ExportCSV?fileName=TCDCTravelAlertAll.csv&type=0` | 每日 |
| 國際旅遊處方箋 | `https://od.cdc.gov.tw/quarantine/TMPrescription.csv` | 每月 |

在「成人時程 → 旅遊目的地」輸入中文／英文國名、疾病或處方箋項目，按 Enter／搜尋；選擇目的地後，可查看警示原始 CSV、開啟疫苗說明及 PDF 原句。没有警示紀錄不等於没有風險，處方箋列出的項目也不等於入境強制接種。

**正式 GitHub Pages 的每日快照不是查詢當下向疾管署取回結果。** 疾管署頁面設定 `frame-ancestors`／`X-Frame-Options` 限制外站直接嵌入，資料也未允許本站瀏覽器跨來源讀取。現有 GitHub Actions 設定每日台灣時間 08:23 同步，再發布可搜尋資料；排程及上游連線可能失敗，因此畫面顯示實際成功／失敗時間，不能只因有排程就宣稱已成功每日更新。每份資料另標官方更新頻率、回應的 Last-Modified（若有）及公告生效日期，三者不混用。

新增 **A 即時代查／B 官方畫面代理的本機比較試用**，正常匿名搜尋，不改官方伺服器設定。兩模式保留每日快照，切換不混用結果；B 只完整轉送旅遊搜尋頁及所需資源，其他連結另開官網，不能稱為整個 CDC 網站均已代理。尚未建立常駐公開後端，GitHub 正式介面不會冒充可用。啟動、限制與計時口徑見 [backend/README.md](backend/README.md)。

### 疫苗搜尋與旅遊地區評估

- 頁面頂端「疫苗與原文搜尋」可直接查霍亂、Dukoral、Vaxchora、MMR、B 型肝炎或接種問題，不必先選目的地。索引 50 組既有整理資料，不是全部 PDF 全文搜尋。搜尋摘要保留適用前提、產品限制及禁忌／注意事項分類；點文字核對來源，展開可讀完整整理。
- 「成人時程」的個人風險卡片下方新增「依旅遊地區建議評估」。快照、A、B 的查詢共用目的地狀態；B 框內搜尋會自動帶回同一次官方回應的完整結果，換頁不會少掉其他頁的資料。
- 以疾病搜尋或顯示所有時，先選擇目的地；全球警示另列。近似國名不擅自合併，同日不同等級顯示衝突。新搜尋、輸入改字或模式切換會清空舊評估及來源面板。
- 「為什麼」連回該筆疫情／處方箋資料；疫苗劑次與注意事項連回既有 PDF 原句。CSV 支援懸浮小視窗、點擊側欄、全表與上下左右捲動；即時文字則標明取得時間與官方連結，不冒充 PDF／CSV 快照。
- 這些是相關資料導覽，**不是由疫情等級直接產生接種處方**，也不會將左側個人條件送往疾管署。查不到已整理資料不表示無疫苗或無風險。

疫苗搜尋、每日快照評估、PDF 與 CSV 原文預覽支援 GitHub Pages；A／B 即時模式仍限本機，不會在 Pages 自動啟動後端。實測與獨立審查範圍見 [review/travel_workspace_2026-09-06.md](review/travel_workspace_2026-09-06.md)。

### 每日資料包的更新與身分核對

每日工作流程先驗證解析器，完整下載並驗證兩份資料，再產生不可變原始 CSV（檔名含 SHA-256）及單一 `review/travel-current.js`。任一來源失敗保留上一份完整資料包，發布醒目失敗狀態，不把空資料當成沒有風險；超過 36 小時未成功則標示過期。只有明確允許的靜態檔案會被打包上線。主頁、hover、側欄與完整 CSV viewer 均使用同一資料包。

資料處理界線：

1. 同一目的地／疾病／細分地區取最新公告日期；最新為「解除」時不當成現行警示。同日不同等級全部保留並顯示衝突，不依列順序裁決。
2. 完整 CSV 包含歷史資料，不能換成近 30 天／近兩年端點；沒有出現在短期資料中不能推定已解除。
3. ISO 代碼可能共用（例如 GP），不同目的地分開，無法唯一辨認的名稱不強制合併。
4. 「嚴重特殊傳染性肺炎」與「新冠併發重症」依官方更名做精確疾病身分對照，原始字串不變。沒有能對應的新名稱目的地公告者列入「歷史／現行狀態待核對」，不展示成已確認的現行第三級警告，也不捏造解除。
5. 全球警示只採原檔真的標為全球的紀錄，不以涵蓋國家數推定。所有外部文字都經 HTML 轉義；不執行 CSV 儲存格內容。
6. TLS 保持憑證及主機驗證。遇官方伺服器漏送中繼憑證時，只補入已驗雜湊、有效期及受信任根簽章的正確中繼憑證，**不使用 `-k` 或停用 TLS 驗證**。

旅遊 PDF 導覽由 `review/travel-guide-spec.json` 與人工核對的 `review/travel-guide-hashes.json` 建置：

```bash
python3 tools/build_travel_references.py
node tools/test_travel_search.cjs
```

來源雜湊改變或原文定位不唯一就停止建置。中文整理／翻譯不標為逐字；黃框僅代表真正定位的來源片段。完整原檔、產品、版本及適用地區均保留，國外政策不自動取代台灣規範。

## 開發陷阱：不要用 `ad` 開頭的元素 id

成人時程卡片原本用 `id="ad0"`～`id="ad13"`，結果 **`ad2`、`ad3`、`ad4`、`ad6`、`ad7` 五張卡片
在瀏覽器裡完全消失**（流感、新冠、B 肝、PCV、PPV23）。

原因是廣告攔截器（uBlock Origin／AdBlock 等）的 EasyList 通用過濾規則包含 `#ad2`、`#ad3` 這類
選擇器，會把符合的元素設成 `display:none`。實測：

```
ad0 → block   ad2 → none   ad5 → block   ad8 → block
ad1 → block   ad3 → none   ad6 → none    ad9 → block
              ad4 → none   ad7 → none    ad10 → block
```

元素確實存在於 DOM（`querySelectorAll` 找得到 14 個），只是被 CSS 隱藏，所以
「檢查 DOM 有沒有渲染」查不出問題，**必須檢查 `getComputedStyle(el).display`**。

現已改為 `id="vaxAdult0"`。日後新增元素避免使用 `ad`、`ads`、`banner`、`sponsor`
等開頭的 id 或 class。

## 原句摘錄層（2026-09-05 新增）

每條規則旁的 **📖**：hover 顯示 PDF 原句縮圖、click 開右側面板——PDF 裁圖＋
半透明高亮框蓋在原句上＋頁碼＋開啟完整 PDF（http 下直接跳頁）。

誠實分級（面板左上標籤）：

| 標籤 | 意義 |
|---|---|
| 逐字 | 匹配覆蓋率 ≥85%，高亮＝原句位置 |
| 部分逐字 | 高亮只畫實際逐字匹配的行；未匹配部分多為網頁補充說明 |
| 整理句 | 網頁對原文的整理／合併，**不畫高亮**（不製造假的逐字對應），只給出處區域 |
| 文字來源 | 來源是網頁擷錄（TFDA 仿單摘錄等），無 PDF 可裁圖 |

**追溯規格（2026-09-12 定案）見 [review/REFERENCE_TRACING_SPEC.md](review/REFERENCE_TRACING_SPEC.md)**：
追溯終點必須是原件（官方 PDF 或官方網頁的列印 PDF）的頁面影像＋定位框；本站轉錄文字不算證據；
官方網頁用 `tools/print_web_source.mjs` 列印（疾管署 Q&A 加 `--expand "全部展開"`）；帶 `claim:` 的規則走
reference-claims（glyph 定位），其餘走下方 legacy 管線；每批內容走完「建置→機械→目視→獨立 verifier→使用者」五階才 merge。

重建管線（改了規則文字後要重跑；系統 python3 沒有 pdfplumber，用 uv）：

```bash
PY="uv run --python 3.12 --with pdfplumber>=0.11,<0.12 --with Pillow>=10,<13 python"   # zsh 請整串照打，變數不會分詞
$PY tools/build_reference_pages.py               # claim 路線：全頁渲染＋glyph 定位，定位失敗即停
node tools/export_rules.mjs > /tmp/rules.json
$PY tools/build_excerpts.py /tmp/rules.json       # legacy：產 review/excerpts.js + img/ + match_report.md
$PY tools/verify_excerpts.py                      # 反查框內 PDF 文字，任一硬性錯誤回傳非零
$PY -m unittest discover -s tools -p 'test_*.py'
npm test                                          # 含 coverage、reference_ui、postinfection_quotes
```

驗證器從現行 `index.html` 重新取規則，並執行前端的鍵值函式，避免舊快照或改字漏重建。
它會核對圖片實際尺寸、框線邊界、整理句零高亮、報告統計、框內文字覆蓋率，以及已人工
覆核的疫苗列／段落界線。`--annotate /tmp/excerpt-boxes` 可另產框選圖供目視抽查。
新增 `origin`（PDF pt）與 `dpi`，可由裁圖座標反查原頁；原點與實際整數裁圖像素一致。
依賴 Node、Poppler (`pdftotext` / `pdftoppm`) 與 Pillow。

2026-09-05 第三輪修正後狀態：**逐字 94／部分逐字 9／整理句 9／文字來源 12，共 124 條**。
比交接時多出的整理句來自收緊來源範圍與改用最終高亮計算分級，門檻維持 85%／50%。
卡介苗 28 天規則改成原文例外提示（`info`），不再誤觸發「需評估」。
詳見 [第三輪覆核紀錄](review/round3_review.md) 與 [機械驗證報告](review/verification_report.md)。

人工定位範圍與 PDF 的 SHA-256 綁定；更換來源版本時，建置器會停止，要求重新核對範圍。
機械通過不能代替醫師對規則的臨床判斷；低支持度行仍列在報告，須配合目視覆核紀錄。

匹配器踩過的坑（都寫在 build_excerpts.py 註解）：S1 表格三欄交錯不能用連續子字串、
固定格線分桶會把同一行拆兩半、JE 頁逐字加空格要行級重組、「孕婦。」短句要疫苗釘頁＋
錨點決勝、※1 類固醇定義在末頁需 fallback、`file://` 下 fetch JSON 被擋所以資料用
`<script src>` 載入。

## 驗證紀錄

內容經三輪 fresh-context 對抗審查（做的人不自驗）：

- **第一輪：FAIL，6 項嚴重** — 四個「注意事項」欄項目被誤標為禁忌；一處引文加了原文沒有的字句；一處引錯來源；類固醇的日本腦炎專屬門檻被全域套用。
- **第二輪：11 項修正確認落地，另發現 3 項** — 日本腦炎類固醇規則把兩欄合併；一處自行加註；一處共用文案漏後綴。另指出狂犬病 Q&A 未存檔導致來源無法重現（已補存）。
- **第三輪：PASS** — 全部 **88 條** S1 規則以字元縮排位置逐條實測欄位歸屬，一致 88 / 不一致 0。
- **2026-09-12 感染後接種間隔批次（S21–S25、總表、shingrix／var／flu／covid 新條）**：verifier R1 PASS（3 項措辭修正落地）；
  使用者否決「本站轉錄當 reference」後改為官方網頁列印 PDF 走 glyph 定位；verifier R2 PASS 7/7
  （列印稿逐句＝線上原頁、SHA 三方一致、高亮裁圖正中、無轉錄殘留、工具無 DOM 改寫、npm test／verify／unittest 全綠）。

## 免責

本頁為疾管署與 TFDA 公開文件之整理，**非官方發布物，僅供醫療人員臨床參考**。
臨床決策前請以官方原文為準。
# 直接點文字查來源（2026-09-05 更新）

接種前篩檢、兒童時程、成人時程、間隔規則、禁忌總表、補種及來源頁，
皆可直接點有底線的文字開右側來源，滑鼠停留則浮出預覽。卡片／折疊區使用
「展開／收合」，篩檢條件請點方框；Enter／Space 開來源，Escape 關閉。

- PDF 為真實原頁預渲染影像，可放大、看完整頁面、切頁或開原檔。
- 兒童表將年齡標頭、該疫苗列及相關附註分開裁出，避免漏掉 5–8 月等附註。
- 既有核對過的規則保留分級；成人等其他頁面也高亮實際匹配字詞，但不把整理文字標為整句逐字。
- 預覽為「整頁定位小圖＋原頁全寬的上下文區域」。黃框為字詞，藍框為位置，不自動放大窄句裁圖。
- 成人 14 列固定到正確疫苗列；抗體說明另定位到相關段落。手動翻頁清除舊框並同步更新連結。
- 含間隔或孕週的成人摘要優先預覽對應附註，再提供第一頁時程表；最小年齡逐格定位，補種控制標籤與結果同步換列。
- 網頁公告／仿單整理摘錄依原型別顯示，沒有 PDF 的項目不冒充 PDF。
- 旅遊文字的 hover 是可上下左右捲動的 CSV 小視窗，可搜尋、切換全表及原檔欄序；點字固定於側欄。切換目的地會清除過期側欄。
- 「查看完整 CSV 表格」會開啟 `csv-viewer.html` 互動表格頁，不直接開原始 CSV 檔。保留目前目的地／疾病的核對條件，預設顯示全表並定位至第一筆對應紀錄所在批次；另有明確的「下載原始 CSV」。
- 可直接查看 [疫情警示完整表格](https://jamesxxx1997.github.io/vaccine-guide/csv-viewer.html?table=alerts) 或 [旅遊處方箋完整表格](https://jamesxxx1997.github.io/vaccine-guide/csv-viewer.html?table=prescriptions)。兩者使用每日同步後的同一份已驗證快照，直接呈現表格，不先跳下載；離線使用則保留下載時的版本。

新增程式：`reference-ui.js`、`reference-ui.css`、`reference-geometry.js`；來源索引：`review/reference-pages.js`，
由 `python3 tools/build_reference_pages.py` 建置。原始 `sources/` 不會被改寫。
互動回歸：`tools/test_reference_ui.cjs`，需 Node.js 與 jsdom 30.0.1；
安裝及測試：

```bash
npm ci
npm test
python3 -m pip install -r requirements.txt
python3 tools/build_reference_pages.py
python3 tools/test_verify_excerpts.py
python3 tools/verify_excerpts.py
python3 tools/test_travel_rebuild.py
```

快照入口回歸：`tools/test_csv_viewer.cjs` 隨 `npm test` 執行，檢查實際預覽連結的目的頁、兩份表格、查詢條件、搜尋／分頁、原始欄序與明確下載連結；不是只測懸浮窗。

另需安裝 Poppler。`build_reference_pages.py` 使用 pdfplumber 的實際字元座標；
人工原文片段與 SHA-256 鎖定於 `review/reference-claims.json`。來源換版時必須重新核對，不能直接改雜湊放行。
互動測試涵蓋 23 組、幾何 8 項、舊引文回歸 8 項；124 條原規則分級未更動。
`npm test` 另遍歷全頁欄位、條件與計算分支、676 組有序間隔選擇、31 個補種分支及所有旅遊摘要對應，
核對兩份 CSV 每一個原始值。`tools/audit_reference_targets.cjs` 可輸出全頁來源清冊；
沒有黃框的介面標籤、空格、整理句及非 PDF 來源須另列，不算逐字通過。
本輪全頁清冊、五項 verifier 發現與修復複驗：見 [2026-09-06 全頁覆核紀錄](review/reference_audit_2026-09-06.md)。
機械驗證仍有 4 個人工覆核提示，歷史說明見 `review/round3_review.md`；測試通過不等於臨床全面認證。

公開儲存庫不包含個人 `study/` 進度、交接文件、未用於網站的教科書摘錄、暫存或憑證。原始 PDF／網頁及其衍生預覽的權利與來源標示均歸各自權利人；本專案未對第三方內容授予額外授權。

---
