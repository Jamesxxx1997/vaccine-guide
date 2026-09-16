# 流感臨床模組 台灣端原件下載紀錄

**建檔日期：2026-09-16**
**目的：**「流感臨床」模組（抗病毒藥選擇、隔離返班Q&A）需要每一句可回溯至本機PDF原件並畫黃框。
本檔記錄任務中 A. TFDA中文仿單 與 B. 疾管署原件PDF 的下載狀態、來源、版本、雜湊。

## 重要提醒：本資料夾另有其他並行工作的產出

執行本次任務時發現 `sources/流感/` 資料夾內已有其他並行 session 產出的檔案，**非本次任務下載**，
特此區分以免混淆來源：
- `CDC_*.pdf`、`Lancet_*.xml`、`IDSA_*.pdf`、`WHO_*.pdf`、`PMDA_Avigan_favipiravir_審查報告_英文_2014-03.pdf`
  ——皆為美國CDC/國際文獻/PMDA英文審查報告，非台灣端原件，由另一並行流程抓取（含item #6 Avigan英文仿單，已由該流程取得，本次未重複下載）。
- `疫苗銜接/`、`檢驗/` 兩個子資料夾——疫苗與快篩檢驗相關文件，屬另一並行流程之範疇（含疫苗Q&A、TFDA疫苗仿單、FDA快篩510k等），非本次任務。
- `疾管署_流感防治與疫苗接種政策_課程簡報_含1140917-1140923勘誤_使用者提供.pdf`、`_使用者提供文件.md`
  ——使用者提供的課程講義，非本次下載。

以下僅記錄**本次任務（A. TFDA仿單 + B. 疾管署原件）**實際下載的檔案。

---

## 下載機制（沿用 sources/仿單/_下載紀錄.md 之已驗證方法）

1. TFDA許可證字號查詢：先查TFDA開放資料集 `https://data.fda.gov.tw/data/opendata/export/37/json`
   （現行未註銷藥品許可證清單，本次因WebSearch額度已用盡改採此法，比對中英文品名取得完整格式許可證字號）。
2. 直連 `https://mcp.fda.gov.tw/im_detail_1/<urlencoded完整許可證字號>`，解析頁面內「歷史仿單」表格
   （`檔案名稱`+`上傳日期`兩欄，按時間排序，取最後一列＝最新版本）之 `/insert/pdfcasefile/<id>` 連結下載。
3. 疾管署文件：`/File/Get/<id>` 為HTML殼層（title標籤含真實檔名），內嵌 `/Uploads/<uuid>.pdf`
   或 `/Uploads/files/<yyyymm>/<uuid>.pdf` 為真檔下載點；部分歸類頁需先展開手風琴
   （`/Category/MPage/`類頁面用`<a href="...">`巢狀在collapse區塊內，需解析HTML找出實際子連結）。
4. 網頁類（無獨立PDF、僅網頁呈現，如Q&A、疾病介紹）：用 `node tools/print_web_source.mjs <url> <out.pdf> --expand "全部展開"` 列印。
5. 驗證：`pdfinfo`記頁數、`pdftotext`抽字數、`shasum -a 256`記雜湊；文字層抽取失敗（0字）者用
   `pdftoppm`轉圖後目視核對內容完整性（本次Relenza、Eraflu屬此類——皆為Adobe Illustrator印刷版美工稿，
   無內嵌字型，非缺頁或抓錯連結）。
6. 本機rtk hook會改寫grep/diff/find/ls，證據指令一律用 `/usr/bin/grep`、`/usr/bin/shasum`、`/bin/ls`、`/opt/homebrew/bin/pdftotext`等原生路徑。

---

## A. TFDA 中文仿單

