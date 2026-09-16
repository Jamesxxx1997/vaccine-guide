# vaccine-guide 2026-09-13 批次：請 Codex 獨立檢查

專案：`~/vaccine-guide`（台灣家醫科疫苗接種速查，單檔 index.html＋JS；GitHub Pages 從 main 部署：https://jamesxxx1997.github.io/vaccine-guide/ ）。
本檔是給 Codex 的檢查交辦。**你可以在 repo 裡直接跑指令**；你看不到圖片像素，所以框位核對請用「數值法」（見 §7）。
所有 shell 證據指令請用 `/usr/bin/grep`、`/usr/bin/diff`、`/bin/ls`（本機有 rtk hook 會改寫這些指令並偶爾吞輸出）。

## 0. 使用者原則（不可妥協）
- 網頁上任何數值／判讀，追溯終點必須是**本機 PDF 原件**（官方 PDF，或官方網頁列印成的 PDF），點擊要能開原件並在該句畫 glyph 框。本站自己寫的轉錄文字不算來源。
- 「查無／未載明」不能是預設值：要有可證明的全文掃描紀錄。
- 醫師會拿這些頁面直接回答病人（副作用、過敏可不可以打），錯一格就是臨床錯誤。

## 1. 今天上線的東西（commit 依序）
| commit | 內容 |
|---|---|
| 823c379 | 搜尋：副作用表格／過敏判讀／仿單成分入索引 |
| 3069407 | 副作用＋過敏與成分：17 份 TFDA 中文仿單分片（47 表格／364 claims；18 品項／180 claims） |
| a24ef66 | Pages 打包白名單補 4 個 JS（上線曾 404）＋守門測試 `tools/test_package_pages.cjs`；Bexsero 乳膠但書顯示 |
| aa451c9 | Adacel(S36) 表1／表2 整列引句＋列帶 region（verifier 抓到漏 ≥65 歲欄、發燒取錯欄） |
| dc2875f | Pages workflow：快照自動 commit 先 rebase 再 push |
| 2ddc282 / 8242035 | 「未載明」全文掃描 `tools/sweep_allergens.py`；related 相關原句；同義詞補強 |
| e0894a9 | 國際仿單 35 份（FDA 27、EMA 2、MHRA 4、HPRA 1、TGA 1）成分／過敏原分片；矩陣機關徽章；Bexsero 獨立 MenB 列；`tools/register_intl_labels.py` |
| ea546c8 | 搜尋：英文成分名（PEG／neomycin）對規則標題視為專有詞；新冠品牌別名 |
| 23b6ca4 | Menveo(S72) 酵母改未載明＋相關原句（verifier 抓到與同批不一致） |

現況數字（`review/allergens.js`，含 2026-09-14 補的 S93）：54 個品項（TFDA 18／FDA 27／MHRA 4／EMA 2／TGA 1／HPRA 1／HSA 1）；530 格：有 122／無 65／未載明 343（343 格全部有掃描紀錄，其中 27 格附相關原句）；成分 claims 570；副作用 claims 364；`npm test` 38 檔全綠。

## 2. 資料流（改任何一層都要重跑後面）
```
review/allergens.src.d/<S>.json      ←人／agent 寫的分片（每份仿單一檔）
review/adverse-effects.src.d/<S>.json ←副作用分片（kind = percent／freq／notes）
tools/sweep_allergens.py             →review/allergen_sweep.d/<S>.json（每格未載明的全文掃描紀錄）＋合併 allergen_sweep.{json,md}
tools/build_allergens.py             →review/allergen-claims.json ＋ review/allergens.js（拒絕：有／無無 quote、未載明附 quote、未載明沒掃、命中沒判讀）
tools/build_adverse_effects.py       →review/adverse-claims.json ＋ review/adverse-effects.js（% 由 PDF 抽出；summary 的數字必須出現在引句）
tools/build_reference_pages.py       →review/reference-pages.js（每個 claim 定位成 glyph rects；找不到／不唯一就 ValueError）＋ review/pages/*.jpg
index.html SRC{}                     ←來源登記（S1–S92；S58–S92 由 tools/register_intl_labels.py 從 sources/國際仿單/_manifest_*.json 產生）
review/label-claims.json.hashes      ←每個來源 PDF 的 sha256（build_reference_pages 會核對）
allergy-guidance.js / adverse-effects.js / vaccine-search.js ←前端
```
執行環境：`UV="uv run --python 3.12 --with 'pdfplumber>=0.11,<0.12' --with 'Pillow>=10,<13' python"`；`npm test`（約 6–8 分鐘，其中 test_reference_coverage 約 5 分鐘）。

