# 流感臨床檢驗機型研究紀錄

調查日期：2026-09-16
目的：盤點台灣家醫科/臨床實際會遇到的流感檢驗機型，並抓取原廠 IFU/package insert（或 FDA 510(k) 決定摘要／台灣官方研究）PDF，供之後做「檢驗判讀面板」use。

## 研究方法與限制（先說清楚）

- 本次 WebSearch 工具額度已在本 session 用罄，改用「真實 Chrome 瀏覽器＋Google 網頁搜尋＋直接 curl 抓檔」的方式進行，證據來源仍是 Google 導向的原始官方/廠商/醫院網頁，未使用第三方整理站的資料本身（僅用 `data.zhupiter.com`／`health.udn.com`(元氣網) 兩個「政府開放資料轉錄站」來**定位**TFDA許可證字號，最終認定仍以其轉錄的官方許可證字號/欄位為準——這兩站是逐筆轉錄 TFDA 資料庫的公開資料倒影，不是評論/整理性質的第三方網站）。
- TFDA 醫療器材許可證查詢系統（`lmspiq.fda.gov.tw`）需要圖形驗證碼（CAPTCHA）才能查詢，依規則不得繞過，故未能直接查询官方資料庫做逐筆許可證驗證；改以「TFDA/疾管署/健保署自行發表的PDF」＋「醫院官網檢驗項目頁」＋「學會/期刊文獻」＋「政府開放資料轉錄站顯示的許可證字號」交叉佐證。
- 健保署（NHI）網站搜尋功能未能穩定取得可用結果，改用 Google 搜尋健保碼，成功取得「流感病毒抗原快速檢測」健保診療項目代碼 **14065C（A型）／14066C（B型）**，各150點，並由多家醫院檢驗科網頁交叉確認。

## 分類與總表

| 機型 | 類別 | 台灣證據 | IFU/文件版本 | 效能摘要(對PCR/對照法) | 狀態 |
|---|---|---|---|---|---|
| Vstrip Flu A&B Rapid Test（寶齡富錦/飛確） | RIDT | 官網產品頁＋DM列健保碼14065C/14066C | 中文/英文DM（非完整仿單），僅列LOD | Flu A LOD 1.0×10²pfu/mL；Flu B LOD 1.0×10³pfu/mL；未列臨床敏感度 | 台灣在用(有證據) |
| Formosa One Sure Flu A/B Rapid Test Kit（台塑生醫迅知） | RIDT | TFDA許可證衛部醫器製字第006720號(轉錄)＋2篇台灣ICU期刊實際採用為對照法 | 未取得原廠IFU | 未確認 | 台灣在用(有證據，IFU未取得) |
| BD Veritor System for Rapid Detection of Flu A+B | DIA | 元氣網醫材資料庫＋義大醫院檢驗實習手冊＋醫檢學會研討會資料 | FDA 510(k) K180438 (2018) | Flu A PPA 83.6%/NPA 97.5%；Flu B PPA 81.3%/NPA 98.2%（對PCR） | 台灣在用(有證據) |
| Sofia / Sofia 2 Influenza A+B FIA（Quidel） | DIA | 疾管署自行執行之台灣本土73件檢體效能研究(2014) | 疾管署《疫情報導》原著文章＋FDA 510(k) K162438 | 台灣本土：Flu A整體敏感度68.2%(Cp<30時85%↑)；Flu B 45.5%(Cp<30時69%)；特異度100% | 台灣在用(有疾管署研究，商用通路未確認) |
| BinaxNOW Influenza A & B Card 2 | RIDT(可選配Reader) | TFDA許可證(轉錄)＋北部醫學中心H1N1病例分析(NICS)＋醫檢學會論文以此為收案標準 | Abbott/Alere原廠IFU (2018-08) | Flu A敏感度84.3%/特異度94.7%；Flu B敏感度89.5%/特異度99.4%（對RT-PCR，含DIGIVAL reader） | 台灣在用(有證據) |
| ASAN Easy Test Influenza A/B（聯新代理） | RIDT | TFDA許可證衛部醫器輸壹字第019118號(轉錄) | 未取得 | 未確認 | **許可證已於2025/09/09註銷**，非現行在用 |
| cobas Liat Influenza A/B（含SARS-CoV-2組合） | POC-NAAT | 台中榮總檢驗項目頁具名SOP編號＋元氣網醫材資料庫＋急診醫學會＋感控學會表三 | FDA CLIA Waiver CW220014 | Flu A前瞻PPA 94.7%/NPA 99.7%，回溯PPA 97.7%/NPA 99.2%；Flu B回溯PPA 100%/NPA 100% | 台灣在用(有證據) |
| ID NOW Influenza A & B 2 | POC-NAAT | 急診醫學會具名列為代表產品＋北榮醫工部醫材警訊具名採購證據＋感控學會表三 | Abbott原廠Product Sheet | Flu A敏感度96.3%(直接拭子)/92.8%(VTM)；Flu B敏感度100%/100%；特異度97-98%（對PCR） | 台灣在用(有證據，含醫材警訊佐證院內採購) |
| Xpert Xpress Flu/RSV（及CoV-2/Flu/RSV plus） | POC-NAAT | 急診醫學會＋感控學會表三＋北榮醫工部2024醫材警訊具名採購證據 | Cepheid原廠IFU 301-6580 Rev.H (2022-12) | Flu A合併PPA 98.1%/NPA 98.8%；Flu B合併PPA 100%/NPA 99.1%（NP swab，對FDA核准分子對照法） | 台灣在用(有證據，含醫材警訊佐證院內採購) |
| BioFire FilmArray Respiratory Panel(RP/RP2/RP2.1，含Pneumonia Panel) | POC-NAAT | 成大醫院/長庚檢驗項目頁具名＋台大醫院雙中心研究新聞報導＋高雄榮總/雙和醫院回溯研究＋內科醫學會教學簡報＋感控學會表三 | FDA 510(k) K170604 (RP2) | Flu A整體PPA 100%(78/78)/NPA 100%；Flu B整體PPA 100%(14/14)/NPA 99.9%（前瞻性臨床試驗） | 台灣在用(有證據，多家醫學中心) |
| Quidel Solana Influenza A+B Assay | POC-NAAT | TFDA許可證(轉錄，台灣代理商「台灣快密刀科技」) | 未取得 | 未確認 | 未確認(僅TFDA許可證紀錄，無醫院使用證據) |
| QuidelOrtho Savanna RVP4/PCR system | POC-NAAT | 無 | 未取得 | 未確認 | 未確認，列為市面可見機型(查無台灣證據) |
| GeneReach POCKIT Influenza(H3N8/H5禽流感) | POC-NAAT(動物用) | 廠商官網/代理商網頁 | 不適用 | 不適用 | **非人用臨床流感檢驗**(動物/水產檢疫用途，排除) |

