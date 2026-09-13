# 國際仿單下載紀錄 B（非美國上市疫苗 / 台灣用產品的歐盟英澳紐星官方仿單）

下載日期：2026-09-13
目的：黃框回溯到原文 PDF，故一律要求官方藥政機關現行 SmPC/Product Information 原件（有文字層）。
驗證方法：`file` 確認 PDF、`pdfinfo` 頁數、`pdftotext | wc -w` 字數（要求 >500）、`shasum -a 256`。以下每一項的 hash/頁數/字數皆由主流程重新獨立跑過 `/usr/bin/shasum`、`pdfinfo`、`pdftotext | wc -w` 驗證，與各下載 agent 回報值完全一致。

---

## 1. Hexaxim（六合一，歐盟核准商品名 Hexyon）

- 品名：Hexyon (Hexaxim), suspension for injection in pre-filled syringe — DTaP-IPV-HB-Hib
- 機關：EMA（歐盟集中核准）
- 網址：https://www.ema.europa.eu/en/documents/product-information/hexyon-epar-product-information_en.pdf
- 產品頁：https://www.ema.europa.eu/en/medicines/human/EPAR/hexyon
- 檔案：`六合一_Hexyon(Hexaxim)_EMA_2026-08.pdf`
- 版本：2026-08（EPAR網頁「Product information」分頁 Last updated 07/08/2026，對應程序號 VR/0000295915）
- sha256：`e568d23861dddfe3e060b39a151fc4aa760b88308483c3d532c76ce51a918cf0`
- 頁數：61；字數：14844
- 驗證：PASS（`file` 對此zip deflate流無法回報頁數屬工具限制，`pdfinfo`/`pdftotext` 均正常）
- 問題：現行版SmPC第10節不再印實際修訂日期（僅導向EMA官網），版本改採EPAR網頁標示日期，非文件內部日期，記錄於manifest notes。文件為EPAR合訂本（SmPC+標籤+病人仿單），已在manifest的sections頁碼中區分SmPC本文與PL/標籤重複段落。

## 2. Infanrix hexa（六合一，GSK）

- 品名：Infanrix hexa, powder and suspension for suspension for injection — DTPa-HBV-IPV/Hib
- 機關：EMA（歐盟集中核准）
- 網址：https://www.ema.europa.eu/en/documents/product-information/infanrix-hexa-epar-product-information_en.pdf
- 產品頁：https://www.ema.europa.eu/en/medicines/human/EPAR/infanrix-hexa
- 檔案：`六合一_Infanrix-hexa_EMA_2026-02.pdf`
- 版本：2026-02（EPAR網頁 Last updated 12/02/2026，VR/0000323859）
- sha256：`1781033b6931762f70b3e76ca83affbe8c46943d8ee4983cd22c6195531e12ed`
- 頁數：43；字數：10243
- 驗證：PASS（`file` 誤報7頁，`pdfinfo`/`pdftotext` 正確顯示43頁且人工核對第2/4/14頁內容無誤）
- 問題：同上，未印內部修訂日期。streptomycin未出現於本品成分表（僅neomycin+polymyxin B痕量），與Hexyon不同，已核實非漏抓。

## 3. Tetraxim（DTaP-IPV 四合一，賽諾菲）— 未找到

- 已查：HPRA（0筆authorised products）、MHRA products.mhra.gov.uk（0筆搜尋結果；該站前端已改為Next.js+GraphQL SPA，無法程式化重現查詢語法）、Medsafe（0筆）、HSA新加坡（搜尋頁與InfoSearch皆需解CAPTCHA，依安全規則不嘗試繞過機器人偵測）、medicines.org.uk emc（0筆，且該站目前搜尋結果頁已改為需登入）、sanofi.com官網搜尋無結果。
- 額外查證：加拿大 Health Canada Drug Product Database 有同抗原組成（DT 15Lf/TT 5Lf/PT 20mcg/FHA 20mcg/PRN 3mcg/FIM 5mcg/IPV type1-2-3 29-7-26 units，逐項核對相符）但**品名不同**的產品 **QUADRACEL®**（DIN 02534789，PM PDF：https://pdf.hres.ca/dpd_pm/00083575.PDF，2026-03-04核准）。因 Health Canada 不在使用者原始指定的六個機關清單內、且品名/DIN/監理档案與台灣使用的 Tetraxim 不同，依「抓不到的明說，不用非官方來源湊數」原則，**不將 Quadracel 列入正式 manifest 作為 Tetraxim 的來源**。該 PDF 已下載存放於 `四合一_Tetraxim(Quadracel-HealthCanada同成分)_HealthCanada_2026-03.pdf` 僅供之後參考比對用，manifest 中該 slug 之 agency/url/sha256 等欄位皆為 null，明確標記為未找到。

## 4. Pentaxim（五合一，賽諾菲）— 未找到

