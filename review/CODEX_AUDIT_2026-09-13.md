# 2026-09-13 獨立檢查結果

檢查基準：`23b6ca4`。結論：**不通過；資料轉譯與框位通過，但有會改變臨床判讀的程式與摘要錯誤。** 本次只新增檢查腳本、證據與報告，未修改正式資料、未提交或部署。brief 所列既有驗證不作為本次通過依據。

## 1. 優先修正的發現

### F1 — P1：不同品項的共同成分永遠算成空集合

[allergy-guidance.js:83](/Users/jamesxxx1997/vaccine-guide/allergy-guidance.js:83) 把 `{key,label}` 物件傳給只接受字串的 `productAllergen(p,key)`；`a.key===key` 永遠不成立。因此任何不同來源 id 都走 `none`，顯示「可考慮」。第 85 行的標籤與引句查找也有相同型別錯誤，只修第 83 行仍會在原本不可達的分支出錯。

重現：A 選 Shingrix S20，B 選 Arexvy S76。兩者均列 `peg_polysorbate=有`，實際結果卻是「兩支疫苗仿單沒有共同已載明的過敏原」。53 品項共有 2,756 個不同 id 的有序配對，其中 **1,404 個配對具有共同的已載明 key**；目前程式均無法辨識。此數字是依矩陣資料全量計算，並非逐一操作 2,756 次 UI。

原句定位：S20 成分格為「Polysorbate 80」；S76 §11、PDF 第 18 頁為「0.18 mg of polysorbate 80」。兩個實際 UI 重現與全量配對計數見 [ui.json](/Users/jamesxxx1997/vaccine-guide/review/audit-2026-09-13/ui.json)。建議統一以 `k.key` 查找與顯示，加入確實斷言 `shared` 分支及兩端來源 claim 的測試。

### F2 — P1：仿單來源 id 被誤當成實體疫苗身分

[allergy-guidance.js:82](/Users/jamesxxx1997/vaccine-guide/allergy-guidance.js:82) 僅以來源 id 相等決定「同一疫苗」。即使修好 F1，Imojev 的 TFDA S41 → TGA S87 仍會因為是不同 id、且兩份均無本表列出的「有」成分，走「另一支疫苗／可考慮」。不同機關的同品牌仿單不能直接視為換了疫苗。

Shingrix S20 → S58 也重現此問題。S58 §4、PDF 第 5 頁原文包含「after a previous dose of SHINGRIX」，依據是疫苗本身，並非仿單機關。來源：[Shingrix FDA 本機原件](/Users/jamesxxx1997/vaccine-guide/sources/國際仿單/帶狀疱疹_Shingrix_FDA_2026-02.pdf)。建議建立明確的品牌／劑型身分與跨機關對應，不可僅以疾病分類 `vaccine` 判定相同，也不可僅用 S key。

### F3 — P1：Vaxigrip Tetra 漏掉老年人註腳，兩個反應頻率寫錯

[S45 分片第 35–36 行](/Users/jamesxxx1997/vaccine-guide/review/adverse-effects.src.d/S45.json:35) 寫：全身無力「極常見（成人及老年人）」、發燒「常見（成人及老年人）」。

但 [TFDA 本機原件](</Users/jamesxxx1997/vaccine-guide/sources/仿單/流感疫苗_菲流達四價流感疫苗VaxigripTetra(賽諾菲)_TFDA_2022-05-26.pdf>) §4.8、PDF 第 5 頁註腳 **(6)「常見於老年人」** 對應全身無力，**(2)「不常見於老年人」** 對應發燒。本次已直接檢視完整頁面確認對應。兩個 claim 只引用反應名稱，未包含右側頻率或下方註腳，因此引句／框位檢查均可通過而摘要仍錯。

應分別修正老年人頻率，並把頻率欄及適用註腳納入同一筆證據。

### F4 — P1：三格「無抗生素」把培養基的否定擴張成整劑疫苗的否定

| 格子 | 原件章節／PDF 頁碼 | 支持本次疑義的原文短句 |
|---|---|---|
| [S58 other_antibiotics](/Users/jamesxxx1997/vaccine-guide/review/allergens.src.d/S58.json:16) | Shingrix §11、p.16 | “in media containing amino acids, with no albumin, antibiotics” |
| [S76 other_antibiotics](/Users/jamesxxx1997/vaccine-guide/review/allergens.src.d/S76.json:48) | Arexvy §11、p.18 | “in media containing no antibiotics” |
| [S77 other_antibiotics](/Users/jamesxxx1997/vaccine-guide/review/allergens.src.d/S77.json:17) | Abrysvo §11、p.22 | “using chemically-defined media, without antibiotics” |

