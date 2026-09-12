#!/usr/bin/env python3
"""把網頁規則對回來源 PDF 的原句位置，產生 hover/click 用的擷取圖與資料。

輸入：/tmp/rules.json（tools/export_rules 由 index.html 匯出）
輸出：review/excerpts.js（EXCERPTS 資料，以 <script src> 載入——file:// 下 fetch JSON 會被擋）
      review/img/<key>.jpg（PDF 區域圖，150dpi）
      review/match_report.md（逐條匹配狀態，供人工與 verifier 抽驗）

匹配設計（S1 是三欄表格、pdftotext 會把不同欄的字交錯輸出，所以不能用連續子字串）：
  1. 逐字片段歸屬：PDF 的每個 word 片段若（正規化後）是規則文字的子字串 → 證據
  2. 空間聚類：證據片段依欄帶（x 重疊）與行距聚成塊
  3. 共用常數（發燒/過敏…出現在每支疫苗列）用「疫苗名稱錨點」選最近的那塊
  4. 覆蓋率分級：≥0.85 verbatim（畫高亮）；0.5–0.85 partial（高亮已匹配行＋標示）；
     <0.5 gist（不畫高亮，標「整理句」）——不製造假的逐字對應

誠實原則：高亮只畫在「實際匹配到的片段」上；規則文字中網頁自行加註的括號
（例如來源說明）本來就不會被匹配，覆蓋率自然反映出來。
"""

from __future__ import annotations

import json
import hashlib
import os
import re
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/rules.json", encoding="utf-8"))
OUT_IMG = os.path.join(ROOT, "review", "img")
os.makedirs(OUT_IMG, exist_ok=True)

DPI = 150
SCALE = DPI / 72.0

SRC_PDF = {
    "S1": ("sources/接種指引/疫苗接種禁忌及注意事項.pdf", "112.09 版"),
    "S2": ("sources/接種指引/各項預防接種間隔時間一覽表.pdf", "115.05 版"),
    "S3": ("sources/接種指引/各項常規疫苗最小接種年齡與最短接種間隔.pdf", "114.4 版"),
    "S4": ("sources/時程表/成人預防接種建議時程表.pdf", "115 年 5 月版"),
    "S5": ("sources/時程表/現行兒童預防接種時程表_中文.pdf", "114 年 1 月版"),
}
# S12 有兩份（莫德納／Novavax），逐條試兩份取覆蓋率高者
S12_PDFS = [
    ("sources/各疫苗/COVID19疫苗接種須知_莫德納XFG.pdf", "莫德納 XFG 須知 2026-07-07"),
    ("sources/各疫苗/COVID19疫苗接種須知_NovavaxXFG.pdf", "Novavax XFG 須知 2026-07-07"),
]
# 純文字來源（無 PDF 可裁圖）：面板顯示逐字摘錄＋連結
TEXT_SRC = {
    "S9":  ("sources/仿單/_TFDA仿單摘錄.md", "TFDA 中文仿單摘錄（擷取 2026-08-07）"),
    "S10": ("", "衛福部新聞稿（建檔 115-06-30）"),
    "S11": ("sources/通函與判讀/狂犬病QA_原始頁面.html", "疾管署狂犬病 Q&A（2018-07-27）"),
    # 感染後間隔批次（2026-09-12）：官方 Q&A／指引網頁存檔，規則帶 q（逐字引句）時逐字對存檔驗證
    "S21": ("sources/感染後間隔/COVID19疫苗接種注意事項QA_原始頁面.html", "疾管署 COVID-19 疫苗 Q&A：接種注意事項（Q3.1 更新 2025-09-26；存檔 2026-09-12）"),
    "S22": ("sources/感染後間隔/流感與流感疫苗簡介QA_原始頁面.html", "疾管署流感與流感疫苗簡介 Q&A（更新 2026-08-14；存檔 2026-09-12）"),
    "S23": ("sources/感染後間隔/CDC通則_接種禁忌與注意事項_原始頁面.html", "CDC General Best Practice Guidelines：Contraindications and Precautions（網頁 2024-07-25；存檔 2026-09-12；同段亦見原 PDF p.52）"),
    "S25": ("sources/感染後間隔/MpoxQA_原始頁面.html", "疾管署 M痘 Q&A（Q28 更新 2025-05-22；存檔 2026-09-12）"),
}

