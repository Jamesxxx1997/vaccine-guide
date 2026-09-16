# 下載紀錄 — 流感疫苗銜接：曾有輕微過敏反應者，接種前/後 routine 給抗組織胺或類固醇？

任務日期：2026-09-16。目標：找到能回溯本機 PDF 原件的逐字原句，回答「曾有輕微過敏反應的人，接種流感疫苗前/後要不要 routine 給抗組織胺或類固醇」。

---

## 1. 疾管署《接種注意事項》Q&A（流感疫苗）

- URL: https://www.cdc.gov.tw/Category/QAPage/DJgcTnIjWNFo1qKKVEN_Ig
- 存檔: `疾管署_流感疫苗接種注意事項QA_網頁列印.pdf`（用 `node tools/print_web_source.mjs` + `--expand "全部展開"` 印出，expandedClicks=2）
- pdfinfo: 5 頁；pdftotext 字數 259；sha256 `7a552703d9607a09b06dc3009c0594d7892b78490aa653afc30ec721ffbd5cc0`
- 各題「最後更新日期」不同：多數題目 2026/8/7，雞蛋過敏題與抗血小板藥物題為 2026/8/14，誤接種年齡題為 2026/5/11。
- 找到的原句：
  - p.1（禁忌症）：「1. 已知對疫苗的成分有嚴重過敏者，不予接種。2. 過去注射曾經發生嚴重不良反應者，不予接種。3. 另外未滿6個月大之嬰兒因缺乏安全性與保護力相關資料，不建議接種。除此以外包括食物過敏、輕微上呼吸道症狀者，均可安心接種流感疫苗。」→ **食物過敏非禁忌，但「嚴重過敏反應」才是禁忌**（本題問「輕微」過敏反應，不落在禁忌範圍）。
  - p.2（雞蛋過敏題，2026/8/14更新）：「可以。……因流感疫苗製程進步，內含的雞蛋蛋白成分已極少，雞蛋過敏者接種雞胚蛋培養之流感疫苗並不會增加過敏反應發生率，因此國際上皆建議雞蛋過敏者可安心照一般流程接種流感疫苗。」
  - p.3（接種後注意事項，2026/8/7更新）：「接種疫苗後有相當小的機率會發生立即型過敏反應，並導致過敏性休克。為了能在事件發生後立即進行醫療處置，接種疫苗後應於接種單位或附近稍做休息，並建議於接種後應坐或躺約15分鐘，離開後請自我密切觀察15分鐘，以避免因發生昏厥而摔倒受傷。」
- **本頁未直接回答「是否 routine 給抗組織胺/類固醇」**——通篇找不到「抗組織胺」「類固醇」字樣。可作間接佐證：官方列出的唯一「常規措施」是15分鐘留觀，並非給藥。

---

## 2. 美國 CDC 舊站《Management of Anaphylaxis at COVID-19 Vaccination Sites》

- URL: https://archive.cdc.gov/www_cdc_gov/vaccines/covid-19/clinical-considerations/managing-anaphylaxis.html
- 存檔: `CDC美國_COVID疫苗嚴重過敏反應處置_舊站存檔.pdf`
- pdfinfo: 8 頁；pdftotext 字數 2978；sha256 `c7a17a8b7e3f71f6c27ba53328862bfd07baca3c1a5de6613e24aeb690ee4c59`
- 頁面標示 "Last Reviewed: April 2, 2024"；修訂紀錄最後一次實質修改為 2022-02-11。
- 找到的原句：
  - p.2：「Antihistamines may be given as adjunctive treatment but should not be used as initial or sole treatment for anaphylaxis.」
  - p.4：「Epinephrine (1 mg/ml aqueous solution [1:1000 dilution]) is the first-line treatment for anaphylaxis and should be administered immediately, as an intramuscular injection. A dose of epinephrine may be repeated approximately every 5-15 minutes if symptoms do not improve or if they return while waiting for EMS. … Because of the acute, life-threatening nature of anaphylaxis, there are no contraindications to epinephrine administration.」
  - p.5（**本題最直接的英文原句**）：「Antihistamines (e.g., H1 or H2 antihistamines) and bronchodilators do not treat upper airway obstruction (laryngeal edema) or hypotension and, thus, are not first-line treatments for anaphylaxis. … in a patient with anaphylaxis they should only be administered after epinephrine. **Administration of antihistamines to COVID-19 vaccine recipients prior to vaccination to prevent anaphylaxis is not recommended.**」
  - p.5：「Because anaphylaxis may recur after patients begin to recover, monitoring in a medical facility for several hours is advised, even after complete resolution of symptoms and signs.」

---

## 3. 美國 CDC《Flu Vaccines and People with Egg Allergies》