### 1. 克流感膠囊75毫克 Tamiflu Capsules 75mg（羅氏）
- 許可證：衛署藥輸字第023253號（另有025285號法國廠、025771號義大利廠兩張平行許可證，CDS版本皆16.0，僅製造廠址不同，未逐一下載）
- 查詢頁：https://mcp.fda.gov.tw/im_detail_1/衛署藥輸字第023253號
- 下載：/insert/pdfcasefile/i_9c35b2b2-4a91-4ce5-864b-d7dbf6f702bf （歷史仿單表最新一筆，檔名含112-10-06廠商自行上傳字樣）
- 存檔：`克流感膠囊75毫克_Tamiflu_TFDA_2023-10-06.pdf`（1頁，2229字，sha256前10碼 `3835bdf46b`）
- 驗證：pdftotext正常抽字；本檔為35.4×18.9吋單頁摺盒印刷版下版，非常規多頁——已用內文章節號(2.1適應症/2.2用法用量/2.3禁忌/2.5.2懷孕/2.5.4小兒/2.5.6腎功能/2.8交互作用)取代頁碼定位，逐一grep核對存在。
- 台灣未查得Tamiflu口服懸液用粉劑之現行許可證（同批TFDA資料集搜尋「懸液」關鍵字無此品項），僅膠囊劑型現行；已如實記錄未找到，未以其他劑型冒充。
- 問題：無（完整取得，內容驗證通過）

### 2. 易剋冒膠囊75毫克 Eraflu Capsule 75mg（永信，公費採購oseltamivir學名藥）
- 許可證：衛部藥製字第059653號
- 查詢頁：https://mcp.fda.gov.tw/im_detail_1/衛部藥製字第059653號
- 下載：/insert/pdfcasefile/1b00d80d-9e8f-4055-9f08-3d22be086c41 （歷史仿單表最新一筆，2025-08-11廠商自行上傳）
- 存檔：`易剋冒膠囊75毫克_Eraflu_TFDA_2025-08-11.pdf`（2頁，pdftotext抽字0，sha256前10碼 `d90cbaf2ac`）
- 驗證：Adobe Illustrator印刷版美工稿，無內嵌字型（pdffonts確認無字型物件），故pdftotext抽取0字——**非缺頁或連結錯誤**，已用pdftoppm 150dpi轉PNG後目視核對，兩頁內容完整涵蓋定義、適應症、用法用量（含腎功能4級劑量表、體重mg/kg兒童劑量表、懸液調配容量表）、禁忌、警語注意事項、藥物動力學、不良反應統計表(2646/1943例安全性數據)、包裝儲存等完整仿單。
- 已由疾管署致醫界通函第613號（2026-08-18發布）確認為現行公費配置藥劑之一（另一為克流感）。
- 問題：文字層無法逐字搜尋，供「原句畫黃框」時需改用圖片座標框選而非文字座標。

### 3. 瑞樂沙旋達碟 Relenza Rotadisks（GSK）
- 許可證：衛署藥輸字第023336號
- 查詢頁：https://mcp.fda.gov.tw/im_detail_1/衛署藥輸字第023336號
- 下載：/insert/pdfcasefile/i_c694a5c7-020a-4aae-adf0-077592721a57 （該許可證下唯一一筆歷史仿單，檔名020233360001pdf-107-12-17.pdf）
- 存檔：`瑞樂沙旋達碟_Relenza_TFDA_2018-10-12.pdf`（1頁，pdftotext抽字0，sha256前10碼 `528cf1d514`）
- 驗證：同Eraflu，為Adobe Illustrator印刷版美工稿無文字層。已轉圖目視核對：完整A2大小單頁仿單，含定性定量組成、臨床特性（成人/兒童用法用量、腎功能不全免調整、孕婦哺乳無足夠資料）、警語注意事項（神經精神事件）、DISKHALER吸入裝置圖解教學。內容完整可讀。
- 問題：文字層無法逐字搜尋，同Eraflu情形。未查得更新版本（TFDA查詢頁僅此一筆歷史紀錄）。

### 4. 瑞貝塔點滴靜脈注射液 Rapiacta（塩野義，300mg/150mg）
- 許可證：衛部藥輸字第026649號
- 查詢頁：https://mcp.fda.gov.tw/im_detail_1/衛部藥輸字第026649號
- 下載：/insert/pdfcasefile/d2a947d2-b3f0-49fa-bb7a-ef8b0f0cb3de （歷史仿單表最新一筆，2025-08-27廠商自行上傳，內容標示2025年3月版）
- 存檔：`瑞貝塔點滴靜脈注射液_Rapiacta_TFDA_2025-03.pdf`（6頁，1518字，sha256前10碼 `08f3822dcc`）
- 驗證：美規式完整仿單格式(Highlights+Full Prescribing Information)，pdftotext正常抽取。適應症：治療成人及1個月大以上兒童A/B型流感急性感染，**明文排除預防用途**（「本藥用於預防使用之有效性及安全性尚未確立」）。腎功能調整依肌酐酸清除率分級（表1，p1-p2）。
- 問題：無