三句的否定範圍都是上游培養基，後文另有純化、配方等步驟。目前引句不能單獨證明整劑「不含抗生素」。S75 對 “media free from antibiotics and albumin” 卻採「未載明＋related」，可直接確認批次內判讀不一致。

本機原件：[Arexvy](/Users/jamesxxx1997/vaccine-guide/sources/國際仿單/呼吸道融合病毒_Arexvy_FDA_2026-07.pdf)、[Abrysvo](/Users/jamesxxx1997/vaccine-guide/sources/國際仿單/呼吸道融合病毒_Abrysvo_FDA_2025-12.pdf)。另已核對 [FDA Arexvy §11](https://www.fda.gov/media/167805/download?attachment=) 與 [FDA Abrysvo §11](https://www.fda.gov/media/168889/download?attachment=) 的相同措辭。建議補足整劑否定原句；沒有足夠證據時，依本站規則改成「未載明＋related」並補掃描。此發現不表示疫苗實際含有抗生素。

### F5 — P1：流感疫苗嚴重過敏後被一概寫成所有製劑禁忌

[allergy-guidance.js:43](/Users/jamesxxx1997/vaccine-guide/allergy-guidance.js:43) 寫「不論懷疑成分為何，都是未來流感疫苗的禁忌」。本站已保存的 [S24 ACIP 2025–26 原件](/Users/jamesxxx1997/vaccine-guide/sources/感染後間隔/ACIP流感疫苗建議_MMWR2025-26.pdf) **PDF 第 6 頁、Table 3** 卻按先前反應的製劑分類：例如 Any egg-based IIV or LAIV → ccIIV3／RIV3 為 **“Precaution”**，不是全部 Contraindication。

亦已核對 [CDC 2026-09-01 指引 Table 3](https://www.cdc.gov/flu/hcp/vax-summary/seasonal-influenza-vaccines.html)：相同分流仍存在，並要求若接種，須在有能力辨識與處理嚴重過敏反應的醫療環境監督下進行。應使用平台與病史分流，不能把一般通則摘要當成全部製劑的結論。連結未宣稱已定位到高亮；可頁面搜尋 “TABLE 3.”。

### F6 — P2：成分選單會套用不符合所選產品的指引

[KEY_RULE](/Users/jamesxxx1997/vaccine-guide/allergy-guidance.js:60) 將所有 `other_antibiotics` 一律對應 neomycin。重現「其他抗生素 → Jynneos S81」時，上方明寫 gentamicin、ciprofloxacin「非 neomycin」，下方卻接「Neomycin 遲發型反應：非禁忌」。neomycin 專屬原句不能替所有抗生素作判讀。

同樣地，「PEG／polysorbate → Arexvy」會接上 mRNA COVID-19 指引；「蛋 → Stamaril」反而未接上現成的 `egg-yf`。應把成分身分、反應型態與疫苗平台列為規則適用條件；不能僅以合併 key 直接掛規則。

### F7 — P2：notes 守門允許跨列借數字，也未檢查非百分比數字及頻率

[build_adverse_effects.py:142](/Users/jamesxxx1997/vaccine-guide/tools/build_adverse_effects.py:142) 將全表 quotes 串在一起，只檢查 `%`。獨立呼叫產生器的兩個測例均被接受：

- 疼痛原句為 10%，摘要改成 20%，而另一列發燒引句含 20%。
- 原句只有「頭痛」，摘要寫成「頭痛持續 999 天；極常見」。

這不是只有理論漏洞：`ae:shingrix-notes:1` 摘要的 16%、21%、7% 在下一列引句；`ae:flu-vaxigriptetra-freq:0` 摘要「肌痛：極常見（≥1/10）」的本列引句只有「肌痛」。類似反應名／頻率不在同列的清单與 192 筆 notes 原文存於證據檔。

192 列中有 72 列的摘要至少一個數字未出现在同列引句。**72 是候選數，不是 72 個臨床錯誤**：包括 G9 品名、表頭年齡、觀察期等合法上下文。建議同一 claim 同時收錄列、表頭、適用註腳，針對百分比／單位／頻率／反應與人群逐項比對，而不是單純 substring。F3 是已確認的實際錯誤。

### F8 — P2：rebase 後會打包未在本次 run 驗證的程式版本

[pages.yml:56](/Users/jamesxxx1997/vaccine-guide/.github/workflows/pages.yml:56) 在 `npm test` 之後 rebase 到當時最新 main，緊接著打包。若 run 期間 main 有新程式提交，打包的程式已不同於本次測試的版本；workflow_dispatch／schedule 更不會跑完整 npm test。這是對工作流程順序的程式審查結論，並非聲稱已在 GitHub 重現一次錯誤部署。

建議將最終程式版本固定後再驗證與打包；或分離資料快照回寫與網站程式部署。現有迴圈可重試 push 競爭最多三次；rebase 衝突會立即失敗，不是自動解衝突。

## 2. 九項清單的覆蓋結果

| 項目 | 本次獨立结果 |
|---|---|
| 分片 → allergens.js／claims | **通過**：53 品項、530 格、554 claims；status、quote/text、related、note、sweep、id、source、page、region 均無差異。S29/S36/S38 合計 16 個省略 key 依產生器規格展開成未載明，亦核對掃描，未誤報成转譯錯誤。 |
| 918 claims 框位 | **通過**：554 al + 364 ae，55 份 PDF、179 頁、53,537 個 rect。重新讀取本機 PDF glyph，不使用現有定位函式產生預期值；每框對應真實 glyph，與 Poppler 字框有正面積交集，依 rect 順序回讀文字正規化後全部相符。 |
| 判讀一致性 | 全列出 65 個「無」與 9 個指定英文培養關鍵字命中的「有」。F4 及下節列出否定範圍、製程來源規則疑義。 |
| 未載明掃描 | **重掃一致**：53 份 PDF、1,140 頁、343 格，當前 SYN、命中與頁數無差異。另加候選同義詞掃描，只得到 S70 neomycin 的 aminoglycoside 分類與 S91 collagen diseases，均不構成新增成分。 |
| 副作用 notes／S36 | 全量輸出 192 列摘要與數字候選；確定 F3／F7。S36 表 1 的 15 列四欄、表 2 的 7 列兩欄已對照完整 PDF 頁面，發燒 8.7／5.0／1.4／0.5 與 6.5／4.2 正確，未發現錯一列。 |
| 前端 | 53 列、A/B 各 53 品項、徽章、同疫苗相鄰、TFDA 優先通過。指定三問排序第一分別 egg-flu、peg、S20 成分。F1/F2/F6 為額外判讀失敗。 |
| 測試守門 | **npm test 完整通過，exit 0**，但未攔下 F1–F7。另以兩個錯誤摘要輸入確認 F7。建議加入本次幾何檢查及判讀回歸測試。 |
| CI／部署 | 22 個引用 JS/CSS 皆在打包白名單；包裝測試通過。發現 F8。未讀取 GitHub 各 run 遠端日誌，故不獨立背書「今天每次因 CDC 逾時而紅」。 |
| 來源登記／hash | **通過**：67 個 `review/label-claims.json` 中的 `hashes` 全部獨立 SHA-256 一致。`--dry` 新增 0 個 SRC；臨時隔離副本實際連跑登記器兩次，兩次皆無內容變動。brief 的 `label-claims.json.hashes` 指 JSON 欄位，並非獨立檔案。 |

幾何檢查採本站 NFKC＋英數中文字正規化，**不證明標點、≥／≤／% 等符號完整被框，也不證明引句涵蓋整個臨床結論、表頭或註腳**。Poppler 某些字框跨行，因此另用真實 glyph 座標與文字作主要檢查；只靠 Poppler y 中心會有誤報。本次未做全網站視覺／響應式版面檢查。

## 3. 判讀規則與紀錄的次要問題

九個「有＋培養英文詞」逐格結論：

| 格子 | 結果 |
|---|---|
| S29 formaldehyde | 同一引句直接列 formaldehyde 成分，medium 是相鄰成分，未違反上游排除。 |
| S62 egg | 引句只說 chick embryo cell culture；與 S81 的 CEF 採 related 不一致。應明訂「有」是否包含培養宿主；本句本身不量證最終蛋成分殘留。 |
| S72 formaldehyde | 現有引句只有製程處理；但同頁 §11 明載 “Residual formaldehyde per dose … not more than 0.30 mcg”。狀態有依據，應換成此直接殘留句作格子的引句。 |
| S78/S79 peg_polysorbate | 引句明載 each dose may contain residual amounts，支持殘留判讀。 |
| S80 formaldehyde | 明載每劑 residual amounts，支持。 |
| S81 other_antibiotics | 明載殘留 gentamicin/ciprofloxacin，支持。 |
| S85/S86 yeast | 只說 produced in yeast cells。應統一製程宿主與最終殘留的呈現規則；不宜暗示這兩句測得最終酵母殘留。 |

其餘值得修訂：

- **S59 VAQTA thimerosal=無** 的 §11 原句 “antigen, which is purified and formulated without a preservative” 與 S27 退回 related 的理由需統一。這是既定證據門檻的不一致，不是確認其實含硫柳汞。
- S61、S78、S79 用全疫苗 “no … antibiotics” 判 other_antibiotics=無，卻仍列 neomycin=未載明；S30 同義中文句則兩欄皆無。應統一通用否定句能涵蓋哪些 key。
- S76 p.19 第二包裝每劑 polysorbate 80 為 0.20 mg；目前只引用 p.18 第一包裝的 0.18 mg。「有」本身不受影響，數量應標明適用包裝。
- 343 格的現存候選命中皆有 related／dismissed 可對應。部分 dismissed 留著已不再命中的 when/then/between 舊理由，應清理；這不代表本次少掃。
- 建議 SYN 加 `ciprofloxacin`（S81 已實際使用，但目前同義詞未含）、`aminoglycoside`、`ovalbumen`、`卵清`、`Komagataella` 等。加入後仍須按上下文判讀。本次有限擴充沒有找到被漏列的其他真成分，不能因此宣稱同義詞已完備。
- 掃描器每頁同一 term 只保留前三條上下文，且 builder 接受一段 key 級 dismissed／related 即放行全部命中。全文有搜尋，不代表保存了所有命中與逐條判讀。建議保留完整命中／穩定 hit id，加 PDF hash、規則版本，並針對每個命中紀錄判讀。
- 矩陣標題仍寫「依 TFDA 仿單原句」，已不適用 35 份國際仿單；底下注解把所有未載明描述為「沒有提到」，亦未準確涵蓋 related 情境。
- S36 表 1 標題還留著「摘要不寫百分比」的舊敘述；現況已寫百分比。表 2 不同追蹤窗（5 年後組 0–14 天、10 年後組 0–7 天）應一併引用，避免把兩欄看成相同觀察窗。

## 4. 測試與 CI 建議

優先加：共同 key 分支、同品牌跨機關、頻率註腳、人群適用範圍、整劑／培養基否定範圍，以及 notes 同列與整個 evidence bundle 的數值對應。幾何回讀適合作為額外守門，但 **918/918 通過仍抓不到 F3**，不能取代語意與表格結構檢查。

對 `Surface source failure`，可把「部署成功」與「來源新鮮度」拆成不同檢查。若採連續 N 次才紅，應按每個資料集持久保存失敗次數，成功才重設，並保留首度失敗的網站警示與最後成功時間；另設資料最久可接受未更新時間。N 是營運政策參數，本次未擅自選定或修改。現況 exit 1 的步驟確實在部署之後，因此單看 run 紅色不能推定網站發布失敗。

## 5. 重跑與證據

在專案根目錄執行；Python 幾何檢查需 pdfplumber，並需 Poppler 的 pdftotext/pdfinfo：

```sh
node tools/audit_0913.cjs /tmp/vaccine-audit
python3 tools/audit_0913_pdf.py /tmp/vaccine-audit
python3 tools/audit_0913_sweep.py /tmp/vaccine-audit
node tools/audit_0913_ui.cjs /tmp/vaccine-audit
npm test
```

這些 audit 是證據產生器，結果以 JSON 內的 errors／failures／重現分支為準，不是已接入 npm 的 pass/fail 測試。數字候選仍需人工判讀。完整機器結果、判讀清單、登記器隔離測試與既有測試紀錄保存在 [audit-2026-09-13](/Users/jamesxxx1997/vaccine-guide/review/audit-2026-09-13)。