## 3. 分片格式與判讀規則
分片（成分）：
```json
{"vaccine":"<VAX id>","product":"…","source":"S58","origin":"FDA","lang":"en","vaccineName":"（VAX 沒有此 id 時的顯示名）",
 "components":[{"page":N,"quote":"逐字","label":"Description"}],
 "allergens":[{"key":"egg","status":"有|無|未載明","page":N,"quote":"逐字","note":"可選",
               "related":{"page":N,"quote":"逐字","note":"…"}}],
 "warnings":[{"label":"Contraindications","page":N,"quote":"逐字"}],
 "sweep":{"dismissed":{"<key>":"假陽性理由"}}}
```
10 個 key：egg, gelatin, neomycin, other_antibiotics, yeast, latex, peg_polysorbate, formaldehyde, thimerosal, aluminium。

判讀慣例（我們定的，請挑戰）：
- 「有」＝仿單明列疫苗本身的成分／製程殘留（含量或 "may contain traces of"）／包裝含天然乳膠。
- 「無」＝仿單有明確否定句。接受的延伸：`contains no preservative` → thimerosal 無；`not made with natural rubber latex` → latex 無；`no preservative or adjuvant`（Menveo）→ aluminium 無；`does not contain a preservative or antibiotics`（Gardasil 9）→ thimerosal 無＋other_antibiotics 無。
- **不算「有」**：只講上游培養基（CRM197 grown in yeast extract medium：Prevnar 13／20、Vaxneuvance、Menveo）、細胞株（Vero、MDCK、CEF、Sf9）、對照疫苗品名（"Influenza Vaccine, Adjuvanted"）、鋁質瓶蓋、丁基／鹵化丁基橡膠瓶塞（未提天然乳膠）→ 一律「未載明＋related」。
- VAQTA「不含防腐劑之 A 型肝炎病毒抗原」主語是抗原 → 未載明＋related（verifier 指出不能推到整劑）。
- Bexsero 改成獨立 vaccine id `menb`（原本掛在四價接合型 mcv4 卡下，臨床不同類）。

