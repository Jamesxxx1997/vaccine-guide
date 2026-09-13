#!/usr/bin/env python3
"""
過敏與成分 → 可追溯資料。每份仿單一個分片 review/allergens.src.d/<key>.json：
{
  "vaccine":"hepb", "product":"Engerix-B 安在時", "source":"S26", "origin":"TFDA"（國際仿單寫 FDA／EMA／MHRA／TGA…，"lang":"en"）,
  "components":[{"page":1,"quote":"…成分段逐字（一行或一段，可多條）…","label":"成分"}],
  "allergens":[
    {"key":"yeast","status":"有","page":1,"quote":"…仿單逐字句…"},
    {"key":"egg","status":"未載明"},                     ← 未載明不需要引句
    {"key":"latex","status":"無","page":2,"quote":"…不含乳膠…"}
  ],
  "warnings":[{"label":"過敏禁忌","page":2,"quote":"…對本疫苗任何成分曾有嚴重過敏反應者…"}]
}
allergen key 固定：egg, gelatin, neomycin, other_antibiotics, yeast, latex, peg_polysorbate, formaldehyde, thimerosal, aluminium。
status「有」「無」必須附 quote（逐字，可被定位器在該頁找到且唯一）；「未載明」不得附 quote（沒有原句就不能宣稱），
但可附 "related":{"page":…,"quote":"…","note":"…"}＝仿單裡的相關原句（瓶塞材質、保存劑種類、佐劑種類），一樣做成 claim 顯示。
判讀慣例：「有」限於疫苗本身的成分／殘留（配方、製程殘留量、包裝材質）；只講上游培養基（例：載體蛋白 CRM197 培養於
yeast extract medium）或對照疫苗品名（Adjuvanted）的句子不算「有」，放 related 並加 note。
每個未載明格子都必須經過 tools/sweep_allergens.py 全文掃描：0 命中才算「仿單沒寫」；有命中必須判讀成 related 或在分片
"sweep":{"dismissed":{"<key>":"理由"}} 記為假陽性，否則產生器拒絕。
輸出：review/allergen-claims.json（claims，key al:…）、review/allergens.js（前端）。找不到／不唯一 → 由 build_reference_pages 定位時失敗。
用法：uv run --python 3.12 python tools/build_allergens.py
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'review/allergens.src.d'
OUT_CLAIMS = ROOT / 'review/allergen-claims.json'
OUT_JS = ROOT / 'review/allergens.js'
KEYS = ['egg', 'gelatin', 'neomycin', 'other_antibiotics', 'yeast', 'latex', 'peg_polysorbate', 'formaldehyde', 'thimerosal', 'aluminium']
LABELS = dict(egg='蛋（卵白蛋白／雞胚）', gelatin='明膠', neomycin='Neomycin', other_antibiotics='其他抗生素（kanamycin、polymyxin、gentamicin…）',
              yeast='酵母', latex='乳膠（針筒／瓶塞）', peg_polysorbate='PEG／polysorbate 80', formaldehyde='福馬林／甲醛殘留',
              thimerosal='硫柳汞', aluminium='鋁佐劑')
STATUSES = {'有', '無', '未載明'}

def main():
    check_only = Path(sys.argv[2]).resolve() if len(sys.argv) >= 3 and sys.argv[1] == '--check' else None
    products, claims = [], {}
    sweep = {f.stem: json.loads(f.read_text(encoding='utf-8')) for f in (ROOT / 'review/allergen_sweep.d').glob('*.json')} if (ROOT / 'review/allergen_sweep.d').is_dir() else {}
    for frag in ([check_only] if check_only else sorted(SRC_DIR.glob('*.json'))):
        d = json.loads(frag.read_text(encoding='utf-8'))
        for req in ('vaccine', 'product', 'source'):
            if req not in d:
                raise SystemExit(f'✗ {frag.name} 缺 {req}')
        pid = frag.stem
        # origin＝仿單來源機關（TFDA 預設；國際仿單寫 FDA/EMA/MHRA/TGA…），vaccineName＝站上 VAX 沒有此疫苗 id 時的顯示名（傷寒、M痘）
        prod = dict(id=pid, vaccine=d['vaccine'], product=d['product'], source=d['source'], origin=d.get('origin', 'TFDA'), lang=d.get('lang', 'zh'),
                    vaccineName=d.get('vaccineName', ''), components=[], allergens=[], warnings=[], note=d.get('note', ''))
        for i, c in enumerate(d.get('components', [])):
            cid = f'al:{pid}:comp:{i}'
            claims[cid] = dict(items=[dict(source=d['source'], page=c['page'], glyphRows=True, quotes=[c['quote']], label=f'{d["product"]} · {c.get("label", "成分")}', **({'region': c['region']} if c.get('region') else {}))])
            prod['components'].append(dict(label=c.get('label', '成分'), text=c['quote'], claim=cid))
        seen = set()
        for a in d.get('allergens', []):
            if a['key'] not in KEYS:
                raise SystemExit(f'✗ {frag.name}：未知過敏原 key {a["key"]}')
            if a['key'] in seen:
                raise SystemExit(f'✗ {frag.name}：過敏原 {a["key"]} 重複')
            seen.add(a['key'])
            if a.get('status') not in STATUSES:
                raise SystemExit(f'✗ {frag.name}：{a["key"]} 的 status 必須是 有／無／未載明')
            if a['status'] == '未載明':
                if a.get('quote'):
                    raise SystemExit(f'✗ {frag.name}：{a["key"]} 標未載明卻附引句（相關原句請放 related）')
                entry = dict(key=a['key'], label=LABELS[a['key']], status='未載明', claim=None, note=a.get('note', ''))
                # 未載明但仿單有「相關原句」（例：瓶塞為丁基橡膠、保存劑為酚、佐劑為 AS01B）→ 一樣做成 claim，格子旁顯示並可點開原件
                rel = a.get('related')
                if rel:
                    if not rel.get('quote') or not rel.get('page'):
                        raise SystemExit(f'✗ {frag.name}：{a["key"]} 的 related 必須有 page 與逐字 quote')
                    cid = f'al:{pid}:{a["key"]}:related'
                    claims[cid] = dict(items=[dict(source=d['source'], page=rel['page'], glyphRows=True, quotes=[rel['quote']], label=f'{d["product"]} · {LABELS[a["key"]]}：未載明（相關原句）', **({'region': rel['region']} if rel.get('region') else {}))])
                    entry.update(claim=cid, text=rel['quote'], related=True, note=rel.get('note', a.get('note', '')))
                prod['allergens'].append(entry)
                continue
            if not a.get('quote') or not a.get('page'):
                raise SystemExit(f'✗ {frag.name}：{a["key"]} 標「{a["status"]}」必須附 page 與逐字 quote')
            cid = f'al:{pid}:{a["key"]}'
            claims[cid] = dict(items=[dict(source=d['source'], page=a['page'], glyphRows=True, quotes=[a['quote']], label=f'{d["product"]} · {LABELS[a["key"]]}：{a["status"]}', **({'region': a['region']} if a.get('region') else {}))])
            prod['allergens'].append(dict(key=a['key'], label=LABELS[a['key']], status=a['status'], claim=cid, text=a['quote'], note=a.get('note', '')))
        for key in KEYS:
            if key not in seen:
                prod['allergens'].append(dict(key=key, label=LABELS[key], status='未載明', claim=None, note='分片未列，視為未載明'))
        # 未載明格子必須有全文掃描紀錄（tools/sweep_allergens.py → review/allergen_sweep.json）：0 命中，或命中已判讀（related 或 sweep.dismissed 理由）
        cells = (sweep.get(pid) or {}).get('cells', {})
        dismissed = (d.get('sweep') or {}).get('dismissed', {})
        for a in prod['allergens']:
            if a['status'] != '未載明':
                continue
            c = cells.get(a['key'])
            if c is None:
                raise SystemExit(f'✗ {frag.name}：{a["key"]} 未載明但沒有全文掃描紀錄——先跑 tools/sweep_allergens.py')
            n = len(c.get('hits', []))
            if n and not dismissed.get(a['key']) and not a.get('related'):
                raise SystemExit(f'✗ {frag.name}：{a["key"]} 全文掃描有 {n} 個候選命中尚未判讀（related 或 sweep.dismissed）')
            a['sweep'] = dict(hits=n, patterns=len(c.get('patterns', [])), dismissed=dismissed.get(a['key'], ''), date=(sweep.get(pid) or {}).get('date', ''))
        for i, w in enumerate(d.get('warnings', [])):
            cid = f'al:{pid}:warn:{i}'
            claims[cid] = dict(items=[dict(source=d['source'], page=w['page'], glyphRows=True, quotes=[w['quote']], label=f'{d["product"]} · {w.get("label", "警語")}', **({'region': w['region']} if w.get('region') else {}))])
            prod['warnings'].append(dict(label=w.get('label', '警語'), text=w['quote'], claim=cid))
        products.append(prod)
        print(f'{pid}: {len(prod["components"])} 成分段, {sum(1 for a in prod["allergens"] if a["status"]!="未載明")} 過敏原有引句, {len(prod["warnings"])} 警語')
    if check_only is not None:
        tmp = ROOT / 'review' / f'.check-al-{check_only.stem}.json'
        tmp.write_text(json.dumps(dict(claims=claims), ensure_ascii=False), encoding='utf-8')
        print(f'check-only: {len(claims)} claims → {tmp.name}（接著跑 tools/check_claims.py {tmp}）')
        return
    OUT_CLAIMS.write_text(json.dumps(dict(claims=claims), ensure_ascii=False, indent=1), encoding='utf-8')
    js = json.dumps(dict(keys=[dict(key=k, label=LABELS[k]) for k in KEYS], products=products), ensure_ascii=False).replace('</', '<\\/')
    OUT_JS.write_text('// Generated by tools/build_allergens.py — 逐字引句由 build_reference_pages 定位；勿手改。\nconst ALLERGENS=' + js + ';\n', encoding='utf-8')
    print(f'wrote {OUT_CLAIMS.name} ({len(claims)} claims) and {OUT_JS.name} ({len(products)} products)')

if __name__ == '__main__':
    main()
