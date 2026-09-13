#!/usr/bin/env python3
"""
「未載明」全文掃描：對每個分片（review/allergens.src.d/*.json）裡狀態＝未載明的過敏原，
用寬同義詞（中英文、化學名、常見誤寫）掃整份仿單 PDF 每一頁（pdftotext 原始輸出＋去空白版本，NFKC），
把每個命中連同頁碼與前後文寫到 review/allergen_sweep.json 與 review/allergen_sweep.md，供人／agent 逐條判讀：
真提及 → 分片改成 有／無＋逐字 quote；假陽性（蛋白質、乳膠樹脂…）→ 在分片 sweep.dismissed 記理由。
分片可帶 "sweep": {"date": "...", "dismissed": {"egg": "蛋白＝protein", ...}}；本工具只讀分片、只寫報告。
用法：uv run --python 3.12 python tools/sweep_allergens.py [--source S33]
"""
from __future__ import annotations
import json, re, subprocess, sys, unicodedata, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def sources() -> dict:   # 與 build_adverse_effects 相同來源（index.html 的 SRC），不 import 以免拉進 PIL
    return json.loads(subprocess.check_output(['node', str(ROOT / 'tools/export_reference_inputs.mjs')], text=True))
SRC_DIR = ROOT / 'review/allergens.src.d'

# 每個 key：(正則, 用在去空白版本?) —— 中文詞用去空白版（有些 PDF 逐字有空格），英文用原始版＋去空白版
SYN = {
    'egg': [r'雞胚', r'雞蛋', r'蛋類', r'卵白', r'卵蛋白', r'(?<![蛋])蛋(?![白])', r'(?<!卵)卵(?!巢|磷脂)', r'禽', r'ovalbumin', r'\begg', r'chick', r'embryo', r'hen\b', r'avian'],
    'gelatin': [r'明膠', r'動物膠', r'水解膠', r'膠質', r'吉利丁', r'gelatin', r'gelatine', r'hydroly[sz]ed'],
    'neomycin': [r'neomycin', r'新黴素', r'紐黴素', r'尼奧黴素', r'奈歐黴素', r'新霉素'],
    'other_antibiotics': [r'kanamycin', r'polymyxin', r'gentamicin', r'gentamycin', r'streptomycin', r'erythromycin', r'amphotericin', r'chlortetracycline', r'antibiotic', r'卡那黴素', r'多黏菌素', r'多粘菌素', r'健大黴素', r'慶大黴素', r'鏈黴素', r'紅黴素', r'抗生素', r'抗菌劑'],
    'yeast': [r'酵母', r'yeast', r'saccharomyces', r'pichia', r'hansenula', r'cerevisiae'],
    'latex': [r'乳膠', r'橡膠', r'latex', r'rubber'],
    'peg_polysorbate': [r'聚山梨', r'吐溫', r'聚乙二醇', r'polysorbate', r'tween', r'\bpeg\b', r'polyethylene\s*glycol', r'macrogol', r'polyoxyethylene', r'聚氧乙烯'],
    'formaldehyde': [r'甲醛', r'福馬林', r'戊二醛', r'formaldehyde', r'formalin', r'glutaraldehyde', r'formol'],
    'thimerosal': [r'硫柳汞', r'汞', r'thimerosal', r'thiomersal', r'merthiolate', r'mercur', r'防腐劑', r'保存劑', r'preservative', r'phenoxyethanol', r'苯氧乙醇', r'(?<![酚])酚(?![酞])', r'phenol'],
    'aluminium': [r'鋁', r'aluminium', r'aluminum', r'\balum\b', r'alpo4', r'al\(oh\)3', r'aahs', r'佐劑', r'adjuvant', r'alhydrogel'],
}

def page_texts(pdf: Path):
    n = int(re.search(r'Pages:\s+(\d+)', subprocess.check_output(['pdfinfo', str(pdf)], text=True)).group(1))
    out = []
    for p in range(1, n + 1):
        raw = subprocess.check_output(['pdftotext', '-f', str(p), '-l', str(p), str(pdf), '-'], text=True, errors='replace')
        raw = unicodedata.normalize('NFKC', raw)
        out.append((p, raw, re.sub(r'\s+', '', raw)))
    return out