## 4. 來源對照（S58–S92 國際仿單；S26–S48 為 TFDA 中文仿單；S20 Shingrix TFDA）
| S | 品項 | 機關 | 檔案（sources/國際仿單/） |
|---|---|---|---|
| S58 | Shingrix | FDA | 帶狀疱疹_Shingrix_FDA_2026-02.pdf |
| S59 | VAQTA | FDA | A型肝炎_VAQTA_FDA_2020-10.pdf（仿單內 Revised 為佔位符 XX/20XX，版本由 pdfinfo 交叉確認） |
| S60 | Engerix-B | FDA | B型肝炎_Engerix-B_FDA_2026-05.pdf |
| S61 | Gardasil 9 | FDA | 人類乳突病毒_Gardasil9_FDA_2025-03.pdf |
| S62 | M-M-R II | FDA | 麻疹腮腺炎德國麻疹_MMR-II_FDA_2025-11.pdf |
| S63 | Prevnar 13 | FDA | 肺炎鏈球菌13價_Prevnar13_FDA_2017-XX.pdf（fda.gov 產品頁已下架，改走 fda.gov/files 穩定路徑） |
| S64 | Pneumovax 23 | FDA | 肺炎鏈球菌23價_Pneumovax23_FDA_2021-04.pdf |
| S65 | Adacel | FDA | 破傷風白喉百日咳成人_Adacel_FDA_2026-08.pdf |
| S66 | Boostrix | FDA | 破傷風白喉百日咳成人_Boostrix_FDA_2026-05.pdf |
| S67 | Fluarix Quadrivalent | FDA | 流感四價_FluarixQuadrivalent_FDA_2023-07.pdf |
| S68 | Bexsero | FDA | 腦膜炎球菌B_Bexsero_FDA_2024-08.pdf |
| S69 | RotaTeq | FDA | 輪狀病毒_RotaTeq_FDA_2026-05.pdf |
| S70 | Havrix | FDA | A型肝炎_Havrix_FDA_2026-05.pdf |
| S71 | Varivax | FDA(DailyMed 副本，FDA 站上版本較舊) | 水痘_Varivax_FDA_2026-08.pdf |
| S72 | Menveo | FDA | 腦膜炎_Menveo_FDA_2025-03.pdf |
| S73 | Vaxneuvance | FDA | 肺炎鏈球菌_Vaxneuvance_V15_FDA_2026-06.pdf |
| S74 | Prevnar 20 | FDA | 肺炎鏈球菌_Prevnar20_V20_FDA_2023-04.pdf |
| S75 | Priorix（美國 2022 核准版） | FDA | 麻疹腮腺炎德國麻疹_Priorix_FDA_2026-03.pdf |
| S76 | Arexvy | FDA | 呼吸道融合病毒_Arexvy_FDA_2026-07.pdf |
| S77 | Abrysvo | FDA | 呼吸道融合病毒_Abrysvo_FDA_2025-12.pdf |
| S78 | Flucelvax Quadrivalent | FDA | 流感_FlucelvaxQuadrivalent_FDA_2026-03.pdf |
| S79 | Flucelvax 三價 2026-27 | FDA | 流感_Flucelvax_trivalent_FDA_2026-07.pdf |
| S80 | Typhim Vi | FDA(DailyMed 副本) | 傷寒_TyphimVi_FDA_2026-06.pdf |
| S81 | Jynneos | FDA | 天花猴痘_Jynneos_FDA_2025-03.pdf（仿單無第 4 節 Contraindications） |
| S82 | Spikevax 2026-27 | FDA | 新冠_Spikevax_FDA_2026-08.pdf |
| S83 | mNEXSPIKE 2026-27 | FDA | 新冠_mNEXSPIKE_FDA_2026-08.pdf |
| S84 | Nuvaxovid 2026-27 | FDA | 新冠_Nuvaxovid_FDA_2026-08.pdf |
| S85 | Hexyon（＝Hexaxim） | EMA | 六合一_Hexyon(Hexaxim)_EMA_2026-08.pdf（61 頁，只引 SmPC 段，不引後段 PIL） |
| S86 | Infanrix hexa | EMA | 六合一_Infanrix-hexa_EMA_2026-02.pdf |
| S87 | Imojev | TGA | 日本腦炎疫苗_Imojev_TGA_2023-03.pdf |
| S88 | Vaxigrip Tetra | HPRA | 流感疫苗_VaxigripTetra_HPRA_2025-06.pdf |
| S89 | Stamaril | MHRA | 黃熱病疫苗_Stamaril_MHRA_2025-01.pdf |
| S90 | Verorab | MHRA | 狂犬病疫苗_Verorab_MHRA_2026-01.pdf |
| S91 | Varilrix | MHRA | 水痘疫苗_Varilrix_MHRA_2026-08.pdf |
| S92 | Rabipur | MHRA | 狂犬病疫苗_Rabipur_MHRA_2026-05.pdf |
| S93 | Pentaxim（2026-09-14 補，使用者自 HSA 解 CAPTCHA 下載） | HSA | 五合一_Pentaxim_HSA_2025-09.pdf（Sanofi-aventis Singapore，September 2025 CCDS V16） |

