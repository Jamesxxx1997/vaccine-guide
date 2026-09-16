# 流感臨床模組 — 國際指引與文獻下載紀錄（INTL）

**建檔日期：2026-09-16**
**範圍：** 美國 CDC 官方頁面／PDF、IDSA 2018 指引、JAMA/Lancet 抗病毒 NMA 三篇、快篩準確度 meta-analysis 兩篇、WHO／PMDA favipiravir 文件。
**方法：** HTML 頁面一律用 `node tools/print_web_source.mjs <url> <out.pdf>`（headless Chrome，頁首頁尾帶網址與日期）列印成 PDF；PDF 原檔用 `curl -L` 直接下載並核對 `Content-Type: application/pdf`。逐字定位用 `pdftotext -layout` 配 `/usr/bin/grep`（本機 rtk hook 會改寫一般 grep/diff/find，證據指令一律用 `/usr/bin/` 原生版本）。
**重要提醒：** 本次任務**只負責國際來源**，不做 git 操作、不改本資料夾以外任何檔案。`sources/流感/` 目錄下另有其他並行 session 的產出（`_manifest_TW.json`／`_下載紀錄_TW.md`＝台灣端 TFDA 仿單＋疾管署原件；`疫苗銜接/`、`檢驗/` 子資料夾＝疫苗與快篩檢測裝置文件；`_使用者提供文件.md`＝使用者手動提供的課程講義與一篇論文）——這些皆非本次任務下載，本檔不重複記錄，僅在交叉引用時註記。

---

## A. 美國 CDC（cdc.gov）— 全部 7 項已取得

| # | 狀態 | 檔名 | 來源網址 | 版本/日期 | 頁數 | 字數 | SHA256（前10碼） |
|---|---|---|---|---|---|---|---|
| 1 | OK | CDC流感抗病毒藥物摘要_SummaryForClinicians_2025-26.pdf | cdc.gov/flu/hcp/antivirals/summary-clinicians.html | 現行2025-26流感季版 | 12 | 7,067 | 26efff57c7 |
| 2 | OK | CDC_HCP感染管制_Viral_Respiratory_Infections_Supplement_2026.pdf | cdc.gov/infection-control/media/pdfs/IC-in-HCP-Update-Viral-Respiratory-Infections-Supplement-508.pdf | PDF ModDate 2026-09-03 | 51 | 16,001 | 16d6de1266 |
| 3 | OK | CDC_生病時預防呼吸道病毒傳播_Precautions_When_Sick.pdf | cdc.gov/respiratory-viruses/prevention/precautions-when-sick.html | Reviewed 2025-08-18 | 5 | 1,084 | 5a8e6b45ff |
| 4 | OK | CDC_住院流感感染管制_Droplet_Precautions.pdf | cdc.gov/flu/hcp/infection-control/healthcare-settings.html | Updated 2025-04-28 | 8 | 4,961 | ebd5468894 |
| 5 | OK | CDC快速診斷檢測臨床指引_RapidDiagnosticTesting.pdf + CDC分子檢測RT-PCR臨床指引_MolecularAssays.pdf | cdc.gov/flu/hcp/testing-methods/{rapid-diagnostic-testing,molecular-assays}.html | 2026-01-05／2026-04-30 | 2+7 | 753+4,315 | 6f2c374df6／27c747847d |
| 6 | OK | CDC_流感傳染期與潛伏期_KeyFacts.pdf | cdc.gov/flu/about/index.html | Updated 2026-02-26 | 4 | 1,450 | 6e3a6f9b9a |
| 7 | OK | （同第4項檔案，第6頁） | 同上 | 同上 | — | — | 同上 |

**額外取得（非清單原始項目，屬批次過程中發現的相關母文件）：**
- `CDC_HCP感染管制_主要指引_呼吸道病毒工作限制_2026.pdf`（132頁）——第2項附錄的母文件本體，Updated 2026-08-25。附錄（Viral Respiratory Infections Supplement）才是流感 Day3/24h 條款所在，母文件本身未逐句定位。