# S1 版面固定（112.09 版 6 頁、每頁 2-3 支疫苗）——直接釘頁碼。
# 錨點字串消歧曾把 B肝 拉去 A肝 那頁（共同字串「型肝炎疫苗」），釘頁碼把這類歧義整批消滅。
S1_PAGE = {"hepb": 1, "bcg": 1, "dtap5": 2, "pcv": 2, "flu": 3, "mmr": 3,
           "var": 4, "hepa": 4, "jelive": 5, "jeinact": 5,
           "dtapipv": 6, "tdap": 6, "ppv23": 6, "hpv": 6}

# 人工核對 PDF 格線的列界（PDF pt）。只釘頁仍可能把 PPV / HPV 相同句子
# 垂直串成同一塊；先限制疫苗列與原文欄，再做文字匹配。
S1_ROWS = {
    "hepb": (124, 237), "bcg": (237, 458), "dtap5": (74, 411), "pcv": (411, 502),
    "flu": (74, 185), "mmr": (185, 450), "var": (74, 339), "hepa": (339, 416),
    "jelive": (74, 317), "jeinact": (317, 409), "dtapipv": (74, 295),
    "tdap": (74, 295), "ppv23": (295, 365), "hpv": (365, 454),
}

# 人工座標僅適用這些已目視核對的存檔；更換版本必須重新核對區域。
SCOPED_SOURCE_SHA256 = {
    SRC_PDF["S1"][0]: "d2edf8c80d077b763aa442a4758435a6c0f8f5e9ec0cb260650d3209f857895a",
    SRC_PDF["S2"][0]: "601cdae83086af6d409a99a40772a19fc2b8fc93d1f8a666771455bd460f1160",
    S12_PDFS[0][0]: "8891c44f7679c65160f88adb3c9077b42ece8da708f63872be5d80bf68286d11",
}


def source_area(pdf_rel, page_idx, rule):
    """第三輪覆核後的來源範圍；None=維持一般搜尋，空 tuple=本頁不參與。

    範圍只收緊脈絡，從不降低匹配或分級門檻。血液製品合成規則只高亮輸血段，
    不把上一段 palivizumab 的「無須間隔」拿來補 Washed RBCs 的覆蓋率。
    """
    if rule["s"] == "S1":
        vid = rule["vid"] if rule["vid"] in S1_ROWS else "hepb"  # 自費疫苗共用發燒通則
        if page_idx + 1 == S1_PAGE[vid]:
            y0, y1 = S1_ROWS[vid]
            x0, x1 = (220, 397) if rule["lv"] == "stop" else (397, 802)
            return (x0, y0, x1, y1)
        if rule["vid"] in ("mmr", "var") and "高劑量類固醇" in rule["t"] and page_idx == 5:
            return (40, 454, 802, 480)  # ※1 定義，仍適用 fallback 降級
        return ()
    if rule["s"] == "S2" and rule["t"].startswith("輸過血或接受靜脈血液製品"):
        return (480, 580, 752, 624) if page_idx == 0 else ()
    if rule["s"] == "S2" and rule["t"].startswith("活性減毒疫苗如未"):
        return (185, 254, 535, 272) if page_idx == 1 else ()  # MMR/水痘/JE 列，非黃熱病列
    if rule["s"] == "S12" and rule["t"].startswith("計畫適用對象"):
        return (28, 175, 580, 235) if pdf_rel == S12_PDFS[0][0] and page_idx == 0 else ()
    if rule["s"] == "S12" and rule["t"].startswith("懷孕婦女可"):
        return (50, 93, 580, 202) if pdf_rel == S12_PDFS[0][0] and page_idx == 1 else ()
    if rule["s"] == "S12" and rule["t"].startswith("有發炎性心臟疾病"):
        if pdf_rel == S12_PDFS[0][0] and page_idx == 1:
            return (50, 374, 580, 448)  # 接種前注意事項第 6 點，排除前後第 5/7 點
        return ()
    if rule["s"] == "S12" and rule["t"].startswith("對於疫苗所含活性物質"):
        if pdf_rel == S12_PDFS[0][0] and page_idx == 0:
            return (42, 689, 580, 726)  # 禁忌主文，排除下方仿單參考註記
        return ()
    return None


