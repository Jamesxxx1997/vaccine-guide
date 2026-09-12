#!/usr/bin/env python3
"""反查已產生的高亮框，驗證規則鍵、來源、裁圖、分級與框內 PDF 文字。

直接讀 index.html 的現行規則及 pdftotext -bbox；不匯入建置器、不重跑定位算法。
python3 tools/verify_excerpts.py [--annotate /tmp/excerpt-boxes]
需要 Node、Poppler 及 Pillow。任何硬性檢查失敗均回傳非零狀態。
這是來源定位檢查，不是臨床正確性或資料時效的認證；同詞異列仍需人工抽看。
"""

from __future__ import annotations

import argparse
import ast
from collections import Counter
from difflib import SequenceMatcher
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
REGRESSIONS = {"ee51e0fd7": "var", "e86feccc5": "mmr", "e4af4cb04": "covid", "ee86d17d1": "jelive"}
HEADERS = {"接種禁忌", "注意事項", "疫苗種類"}
# 由第三輪完整頁面目視核對建立的回歸界線，不從建置器匯入。
# 用來偵測「文字一樣卻框到別列」與鄰段通用詞污染，單靠覆蓋率無法偵測。
REVIEWED_BOUNDS = {
    "e90947324": (1, (397, 308, 802, 327)),  # BCG 發燒，不得牽入麻疹/水痘復原期
    "e92cc790f": (2, (185, 140, 491, 158)),  # BCG 間隔，不得跨到口服疫苗列
    "e9ac5ab5b": (6, (220, 295, 397, 365)),  # PPV 過敏，不得跨到 HPV 列
    "e57203ae2": (6, (220, 365, 397, 454)),  # HPV 過敏，不得跨到 PPV 列
    "eb22e5e66": (1, (480, 580, 752, 624)),  # MMR 輸血 / Washed RBCs
    "ed1c5a1b1": (1, (480, 580, 752, 624)),  # 水痘 同上
    "e9dcac10d": (1, (480, 580, 752, 624)),  # JE 同上
    "e1af0a5fc": (2, (50, 374, 580, 448)),   # 莫德納注意事項第 6 點
    "e8d6af783": (1, (42, 689, 580, 726)),   # 莫德納禁忌主文，不含仿單參考註記
    "ed8d94dfa": (2, (185, 254, 535, 272)), # 活性疫苗通則須取 MMR/水痘/JE 列
    "e979bc1ad": (2, (185, 254, 535, 272)),
    "e5873f591": (2, (185, 254, 535, 272)),
    "ee51e0fd7": (6, (40, 454, 802, 480)),
    "e86feccc5": (6, (40, 454, 802, 480)),
    "ee86d17d1": (5, (220, 74, 397, 317)),
    "e571fd45b": (2, (50, 93, 580, 202)),
    "e4af4cb04": (1, (28, 175, 580, 235)),
}


def normalized(text):
    return re.sub(r"[^0-9A-Za-z一-鿿㐀-䶿]", "", unicodedata.normalize("NFKC", text))



def rule_text(text):
    # 網頁加的分類後綴不應拿 PDF 表頭來填補；與前端顯示的原規則分開記錄。
    return normalized(re.sub(r"(?:，?(?:均|皆)?為接種禁忌|，?列為注意事項|，?不予接種)。?$", "", text))


def key_for(rule):
    # JavaScript charCodeAt 是 UTF-16 code unit；遇到非 BMP 字元也要一致。
    encoded = "|".join(rule[k] for k in ("vid", "s", "t")).encode("utf-16-le")
    h = 5381
    for i in range(0, len(encoded), 2):
        h = ((h * 33) ^ int.from_bytes(encoded[i:i + 2], "little")) & 0xffffffff
    return f"e{h:08x}"


