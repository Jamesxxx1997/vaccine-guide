# 原句摘錄追溯規格（本專案版，2026-09-12）

使用者定案原則：**「重點是有原網頁或是原 PDF，trace 原句的部分我才能很放心相信。」**
每一句臨床陳述點開後必須落在原件（官方 PDF，或官方網頁的列印 PDF）的頁面影像上，並在該句畫框。
本站自己打的文字（整理句、轉錄摘錄）不是證據。通用版規範另存於 `~/.claude/skills/quote-review/references/source-tracing-spec.md`；本文件記錄專案內的具體做法。

## 兩套追溯系統的分工
| 路線 | 適用 | 資料 | 工具 |
|---|---|---|---|
| reference-claims（宣告式，glyph 定位） | 2026-09 起所有新規則、總表、卡片附註 | 規則帶 `claim:"id"`；`review/reference-claims.json`（`hashes` 鎖 SHA-256、`claims[id].items[{source,page,quotes,label,note,glyphRows}]`，`ref` 可展開） | `tools/build_reference_pages.py` → `review/reference-pages.js`＋`review/pages/*.jpg`（每個 SRC PDF 全頁渲染 125 dpi） |
| legacy EXCERPTS（文字比對，誠實分級） | 舊有 S1／S2／S4／S9–S12 規則 | 規則無 claim；鍵＝djb2(vid\|s\|t) | `tools/export_rules.mjs` → `tools/build_excerpts.py` → `review/excerpts.js`＋`img/`；`tools/verify_excerpts.py` |

build_excerpts／verify_excerpts 都會跳過帶 `claim` 的規則；`test_reference_ui.cjs` 目前斷言 legacy 規則 121 條。

## 來源檔案規範
- 官方 PDF：解 `/File/Get/<id>` 殼層拿真檔；URL／日期／HTTP／大小／SHA-256／版本記入 `sources/**/_下載紀錄.md`；`reference-claims.json.hashes` 登記後，檔案一變建置就停。
- 官方網頁：`node tools/print_web_source.mjs <url> <out.pdf> [--expand "全部展開"] [--wait ms]`
  （headless Chrome＋DevTools Protocol；疾管署 Q&A 必加 `--expand "全部展開"`，否則只印題目；頁尾自帶網址、日期、頁碼；
  除展開按鈕與視窗尺寸外不改 DOM）。同日 `curl` 一份原始 HTML 留存比對。SRC 登錄 `print:true`，版本欄寫「網頁列印 YYYY-MM-DD」。
- 大 PDF（如 CDC General Best Practices 197 頁）不登記成 claim 來源（建置器全頁渲染），改用同段落的網頁列印版；原 PDF 仍存檔記 SHA。
- 列印中文後目視一頁確認字型有印出（本機曾有 PingFang 無法嵌入的 bug）。

## 定位與分級
- claim 定位失敗 → `build_reference_pages.py` 丟例外，整批不產出；不得靜默無框。
- legacy 分級：逐字 ≥0.85／部分逐字 0.5–0.85（只畫匹配行）／整理句 <0.5（零高亮）／文字來源（僅連結）；fallback 頁一律整理句除非 ≥0.85；無升等路徑。
- 正規化：NFKC、去空白標點、只留 CJK／字母／數字；PDF 部首變體（⽉）靠 NFKC；引句避開引註（網頁上標 8 9 10 11 ≠ PDF (8-11)）。

## 介面
- hover 縮圖＝原頁裁圖＋黃框（字詞）／藍框（位置）；click 面板＝整頁、頁碼、翻頁、「開啟 PDF」（`#page=` 需 http）。
- `print:true` 來源多一個「開啟官方線上頁面（嘗試跳至原句）」：`u + #:~:text=`（`refFrag()`，逗號／連字號／& 另編碼，>120 字改起迄範圍式）。
  tooltip 明寫：手風琴收合的答案不會高亮（疾管署實測）；線上連結是入口，不是追溯終點。
- 表格列 `data-ref-claim` 綁在每個 td；表格裡顯示的引句是顯示副本，`tools/test_postinfection_quotes.cjs` 逐句比對它 ⊆ claim 的有頁碼 item quotes。

## 驗證階梯（每批必走）
1. `uv run --python 3.12 --with 'pdfplumber>=0.11,<0.12' --with 'Pillow>=10,<13' python tools/build_reference_pages.py`（定位失敗即停）
2. `node tools/export_rules.mjs > /tmp/rules.json && uv run … python tools/build_excerpts.py /tmp/rules.json && uv run … python tools/verify_excerpts.py`（exit 0）
3. `uv run … python -m unittest discover -s tools -p 'test_*.py'`；`npm test`（含 coverage、reference_ui、postinfection_quotes）
4. 目視：從 `review/reference-pages.js` 取 rects 畫回 `review/pages/*.jpg` 裁圖，眼睛確認框正中原句
5. fresh-context verifier（做的人不自驗）：獨立抽字比對、curl 重抓線上頁面核對引句與更新日期、shasum 三方一致、重畫裁圖、讀工具碼確認無 DOM 改寫、破壞測試（改壞引句→建置必須失敗）、實跑全部測試
6. 使用者 `python3 tools/serve.py 8899` 本機看（不用 file://）；點頭才 merge main／push（Pages 從 main 部署；工作流程紅燈可能是旅遊同步失敗的設計提醒，看 log 尾段）
- 「查無」結論附查證範圍清冊，措辭「本站對照查無」，不寫成官方明文。

## 已否決（別再做）
- `SRC.text` 轉錄當 reference；規則 `q:` 引句欄（含建置驗證版）；整理稿列印冒充原件；生成檔保留死鍵；即時抓線上頁面產預覽。

## 紀錄
- 2026-09-05：legacy 摘錄層＋三輪對抗審查（見 README「驗證紀錄」）。
- 2026-09-09：Codex 建 reference-claims 系統（Shingrix S20）。
- 2026-09-12：感染後接種間隔批次；S21–S25；verifier R1 PASS（措辭修正）→ 使用者否決轉錄式 reference → 網頁列印 PDF 路線 → verifier R2 PASS 7/7 → merge 80c3a27 並部署。