- URL: https://www.cdc.gov/flu/vaccines/egg-allergies.html
- 存檔: `CDC美國_流感疫苗蛋過敏.pdf`
- pdfinfo: 2 頁；pdftotext 字數 590；sha256 `4bc8fed83c49b014c529a93a3a08a6e430b0238eae1863a0480a643c7c184061`
- 頁面標示日期：SEPTEMBER 17, 2024
- 找到的原句：
  - p.1：「Beginning with the 2023-2024 season, additional safety measures are no longer recommended for flu vaccination of people who are allergic to eggs beyond those recommended for receipt of any vaccine, **regardless of the severity of previous reaction to egg**. All vaccines should be administered in settings in which personnel and equipment needed for rapid recognition and treatment of allergic reactions are available.」

---

## 4. 疾管署舊教材《認識流感疫苗》教學手冊（防疫學苑系列031）第五章 流感疫苗安全性

- URL: https://www.cdc.gov.tw/uploads/files/9229ebe8-c089-4ab3-980a-fe0e38b1d16f.pdf（curl 直接下載，HTTP 200）
- 存檔: `疾管署_第五章流感疫苗安全性_歷史教材.pdf`（278頁全書，非僅第五章單獨檔）
- pdfinfo: 278 頁；pdftotext 字數 17722；sha256 `d3dc0c88a0f867ca68fad98ac48d659952ab9a5dbd736738f2a56cfd6ac904e5`
- 年代：PDF CreationDate 2011-04-07；ISBN 978-986-02-6706-8 → **★歷史文件，做法已過時**
- 找到的原句：
  - p.122：「大多數專家都建議，接種完疫苗應留在醫療院所觀察30分鐘；如果不幸發生了立即型過敏症狀，應住院觀察至少24小時才可出院，以避免發生第二波反應。」（舊版留觀時間，現行 TW QA 頁改為15分鐘）
  - p.128：「對於疫苗引起的立即型過敏的治療……應馬上肌肉注射腎上腺素（成人0.3～0.5mL 1：1,000 sol'n，兒童0.01mL／kg，minimum 0.1mL），並給予口服抗組織胺。若效果不彰，腎上腺素可每10分鐘給一劑，最多給三劑。若病人症狀已經緩解，要持續給口服抗組織胺與類固醇共48小時。」（**這是「反應發生後」的治療流程，非「接種前」的預防性投藥**）
  - p.129：「除上述急救之外，建議同時給予H1和H2受器阻斷劑……以及類固醇。……症狀緩解後，輕微症狀者至少觀察四小時，嚴重症狀者至少觀察24小時始可出院。」
  - p.136：「若被接種者曾有輕微雞蛋過敏的病史（除立即型過敏以外）……可以採取兩階段式接種法：先接種十分之一的劑量，30分鐘後無症狀產生，再接種剩下十分之九的劑量，並再觀察30分鐘始可離去。」（**此「兩階段式接種法」已被 2023-24季起的新版建議取代，見上方第3份文件**）
- **結論：即使是2011年舊版教材，通篇也找不到「接種前常規給抗組織胺或類固醇以預防過敏反應」的建議語句**——舊版與新版一致：抗組織胺/類固醇只出現在「反應發生後的治療」段落，從未作為「接種前預防性投藥」被建議過。舊版與新版的差異在於：①留觀時間（30分鐘舊 vs 15分鐘新）、②雞蛋過敏處置方式（兩階段式接種舊 vs 直接正常接種新）。

---

## 5. CDC 現行《General Best Practice Guidelines for Immunization》S57（本站既有檔案，未重抓，僅補查頁碼原句）

- 檔案: `sources/感染後間隔/CDC疫苗接種通則_General_Best_Practice_Guidelines_for_Immunization.pdf`（既有）
- pdfinfo: 197 頁；pdftotext 字數 55672；sha256 `0e701421801dbc07b1fdeb3a8ebb4958295d9fbdc46980f46c8e3539d6dce4a4`
- 用 `pdftotext -layout` 全文搜尋 "premedicat"/"antihistamine"/"corticosteroid"/"routine" 等關鍵字，找到：
  - p.74（Preventing and Managing Adverse Reactions 章節開頭）：「The best practice to prevent allergic reactions is to identify individuals at increased risk by obtaining a history of allergy to previous vaccinations and vaccine components that might indicate an underlying hypersensitivity.」→ **預防過敏的官方建議做法是「問過敏史以識別高風險者」，不是「常規給藥」**。
  - p.82（Table 5-1，兒童 anaphylaxis 處置表）：「IM epinephrine (1 mg/mL preparation): Epinephrine 0.01 mg/kg … If there is no response or the response is inadequate, the injection can be repeated in 5 to 15 minutes (or more frequently). … H1 antihistamine: Consider giving diphenhydramine 1 mg/kg (max 50 mg) IV … H2 antihistamine: Consider giving famotidine 0.25 mg/kg (max 20 mg) IV … Glucocorticoid: Consider giving methylprednisolone 1 mg/kg (max 125 mg) IV.」
  - p.83（Table 5-2，成人 anaphylaxis 處置表）：「IM epinephrine (1 mg/mL preparation): Give epinephrine 0.3 to 0.5 mg intramuscularly … Can repeat every 5 to 15 minutes (or more frequently), as needed. … Adjunctive therapies: H1 antihistamine … H2 antihistamine … Glucocorticoid: Consider giving methylprednisolone 125 mg IV.」
  - p.84（表格附註）：「(a) These medications should not be used as initial or sole treatment.」→ 明白限定 H1/H2/類固醇只能是「輔助」，且是**反應發生後**的輔助治療，非接種前預防。
  - p.97（類比佐證，非同一藥物類別）：「Evidence does not support use of antipyretics before or at the time of vaccination; however, they can be used for the treatment of fever and local discomfort that might occur following vaccination.」→ 對「接種前常規給退燒藥」持相同的不建議立場，邏輯結構與本題相似，但**藥物類別不同（退燒藥非抗組織胺），不可直接引用為抗組織胺的答案，僅供類比佐證**。
  - **全文檢索未找到任何「接種前常規給抗組織胺/類固醇」的建議句**——搜尋 "premedicat" 全文零命中。