## 判斷「台灣最常見」的排序與理由

排序依據：(1) 有具名醫院檢驗科網頁/院內SOP編號佐證使用中；(2) 有醫學會/期刊文獻具名引用做臨床研究對照方法；(3) TFDA許可證是否現行有效；(4) 是否有健保給付代碼可查。

1. **傳統RIDT（Vstrip、Formosa One Sure Flu A/B）— 基層診所/健保給付最普及的第一線**
   - 理由：這兩個是「台灣本土製造」且有健保診療代碼(14065C/14066C，各150點)可直接對應，是基層診所最常見、最便宜的第一線流感篩檢方式；Formosa One Sure更被兩篇台灣ICU重症流感期刊研究引用為RIDT對照方法，證明其不只用於基層也用於醫學中心研究。
   - 證據強度：中高（TFDA許可證明確、健保碼明確，但未取得完整臨床效能IFU）。

2. **POC-NAAT（cobas Liat、Xpert Xpress、ID NOW、FilmArray）— 醫學中心/急診/檢驗科的實際主力**
   - 理由：這四款是台灣各大醫學中心（台中榮總、台北榮總、台大、成大、長庚、高雄榮總、義大、雙和）檢驗科網頁、院內SOP、醫工部醫材警訊、學會教學簡報中「唯一具名且反覆出現」的分子快速診斷機型，且都被台灣感染管制學會〈呼吸道病毒感染之實驗診斷〉表三正式列為「具台灣衛署許可證市售檢測試劑」。北榮醫工部的醫材警訊公告特別有力——那是院內真實採購清單的第一手證據（警訊是因為機器出問題才公告，间接證明真的在用）。
   - 台灣醫學中心內部排序（依證據密度，非市佔率）：cobas Liat 與 FilmArray 證據最多（多家醫院具名SOP/檢驗項目頁），其次 Xpert Xpress 與 ID NOW（急診醫學會＋北榮醫材警訊）。
   - 證據強度：高（多重獨立來源交叉確認）。

