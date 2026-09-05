#!/usr/bin/env python3
"""Read-only source PDFs -> local page previews and text coordinates.

This contextual page index is deliberately separate from EXCERPTS: a search
result is NOT a verified quotation. Yellow marks identify only actual matching
fragments; whole-claim verification is a separate grade.
Original sources and the 124 verified-rule records are not modified.
"""
import hashlib
import json
import re
from pathlib import Path
import subprocess
import tempfile
import unicodedata
import xml.etree.ElementTree as ET

from PIL import Image
import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'review' / 'pages'
NS = {'h': 'http://www.w3.org/1999/xhtml'}


def normalize(text):
    return re.sub(r'[^a-z0-9\u3400-\u9fff]', '', unicodedata.normalize('NFKC', text).lower())


def anchor_quote(page, quote, region=None):
    """Exact normalized matches only, never fuzzy or cross-column matching."""
    needle = normalize(quote)
    matches = []
    blocks = [None] if region else sorted({line[5] for line in page['lines']})
    for block in blocks:
        words = [w for w in page['words'] if (region and
                 region[0] <= (w[0]+w[2])/2 <= region[2] and
                 region[1] <= (w[1]+w[3])/2 <= region[3]) or
                 (not region and page['lines'][w[5]][5] == block)]
        stream, positions = '', []
        for word in words:
            token = normalize(word[4])
            stream += token
            glyphs = [c for c in page.get('chars', []) if
                      word[0]-1 <= (c[0]+c[2])/2 <= word[2]+1 and
                      word[1]-2 <= (c[1]+c[3])/2 <= word[3]+2]
            glyphs.sort(key=lambda c:c[0])
            glyph_text = ''.join(normalize(c[4]) for c in glyphs)
            positions += ([c for c in glyphs for _ in normalize(c[4])]
                          if glyph_text == token else [word] * len(token))
        start = stream.find(needle)
        if start < 0:
            continue
        if stream.find(needle, start + 1) >= 0:
            raise ValueError('Ambiguous quotation: ' + quote)
        selected = positions[start:start + len(needle)]
        rects = []
        for word in selected:
            rect = word[:4]
            if not rects or rects[-1] != rect:
                rects.append(rect)
        matches.append(rects)
    if len(matches) != 1:
        raise ValueError(f'Expected one exact block match, found {len(matches)}: {quote}')
    return matches[0]


def build_claims(sources, spec):
    for key, expected in spec['hashes'].items():
        if sources[key].get('sha256') != expected:
            raise ValueError('Source changed; re-review anchors before rebuilding: ' + key)
    result = {}
    def resolve(key):
        if key in result:
            return result[key]
        entry = spec['claims'][key]
        items = []
        for item in entry['items']:
            if 'ref' in item:
                items.extend(resolve(item['ref'])['items'])
                continue
            item = dict(item)
            if 'page' in item:
                doc = sources[item['source']]
                page = doc['pages'][item['page'] - 1]
                item['rects'] = [r for q in item['quotes'] for r in anchor_quote(page, q, item.get('region'))]
                item['sha256'] = doc['sha256']
            items.append(item)
        result[key] = dict(note=entry.get('note', ''), items=items)
        return result[key]
    for key in spec['claims']:
        resolve(key)
    return result


