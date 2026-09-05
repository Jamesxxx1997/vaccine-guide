# 補充分類與原文定位查核 — 2026-09-05

本輪範圍：補充分類表、口服霍亂製劑與間隔提示，以及全分頁原文定位介面。並非重新查核本站全部政策，亦非獨立醫師審查。

| 項目 | 採用結果 | 原始依據／PDF 頁序 |
|---|---|---|
| Shingrix | 非活性、基因重組；不是活性減毒 | 台灣成人時程 S4，第 5 頁 |
| Moderna XFG／Novavax XFG | 分別為 mRNA／蛋白質次單元；均屬非活性 | 台灣接種須知 S12／S12N，第 1 頁 |
| Arexvy／Abrysvo | 重組 RSV 蛋白疫苗，非活病毒製劑 | FDA S13 第 18 頁／S14 第 22 頁；CDC 非活性分類 S19 |
| Dukoral | 口服不活化霍亂疫苗 | EMA S15，第 2 頁 |
| Vaxchora | 口服活性減毒霍亂疫苗 | EMA S16，第 2 頁 |

「非活性」比「不活化」範圍廣；蛋白質與 mRNA 不宜全部狹義稱為整顆病原不活化疫苗。
網頁不再把所有口服霍亂製劑概括成不活化，間隔計算器新增未確認品牌、Dukoral、Vaxchora 三選項。

## 霍亂與黃熱病：保留差異，停止簡化判定

- 台灣 S2（115.05）PDF 第 1 頁載 3 週以上，但未指明霍亂製劑。
- [EMA Dukoral 仿單](https://www.ema.europa.eu/en/documents/product-information/dukoral-epar-product-information_en.pdf)第 4 頁：同時接種研究沒有觀察到對黃熱病免疫反應的影響；該研究未評估 Dukoral 免疫反應，不能擴張成雙方效力都已證實不受影響。
- [CDC ACIP 2022](https://www.cdc.gov/mmwr/volumes/71/rr/pdfs/rr7102a1-H.pdf)第 8 頁說明當時核准 CVD 103-HgR 製劑缺乏與其他疫苗同時接種資料，須區分早期製劑研究。
- [CDC 黃熱病醫療人員頁](https://www.cdc.gov/yellow-fever/hcp/vaccine/)（2026-05-12）表示有限資料支持口服 CVD 103-HgR 與黃熱病同日或任意間隔。此項是官方網頁，不偽製 PDF。

計算器遇到霍亂時提示核對品牌、仿單及旅遊門診建議；與黃熱病配對時並列台灣與國際依據，不自動判定可同日或通用 28 天。Vaxchora 不套入 OPV／輪狀病毒兩週規則。

## 新下載的官方 PDF 快照

| 代碼 | 來源 | 文件版本／官網更新 | 本機檔案 |
|---|---|---|---|
| S13 | [FDA AREXVY](https://www.fda.gov/media/167805/download?attachment=) | 2026-07 修訂 | `sources/國際官方指引/FDA_Arexvy_2026-07.pdf` |
| S14 | [FDA ABRYSVO](https://www.fda.gov/media/168889/download?attachment=) | 2025-12 修訂 | `sources/國際官方指引/FDA_Abrysvo_2026.pdf`（檔名年分為下載年度） |
| S15 | [EMA Dukoral](https://www.ema.europa.eu/en/documents/product-information/dukoral-epar-product-information_en.pdf) | 官網 2022-04-06 更新 | `sources/國際官方指引/EMA_Dukoral_2022.pdf` |
| S16 | [EMA Vaxchora](https://www.ema.europa.eu/en/documents/product-information/vaxchora-epar-product-information_en.pdf) | 官網 2026-07-10 更新 | `sources/國際官方指引/EMA_Vaxchora_2026.pdf` |
| S17 | [CDC ACIP](https://www.cdc.gov/mmwr/volumes/71/rr/pdfs/rr7102a1-H.pdf) | 2022-09-30 | `sources/國際官方指引/CDC_Cholera_ACIP_2022.pdf` |

皆於 2026-09-05 下載，未改寫 PDF。SHA-256、固定頁面及原文短引見 `reference-claims.json`；重建器對雜湊或非唯一匹配會中止。S19 為 [CDC 分類表](https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html)，同樣明示為網頁。

## 高亮介面驗證

- 23 組 DOM 互動測試：七分頁入口、全部兒童格、成人 14 列、124 條規則、5 種製劑分類、兩種 COVID 來源與兩種 RSV 來源、動態計算、鍵盤與手動翻頁。
- 8 項幾何回歸：限制同欄、排除孤立數字、無實際字元座標不硬切 word、裁圖原點換算、gist 零高亮等。
- 舊 8 項引文測試通過；124 條維持逐字 94／部分 9／整理 9／文字 12。驗證器 0 錯誤、4 個既有人工提示，未自行移除。
- 真瀏覽器抽看成人欄列／懸浮預覽及 PDF 高亮；預設保留原頁全寬與整頁位置，不把單句放成大字。

「文字有查來源入口」不等於所有文字都有逐字 PDF 證據；一般摘要、推算、介面標籤與網頁来源仍保留相應警語。