下載紀錄：`sources/國際仿單/_下載紀錄_A1.md`、`_A2.md`、`_B.md`；manifest：`_manifest_A1/A2/B.json`（含各關鍵字所在頁碼）。
未取得：Tetraxim（EMA／MHRA／HPRA／TGA／Medsafe／HSA 皆查無；Health Canada 同成分不同品名的 Quadracel 已下載**但未登記**，等使用者決定）。Pentaxim 已於 2026-09-14 由使用者從 HSA 取得並登記為 S93。；AdimFlu-S、公費 BCG 為台灣本土無國際仿單。

## 5. 已做過的獨立驗證（fresh-context verifier，做的人不自驗）
- TFDA 17 份：三組 verifier 分區逐句比對 PDF、全文搜尋未載明、看裁圖。抓到 Adacel(S36) 兩個真錯（漏 ≥65 歲欄；發燒引到 10 年後欄）→ 已修成整列引句＋region。複驗 verifier 又報「表 1 框整體錯一列」→ 用 rects y 與標籤字 y 數值比對＋重畫圖證實為**假紅**。
- 未載明掃描：verifier 用自己的同義詞重掃 18 份 PDF、抽 6 個零命中格自查、7 個相關原句逐字＋框位；建議補的同義詞已加；VAQTA 硫柳汞由「無」退回未載明。
- 國際仿單 35 份：三組 verifier；S58–S70 全 PASS（116 claims 逐字＋116 張圖）；S85–S92 全 PASS（1 WARN：S91 dismissed 計數與現況差 2，因掃描規則收緊後數字變動）；S71–S84 1 FAIL（S72 Menveo yeast，已修）＋2 WARN（S74 缺 Fluad「Adjuvanted」命中的 dismissed 紀錄——該格現為「有」故不進掃描；S76 第二劑型的 polysorbate 句未收）。
- verifier 自己承認的覆蓋缺口：S73、S74、S79 的裁圖沒有逐張看；**src.d → allergens.js／allergen-claims.json 的轉譯正確性沒有被獨立驗過**（只驗了 src.d 對 PDF）。

## 6. 請 Codex 檢查的清單（依風險排序）
1. **轉譯正確性**：對每個分片，比對 `review/allergens.src.d/<S>.json` 與 `review/allergens.js` 內同 id 的 product：status／quote／related／note／sweep 是否一一對應；`review/allergen-claims.json` 的 claim id 命名（`al:<S>:<key>`、`al:<S>:<key>:related`、`al:<S>:comp:<i>`、`al:<S>:warn:<i>`）與 quotes 是否等於分片。寫個腳本全量 diff，不要抽查。
2. **定位正確性（數值法）**：從 `review/reference-pages.js` 取 `REFERENCE_CLAIMS[id].items[0].rects`，用 `pdftotext -f p -l p -bbox-layout` 取該頁字框，驗證每個 rect 都與引句的字重疊（y 範圍在同一行、x 落在引句字的範圍內），且 rects 拼起來的文字正規化後等於 quote。全量跑 554＋364 條，列出不吻合者。
3. **判讀一致性**：列出所有 status=「有」的 quote 含 `medium|cultured|grown|cell|culture` 的格子，逐一判斷是否違反 §3「上游培養基不算有」；列出所有「無」的 quote，確認每句都是否定句且否定的是該 key（不是借別的 key 的句子）。
4. **未載明掃描完整性**：`review/allergen_sweep.d/*.json` 是否涵蓋每一個未載明格（343 格）；`sweep.dismissed` 的理由是否對得上命中前後文；同義詞表（`tools/sweep_allergens.py` 的 SYN）你認為還漏什麼。
5. **副作用 notes 表**：`review/adverse-effects.js` 每列 summary 的數字是否都在同列 text（引句）裡；summary 有沒有加入引句沒有的頻率等級或反應名；特別看 S36 Adacel 表 1（四欄）／表 2（兩欄）改成 region 後的 quote 與 summary。
6. **前端**：`allergy-guidance.js` 矩陣（同疫苗列相鄰、TFDA 在前、機關徽章、未載明格顯示「已掃」或相關原句、格子綁 claim）；A→B 選單 53 個品項；`vaccine-search.js` 對「蛋過敏可以打流感疫苗嗎」「對PEG過敏可以打莫德納嗎」「Shingrix 成分」的排序是否合理（`node tools/test_vaccine_discovery.cjs` 有斷言）。
7. **測試守門的洞**：現有測試能抓「引句在原件裡」，抓不到「引句沒涵蓋整列／對錯欄」（S36 事件）與「region 座標對齊」；請評估要不要加一個「rects 文字＝quote」的測試（§6.2 的腳本可直接變成測試）。
8. **CI／部署**：`.github/workflows/pages.yml` 快照 commit 改成 fetch＋rebase 再 push（最多 3 次）；`tools/package_pages.mjs` 白名單與 `tools/test_package_pages.cjs`；每次 run 最後一步「Surface source failure」因 od.cdc.gov.tw 從 GitHub runner 逾時而 exit 1（網站已發布），今天每一 run 都這樣，請看是否要改成只在連續 N 次失敗時才紅。
9. **來源登記**：`tools/register_intl_labels.py` 的冪等性（同 path 不重複發 S key）；`review/label-claims.json.hashes` 與檔案 sha256 一致（build_reference_pages 會核對，但請獨立算一次）。