def build():
    sources = json.loads(subprocess.check_output(
        ['node', str(ROOT / 'tools/export_reference_inputs.mjs')], text=True))
    spec = json.loads((ROOT / 'review/reference-claims.json').read_text())
    glyph_pages = {}
    for claim in spec['claims'].values():
        for item in claim['items']:
            if 'page' in item:
                glyph_pages.setdefault(item['source'], set()).add(item['page'])
    files = {s['p']: k for k, s in sources.items() if s['p'].endswith('.pdf')}
    for path in sorted((ROOT / 'sources/各疫苗').glob('*.pdf')):
        relative = str(path.relative_to(ROOT))
        if relative not in files:
            key = 'D' + hashlib.sha256(relative.encode()).hexdigest()[:10]
            files[relative] = key
            sources[key] = dict(n=path.stem, v='本機來源存檔 · 擷取 2026-08-07',
                                p=relative, u='')
    OUT.mkdir(parents=True, exist_ok=True)
    for file, key in files.items():
        doc = sources[key]
        doc['sha256'] = hashlib.sha256((ROOT / file).read_bytes()).hexdigest()
        xml = subprocess.check_output(['pdftotext', '-bbox-layout', str(ROOT / file), '-']).decode('utf-8', errors='replace')
        # quote-review/anchor_engine.py's XML-control-character safeguard.
        xml = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', xml)
        pages = ET.fromstring(xml).findall('.//h:page', NS)
        glyph_pdf = pdfplumber.open(ROOT / file) if key in glyph_pages or key in ['S2','S3','S4','S5','S6','S7','S8'] else None
        doc['pages'] = []
        for number, page in enumerate(pages, 1):
            target = OUT / f'{key}-{doc["sha256"][:10]}-{number}.jpg'
            # Render once; different excerpt windows reuse this image in CSS.
            if not target.exists():
                with tempfile.TemporaryDirectory(prefix='vax-page-') as tmp:
                    prefix = str(Path(tmp) / 'page')
                    subprocess.run(['pdftoppm', '-f', str(number), '-l', str(number),
                                    '-singlefile', '-r', '125', '-jpeg', '-jpegopt',
                                    'quality=86', str(ROOT / file), prefix], check=True,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                    target.write_bytes(Path(prefix + '.jpg').read_bytes())
            with Image.open(target) as image:
                iw, ih = image.size
            lines, words = [], []
            for block_id, block in enumerate(page.findall('.//h:block', NS)):
                for line in block.findall('.//h:line', NS):
                    line_words = line.findall('h:word', NS)
                    text = ' '.join(''.join(w.itertext()) for w in line_words)
                    if not text.strip():
                        continue
                    line_id = len(lines)
                    lines.append([round(float(line.attrib[a]), 2) for a in
                                  ('xMin', 'yMin', 'xMax', 'yMax')] + [text, block_id])
                    for word in line_words:
                        words.append([round(float(word.attrib[a]), 2) for a in
                                      ('xMin', 'yMin', 'xMax', 'yMax')] +
                                     [''.join(word.itertext()), line_id])
            doc['pages'].append(dict(page=number, w=float(page.attrib['width']),
                                     h=float(page.attrib['height']), iw=iw, ih=ih,
                                     img=str(target.relative_to(ROOT)), lines=lines, words=words))
            if glyph_pdf and (key in ['S2','S3','S4','S5','S6','S7','S8'] or number in glyph_pages.get(key, set())):
                doc['pages'][-1]['chars'] = [[round(c[a],2) for a in ('x0','top','x1','bottom')]+[c['text']]
                                            for c in glyph_pdf.pages[number-1].chars if c['text'].strip()]
        if glyph_pdf:
            glyph_pdf.close()
        print(key, len(pages), file, flush=True)
    sources['S9']['text'] = (ROOT / sources['S9']['p']).read_text()
    # Short source extract checked against the original MOHW announcement.
    sources['S10']['text'] = (
        '輪狀病毒疫苗將於明(2027)年1月1日納入幼兒公費疫苗接種 '
        '併同提供2劑型及3劑型疫苗\n\n'
        '相關接種說明如下：\n'
        '1. 接種年齡：最小為出生滿6週，最大不得超過8個月。\n'
        '2. 建議接種時程：\n2劑型：出生滿2、4個月。\n3劑型：出生滿2、4、6個月。\n'
        '3. 接種間隔：每劑最短間隔4週。')
    sources['S10']['textLabel'] = '官方網頁原文節錄（非 PDF）'
    sources['S9']['textLabel'] = '本機仿單整理摘錄（非原始 PDF）'
    claims = build_claims(sources, spec)
    result = ROOT / 'review/reference-pages.js'
    result.write_text('// Generated by tools/build_reference_pages.py; context only.\n'
                      'const REFERENCE_PAGES=' + json.dumps(sources, ensure_ascii=False,
                                                           separators=(',', ':')) + ';\n'
                      'const REFERENCE_CLAIMS=' + json.dumps(claims, ensure_ascii=False,
                                                            separators=(',', ':')) + ';\n')
    print('Saved', result)


if __name__ == '__main__':
    build()