---

## 6.（追加範圍）疾管署《COVID-19疫苗接種場所嚴重過敏反應處置建議》2021（本站既有檔案，未重抓，僅補查頁碼原句）

- 檔案: `sources/過敏指引/疾管署_COVID19疫苗接種場所嚴重過敏反應處置建議_2021.pdf`（既有；原始下載網址未記錄，本次未查證）
- pdfinfo: 3 頁；pdftotext 字數 220；sha256 `0df26911b867faad03367ea69afbf949183f102ef0aa66362317467993c0c1dc`
- 年代：檔名標註2021；內文未查證確切發布/更新日期
- 找到的原句（**★本題最直接命中的中文原句**）：
  - p.2（急救藥物設備分級）：「Ａ. 一定要具備：腎上腺素、血壓計。Ｂ. 建議具備：氧氣（oxygen）、抗組織胺藥物（如 diphenhydramine, cetirizine）、類固醇（steroid）、支氣管擴張劑（bronchodilator）……」
  - p.2（腎上腺素劑量與重複給藥間隔）：「對於發生嚴重過敏反應如低血壓、呼吸道水腫、及呼吸困難的病人，應立即注射腎上腺素（濃度 1:1000，1mg/ml）：不論大人或小孩，肌肉注射劑量為 0.01mg/kg，成人最大注射量為 0.5mg/劑，兒童為 0.3mg/劑。如果使用腎上腺素自動注射器，成人單次劑量為 0.3mg……25 公斤以下兒童，單次劑量為 0.15mg，體重介於 26 至 50 公斤，單次劑量為 0.3mg。若症狀未改善，可每 5 至 15 分鐘重覆注射一次。完整記錄注射劑量及時間。由於全身性嚴重過敏反應可能危及生命，故使用腎上腺素時，並無禁忌症。」
  - p.3：「腎上腺素為當發生全身性嚴重過敏反應時第一線治療藥物。抗組織胺藥物（如 H1, H2 抗組織胺藥物）及支氣管擴張劑不能治療呼吸窘迫或低血壓，因此這些藥物並非全身性嚴重過敏反應第一線的治療藥物。抗組織胺藥物可幫助舒緩蕁麻疹發癢，而支氣管擴張劑則可減緩呼吸窘迫之不適，但應於使用腎上腺素治療後再提供。**不建議於接種 COVID-19 疫苗前，使用抗組織胺藥物作為預防過敏之用藥。抗組織胺藥物無法避免嚴重過敏反應之發生，且該預防性用藥可能使皮膚等相關症狀被掩蓋住，以致於延誤過敏反應之診斷與治療。**因全身性嚴重過敏反應可能於症狀緩解又再度發作，故建議發生全身性嚴重過敏反應病患需留院觀察至少 4 小時。」
- 標題雖限定COVID-19疫苗，但過敏處置原則（腎上腺素第一線、抗組織胺為輔助非預防）是通用型過敏處置知識，與流感疫苗場景可類推套用（網頁引用時應標註「COVID疫苗指引，過敏處置原則通用」）。

---

## 抓不到的項目與原因

- 「疾管署現行『預防接種後嚴重過敏反應處置』或『疫苗接種場所嚴重過敏反應處置』更新版 PDF」（追加範圍 d 項）：**未抓到**。WebSearch 額度已用完，無法搜尋確認現行版網址；嘗試以既有檔案的猜測路徑（`cdc.gov.tw/File/Get/...`）探測 1 次，回傳 400 Bad Request（已刪除該失敗探測檔），未再嘗試第二個猜測網址以免產生更多無效請求。若使用者能提供確切網址，可再抓。
- 疾管署《接種注意事項》Q&A 頁本身**未正面回答**「輕微過敏反應者接種前/後是否 routine 給抗組織胺/類固醇」——頁面通篇無「抗組織胺」「類固醇」字樣，僅有禁忌症（嚴重過敏反應）與15分鐘留觀建議。此點已如實記錄，不代表抓取失敗，而是頁面內容本身的限制；本題答案需綜合第2、5、6份文件的通用過敏處置原則類推。