3. **DIA（BD Veritor）— 部分醫院檢驗科的中間選項**
   - 理由：義大醫院醫事檢驗實習手冊具名列為院內實際使用試劑，台灣醫檢學會研討會資料也提及BD Veritor Plus在流感高峰期的應用效益；但證據密度低於POC-NAAT系列（只找到1-2家醫院的具名證據）。
   - 證據強度：中（有具名醫院使用證據，但數量少於POC-NAAT組）。

4. **Sofia FIA — 疾管署曾自行評估，但未見台灣醫院採購證據**
   - 理由：疾管署2014年發表的原著論文本身就是最強的「台灣官方本土使用」證據（疾管署買了機器來測73件台灣檢體），研究結論也影響了台灣對這類「新式流感快篩試劑」的認識；但除了這篇官方論文外，未查到任何台灣醫院檢驗科網頁或商用經銷證據，代理通路狀態不明。
   - 證據強度：中（官方研究證據極強，但缺乏「現行臨床採購」的旁證）。

5. **BinaxNOW — 有歷史使用證據，但屬較舊世代機型**
   - 理由：北部醫學中心H1N1病例分析(2009年疫情期間)與醫檢學會2019年論文都明確以BinaxNOW作為收案的常規篩檢工具，證明它至少在2009-2019年間是台灣醫院常用機型；但近年（2020年後）查無新的具名使用證據，可能已逐漸被DIA/POC-NAAT取代。
   - 證據強度：中（歷史證據強，近年證據缺乏）。

## 排除或標記為「未確認/已停用」的機型

- **ASAN Easy Test Influenza A/B（聯新代理）**：TFDA許可證已於2025/09/09正式註銷，判斷非現行在用機型，未再花力氣尋找IFU。
- **Quidel Solana Influenza A+B Assay**：僅查到TFDA許可證轉錄紀錄（代理商為台灣快密刀科技），但完全查無任何台灣醫院/檢驗科使用的網頁證據，也沒找到IFU；列為「未確認」。
- **QuidelOrtho Savanna RVP4／Savanna PCR系統**：查無台灣TFDA許可證證據，也查無醫院使用證據，僅有國際新聞稿提及在歐洲上市；列為「未確認，市面可見機型」。
- **瑞基海洋 GeneReach POCKIT系列**：這是台灣本土知名的分子檢測(iiPCR)廠商，COVID-19/腸胃道病原檢測相當知名；但其「流感」相關產品線（POCKIT Influenza H3N8、H5禽流感等）查證後屬**動物/水產檢疫用途**，非人用臨床流感診斷，故從清單中排除，只做說明性註記。
- **亞諾法生技**：搜尋後未發現其有明確的流感檢驗相關產品（該公司主力為分子生物試劑/耗材而非IVD診斷試劑），未列入清單。
- **台塑生醫（Formosa Plastics/FBC）COVID+流感二合一新品**：2025年底才通過TFDA核准，2026年初才上市，屬於太新的產品、暫時查無醫院使用證據，故清單中只列其較舊的單純Flu A/B版本(Formosa One Sure Flu A/B，衛部醫器製字第006720號)，二合一新品未單獨立項。

## 抓不到的東西與原因

1. **Formosa One Sure Flu A/B 原廠完整IFU**：官網(fbc.com.tw)目前主推COVID-19快篩與COVID+流感二合一新品，單純Flu A/B產品的完整仿單/IFU PDF未能在官網或第三方站點找到直接下載連結；改以TFDA許可證字號＋2篇台灣期刊引用作為佐證。
2. **Quidel Solana / QuidelOrtho Savanna 台灣使用證據**：Google搜尋多輪查證後仍查無台灣醫院或代理商網頁具名使用證據，判斷這兩款機型即使有TFDA許可證，實際市佔率可能很低或尚未大量鋪貨。
3. **健保署官網搜尋功能不穩定**：`nhi.gov.tw` 網站搜尋框互動多次未能正確導向搜尋結果頁（可能是該站的搜尋是JS驅動、與Chrome自動化互動不完全相容），改用Google `site:nhi.gov.tw` 與一般查詢間接取得14065C/14066C代碼；未能直接開啟NHI官方支付標準PDF全文核對代碼所在章節（僅由多家醫院檢驗科網頁交叉確認代碼與點數一致）。
4. **TFDA醫療器材許可證查詢系統（lmspiq.fda.gov.tw）**：需圖形驗證碼，依安全規則不得由AI協助完成CAPTCHA，故本次所有「TFDA許可證字號」均來自(a) TFDA自行發布的PDF文件（如流感快篩試劑品質調查論文）、(b) 政府開放資料轉錄站（諸彼特`data.zhupiter.com`、元氣網`health.udn.com`）逐筆轉錄TFDA資料庫的公開資料頁面、(c) 廠商官網/經銷商網頁上自行標示的許可證字號。這些字號均為轉錄或廠商自報，未經本人直接向TFDA官方查詢系統核對，嚴謹度略低於直接查詢，使用時建議使用者可自行至TFDA官網人工查詢驗證碼後複核。
5. **Sofia FIA / Solana的台灣代理商現況**：只查到疾管署2014年的研究與TFDA許可證轉錄，無法確認這兩款機型目前在台灣是否仍有代理商積極銷售、或已淡出市場——已在manifest中誠實標註為「未確認」。
6. **各機型是否有兒童/成人分層數據**：多數原廠IFU未明確依年齡分層列出流感A/B敏感度/特異度（FilmArray RP2的Table 29雖列出H1N1/H3N2/H1亞型，但仍非年齡分層）；BD Veritor K180438文件中僅提到「年輕受試者敏感度較高」的定性描述，未附具體年齡分層數字表。