def scoped_page(pg, area):
    if area is None:
        return pg
    words = [] if not area else [w for w in pg["words"]
        if area[0] <= (w["x0"] + w["x1"]) / 2 <= area[2]
        and area[1] <= (w["y0"] + w["y1"]) / 2 <= area[3]]
    return {"w": pg["w"], "h": pg["h"], "words": words}

# S1 各疫苗在 PDF 表格第一欄的標籤（逐字，供錨點消歧；來源：S1 原文）
S1_LABELS = {
    "hepb": "B型肝炎疫苗（HepatitisB）",
    "bcg": "卡介苗（BCG）",
    "dtap5": "白喉破傷風非細胞性百日咳、b型嗜血桿菌及不活化小兒麻痺五合一疫苗",
    "pcv": "結合型肺炎鏈球菌疫苗(PCV)",
    "flu": "流感疫苗（Influenza）",
    "mmr": "麻疹腮腺炎德國麻疹混合疫苗（MMR）",
    "var": "水痘疫苗（Varicella）",
    "hepa": "A型肝炎疫苗（HepatitisA）",
    "jelive": "日本腦炎疫苗（JE）(活性減毒)",
    "jeinact": "日本腦炎疫苗（JE）(不活化)",
    "dtapipv": "白喉破傷風非細胞性百日咳及不活化小兒麻痺混合疫苗",
    "tdap": "白喉破傷風非細胞性百日咳及不活化小兒麻痺混合疫苗",   # tdap 規則取自同條目
    "ppv23": "多醣體肺炎鏈球菌疫苗(PPV)",
    "hpv": "人類乳突病毒疫苗(HPV)",
}


# 網頁自加的分類字尾——不是原文的一部分，卻會跟表頭「接種禁忌」撞出 4 字區塊，
# 把「孕婦為接種禁忌。」整條拉去框頁首標題（verifier 抓到的嚴重錯誤①）。
WEB_SUFFIX_RE = re.compile(r"(?:，?(?:均|皆)?為接種禁忌|，?列為注意事項|，?不予接種)。?$")


def strip_web_suffix(t: str) -> str:
    return WEB_SUFFIX_RE.sub("", t)


# 表頭欄位詞永遠不是內容證據（每頁都有、與規則字尾同形）
EXCLUDE_TOKENS = {"接種禁忌", "注意事項", "疫苗種類", "疫苗", "種類"}


def norm(s: str) -> str:
    """匹配用正規化：NFKC、去空白、去標點——只留 CJK/字母/數字。"""
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"[^0-9A-Za-z一-鿿㐀-䶿]", "", s)


_TEXT_CACHE: dict[str, str] = {}

def text_source_norm(path_rel: str) -> str:
    """文字來源存檔正規化全文（HTML 去 script/style/標籤、解實體）；供逐字引句驗證。"""
    if path_rel not in _TEXT_CACHE:
        import html as _html
        raw = open(os.path.join(ROOT, path_rel), encoding="utf-8", errors="replace").read()
        if path_rel.lower().endswith((".html", ".htm")):
            raw = re.sub(r"<script.*?</script>|<style.*?</style>", "", raw, flags=re.S | re.I)
            raw = re.sub(r"<[^>]+>", "", raw)
            raw = _html.unescape(raw)
        _TEXT_CACHE[path_rel] = norm(raw)
    return _TEXT_CACHE[path_rel]


def djb2(s: str) -> int:
    h = 5381
    for ch in s:
        h = ((h * 33) ^ ord(ch)) & 0xFFFFFFFF
    return h


def load_pages(pdf_rel: str):
    pdf = os.path.join(ROOT, pdf_rel)
    xml = subprocess.run(["pdftotext", "-bbox", pdf, "-"], capture_output=True).stdout
    txt = xml.decode("utf-8", "replace")
    txt = re.sub(r'\sxmlns="[^"]+"', "", txt, count=1)
    m = re.search(r"<doc>.*</doc>", txt, re.S)
    root = ET.fromstring(m.group(0))
    pages = []
    for pg in root.iter("page"):
        words = []
        for w in pg.iter("word"):
            t = (w.text or "").strip()
            if not t:
                continue
            words.append({
                "t": t, "n": norm(t),
                "x0": float(w.get("xMin")), "y0": float(w.get("yMin")),
                "x1": float(w.get("xMax")), "y1": float(w.get("yMax")),
            })
        pages.append({"w": float(pg.get("width")), "h": float(pg.get("height")), "words": words})
    return pages