def load_pdf(path):
    result = subprocess.run(["pdftotext", "-bbox", str(path), "-"], check=True, capture_output=True)
    xml = ET.fromstring(result.stdout.decode("utf-8"))
    pages = []
    for pg in xml.iter():
        if pg.tag.rsplit("}", 1)[-1] != "page":
            continue
        words = []
        for w in pg.iter():
            if w.tag.rsplit("}", 1)[-1] == "word":
                words.append({"t": "".join(w.itertext()),
                              "box": tuple(float(w.get(k)) for k in ("xMin", "yMin", "xMax", "yMax"))})
        pages.append((float(pg.get("width")), float(pg.get("height")), words))
    return pages


def boxed_words(words, rect, origin, scale):
    x, y, w, h = rect
    left, top = origin[0] + x / scale, origin[1] + y / scale
    right, bottom = left + w / scale, top + h / scale
    found = []
    for word in words:
        a, b, c, d = word["box"]
        if left <= (a + c) / 2 <= right and top <= (b + d) / 2 <= bottom:
            found.append(word)
    return sorted(found, key=lambda word: word["box"][0])


def text_evidence(rule, rows):
    covered = set()
    row_support = []
    for row in rows:
        text = normalized("".join(w["t"] for w in row))
        matched = 0
        for block in SequenceMatcher(None, rule, text, autojunk=False).get_matching_blocks():
            if block.size >= (min(2, len(rule)) if len(rule) <= 4 else 3):
                covered.update(range(block.a, block.a + block.size))
                matched += block.size
        row_support.append(matched / max(1, len(text)))
    return len(covered) / max(1, len(rule)), row_support