def hits_for(texts, patterns):
    found = []
    for p, raw, flat in texts:
        for pat in patterns:
            latin = bool(re.search(r'[a-z]', pat))
            for hay, label in ((raw, 'raw'), (flat, 'flat')):
                if latin and label == 'flat' and r'\b' in pat:
                    continue   # 去空白版沒有字界，\b 型英文正則只掃原始版
                if not latin and label == 'raw':
                    continue   # 中文只掃去空白版（避免逐字空格漏掉）
                for m in re.finditer(pat, hay, re.I):
                    s, e = max(0, m.start() - 40), min(len(hay), m.end() + 40)
                    ctx = hay[s:e].replace('\n', '⏎')
                    key = (p, pat, m.group(0).lower(), ctx[:30])
                    if any(h['_k'] == key for h in found):
                        continue
                    found.append(dict(page=p, term=m.group(0), pattern=pat, context=ctx, _k=key))
    for h in found:
        h.pop('_k')
    # 同頁同 term 重複的前後文只留前 3 條
    trimmed, seen = [], {}
    for h in found:
        k = (h['page'], h['term'].lower())
        seen[k] = seen.get(k, 0) + 1
        if seen[k] <= 3:
            trimmed.append(h)
    return trimmed

def main():
    only = sys.argv[sys.argv.index('--source') + 1] if '--source' in sys.argv else None
    docs = sources()
    report, md = {}, ['# 「未載明」全文掃描報告', f'掃描日期：{datetime.date.today().isoformat()}；每格列出命中詞、頁碼、前後文。判讀後請把結果寫回分片（有／無＋quote，或 sweep.dismissed）。', '']
    total_cells = total_hits = 0
    for frag in sorted(SRC_DIR.glob('*.json')):
        d = json.loads(frag.read_text(encoding='utf-8'))
        if only and frag.stem != only:
            continue
        pending = [a['key'] for a in d['allergens'] if a.get('status') == '未載明']
        listed = {a['key'] for a in d['allergens']}
        pending += [k for k in SYN if k not in listed]   # 分片沒列的 key 也是未載明
        if not pending:
            continue
        pdf = ROOT / docs[d['source']]['p']
        texts = page_texts(pdf)
        if sum(len(t[2]) for t in texts) < 200:
            md.append(f'## {frag.stem} {d["product"]}：PDF 無文字層（掃描檔），無法掃描'); continue
        report[frag.stem] = dict(product=d['product'], source=d['source'], pdf=str(pdf.relative_to(ROOT)), pages=len(texts), cells={})
        md.append(f'## {frag.stem} {d["product"]}（{pdf.name}，{len(texts)} 頁）')
        dismissed = (d.get('sweep') or {}).get('dismissed', {})
        for key in pending:
            hs = hits_for(texts, SYN[key]); total_cells += 1; total_hits += len(hs)
            report[frag.stem]['cells'][key] = dict(patterns=SYN[key], hits=hs, dismissed=dismissed.get(key))
            tag = '（分片已判為假陽性：' + dismissed[key] + '）' if key in dismissed else ''
            md.append(f'### {key}：{len(hs)} 命中{tag}')
            for h in hs:
                md.append(f'- p.{h["page"]}「{h["term"]}」…{h["context"]}…')
        md.append('')
    (ROOT / 'review/allergen_sweep.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    (ROOT / 'review/allergen_sweep.md').write_text('\n'.join(md), encoding='utf-8')
    print(f'{total_cells} 個未載明格子，{total_hits} 個候選命中 → review/allergen_sweep.md')
    for s, r in report.items():
        print(s, r['product'][:18].ljust(18), ' '.join(f'{k}:{len(c["hits"])}' for k, c in r['cells'].items()))

if __name__ == '__main__':
    main()
