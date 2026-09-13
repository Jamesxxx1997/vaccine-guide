#!/usr/bin/env python3
"""
只驗證、不寫輸出：對一份 claims JSON 的每個 item 做與 build_reference_pages 相同的定位（pdftotext -bbox-layout 字串＋
pdfplumber glyph），回報成功／失敗與原因。供多個 agent 並行寫分片時各自自檢，不會互相覆蓋 review/ 產物。
用法：uv run --python 3.12 --with 'pdfplumber>=0.11,<0.12' python tools/check_claims.py <claims.json> [<claims.json>…]
"""
from __future__ import annotations
import json, re, subprocess, sys
import xml.etree.ElementTree as ET
from pathlib import Path
import pdfplumber
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from build_reference_pages import anchor_quote, NS  # noqa: E402

_cache = {}
def page_dict(pdf_path: Path, number: int):
    key = (str(pdf_path), number)
    if key in _cache:
        return _cache[key]
    xml = subprocess.check_output(['pdftotext', '-f', str(number), '-l', str(number), '-bbox-layout', str(pdf_path), '-']).decode('utf-8', 'replace')
    xml = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', xml)
    page = ET.fromstring(xml).find('.//h:page', NS)
    lines, words = [], []
    for block_id, block in enumerate(page.findall('.//h:block', NS)):
        for line in block.findall('.//h:line', NS):
            lw = line.findall('h:word', NS)
            text = ' '.join(''.join(w.itertext()) for w in lw)
            if not text.strip():
                continue
            line_id = len(lines)
            lines.append([round(float(line.attrib[a]), 2) for a in ('xMin', 'yMin', 'xMax', 'yMax')] + [text, block_id])
            for w in lw:
                words.append([round(float(w.attrib[a]), 2) for a in ('xMin', 'yMin', 'xMax', 'yMax')] + [''.join(w.itertext()), line_id])
    with pdfplumber.open(pdf_path) as pdf:
        chars = [[round(c[a], 2) for a in ('x0', 'top', 'x1', 'bottom')] + [c['text']] for c in pdf.pages[number - 1].chars if c['text'].strip()]
    _cache[key] = dict(page=number, lines=lines, words=words, chars=chars)
    return _cache[key]

def main():
    sources = json.loads(subprocess.check_output(['node', str(ROOT / 'tools/export_reference_inputs.mjs')], text=True))
    ok = bad = 0
    for path in sys.argv[1:]:
        spec = json.loads(Path(path).read_text(encoding='utf-8'))
        for cid, claim in spec['claims'].items():
            for item in claim['items']:
                if 'page' not in item:
                    continue
                src = sources.get(item['source'])
                if not src or not src.get('p', '').endswith('.pdf'):
                    print(f'✗ {cid}: source {item["source"]} 不是本機 PDF'); bad += 1; continue
                try:
                    page = page_dict(ROOT / src['p'], item['page'])
                    for q in item['quotes']:
                        anchor_quote(page, q, item.get('region'), item.get('glyphRows', False))
                    ok += 1
                except Exception as e:  # noqa: BLE001
                    print(f'✗ {cid} p.{item["page"]} {item["source"]}: {e}'); bad += 1
    print(f'{ok} OK, {bad} FAIL')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