## 7. 指令速查
```bash
cd ~/vaccine-guide
UV="uv run --python 3.12 --with 'pdfplumber>=0.11,<0.12' --with 'Pillow>=10,<13' python"
node tools/export_reference_inputs.mjs | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['S72'])"   # S key → PDF 路徑
pdftotext -f 25 -l 25 -layout "sources/國際仿單/腦膜炎_Menveo_FDA_2025-03.pdf" -                                 # 原文
eval "$UV tools/build_allergens.py --check review/allergens.src.d/S72.json" && eval "$UV tools/check_claims.py review/.check-al-S72.json"   # 單份定位檢查（不寫輸出）
eval "$UV tools/sweep_allergens.py --source S72"                                                                  # 單份全文掃描
eval "$UV tools/crop_claims.py --out /tmp/crops --source S72"                                                     # 畫框裁圖（你看不到像素，用 §6.2 數值法）
npm test                                                                                                          # 38 檔
```
`REFERENCE_CLAIMS` 與 `REFERENCE_PAGES` 是 `review/reference-pages.js` 的頂層 const（不在 window 上）；`index.html` 的 `VAX`、`SRC` 同樣是頂層 const。rects 單位是 PDF pt，頁圖在 `review/pages/<S>-<hash10>-<page>.jpg`，縮放比＝圖寬／`REFERENCE_PAGES[S].pages[i].w`。

## 8. 已知未決（不用你解，但別當 bug 報）
- 4 份 TFDA 仿單是掃描檔無文字層（Havrix S26、BCG S40、Varivax S42、Menveo S47）→ 不在矩陣，等 OCR 或使用者重匯出。
- 12 個品項 TFDA 頁面只有網頁版仿單需使用者手動「匯出PDF」（Pentaxim、Vaxneuvance、Prevnar 20、公費三價流感 5 家、Flucelvax、Priorix、Varilrix、Arexvy、Abrysvo、Verorab）——其中多數已用國際仿單補上一列。
- Flucelvax(S78/S79) thimerosal「有」是多劑量瓶才有，台灣用預充針筒；格子 note 已標明，矩陣不分劑型。
- 副作用頁只收 TFDA 中文仿單＋疾管署原件，國際仿單這批只做成分／過敏原。

---

# 2026-09-16 追加批次（請一併檢查）