- 已查：HPRA（0筆）、MHRA（搜尋僅命中 Tetravac，非 Pentaxim 本身仿單，內容只在腳註提及 Pentaxim/Pentavac，已排除不採用）、Medsafe（0筆）、HSA新加坡（CAPTCHA擋住，未嘗試繞過）、medicines.org.uk emc（0筆）。
- 額外查證：加拿大 Health Canada 有同成分但品名不同的產品 **PEDIACEL®**（DIN 02243167，PM PDF：https://pdf.hres.ca/dpd_pm/00071965.PDF，2023-08-08修訂），含 bovine serum albumin 痕量殘留（Hib結合蛋白製程差異，Tetraxim/Quadracel版無此項）。同樣因非原指定機關、品名不同，**不列入正式 manifest**。PDF 已下載存放於 `五合一_Pentaxim(Pediacel-HealthCanada同成分)_HealthCanada_2023-08.pdf` 僅供參考，manifest 中該 slug 的 agency/url/sha256 等欄位皆為 null。

## 5. Imojev（日本腦炎活性減毒疫苗，賽諾菲／現贊助商 Biocelect）

- 品名：Imojev (Japanese encephalitis virus vaccine, live, attenuated)
- 機關：TGA（澳洲）
- 網址：https://www.ebs.tga.gov.au/ebs/picmi/picmirepository.nsf/pdf?OpenAgent&id=CP-2023-PI-01604-1
- 產品頁：https://www.ebs.tga.gov.au/ebs/picmi/picmirepository.nsf/PICMI?OpenForm
- 檔案：`日本腦炎疫苗_Imojev_TGA_2023-03.pdf`
- 版本：2023-03（文件末頁 Date of Revision: 30 March 2023, Version 6）
- sha256：`dd11e65d7a4676c75349a131f6d512c45faa5743275ee903fd657787481cb2ab`
- 頁數：21；字數：6399
- 驗證：PASS
- 問題：現行 PI 贊助商為 Biocelect Pty Ltd（非 Sanofi，僅 Section 8 欄位異動），首次核准日 2010-08-23。Vero細胞培養，無蛋/明膠/抗生素殘留章節。p.20 出現的 aluminium 僅為安瓿蓋材質敘述，非賦形劑成分。

## 6. Vaxigrip Tetra（四價流感疫苗，賽諾菲）

- 品名：Quadrivalent Influenza Vaccine (split virion, inactivated) — HPRA 登記名稱，即 Vaxigrip Tetra，Sanofi Winthrop Industrie，PA23458/010/001
- 機關：HPRA（愛爾蘭）
- 網址：https://assets.hpra.ie/products/Human/30361/Licence_PA23458-010-001_06062025094241.pdf
- 產品頁：https://www.hpra.ie/find-a-medicine/for-human-use/authorised-medicines
- 檔案：`流感疫苗_VaxigripTetra_HPRA_2025-06.pdf`
- 版本：2025-06（文件末頁 Date of revision of the text: June 2025）
- sha256：`8aa8ab4045fdcbbc8a40f1bc9ddd78a9766eb3dc507aa347083d8908299f37f6`
- 頁數：17；字數：6588
- 驗證：PASS
- 問題：HPRA 登記名稱字面上是「Quadrivalent Influenza Vaccine (split virion, inactivated)」而非「Vaxigrip Tetra」，經核對 licenseHolderName=Sanofi Winthrop Industrie 與同一 PA23458 許可證字軌（與三價 Vaxigrip 同家族），確認為同一產品的愛爾蘭登記名稱。MHRA 因前端已改為 GraphQL SPA 無法程式化查詢、medicines.org.uk emc 需登入，故改採 HPRA 為來源。雞胚培養疫苗，蛋/neomycin/formaldehyde/octoxinol-9 痕量殘留明列於 4.3 禁忌節。

## 7. Stamaril（黃熱病疫苗，賽諾菲）

- 品名：STAMARIL, powder and solvent for suspension for injection in pre-filled syringe (Yellow fever vaccine, live) — PL 23228/0005
- 機關：MHRA（英國）
- 網址：https://mhraproducts4853.blob.core.windows.net/docs/1f39190ffa3fa74f64db2a5a6a957da900d82f45
- 產品頁：https://products.mhra.gov.uk/search/?search=Stamaril&page=1
- 檔案：`黃熱病疫苗_Stamaril_MHRA_2025-01.pdf`
- 版本：2025-01（Date of revision of the text: 04/01/2025）
- sha256：`05fccb6f7a8b8b8489bc8505e5e376f5b5ae8e9e86f3a014bb742cbb05e45e54`
- 頁數：16；字數：4145
- 驗證：PASS
- 問題：無。雞胚培養活性減毒疫苗，含sorbitol E420，egg相關文字於4.3禁忌節。

## 8. Verorab（狂犬病疫苗，賽諾菲；台灣目前實際使用品項）

- 品名：Verorab, powder and solvent for suspension for injection (Rabies vaccine, inactivated, Vero cell-derived) — PLGB 23228/0001
- 機關：MHRA（英國）
- 網址：https://mhraproducts4853.blob.core.windows.net/docs/d0907dcae747d3eb973189eaf334ab315ebcbae7
- 產品頁：https://products.mhra.gov.uk/search/?search=Verorab&page=1
- 檔案：`狂犬病疫苗_Verorab_MHRA_2026-01.pdf`
- 版本：2026-01（Date of revision of the text: 29/01/2026）
- sha256：`cfc9f86da612d77f32c8840d628b61c2b7e2d5dc1f93ccc78458ce26d13fea0b`
- 頁數：16；字數：4683
- 驗證：PASS
- 問題：無。含polymyxin B/streptomycin/neomycin痕量殘留、phenylalanine與human albumin賦形劑，不含蛋/明膠/鋁佐劑。