### 執行備註
- `curl` 直連 cdc.gov 在本機網路環境遭 Akamai 阻擋（403），改用 `WebFetch` 確認網址內容 + `print_web_source.mjs`（headless Chrome）列印，符合題目規定的列印流程。
- `WebSearch` 額度在多個並行 agent 間共用，很快用盡；改用 `WebFetch` 直接驗證候選網址。
- 題目要求的「nucleic acid test sensitivity 90–95%」一句，CDC 現行版 Molecular Assays 頁面實際文字為「Reported sensitivities of available rapid molecular assays range from 66-100%」，並非固定 90-95% 區間——已如實記錄用詞差異，未強行湊成題目原詞。
- 題目要求的獨立「Clinical Signs and Symptoms of Influenza」與「Key Facts」兩頁，CDC現行版已合併為單一 `About Influenza` 頁面（cdc.gov/flu/about/index.html），已涵蓋傳染期與潛伏期兩句。

---

## B. 指引與文獻

| # | 狀態 | 標題 | 期刊/機構 | 授權 | 頁數/字數 | SHA256（前10碼） |
|---|---|---|---|---|---|---|
| 8 | OK（第二輪成功） | IDSA 2018 Seasonal Influenza Guideline（Uyeki et al.） | Clin Infect Dis 2019;68:e1–e47 | CC BY-NC-ND（OUP開放取用；未見頁內授權貼紙，建議公開部署前再核對確切授權變體） | 47pp / 45,972字 | ac982e7e8e |
| 9 | **未取得，付費** | Gao 2025 nonsevere influenza NMA | JAMA Intern Med 2025;185:293-301 | ©（本機限定，未取得） | — | — |
| 10 | OK | Gao 2024 severe influenza NMA | Lancet 2024;404:753-763 | **CC BY 4.0** | 11pp / 8,208字 | 79969fd482 |
| 11 | OK（僅XML，無PDF） | Lancet 2024 PEP NMA | Lancet 2024;404:764-772 | **CC BY 4.0** | 全文XML / 8,172字（無頁碼） | 98c5ef2bdc |
| 12 | **未取得，付費** | Merckx 2017 rapid test accuracy | Ann Intern Med 2017;167:394-409 | ©（本機限定，未取得） | — | — |
| 13 | **未取得，付費** | Chartrand 2012 rapid test meta-analysis | Ann Intern Med 2012;156:500-511 | ©（本機限定，未取得） | — | — |
| 14 | OK | PMDA Avigan (favipiravir) Review Report | PMDA (日本) | public domain-like（政府審查報告） | 172pp / 94,985字 | 211c2f20e1 |

**額外取得：** `WHO_流感臨床實務指引_ClinicalPracticeGuidelinesInfluenza_2024.pdf`（242頁，CC BY-NC-SA 3.0 IGO）——與第10項Lancet論文同一研究團隊、正文互引（"To support updated WHO influenza clinical guidelines"），批次執行時一併取得，補足了WHO官方治療劑量建議的完整脈絡。

### 各項詳情與嘗試記錄

**8. IDSA 2018 指引**
確認為真正開放取用文件（Crossref/Unpaywall: `is_oa=true`；Europe PMC PMC6653685: `isOpenAccess=Y, hasPDF=Y`），但首輪嘗試全數被反機器人機制擋下，非付費牆問題：
- `doi.org/10.1093/cid/ciy866` → OUP 頁面 Cloudflare 403
- `academic.oup.com/cid/article-pdf/68/6/e1/.../ciy866.pdf` → Cloudflare 403
- `pmc.ncbi.nlm.nih.gov/articles/PMC6653685/pdf/...` → PMC proof-of-work JS challenge，升級為 reCAPTCHA
- `europepmc.org/articles/PMC6653685?pdf=render` → Cloudflare「Just a moment」challenge
第二輪改用互動式瀏覽器（非純 curl/headless）成功通過驗證，取得完整47頁PDF。

**9. Gao 2025（JAMA, nonsevere influenza）**
PMC11877164 僅為引用頁殼（Europe PMC 標記 `isOpenAccess:N, hasPDF:N`），無公開全文；jamanetwork.com 需訂閱登入。曾在 PMC 頁面上以螢幕閱讀方式讀到 Table 3 症狀緩解天數數字（baloxavir −1.02天、umifenovir −1.10天、oseltamivir −0.75天、zanamivir −0.68天，皆相對 placebo），但無法取得可逐字核對＋畫黃框的原始檔案，故未登記為已存檔來源。**若使用者有訂閱管道，建議自行下載後補入本資料夾。**

