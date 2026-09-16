#!/usr/bin/env python3
"""
把 sources/國際仿單/_manifest_*.json 裡的國際仿單登記成來源：
  - index.html 的 SRC 物件新增 S<n> 條目（pagesOnly:"claims"，n/v/o/u/p），
  - review/label-claims.json 的 hashes 加 sha256（build_reference_pages 會核對檔案），
  - review/label-sources.json 加一筆（cat/prod/path/pages），
  - 回寫 manifest 每筆的 "source": "S<n>"，供分片使用。
冪等：path 已登記過就沿用同一個 S key。用法：python3 tools/register_intl_labels.py [--dry] [manifest.json …]（不給路徑＝國際仿單全部 manifest）
"""
from __future__ import annotations
import hashlib, json, re, sys, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENCY = dict(FDA='美國 FDA', EMA='歐盟 EMA', MHRA='英國 MHRA', HPRA='愛爾蘭 HPRA', TGA='澳洲 TGA', Medsafe='紐西蘭 Medsafe', HSA='新加坡 HSA', emc='英國 emc（MHRA 核准文本）', HealthCanada='加拿大 Health Canada')

def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    dry = '--dry' in sys.argv
    html_path = ROOT / 'index.html'; html = html_path.read_text(encoding='utf-8')
    m = re.search(r'^const SRC = \{\n(.*?)^\};', html, re.S | re.M)
    body = m.group(1)
    existing = {pm.group(2): pm.group(1) for pm in re.finditer(r'^  (S\d+):\{.*?p:"([^"]+)"', body, re.S | re.M)}
    nums = [int(k[1:]) for k in re.findall(r'^  (S\d+):\{', body, re.M)]
    nxt = max(nums) + 1
    lc_path = ROOT / 'review/label-claims.json'; lc = json.loads(lc_path.read_text(encoding='utf-8'))
    ls_path = ROOT / 'review/label-sources.json'; ls = json.loads(ls_path.read_text(encoding='utf-8'))
    additions = []
    # 預設掃國際仿單 manifest；也可在命令列給其他 manifest 路徑（例：sources/流感/_manifest_TW.json）
    manifests = [a for a in sys.argv[1:] if not a.startswith('--')] or sorted(glob.glob(str(ROOT / 'sources/國際仿單/_manifest_*.json')))
    for mf in manifests:
        items = json.loads(Path(mf).read_text(encoding='utf-8'))
        changed = False
        for it in items:
            if not it.get('path') or not it['path'].lower().endswith('.pdf'):
                continue   # 沒檔或非 PDF（例：XML 全文）不登記
            pdf = ROOT / it['path']
            if not pdf.is_file():
                print(f'✗ {it.get("slug")}: 找不到 {it["path"]}'); continue
            digest = sha256(pdf)
            if it.get('sha256') and it['sha256'] != digest:
                print(f'! {it["slug"]}: manifest sha256 與檔案不符，以檔案為準')
            key = existing.get(it['path'])
            if not key:
                key = f'S{nxt}'; nxt += 1
                agency = AGENCY.get(it.get('agency', ''), it.get('agency', ''))
                if it.get('title'):   # 一般 manifest（指引／文獻／網頁列印／機型 IFU）
                    n = it['title']
                    v = f'{it.get("version","未確認")}；下載 {it.get("downloaded","")}'.replace('"', '”')
                    o = it.get('org') or it.get('maker') or agency
                else:                 # 國際仿單 manifest
                    n = f'{it.get("product","")} — {it.get("agency","")} 原廠英文仿單'
                    v = f'仿單版本 {it.get("revised","未確認")}；下載 {it.get("downloaded","")}'.replace('"', '”')
                    o = agency
                u = it.get('landing') or it.get('url', '')
                entry = f'  {key}:{{n:{json.dumps(n, ensure_ascii=False)}, v:{json.dumps(v, ensure_ascii=False)}, o:{json.dumps(o, ensure_ascii=False)}, pagesOnly:"claims",\n      u:{json.dumps(u, ensure_ascii=False)}, p:{json.dumps(it["path"], ensure_ascii=False)}}},\n'
                additions.append(entry); existing[it['path']] = key
            lc['hashes'][key] = digest
            ls[key] = dict(cat=it.get('vaccine', it.get('kind', '')), prod=it.get('product') or it.get('title', ''), path=it['path'], pages='claims', agency=it.get('agency') or it.get('org', ''))
            if it.get('source') != key:
                it['source'] = key; changed = True
            print(f'{key} ← {it["slug"]} ({it.get("agency")}) {it["path"]}')
        if changed and not dry:
            Path(mf).write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
    if dry:
        print(f'dry run: {len(additions)} 個新 SRC'); return
    if additions:
        # 插在 SRC 物件結尾（最後一個條目之後）
        new_body = body.rstrip('\n') + '\n' + ''.join(additions)
        html = html[:m.start(1)] + new_body + html[m.end(1):]
        html_path.write_text(html, encoding='utf-8')
    lc_path.write_text(json.dumps(lc, ensure_ascii=False, indent=1), encoding='utf-8')
    ls_path.write_text(json.dumps(ls, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'registered: {len(additions)} new SRC entries; hashes now {len(lc["hashes"])}')

if __name__ == '__main__':
    main()