## 9. Varilrix（水痘疫苗，GSK）

- 品名：Varilrix 10^3.3 PFU/0.5mL Powder and Solvent for Solution for Injection — PL 10592/0121
- 機關：MHRA（英國）
- 網址：https://mhraproducts4853.blob.core.windows.net/docs/765b1f7a88e3f863665e956a04a22e26ed6aed6c
- 產品頁：https://products.mhra.gov.uk/search/?search=Varilrix&page=1
- 檔案：`水痘疫苗_Varilrix_MHRA_2026-08.pdf`
- 版本：2026-08（Date of revision of the text: 25/08/2026）
- sha256：`0303d77c5a6869b2401d69f68a3cb9e3c3de6c67dc87938ce983de491edb43ce`
- 頁數：15；字數：4217
- 驗證：PASS
- 問題：無。僅含微量neomycin，不含gelatin/latex/egg。搜尋時另有4筆Priorix-Tetra/Pentaxim等組合疫苗頁面交叉參照Varilrix之結果，經確認非本品仿單已排除。

## 10. Rabipur（狂犬病疫苗，Bavarian Nordic；台灣未使用，抓到即記錄）

- 品名：Rabipur (Rabies Vaccine Inactivated) Powder and Solvent for Solution for Injection in Pre-filled Syringe — PL 40365/0004
- 機關：MHRA（英國）
- 網址：https://mhraproducts4853.blob.core.windows.net/docs/2c13145eabbe8cb503f4c134c6570a6d02812df5
- 產品頁：https://products.mhra.gov.uk/search/?search=Rabipur&page=1
- 檔案：`狂犬病疫苗_Rabipur_MHRA_2026-05.pdf`
- 版本：2026-05（Date of revision of the text: 20/05/2026）
- sha256：`b3f7afb86adabc034f07adf83c9ae716309467d8d0958df1e7c4832560ec686d`
- 頁數：15；字數：3720
- 驗證：PASS
- 問題：無。意外在MHRA直接找到完整SPC（原以為需退而求其次）。含chlortetracycline及amphotericin B殘留（非任務關鍵字清單，但同屬過敏原相關，供之後定位參考）。台灣實際使用Verorab非Rabipur，本檔僅作補充。

---

## AdimFlu-S（安定伏，國光生技）— 無國際仿單，依指示跳過

台灣本土製造流感疫苗，僅在台灣上市，未於歐盟/英國/愛爾蘭/澳洲/紐西蘭/新加坡等地取得藥證，查無對應之國際 SmPC/PI，故依使用者指示直接跳過不下載。

## 公費 BCG（卡介苗）— 無國際仿單，依指示跳過

台灣公費卡介苗為特定株之官方生物製劑，非國際藥廠商品化產品，無對應之歐盟/英國/澳洲/紐西蘭/新加坡官方 SmPC/PI 可查，故依使用者指示直接跳過不下載。

---

## 總結：本次未達成部分

Tetraxim、Pentaxim 兩支在原指定的六個機關（EMA/MHRA/HPRA/TGA/Medsafe/HSA）與次選 medicines.org.uk 均查無官方仿單。已確認的失敗原因：
1. 這兩個品牌名稱主要透過歐盟各國「國家核准」（非集中核准）上市，例如丹麥 Lægemiddelstyrelsen、波蘭 URPL、義大利 AIFA 等，不在原指定機關內。
2. HSA 新加坡的公開搜尋介面全面需要解 CAPTCHA，依安全規則未嘗試繞過。
3. 賽諾菲在加拿大以不同品牌名（Quadracel/Pediacel）銷售同成分產品，但品名、DIN、監理档案均不同，不能直接充當 Tetraxim/Pentaxim 的官方仿單來源。

若要補齊這兩支，需要使用者授權以下其一：(a) 手動完成 HSA 新加坡的 CAPTCHA 驗證並提供搜尋結果連結；(b) 同意擴大機關範圍至歐盟個別國家核准機關（丹麥/波蘭/義大利等）；(c) 接受 Health Canada 的 Quadracel/Pediacel 作為同成分替代來源（本次已下載但未列入正式 manifest）。

## 補記（2026-09-14）：Pentaxim 已由使用者自 HSA 取得
- 使用者在 HSA Register of Therapeutic Products（需解 CAPTCHA）搜尋 PENTAXIM 下載 package insert，轉存為 `五合一_Pentaxim_HSA_2025-09.pdf`（11 頁、2,855 字、文件標題 Pentaxim PI_v01_September 2025、Sanofi-aventis Singapore）。sha256 與登記見 `_manifest_C.json`，來源 key S93。
- Tetraxim 在 HSA 亦未找到（使用者搜尋結果只有 Pentaxim）。