def verify(args):
    rules = json.loads(subprocess.check_output(["node", str(ROOT / "tools/export_rules.mjs")], text=True))
    # claim 規則由 reference-claims 系統追溯（test_reference_coverage 驗），此處只驗 EXCERPTS 轄區
    rules = [r for r in rules if not r.get("claim")]
    raw = (ROOT / "review/excerpts.js").read_text()
    excerpts = json.loads(raw.split("const EXCERPTS=", 1)[1].strip().removesuffix(";"))
    errors, review_notes, details = [], [], []

    def check(ok, message):
        if not ok:
            errors.append(message)

    keys = [key_for(r) for r in rules]
    check(len(keys) == len(set(keys)), "規則鍵重複或雜湊碰撞")
    check(set(keys) == set(excerpts), f"規則鍵不一致：缺 {set(keys) - set(excerpts)}；多 {set(excerpts) - set(keys)}")
    # 另執行頁面中的 exKey，避免只驗證 Python 的另一份 hash 實作。
    key_script = r"""
const fs = require('fs');
const html = fs.readFileSync(process.argv[1], 'utf8');
for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new Function(m[1]);
const fn = html.match(/function exKey\([^]*?\n\}/)[0];
const rules = JSON.parse(fs.readFileSync(0, 'utf8'));
console.log(JSON.stringify(new Function(fn + '; return ' +
  'arguments[0].map(r => exKey(r.vid,r.s,r.t))')(rules)));
"""
    js_keys = json.loads(subprocess.check_output(["node", "-e", key_script, str(ROOT / "index.html")],
                                                input=json.dumps(rules), text=True))
    check(js_keys == keys, "前端 exKey 與驗證器產生的鍵不一致")
    stats = Counter(e.get("status", e["type"]) for e in excerpts.values())
    report = (ROOT / "review/match_report.md").read_text()
    summary = re.search(r"狀態統計：(\{[^\n]+\})", report)
    check(summary is not None and ast.literal_eval(summary[1]) == dict(stats), "建置報告統計與實際資料不同")
    check(f"規則總數 {len(rules)}\n" in report, "建置報告規則總數不同")
    report_rows = [line.split("|") for line in report.splitlines() if re.match(r"\| \d+ \|", line)]
    check(len(report_rows) == len(rules), "建置報告逐條列數不同")
    for i, row in enumerate(report_rows):
        if i < len(rules) and keys[i] in excerpts:
            e = excerpts[keys[i]]
            expected = [str(i), rules[i]["vid"], rules[i]["s"], e.get("status", e["type"])]
            check([v.strip() for v in row[1:5]] == expected, f"建置報告第 {i} 條資料不同")

    for key, vid in REGRESSIONS.items():
        entry = excerpts.get(key, {})
        check(entry.get("status") == "gist" and entry.get("rects") == [], f"{key} ({vid}) 整理句退化")

    cache = {}
    for rule, key in zip(rules, keys):
        if key not in excerpts:
            continue
        e = excerpts[key]
        label = f"{key} {rule['vid']}"
        check(e.get("src") == rule["s"], f"{label} 來源代碼不同")
        if e["type"] == "text":
            check(bool(e.get("label")), f"{label} 文字來源無標籤")
            if e.get("path"):
                check((ROOT / e["path"]).is_file(), f"{label} 文字來源存檔不存在")
            details.append((key, rule, e, None, [], []))
            continue
        if e["type"] != "pdf":
            errors.append(f"{label} 尚未定位：{e['type']}")
            continue
        try:
            source = ROOT / e["file"]
            if e["file"] not in cache:
                cache[e["file"]] = load_pdf(source)
            pages = cache[e["file"]]
            check(isinstance(e["page"], int) and 1 <= e["page"] <= len(pages), f"{label} 頁碼不合法")
            pw, ph, words = pages[e["page"] - 1]
            origin, scale = e["origin"], e["dpi"] / 72
            check(len(origin) == 2 and scale > 0 and all(math.isfinite(v) for v in origin), f"{label} 裁圖原點不合法")
            check(0 <= origin[0] < pw and 0 <= origin[1] < ph, f"{label} 裁圖原點超出 PDF")
            check(origin[0] + e["iw"] / scale <= pw + 1 / scale and
                  origin[1] + e["ih"] / scale <= ph + 1 / scale, f"{label} 裁圖超出 PDF")
            with Image.open(ROOT / e["img"]) as img:
                check(img.size == (e["iw"], e["ih"]), f"{label} 圖片實際尺寸不同")
                img.verify()
            check(e["status"] in ("verbatim", "partial", "gist"), f"{label} 未知分級")
            check(0 <= e["cov"] <= 1, f"{label} 覆蓋率超出範圍")
            if e["status"] == "gist":
                check(e["rects"] == [], f"{label} 整理句不應高亮")
                if key in REVIEWED_BOUNDS:
                    expected_page, (left, top, right, bottom) = REVIEWED_BOUNDS[key]
                    check(e["page"] == expected_page and origin[0] <= left + 1 and origin[1] <= top + 1 and
                          origin[0] + e["iw"] / scale >= right - 1 and
                          origin[1] + e["ih"] / scale >= bottom - 1,
                          f"{label} 整理句裁圖未涵蓋人工覆核的主要出處")
            else:
                check(bool(e["rects"]), f"{label} 有逐字標籤卻無高亮")
            rows = []
            for ri, rect in enumerate(e["rects"]):
                x, y, w, h = rect
                check(all(math.isfinite(v) for v in rect) and min(x, y) >= 0 and w > 0 and h > 0 and
                      x + w <= e["iw"] and y + h <= e["ih"], f"{label} 框 {ri} 越界或無效")
                row = boxed_words(words, rect, origin, scale)
                if key in REVIEWED_BOUNDS:
                    expected_page, (left, top, right, bottom) = REVIEWED_BOUNDS[key]
                    check(e["page"] == expected_page and
                          origin[0] + x / scale >= left - 1 and origin[1] + y / scale >= top - 1 and
                          origin[0] + (x + w) / scale <= right + 1 and
                          origin[1] + (y + h) / scale <= bottom + 1,
                          f"{label} 框 {ri} 超出人工覆核的來源段落／疫苗列")
                check(bool(row), f"{label} 框 {ri} 沒有 PDF 文字")
                check(not any(normalized(w["t"]) in HEADERS for w in row), f"{label} 框 {ri} 包含表頭")
                rows.append(row)
            cov, support = text_evidence(rule_text(rule["t"]), rows)
            if e["status"] != "gist":
                threshold = 0.85 if e["status"] == "verbatim" else 0.5
                check(cov + 1e-9 >= threshold, f"{label} 框內覆蓋率 {cov:.3f} < {threshold}")
                # 建置器只計入匹配片段；合併行框可能帶入同句中原先未計入的字。
                # 實際框內覆蓋率可更高，但不可低於宣稱值（僅容許儲存時四捨五入）。
                check(cov + 0.005 >= e["cov"], f"{label} 框內覆蓋率 {cov:.3f} 低於宣稱 {e['cov']}")
                for ri, ratio in enumerate(support):
                    if ratio < 0.6:
                        review_notes.append(f"{label} 框 {ri}：框中文字僅 {ratio:.0%} 對應規則，需人工確認")
            details.append((key, rule, e, cov if rows else None, rows, support))
            if args.annotate:
                args.annotate.mkdir(parents=True, exist_ok=True)
                with Image.open(ROOT / e["img"]).convert("RGB") as img:
                    draw = ImageDraw.Draw(img, "RGBA")
                    for x, y, w, h in e["rects"]:
                        draw.rectangle((x, y, x + w, y + h), fill=(255, 209, 0, 65), outline=(220, 100, 0, 230), width=2)
                    img.save(args.annotate / f"{key}.png")
        except (OSError, ValueError, KeyError, IndexError, TypeError, subprocess.CalledProcessError, ET.ParseError) as exc:
            errors.append(f"{label} 無法驗證：{exc}")

    lines = ["# 原句摘錄機械驗證", "", f"結果：{'FAIL' if errors else 'PASS'}（{len(errors)} 項錯誤）", "",
             f"規則 {len(rules)}；摘錄 {len(excerpts)}；狀態 {dict(stats)}", "",
             "此報告驗證本機存檔與高亮定位，不驗證醫療建議、政策時效或同詞異列的臨床歸屬。", "",
             "## 錯誤", "", *(errors or ["無。"]), "", "## 需人工複核的低支持度框", "",
             *(review_notes or ["無。"]), "", "## 本次輸入指紋（SHA-256）", ""]
    for rel in ("index.html", "review/excerpts.js", *cache):
        lines.append(f"- `{rel}`：`{hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()}`")
    lines += ["", "## 每條框內文字", ""]
    for key, rule, e, cov, rows, support in details:
        lines += [f"### {key} · {rule['vid']} · {e.get('status', e['type'])}", "", f"規則：{rule['t']}", ""]
        if cov is not None:
            lines += [f"第 {e['page']} 頁；框內覆蓋率 {cov:.3f}；建置覆蓋率 {e['cov']:.2f}。", ""]
            for i, row in enumerate(rows):
                lines.append(f"- 框 {i}（支持度 {support[i]:.0%}）：{''.join(w['t'] for w in row)}")
        else:
            lines.append("無高亮（整理句）" if e["type"] == "pdf" else "文字來源，存檔連結已檢查（若有提供）。")
        lines.append("")
    args.report.write_text("\n".join(lines), encoding="utf-8")
    print(f"{'FAIL' if errors else 'PASS'}: {len(rules)} rules, {dict(stats)}, {len(errors)} errors, {len(review_notes)} review notes")
    for message in errors + review_notes:
        print(message)
    print(f"Report: {args.report}")
    return bool(errors)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--annotate", type=Path, help="另存框選 PNG 供人工抽看")
    parser.add_argument("--report", type=Path, default=ROOT / "review/verification_report.md")
    sys.exit(verify(parser.parse_args()))