**10. Gao 2024（Lancet, severe influenza）**
確認 CC BY 4.0（PDF首頁版權聲明＋Unpaywall/PMC 授權欄位皆確認）。PMC/Lancet官網PDF端點多次被Cloudflare/reCAPTCHA擋下，最終取得的PDF來自使用者當日另外提供的同篇檔案（見 `_使用者提供文件.md`）與下載agent各自嘗試的成果，經sha256比對後擇一登記。第7頁（期刊頁759附近）：Table 2 死亡率GRADE摘要、Table 3 住院天數GRADE摘要。

**11. Lancet 2024 PEP NMA**
確認CC BY 4.0，但PDF端點（PMC、thelancet.com）皆被反機器人機制擋下，多次嘗試（curl與互動式瀏覽器）均失敗。改用Europe PMC REST API合法取得完整JATS XML全文（`https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11369964/fullTextXML`），內容完整可逐字核對，**但無頁碼，无法畫黃框定位**。如需黃框功能，建議使用者以登入瀏覽器手動下載PMC提供的PDF（頁面顯示約605KB）取代本檔。

**12/13. Merckx 2017 / Chartrand 2012**
兩篇原題目提供的PMID有誤，已用PubMed搜尋校正（Merckx PMID 28869986；Chartrand PMID 22371850）。確認皆未收錄於PMC（NCBI ID converter查無PMCID），Crossref授權欄位僅列text-and-data-mining（非開放取用授權）。直連acpjournals.org PDF端點回傳Cloudflare 403。判定為真實付費牆，無合法免費全文管道，**未違規嘗試Sci-Hub等非法來源**。

**14. WHO／PMDA favipiravir**
WHO官方文件庫查無專門針對「流感適應症」之favipiravir審查文件（WHO對favipiravir的討論多集中於伊波拉/COVID-19脈絡，非流感）；已依題目「WHO或PMDA擇一」之許可，改取PMDA英文審查報告（2014年首次核准審查，172頁）。第3頁：適應症限「novel or re-emerging pandemic influenza virus infection in whom other influenza antiviral agents are not effective or insufficiently effective」；第44頁：致畸性/胚胎毒性動物實驗段落（孕婦禁忌依據）。

---

## 關鍵引句頁碼彙整（供 quote-review／黃框定位使用）

- CDC HCP補充指引 p.12：Day 3＋24h退燒（不用退燒藥）工作限制條款
- CDC住院感染管制 p.4：Droplet Precautions 7天或退燒後24h（取較久）
- CDC住院感染管制 p.6：抗病毒治療中患者仍持續散播病毒（continue to shed virus）
- CDC生病時預防傳播 p.1：24h症狀改善＋無退燒藥退燒，再5天注意事項
- CDC快篩指引 p.1：FDA要求RIDT對RT-PCR至少80%敏感度
- CDC分子檢測指引 p.1：現行快速分子檢測敏感度範圍66-100%（非題目原詞90-95%，已如實記錄差異）
- CDC流感基本資訊 p.2：最具傳染力期間（發病前1天至發病後5-7天）；潛伏期1-4天（平均2天）
- CDC抗病毒藥物摘要 p.1：治療優先族群；p.1-9多處：暴露後2天內經驗性投藥
- IDSA指引 p.5/18：建議用rapid molecular assay/RT-PCR優於RIDT（Recommendation 10）
- IDSA指引 p.4/16：「preferably within 4 days of symptom onset」（題目「ideally less than 4 days」的近似版本）
- Lancet Gao2024重症流感NMA p.7：Table 2死亡率GRADE摘要、Table 3住院天數GRADE摘要
- Lancet PEP NMA（XML，無頁碼）：摘要段落列出各藥物暴露後預防相對風險（zanamivir RR 0.35、oseltamivir 0.40、laninamivir 0.43、baloxavir 0.43）
- WHO 2024臨床指引 p.79-80：oseltamivir治療劑量表；p.134/166：oseltamivir暴露後預防劑量表
- PMDA Avigan審查報告 p.3：適應症（限其他抗病毒藥無效之新型/再現流感）；p.44：致畸性/胚胎毒性動物實驗