_page_cache: dict[str, list] = {}


def pages_for(pdf_rel):
    if pdf_rel not in _page_cache:
        _page_cache[pdf_rel] = load_pages(pdf_rel)
    return _page_cache[pdf_rel]


def group_rows(words: list[dict], tol: float = 3.5) -> list[list[dict]]:
    """依 y 鄰近性把片段分行。固定格線（round(y/6)）會在桶界把同一行拆兩半
    （y 差 <1pt 的兩個字落在不同桶），這裡改走訪式分組。"""
    rows: list[list[dict]] = []
    for w in sorted(words, key=lambda x: x["y0"]):
        if rows and abs(w["y0"] - rows[-1][-1]["y0"]) <= tol:
            rows[-1].append(w)
        else:
            rows.append([w])
    return rows


def cluster_words(cands: list[dict]) -> list[list[dict]]:
    """兩段式：先把同一視覺行的證據串成行段（同行字距可到 30pt——
    「未達 2,000 公克」中間的空隙就超過舊的 ±10，曾把一句話切成兩塊）；
    再把 x 範圍重疊、行距 ≤2.2 字高的行段垂直鏈成塊（換行的長句）。"""
    if not cands:
        return []
    # 行段
    segs = []
    for ws in group_rows(cands):
        ws = sorted(ws, key=lambda x: x["x0"])
        cur = [ws[0]]
        for w in ws[1:]:
            if w["x0"] - cur[-1]["x1"] <= 30:
                cur.append(w)
            else:
                segs.append(cur); cur = [w]
        segs.append(cur)
    # 垂直鏈接
    clusters = [list(sg) for sg in segs]
    merged = True
    while merged:
        merged = False
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                a, b = clusters[i], clusters[j]
                ax0 = min(w["x0"] for w in a); ax1 = max(w["x1"] for w in a)
                bx0 = min(w["x0"] for w in b); bx1 = max(w["x1"] for w in b)
                if ax1 < bx0 or bx1 < ax0:          # x 不重疊 → 不同欄
                    continue
                hgt = max(6.0, sum(w["y1"] - w["y0"] for w in a + b) / len(a + b))
                gap = min(abs(wa["y0"] - wb["y0"]) for wa in a for wb in b)
                if gap <= hgt * 2.2:
                    clusters[i] = a + b; del clusters[j]
                    merged = True
                    break
            if merged:
                break
    return clusters


from difflib import SequenceMatcher


def blocks(rule_n: str, frag_n: str, min_len: int = 3):
    """frag 與規則文字的共同區塊（≥min_len）。用區塊而非整段子字串：
    網頁側只要改寫一個字（如刪「者」），整段子字串比對就會歸零。"""
    sm = SequenceMatcher(None, rule_n, frag_n, autojunk=False)
    return [(a, b, n) for a, b, n in sm.get_matching_blocks() if n >= min_len]


def coverage(rule_n: str, cluster: list[dict]) -> float:
    used = [False] * len(rule_n)
    for w in cluster:
        for a, _, n in blocks(rule_n, w["n"]):
            for j in range(a, a + n):
                used[j] = True
    return sum(used) / max(1, len(used))


def build_lines(pg):
    """把片段串回「行」：JE 頁的原文是逐字加空格（每字一個片段、norm 後長度 1），
    片段級匹配整行落空。行級先串再配，並保留每片段在行字串中的偏移以便回推座標。"""
    if "lines" in pg:
        return pg["lines"]
    lines = []
    for ws in group_rows(pg["words"]):
        ws = sorted(ws, key=lambda x: x["x0"])
        offs, buf = [], ""
        for w in ws:
            offs.append(len(buf)); buf += w["n"]
        if buf:
            lines.append({"words": ws, "offs": offs, "n": buf})
    pg["lines"] = lines
    return lines