## 檔案清單（sources/流感/檢驗/）

已下載/列存的PDF共 19 個檔案，詳細 sha256、頁碼、效能頁碼皆記錄於 `_manifest_TEST.json`。重點：

- **原廠/官方IFU或FDA決定摘要**（供逐字定位效能表）：
  - BDVeritor_FluAB_510k_K180438_FDA.pdf（含Table 1效能表於page2）
  - BDVeritor_FluAB_510k_K223016_FDA.pdf、BDVeritor_FluAB_510k_K232434_FDA.pdf（皆為後續硬體/軟體修改案，效能表沿用K180438，留存供版本追溯）
  - Sofia2_InfluenzaAB_510k_K162438_FDA.pdf
  - BinaxNOW_FluAB_Card2_IFU_Abbott.pdf（page10效能表）、BinaxNOW_FluAB_Card2_510k_K181853_FDA.pdf（僅演算法修改案）
  - cobasLiat_InfluenzaAB_CLIA_CW220014_FDA.pdf（page15-16效能表）
  - IDNOW_FluAB2_ProductSheet_Abbott.pdf（page2效能表）、IDNOW_FluAB2_510k_K191534_FDA.pdf（僅演算法修改案）
  - XpertXpress_FluRSV_IFU_Cepheid.pdf（page27-29效能表）、XpertXpress_FluRSV_510k_K201849_FDA.pdf（僅檢體介質相容性案）
  - FilmArrayRP2_510k_K170604_FDA.pdf（page49-50 Table 29效能表）、FilmArrayRP_510k_K160068_FDA.pdf（原始RP版本彙總數字）
  - Vstrip_FluAB_IFU_中文.pdf、Vstrip_FluAB_IFU_English.pdf（簡式仿單，無完整效能表）
- **台灣官方研究/彙整文件**：
  - CDC_TW_Sofia流感快篩效能評估_2014.pdf（疾管署本土73例研究）
  - TFDA_流感快篩試劑品質調查.pdf（TFDA 2013年市場調查，J Food Drug Anal）
  - NICS_呼吸道病毒感染之實驗診斷.pdf（台灣感染管制學會表三，POC-NAAT機型清單關鍵佐證）
- **CDC(美國)方法總表**：
  - CDC_Table1_InfluenzaTestingMethods.pdf（本次新增）
  - （原先已存在於 `sources/流感/` 上層目錄的 `CDC_流感檢驗指引_Testing_Methods.pdf` 與 `CDC快速診斷檢測臨床指引_RapidDiagnosticTesting.pdf` 為前次任務已下載，本次未重複抓取）

## 回報總表（濃縮版）

| 排序 | 機型類別 | 台灣證據強度 | 一句話結論 |
|---|---|---|---|
| 1 | RIDT本土製造(Vstrip/Formosa) | 中高 | 基層診所最普及，健保碼14065C/14066C明確 |
| 2 | POC-NAAT(cobas Liat/Xpert Xpress/ID NOW/FilmArray) | 高 | 醫學中心/急診真正主力，多院具名SOP+醫材警訊佐證 |
| 3 | DIA(BD Veritor) | 中 | 部分醫院使用，證據少於POC-NAAT |
| 4 | DIA(Sofia FIA) | 中(官方研究強/商用弱) | 疾管署做過本土評估，未見醫院採購證據 |
| 5 | RIDT(BinaxNOW) | 中(歷史強/近年弱) | 2009-2019年常見，近年證據消失 |
| 排除 | ASAN(已註銷)/Solana/Savanna(未確認)/GeneReach(動物用) | 低/不適用 | 見上方明細 |