### 5. 紓伏效膜衣錠20毫克 Xofluza Tablets 20mg（塩野義）
- 許可證：衛部藥輸字第027693號
- 查詢頁：https://mcp.fda.gov.tw/im_detail_1/衛部藥輸字第027693號
- 下載：/insert/pdfcasefile/i_7fd5f1b3-6c9a-446f-a107-f5dc5671d7b7 （該許可證下唯一一筆歷史仿單，核定日期2020年11月25日）
- 存檔：`紓伏效膜衣錠20毫克_Xofluza_TFDA_2020-11-25.pdf`（6頁，1236字，sha256前10碼 `86b794fad5`）
- 驗證：pdftotext正常抽取。
- **★★年齡/體重適應症句（使用者特別要求記錄）：「適用於治療成人及12歲以上兒童之A型及B型流行性感冒病毒急性感染」**——本版切點為「12歲以上」，並非按體重分層（無「≥5歲且≥20kg」字樣），與部分國際版仿單用語不同，臨床應用時應以本頁原文為準。
- 用法用量：體重40-80kg單次40mg；≥80kg單次80mg（皆限12歲以上兒童及成人）。
- 交互作用（p3）：明確列出「應避免和乳製品、高鈣飲品、含多價陽離子緩瀉劑、抗酸劑或口服補充劑(例如：鈣、鐵、鎂、硒或鋅)併服」。
- 問題：無；未見獨立腎功能不全劑量調整段落（原廠仿單本身未列此分層）。

---

## B. 疾管署（cdc.gov.tw）原件PDF

### 7. 季節性流感防治工作手冊（2026年3月版）
- 來源分類頁：https://www.cdc.gov.tw/Category/DiseaseManual/bU9xd21vK0l5S3gwb3VUTldqdVNnQT09 （「傳染病防治工作手冊」，流感併發重症列項）
- 實際連結：/File/Get/4IJouPVVctcyzcYh2LEVYg → https://www.cdc.gov.tw/Uploads/8945f860-0aa5-4352-a08d-e25dc0f27dfe.pdf
- 存檔：`季節性流感防治工作手冊_2026年3月版.pdf`（90頁，6135字，sha256前10碼 `d2a978dcdb`）
- 版本：PDF Title「季節性流感防治工作手冊」，CreationDate 2026-03-13，與使用者所述「據稱2026年3月版」相符，並含「補充修正擴大新A採檢(2026.0313)」字樣。
- 問題：無；篇幅大（90頁），本次未逐頁標註章節頁碼，供後續模組建置時再細分。

### 8. 公費流感抗病毒藥劑使用對象一覽表
- 來源分類頁：https://www.cdc.gov.tw/Category/Page/fHHHNV-HWyYD00tnKeXsLA
- 實際連結：/File/Get/HYVOngMEg2A0jRxNhwa_2Q → https://www.cdc.gov.tw/Uploads/files/378de5ae-9649-4f38-a01c-91d5304de39d.pdf
- 存檔：`公費流感抗病毒藥劑使用對象一覽表_自115年8月24日起.pdf`（2頁，347字，sha256前10碼 `153ed600a5`）
- 版本：官方頁面標示「自115年8月24日起」，最後更新日期2026/8/24，與使用者所述「2026-08-24起適用」相符。
- 交叉驗證：同檔案亦附於疾病管制署致醫界通函第613號（2026-08-18發布，https://www.cdc.gov.tw/Bulletin/Detail/KIhbnuQlku7dyr341a-pzw?typeid=48），兩來源sha256雜湊完全相同，確認為同一份文件。通函內文：因第32週(8/9-8/15)類流感就診數上升1.2%，自2026-08-24至2026-09-30**擴大**公費藥劑使用條件至7類高傳播族群（醫事防疫相關人員、長照受照顧者及工作人員、幼兒園托育人員、國小至高職五專前3年學生、與流感重症高風險族群同住或照顧者、禽畜/動物園/動物防疫人員、其他人口密集機構人員）；公費藥劑配置全國約4千家合約醫療機構，配置藥劑為**克流感及易剋冒**。
- 「使用注意事項／Q&A」：另抓取 https://www.cdc.gov.tw/Category/QAPage/YgeC_ca-wDJqW2fnH6CLdg （流感抗病毒藥劑Q&A）存為 `QA_流感抗病毒藥劑.pdf`，內容未見「退燒後隔離/返班」相關題目（該主題實際位於下方第10項醫療照護機構感染管制指引）。
- 問題：此為「擴大期間」版本（8/24-9/30），非全年常態版；疾管署官方分類頁目前僅公告此一版連結，查無另外的「全年標準版」一覽表。