## A. TFDA 仿單現行版更新（影響過敏原矩陣台灣列與副作用頁）
- 發現：TFDA 查詢頁連結的 PDF 常是舊版，頁面「歷史仿單查詢」的最新版次與手風琴全文才是現行版。逐筆 curl 比對後 15 份過期、8 份「仿單無紙化」（PDF 只是外盒標籤表）。
- 處理：17 份（S26、S30–S32、S34–S40、S42–S46、S48）改用 `tools/print_web_source.mjs --expand "全部展開" --ua` 列印頁面全文（`sources/仿單/現行版_2026-09-16/`，`_更新紀錄.md`），SRC 的 p:/v:、hashes、label-sources 已替換；舊分片移到 `review/*/_old_2026-09-13/`，四組 agent 重寫成分與副作用分片；三組 fresh-context verifier 分區核（結果：第一組全 PASS；第二組抓到 Hexaxim 禁忌句「1.2」在文字層是獨立連結區塊、卡介苗一列引句起點縮短理由寫錯，均已修正並註記；第三組抓到 Vaxigrip 缺乳膠相關句與註腳錯位、Bexsero 漏兩個罕見列、AdimFlu 漏一列、Fluarix 漏英譯，均已修正 0 FAIL）。
- 實質內容變動（請抽查）：M-M-R II 硫柳汞 無→未載明；Boostrix 甲醛／polysorbate 殘留句消失→未載明、乳膠→無；Bexsero 乳膠但書消失→無；Fluarix 乳膠→無；Gardasil 9 補表 1；Hexaxim/Infanrix hexa 頁碼大幅位移。
- 請 Codex 檢查：(1) `sources/仿單/現行版_2026-09-16/*.pdf` 每份頁首網址與日期存在、與 SRC `v:` 的版次一致；(2) 用 §6.2 數值法全量核對這 17 份的 claims；(3) 舊分片 vs 新分片的 status 差異表（有無「有」變「未載明」但新 PDF 其實仍有該句的情況）。

## B. 疾病臨床 → 流感模組（新分頁）
- 資料：`review/clinical.src.d/flu/{antiviral-labels,antiviral-policy,antiviral-rules,test,isolation,special,qa,vaccine,vaccine-premed}.json` → `tools/build_clinical.py` → `review/clinical-claims.json`（claim id `cl:flu:<item id>:<n>`）＋`review/clinical.js`；前端 `clinical.js`（六面板、抗病毒藥選擇器、關鍵字搜尋框）；index.html 分頁「疾病臨床」；`tools/test_clinical.cjs`。
- 守門：每 item ≥1 ref；summary 數字必須出現在引句（西元年豁免）；rule 用 basedOn 借 refs；keywords 給站內不經 LLM 的關鍵字搜尋。
- 來源 S94–S154（五藥仿單含紓伏效第 3 版、疾管署手冊與一覽表、CDC 2025-26／2026、WHO 2024、IDSA 2018、JAMA IM 2025、Lancet 2024×2、Merckx 2017、檢驗機型 IFU、疫苗銜接文件、premedication／anaphylaxis 文件）；ChatGPT 稿三份核對表在 `review/FLU_PLAN_2026-09-16.md` §11。
- 已知判斷點請 Codex 挑戰：(1) 疾管署／CDC／WHO 三方不一致（WHO 對非重症 oseltamivir strong against）是否如實並列；(2) 選擇器規則（37 條）的 when 條件是否被 basedOn 原句支持；(3) 「7 天」條限保護環境照護者、傳染力用區間；(4) Merckx 2017 PDF 的 MediaBox 原點 (9,-9) 已在 `plumber_chars()` 校正——請確認其他 PDF 沒有被這個校正弄錯（bbox 原點為 0 的檔位移為 0）；(5) 易剋冒無文字層，用藥事實引克流感兩張許可證仿單（S112、S113），頁面標示；(6) premedication：不建議接種前 routine 抗組織胺（疾管署 2021 中文＋CDC 英文原句）、類固醇無任何來源建議、anaphylaxis 處置引 CDC 通則表與疾管署 2021。
- 測試盲點：test_clinical 只驗「引句在原件裡」與「數字在引句裡」，抓不到整理句語意超出原句；verifier 已抽 labels 74／policy 117／isolation 32 全查。