def evidence_for(pg, rule_n):
    """行級比對 → 回傳證據片段（附覆蓋強度）。短規則（≤4字）要求整句在行內。"""
    short = len(rule_n) <= 4
    ev = []
    for ln in build_lines(pg):
        if short:
            j = ln["n"].find(rule_n)
            if j < 0:
                continue
            bl = [(0, j, len(rule_n))]
        else:
            bl = blocks(rule_n, ln["n"], 4)
            if not bl:
                continue
        for i, w in enumerate(ln["words"]):
            w0, w1 = ln["offs"][i], ln["offs"][i] + len(w["n"])
            if not w["n"] or w["n"] in EXCLUDE_TOKENS:
                continue
            hit = sum(max(0, min(b + n, w1) - max(b, w0)) for _, b, n in bl)
            # 相對支持度：片段要嘛大部分被規則覆蓋（≥60%），要嘛命中很長（≥8字）。
            # 「病情穩定」「接種疫苗」這種 4 字通用語出現在 18 字的鄰句片段裡
            # （支持度 4/18=22%）就進不來——高亮溢出到隔壁規則的病因。
            if hit >= min(2, len(w["n"])) and (hit >= 0.6 * len(w["n"]) or hit >= 8):
                ww = dict(w); ww["hit"] = hit
                ev.append(ww)
    return ev


def cluster_cov(rule_n, cl):
    """塊覆蓋率也走行級：把塊內片段按行重組再對，逐字排版下才算得出來。"""
    short = len(rule_n) <= 4
    used = [False] * len(rule_n)
    for ws in group_rows(cl):
        seg = "".join(w["n"] for w in sorted(ws, key=lambda x: x["x0"]))
        for a, _, n in blocks(rule_n, seg, 2 if short else 3):
            for j in range(a, a + n):
                used[j] = True
    return sum(used) / max(1, len(used))


def trim_redundant_edges(rule_n, cluster):
    """去除完全不增加覆蓋率的首尾行，避免「後再接種」牽進相鄰規則。

    只收窄已選中的塊，不追加證據、不升級；保留中間換行與必要的上下文。
    """
    rows = group_rows(cluster)
    target = cluster_cov(rule_n, cluster)
    while len(rows) > 1:
        without_last = [w for row in rows[:-1] for w in row]
        if cluster_cov(rule_n, without_last) + 1e-9 >= target:
            rows.pop()
            continue
        without_first = [w for row in rows[1:] for w in row]
        if cluster_cov(rule_n, without_first) + 1e-9 >= target:
            rows.pop(0)
            continue
        break
    return [w for row in rows for w in row]


