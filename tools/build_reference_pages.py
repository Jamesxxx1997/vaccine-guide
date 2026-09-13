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


def word_positions(page, word, glyph_rows=False):
    """Map actual glyphs, never split a tall word box into estimated letters.

    Some PDFs have a font descriptor whose Poppler bbox spans adjacent lines.
    Opt-in row recovery requires one exact normalized glyph row; ambiguity or
    unavailable glyph geometry fails closed, instead of highlighting a tall box.
    """
    token = normalize(word[4])
    glyphs = [c for c in page.get('chars', []) if
              word[0]-1 <= (c[0]+c[2])/2 <= word[2]+1 and
              word[1]-2 <= (c[1]+c[3])/2 <= word[3]+2]
    glyphs.sort(key=lambda c:c[0])
    if not glyph_rows and ''.join(normalize(c[4]) for c in glyphs) == token:
        return [c for c in glyphs for _ in normalize(c[4])]
    if glyph_rows and token:
        rows = []
        for char in sorted(glyphs, key=lambda c:((c[1]+c[3])/2,c[0])):
            center = (char[1]+char[3])/2
            if rows and abs(center-rows[-1][0]) < 2:
                rows[-1][1].append(char)
            else:
                rows.append((center,[char]))
        matches = [sorted(row,key=lambda c:c[0]) for _,row in rows
                   if ''.join(normalize(c[4]) for c in sorted(row,key=lambda c:c[0])) == token]
        if len(matches) != 1:
            raise ValueError('Expected one exact glyph row: ' + word[4])
        return [c for c in matches[0] for _ in normalize(c[4])]
    return [word] * len(token)



def reading_lines(words):
    """把 [x0,y0,x1,y1,text,...] 的字依閱讀序分行：yMin 相差 6pt 內視為同一行（不用中心點——Poppler 偶爾給出
    跨兩行的高字框，中心點會落到別行；Shingrix 仿單「麻疹、血管性水腫」＋註腳「2」即一例），行內依 x0 排序。
    表格各欄常被 pdftotext 切成不同區塊，區域模式若照文件序串接會把同一列拆散；產生器與定位器都用這個函式，
    引句才保證在區域串流中連續。"""
    ordered, line_top = [], None
    for w in sorted(words, key=lambda w: (w[1], w[0])):
        if line_top is None or w[1] > line_top + 6:
            line_top = w[1]; ordered.append([])
        ordered[-1].append(w)
    return [sorted(line, key=lambda w: w[0]) for line in ordered]


def reading_order(words):
    return [w for line in reading_lines(words) for w in line]


def region_words(words, region):
    return [w for w in words if region[0] <= (w[0]+w[2])/2 <= region[2] and region[1] <= (w[1]+w[3])/2 <= region[3]]


def anchor_quote(page, quote, region=None, glyph_rows=False):
    """Exact normalized matches only, never fuzzy or cross-column matching."""
    needle = normalize(quote)
    matches = []
    blocks = [None] if region else sorted({line[5] for line in page['lines']})
    for block in blocks:
        words = [w for w in page['words'] if (region and
                 region[0] <= (w[0]+w[2])/2 <= region[2] and
                 region[1] <= (w[1]+w[3])/2 <= region[3]) or
                 (not region and page['lines'][w[5]][5] == block)]
        if region:
            words = reading_order(words)   # 區域模式依閱讀序（行→左到右）；與 tools/build_adverse_effects.py 共用同一規則
        stream, positions = '', []
        for word in words:
            token = normalize(word[4])
            stream += token
            positions += [(word, offset) for offset in range(len(token))]
        start = stream.find(needle)
        if start < 0:
            continue
        if stream.find(needle, start + 1) >= 0:
            raise ValueError('Ambiguous quotation: ' + quote)
        selected = positions[start:start + len(needle)]
        rects = []
        mapped = {}
        for word, offset in selected:
            if id(word) not in mapped:
                mapped[id(word)] = word_positions(page, word, glyph_rows)
            rect = mapped[id(word)][offset][:4]
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
                item['rects'] = [r for q in item['quotes'] for r in anchor_quote(page, q, item.get('region'), item.get('glyphRows', False))]
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
    # 產生器輸出的 claims（副作用表 ae:、之後的過敏成分表）放在獨立檔案，這裡合併；key 不得與手寫 claims 重複。
    for extra in ('review/adverse-claims.json', 'review/allergen-claims.json'):
        path = ROOT / extra
        if path.is_file():
            more = json.loads(path.read_text())
            dup = set(more.get('claims', {})) & set(spec['claims'])
            if dup:
                raise ValueError('Duplicate claim ids across files: ' + ', '.join(sorted(dup)))
            spec['claims'].update(more.get('claims', {}))
            for k, v in more.get('hashes', {}).items():
                if spec['hashes'].get(k, v) != v:
                    raise ValueError('Conflicting hash for ' + k)
                spec['hashes'][k] = v
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
        glyph_pdf = pdfplumber.open(ROOT / file)
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
            if glyph_pdf:
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