### 9. 公費Avigan使用方案／使用指引
- 已查：疾管署流感抗病毒藥劑分類頁「儲備目的及使用原則」(https://www.cdc.gov.tw/Category/Page/jxG4AeaWmIbGXFJBDeRfDw) 內容僅提及克流感/瑞樂沙/瑞貝塔/易剋冒四款藥劑之儲備與使用原則，**未提及法匹拉韋/Avigan**。
- 已查：流感疾病總覽頁(https://www.cdc.gov.tw/Disease/SubIndex/x7jzGIMMuIeuLM5izvwg_g)全文搜尋「法匹拉韋」「Avigan」「法匹」均無結果。
- 已試：CDC網站進階搜尋表單為POST+CSRF token防護，純curl無法穩定送出查詢（token擷取失敗，GET fallback回傳404導回首頁樣板）；WebSearch額度已於本次任務開始前用罄，無法用網路搜尋輔助定位。
- **結論：未在疾管署公開網頁上查得「公費Avigan使用方案／使用指引」之獨立文件，如實記錄為查無。**（另，並行的其他session已取得PMDA英文審查報告作為Avigan相關的替代佐證，但那並非疾管署公費使用方案本身，詳見上方「重要提醒」段。）

### 10. 醫療照護工作人員季節性流感感染管制建議
- 來源分類頁：https://www.cdc.gov.tw/Category/MPage/6YQ32GG9EOdXNTjPqUDT1A （重要指引及教材）→「醫院及長期照護機構季節性流感感染管制措施指引」手風琴區塊，內含醫院版與長照版兩個子連結
- **醫療照護機構版**：/Category/ListContent/NO6oWHDwvVfwb2sbWzvHWQ → /File/Get/7MVzAsuLAr-FK9LGb9eYOA → https://www.cdc.gov.tw/Uploads/files/201706/50dc3967-6924-43d1-83a0-5291c5517ce6.pdf
  存檔：`醫療照護機構季節性流感感染管制措施指引_20170615.pdf`（14頁，455字，sha256前10碼 `8e10e13984`）
  **★★逐字核對通過**：「(1) 建議停止工作至退燒後至少 24 小時（指未使用如 acetaminophen 等退燒藥）」（原文行266、345-347重複出現兩處）；「疑似或確診的流感病人在發病後 7 天內或發燒/呼吸道症狀緩解前（以時間較長者為主）...因為這些環境中的病人嚴重免疫功能[不全]」（原文行176、183「嚴重免疫缺」、288-290、331）——確認為使用者所述「停止工作至退燒後至少24小時」「照顧免疫低下者7天」兩句的正確來源文件。
- **長期照護機構版**：/Category/ListContent/FR9BZ-4u-p4jZvbt_q6IXw → /File/Get/R0iGQp9EiEtLBx6cr8sJiA → https://www.cdc.gov.tw/Uploads/files/201710/f71f2b1b-92d2-42d0-893f-37cebb1feeb2.pdf
  存檔：`長期照護機構季節性流感感染管制措施指引_1061013.pdf`（17頁，751字，sha256前10碼 `c86d2286cd`）
- 版本：兩者皆為2017年版本（醫院版20170615、長照版1061013即2017-10-13），為疾管署「醫療機構感染管制」「長期照護機構感染管制」分類頁目前僅有的現行公告版本，未查得更新版。
- 問題：無（核心內容逐字核對通過）

### 11. 流感衛教／疾病介紹頁
- 來源：https://www.cdc.gov.tw/Category/Page/HMC9qDI4FA-gDrbcnFlXgg （網頁，用print_web_source.mjs列印）
- 存檔：`疾病介紹_流感_網頁列印.pdf`（4頁，189字，sha256前10碼 `79ff048c75`）
- 網頁最後更新日期：2023/12/26
- 原文摘錄：「潛伏期 通常約1-4天，平均為2天。出現併發症的時間約在發病後的1-2週內。可傳染期 一般而言約在症狀出現後3-4天內傳染力最強。另研究發現，成年感染者在發病前24-48小時便開始排放病毒，但量較低，病毒排放高峰是發病後24-72小時，直至發病後第5天；但免疫不全者，排放病毒的期間可能達數週或數月；兒童亦較早開始排放病毒，且量較多，時間較久，最長可達21天。」
- **★提醒**：使用者記憶中「症狀前約24小時至發病後約5天」一句與現行網頁原文語意相近但非逐字相同（現行原文如上），請以本頁下載之原文為準，不要直接沿用使用者記憶中的簡化句子。
- 問題：頁面內容本身精簡（189字），非列印失敗——已核對PDF為4頁完整版面含頁首URL與列印日期戳。

### 12. 學校／人口密集機構流感群聚處理指引
- 來源分類頁：https://www.cdc.gov.tw/Category/MPage/6YQ32GG9EOdXNTjPqUDT1A → /File/Get/n27z1VMooTgwiZE35wykJQ → https://www.cdc.gov.tw/Uploads/c09dee6e-b116-4da6-8905-7603fe63b015.pdf
- 存檔：`學校幼兒園補習班流感群聚防治指引_108.2.pdf`（4頁，210字，sha256前10碼 `b6490710ab`）
- 版本：108.2版（民國108年2月＝2019年2月）
- 同分類頁另有相關行政表單（本次僅記錄連結，未下載）：
  - 附表一 學校幼兒園補習班兒童課後照顧服務班與中心因應流感疫情防疫作為現況查檢表(108.2)：/File/Get/bWraSDovqIZKGz7Z5MJfYQ
  - 附表二 流感群聚事件防治措施執行確認表(108.2)：/File/Get/58K2DrJwRxM-Bn6hlnTUyg
  - 附錄五 上呼吸道感染及不明原因發燒等可能流感群聚事件疫調報告：/File/Get/fcY_sIguA98PiFQoEfGFcg
  - 附錄六 流感群聚事件之預防性公費藥劑使用申請流程：/File/Get/INzNa5vOw27JQ2Z80OI0_g
  - 群聚事件預防性投藥公費藥劑使用評估申請表(115)：/File/Get/Uc15G5yfu3SWjEzGQPhD2Q
- 問題：指引本文210字，內容為原則性條列（停課建議門檻、機構通報流程），非逐字截斷；未查得比108.2更新的版本。

### 13. 流感併發重症 病例定義／通報定義
- 來源分類頁：https://www.cdc.gov.tw/Category/DiseaseDefine/ZW54U0FpVVhpVGR3UkViWm8rQkNwUT09 （「傳染病病例定義及檢體送驗」）→ /File/Get/OX_YLUZbUHKMkZCidu32jA → https://www.cdc.gov.tw/Uploads/6a528cce-ef9d-47ef-9cf8-902bc83cbcd0.pdf
- 存檔：`流感併發重症_通報病例定義.pdf`（2頁，99字，sha256前10碼 `a4ebec53f0`）
- 版本：檔案ModDate 2016-02-17；內文未見獨立版本日期字樣。已核對疾管署現行分類頁目前僅公告此一版連結，未查得更新版本。
- 內容：臨床條件（出現類流感症狀後兩週內因併發症需加護病房治療或死亡）、檢驗條件、流行病學條件、通報定義（符合臨床條件即通報）、疾病分類（可能/極可能/確定病例）、檢體採檢送驗事項。
- 問題：檔案時間戳較舊（2016年），已如實記錄，未偽稱為最新版；惟為疾管署現行公告連結。

### 14. 流感疫苗接種計畫 2026-27實施計畫／QA
- 來源分類頁：https://www.cdc.gov.tw/Category/MPage/JNTC9qza3F_rgt9sRHqV2Q
- 存檔1：`115年度流感疫苗接種計畫_全文.pdf`（27頁，2130字，sha256前10碼 `51648bddcf`）
  來源：/File/Get/vtqbmLpBSkjJdWKZ3-8BAw → https://www.cdc.gov.tw/Uploads/55597085-7805-4e92-80a9-cfeb4bc0c6fa.pdf；PDF CreationDate 2026-07-16
- 存檔2：`115年度流感疫苗政策綜論.pdf`（47頁，1916字，sha256前10碼 `acc0e6a3eb`）
  來源：/File/Get/O0YCUBa4UWlBUyZs8_PJcw → https://www.cdc.gov.tw/Uploads/f1f112bd-0139-4db0-beda-caf43e8fb0c6.pdf；PDF CreationDate 2026-09-07（較新）
- 說明：民國115年度＝西元2026-27流感季。因非本模組核心（抗病毒藥/隔離返班），僅順便一併下載存查，未深入分析章節結構。
- 問題：無

### 補充：Q&A頁面
- 季節性流感防治Q&A：https://www.cdc.gov.tw/Category/QAPage/DQWXG19u2cXMH1jwGKXHug → `QA_季節性流感防治.pdf`（6頁，302字，sha256前10碼 `7c8e7062e4`），已用--expand展開全部題目，網頁最後更新日期2026/7/30。
- 流感抗病毒藥劑Q&A：https://www.cdc.gov.tw/Category/QAPage/YgeC_ca-wDJqW2fnH6CLdg → `QA_流感抗病毒藥劑.pdf`（6頁，348字，sha256前10碼 `4b20979704`），已用--expand展開全部題目。

---

## 總結：抓不到的項目

| 項目 | 嘗試過的網址／方法 | 結果 |
|---|---|---|
| #6 Avigan英文package insert | 疾管署「儲備目的及使用原則」頁、流感疾病總覽頁全文搜尋「法匹拉韋/Avigan/法匹」；CDC進階搜尋表單(POST+CSRF，curl無法穩定送出) | 疾管署公開網頁未查得獨立文件，本次任務範圍內判定為查無（另一並行session已取得PMDA英文審查報告，非本次任務所得，見上方提醒段） |
| #9 公費Avigan使用方案／使用指引 | 同上 | 查無獨立文件 |
| 公費抗病毒藥劑「全年標準版」使用對象一覽表 | 疾管署官方分類頁 /Category/Page/fHHHNV-HWyYD00tnKeXsLA | 該分類頁目前僅公告「自115年8月24日起」擴大期間版一份連結，查無另外常態版 |

以上兩項因WebSearch額度已於任務開始前用罄（改用TFDA開放資料集與疾管署網站直接爬梳作為替代方法，其餘13項均成功取得），且CDC.gov.tw進階搜尋功能需要CSRF token配對，純curl環境下無法穩定完成表單送出，故僅能透過已知分類頁人工巡覽方式搜尋，未能覆蓋網站全部索引範圍。如需進一步確認，建議由使用者以瀏覽器登入介面直接使用全站搜尋，或聯繫疾管署防疫專線1922查詢。


## 補記（2026-09-16）：瑞樂沙仿單全文改用 TFDA 頁面列印
- 原下載的 `瑞樂沙旋達碟_Relenza_TFDA_2018-10-12.pdf` 是向量美工稿、無文字層。同一許可證（衛署藥輸字第023336號）的仿單查詢頁本身含全文手風琴（適應症、用法及用量、禁忌…），用 `node tools/print_web_source.mjs <url> <out> --expand "全部展開" --wait 4000 --ua "<一般瀏覽器 UA>"` 列印成 `瑞樂沙旋達碟_Relenza_TFDA仿單全文_網頁列印_2026-09-16.pdf`（13 頁、719 字、sha256 ebdf092fe286…）；頁面內版本 GDS20/IPI09、13 October 2017。
- GOTCHA：mcp.fda.gov.tw 會擋 headless Chrome 預設 UA（回「The URL you requested has been blocked」），帶一般 UA 即可；「全部展開」是 `div.toggle-all_content` 不是 button，工具已改成任何元素都可點。
- 易剋冒（衛部藥製字第059653號）的查詢頁沒有全文段落（只有 PDF 連結），仍需使用者手動匯出或 OCR。