def find_match(pdf_rel: str, rule_n: str, only_page: int | None = None, anchor_n: str | None = None, rule=None):
    """回傳 (page_idx, cluster, cov)。S1 用釘頁；找不到 ≥0.25 時，釘頁模式
    退而求其次取 ≥0.10 的最佳塊當 gist（S1 有些規則是footnote＋改寫的整理句）。"""
    best = None
    pages = pages_for(pdf_rel)
    allowed = None
    if only_page is not None:
        allowed = {only_page - 1, len(pages) - 1}   # 釘頁＋末頁（※1 註腳定義）
    for pi, pg in enumerate(pages):
        if allowed is not None and pi not in allowed:
            continue
        # 錨點在左欄，必須先保留原頁找錨點，再限制右側的規則搜尋範圍。
        match_pg = scoped_page(pg, source_area(pdf_rel, pi, rule)) if rule else pg
        ay = None
        if anchor_n:
            aw = [w for w in pg["words"] if w["n"] and blocks(anchor_n, w["n"], 4)]
            if aw:
                ay = sorted(w["y0"] for w in aw)[len(aw) // 2]
        # 註腳 fallback 頁（非釘頁）只有在釘頁成績差時才有資格競爭；
        # 且「要求錨點但該頁找不到錨點」的塊，距離記大罰分——
        # 否則 A肝的「孕婦。」會被第 6 頁 HPV 的「孕婦」以 dist=0 劫走。
        is_pinned_pg = (only_page is None) or (pi == only_page - 1)
        for cl in cluster_words(evidence_for(match_pg, rule_n)):
            cov = cluster_cov(rule_n, cl)
            if not is_pinned_pg and best is not None and best[0] >= 0.5:
                continue
            dist = 1e9 if (anchor_n and ay is None) else (
                abs(sum(w["y0"] for w in cl) / len(cl) - ay) if ay is not None else 0.0)
            if not is_pinned_pg:
                dist = 1e9   # fallback 頁永遠排在釘頁同分之後
            if best is None or cov > best[0] + 0.05 or (abs(cov - best[0]) <= 0.05 and dist < best[3]):
                best = (cov, pi, cl, dist)
    if best is None:
        return None
    floor = 0.10 if only_page is not None else 0.25
    if best[0] < floor:
        return None
    fb = (only_page is not None) and (best[1] != only_page - 1)
    return best[1], best[2], best[0], fb


def line_rects(cluster: list[dict]):
    """把片段合併成逐行矩形（高亮用）。"""
    rects = []
    for ws in group_rows(cluster):
        rects.append([min(w["x0"] for w in ws), min(w["y0"] for w in ws),
                      max(w["x1"] for w in ws), max(w["y1"] for w in ws)])
    return rects


def render_crop(pdf_rel: str, page_idx: int, box, key: str, page_size):
    pw, ph = page_size
    pad_x, pad_y = 36, 26
    x0 = max(0, box[0] - pad_x); y0 = max(0, box[1] - pad_y)
    x1 = min(pw, box[2] + pad_x); y1 = min(ph, box[3] + pad_y)
    px, py = int(x0 * SCALE), int(y0 * SCALE)
    pwid, phgt = int((x1 - x0) * SCALE), int((y1 - y0) * SCALE)
    out = os.path.join(OUT_IMG, key)
    subprocess.run(["pdftoppm", "-jpeg", "-r", str(DPI), "-f", str(page_idx + 1), "-l", str(page_idx + 1),
                    "-x", str(px), "-y", str(py), "-W", str(pwid), "-H", str(phgt),
                    "-singlefile", os.path.join(ROOT, pdf_rel), out], check=True)
    # pdftoppm 的裁圖原點是整數像素；高亮與反向驗證都用同一實際原點。
    return (px / SCALE, py / SCALE), (pwid, phgt)


def status_of(cov: float) -> str:
    return "verbatim" if cov >= 0.85 else ("partial" if cov >= 0.5 else "gist")


def main():
    for path, expected in SCOPED_SOURCE_SHA256.items():
        with open(os.path.join(ROOT, path), "rb") as source:
            if hashlib.sha256(source.read()).hexdigest() != expected:
                raise ValueError(f"來源已變更，請先重新核對 source_area 的原文範圍：{path}")
    excerpts = {}
    report = ["# 原句對照建置報告", "",
              f"規則總數 {len(RULES) - sum(1 for r in RULES if r.get(chr(99)+chr(108)+chr(97)+chr(105)+chr(109)))}", "",
              "| # | 疫苗 | 來源 | 狀態 | 覆蓋率 | 頁 | 規則文字（前40字） |",
              "|---|---|---|---|---|---|---|"]
    stats = defaultdict(int)
    claim_skipped: list = []

    for i, r in enumerate(RULES):
        if r.get("claim"):
            # 帶 claim 的規則走 reference-claims 系統（宣告式逐字引句＋glyph 定位，
            # build_reference_pages.py 負責）。報告維持「只描述 EXCERPTS 轄區」的契約
            # （test_verify_excerpts 逐列比對），claim 條數另以敘述行註記。
            claim_skipped.append(r)
            continue
        row_i = i - len(claim_skipped)   # 報告列編號＝EXCERPTS 轄區內序號（verify 端同步過濾後比對）
        key = f"e{djb2(r['vid'] + '|' + r['s'] + '|' + r['t']):08x}"
        rule_n = norm(strip_web_suffix(r["t"]))
        src = r["s"]

        if src in TEXT_SRC:
            path, label = TEXT_SRC[src]
            excerpts[key] = {"type": "text", "src": src, "label": label, "path": path}
            note = ""
            if r.get("q"):
                # 文字來源的逐字引句：正規化後必須整句出現在存檔裡，否則整個 build 失敗——
                # 網頁來源沒有裁圖高亮可對照，引句本身就是唯一可核對的證據，不能容許「大概有」。
                quotes = r["q"] if isinstance(r["q"], list) else [r["q"]]
                if not path:
                    sys.exit(f"✗ {r['vid']} {src} 帶 q 但來源無存檔路徑，無法驗證引句")
                full = text_source_norm(path)
                for q in quotes:
                    if norm(q) not in full:
                        sys.exit(f"✗ 引句不在存檔中（{src} {path}）：{q[:60]}")
                excerpts[key]["quotes"] = quotes
                note = f"（引句 {len(quotes)} 條已逐字驗證）"
            stats["text"] += 1
            report.append(f"| {row_i} | {r['vid']} | {src} | text | — | — | {r['t'][:40]}{note} |")
            continue

        trials = S12_PDFS if src == "S12" else [SRC_PDF[src]]
        only_page = S1_PAGE.get(r["vid"]) if src == "S1" else None

        best = None
        for pdf_rel, ver in trials:
            anchor = norm(S1_LABELS.get(r["vid"], "")) if src == "S1" else None
            m = find_match(pdf_rel, rule_n, only_page, anchor, r)
            if m and (best is None or m[2] > best[3]):
                best = (pdf_rel, ver, m[0], m[2], m[1], m[3])
        if best is None:
            excerpts[key] = {"type": "none", "src": src}
            stats["none"] += 1
            report.append(f"| {row_i} | {r['vid']} | {src} | **NONE** | 0 | — | {r['t'][:40]} |")
            continue

        pdf_rel, ver, page_idx, cov, cl, from_fallback = best
        st = status_of(cov)
        # fallback 頁（註腳頁等非釘頁）的匹配一律降為 gist，除非覆蓋率高到真逐字（≥0.85）。
        # 第二輪 verifier 抓到：var/mmr 的類固醇整理句在自己頁分數低、被第 6 頁註腳以
        # 字面重疊搶走還標成 partial——框到別的脈絡就是硬湊，寧可誠實標整理句不畫高亮。
        # （原「反向召回升等」一併移除：字尾剝除修好後，它只剩製造這類假 partial 的用途。）
        if from_fallback and cov < 0.85:
            st = "gist"
        if src == "S12" and r["t"].startswith(("計畫適用對象", "懷孕婦女可")):
            st = "gist"  # 跨兩份產品須知的合成句，局部匹配變好也不可升等
        pages = pages_for(pdf_rel)
        pg = pages[page_idx]
        strong = [w for w in cl if w.get("hit", 0) >= 3 or len(w["n"]) <= 2]
        strong = trim_redundant_edges(rule_n, strong or cl)
        # 分級不能計入最後被 strong 過濾掉的字；只可降級，不以框內新字升等。
        # JE 的類固醇整理句曾宣稱 55%，實際高亮只有 48%，應誠實標為 gist。
        cov = min(cov, cluster_cov(rule_n, strong or cl))
        if st != "gist":
            st = status_of(cov)
        stats[st] += 1
        rects = line_rects(strong or cl)
        box = [min(x[0] for x in rects), min(x[1] for x in rects),
               max(x[2] for x in rects), max(x[3] for x in rects)]
        area = source_area(pdf_rel, page_idx, r)
        if st == "gist" and area:
            # 整理句須顯示已核對的完整來源區域；零碎共同詞不能代表主要出處。
            box = list(area)
        origin, (iw, ih) = render_crop(pdf_rel, page_idx, box, key, (pg["w"], pg["h"]))
        rel_rects = [[round((a - origin[0]) * SCALE), round((b - origin[1]) * SCALE),
                      round((c - a) * SCALE), round((d - b) * SCALE)] for a, b, c, d in rects]
        excerpts[key] = {
            "type": "pdf", "src": src, "file": pdf_rel, "ver": ver,
            "page": page_idx + 1, "status": st, "cov": round(cov, 2),
            "img": f"review/img/{key}.jpg", "iw": iw, "ih": ih,
            "origin": list(origin), "dpi": DPI,
            "rects": rel_rects if st != "gist" else [],
        }
        report.append(f"| {row_i} | {r['vid']} | {src} | {st} | {cov:.2f} | p.{page_idx+1} | {r['t'][:40]} |")

    with open(os.path.join(ROOT, "review", "excerpts.js"), "w", encoding="utf-8") as f:
        f.write("/* 由 tools/build_excerpts.py 產生——勿手改。file:// 下 fetch JSON 被擋，故用 script 載入 */\n")
        f.write("const EXCERPTS=" + json.dumps(excerpts, ensure_ascii=False) + ";\n")
    report.insert(2, f"狀態統計：{dict(stats)}")
    report.insert(3, f"（另有 {len(claim_skipped)} 條帶 claim 規則由 reference-claims 系統追溯，不在本報告範圍）")
    with open(os.path.join(ROOT, "review", "match_report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(report) + "\n")
    print("完成", dict(stats))


if __name__ == "__main__":
    main()
