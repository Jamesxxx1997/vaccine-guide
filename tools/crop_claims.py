#!/usr/bin/env python3
"""
把 claim 的 glyph 框畫在原件頁圖上並裁出局部，供人眼／verifier 核對「框住的字＝引句」。
用法：uv run --python 3.12 --with 'Pillow>=10,<13' python tools/crop_claims.py --out DIR [--prefix ae:] [--source S27] [--sample N] [--seed 1] [--ids id1 id2 …]
輸出：DIR/<claim id 安全化>.png（紅框＝glyph 框，外加 40pt 邊界），並印出 id → label → quote。
"""
from __future__ import annotations
import argparse, json, random, re, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

def load():
    js = (ROOT / 'review/reference-pages.js').read_text(encoding='utf-8')
    m = re.search(r'^const REFERENCE_PAGES=(.*?);\nconst REFERENCE_CLAIMS=(.*?);\n?$', js, re.S | re.M)
    if not m:
        m = re.search(r'const REFERENCE_PAGES=(\{.*?\});\s*const REFERENCE_CLAIMS=(\{.*\});', js, re.S)
    return json.loads(m.group(1)), json.loads(m.group(2))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True); ap.add_argument('--prefix', default=''); ap.add_argument('--source', default='')
    ap.add_argument('--sample', type=int, default=0); ap.add_argument('--seed', type=int, default=1); ap.add_argument('--ids', nargs='*', default=[])
    ap.add_argument('--margin', type=float, default=40)
    a = ap.parse_args()
    pages, claims = load()
    ids = a.ids or [k for k in claims if k.startswith(a.prefix) and (not a.source or any(it.get('source') == a.source for it in claims[k]['items']))]
    if a.sample and len(ids) > a.sample:
        random.seed(a.seed); ids = sorted(random.sample(ids, a.sample))
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    n = 0
    for cid in ids:
        for j, it in enumerate(claims[cid]['items']):
            if not it.get('rects'):
                print(f'✗ {cid}#{j} 無 rects'); continue
            src = pages[it['source']]; pg = next((p for p in src['pages'] if p['page'] == it['page']), None)
            if not pg or not pg.get('img'):
                print(f'✗ {cid}#{j} 第 {it["page"]} 頁未渲染'); continue
            im = Image.open(ROOT / pg['img']).convert('RGB'); s = im.width / pg['w']
            d = ImageDraw.Draw(im)
            for x0, y0, x1, y1 in it['rects']:
                d.rectangle([x0 * s, y0 * s, x1 * s, y1 * s], outline=(255, 0, 0), width=2)
            xs = [r[0] for r in it['rects']] + [r[2] for r in it['rects']]; ys = [r[1] for r in it['rects']] + [r[3] for r in it['rects']]
            box = [max(0, (min(xs) - a.margin) * s), max(0, (min(ys) - a.margin) * s), min(im.width, (max(xs) + a.margin) * s), min(im.height, (max(ys) + a.margin) * s)]
            safe = re.sub(r'[^A-Za-z0-9_.-]+', '_', cid) + (f'_{j}' if j else '')
            im.crop(tuple(int(v) for v in box)).save(out / f'{safe}.png'); n += 1
            print(f'{cid}#{j} p.{it["page"]} {it["source"]} | {it.get("label","")} | {" / ".join(it["quotes"])[:120]}')
    print(f'{n} crops → {out}')

if __name__ == '__main__':
    main()
