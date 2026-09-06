#!/usr/bin/env python3
"""Render reviewed original pages and uniquely anchor literal source fragments.

Chinese guide summaries are editorial translations, never labelled verbatim.
Coordinates are PDF points; the shared UI keeps full-page width and context.
"""
import hashlib
import json
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
import pdfplumber
from PIL import Image
from build_reference_pages import NS, anchor_quote

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'review/travel-guide-spec.json'
OUT = ROOT / 'review/travel-pages'


def build():
    spec = json.loads(SPEC.read_text())
    manifest = json.loads((ROOT / 'sources/旅遊疫苗/2026-09-06/manifest.json').read_text())
    archive = {d['id']: d for d in manifest['documents']}
    pins = json.loads((ROOT / 'review/travel-guide-hashes.json').read_text())
    needed = {}
    for guide in spec['guides']:
        for section in guide['sections']:
            needed.setdefault(section['source'], set()).add(section['page'])
    docs, claims = {}, {}
    OUT.mkdir(exist_ok=True)
    for key, numbers in needed.items():
        original = archive[key]
        file = ROOT / original['path']
        sha = hashlib.sha256(file.read_bytes()).hexdigest()
        if sha != pins[key] or sha != original['sha256']:
            raise ValueError('Source changed; review again: ' + key)
        xml = subprocess.check_output(['pdftotext', '-bbox-layout', str(file), '-']).decode()
        xml = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', xml)
        parsed = ET.fromstring(xml).findall('.//h:page', NS)
        doc = dict(n=original['title'], p=original['path'], u=original.get('download_url') or original.get('url') or original['landing_url'],
                   v=original.get('document_version', '原文件未標明版本'), sha256=sha,
                   pageCount=len(parsed), pages=[])
        with pdfplumber.open(file) as glyphs:
            for number in sorted(numbers):
                page = parsed[number-1]
                target = OUT / f'{key}-{sha[:10]}-{number}.jpg'
                if not target.exists():
                    with tempfile.TemporaryDirectory(prefix='travel-pdf-') as tmp:
                        prefix = str(Path(tmp) / 'page')
                        subprocess.run(['pdftoppm', '-f', str(number), '-l', str(number),
                                        '-singlefile', '-r', '125', '-jpeg', '-jpegopt', 'quality=86',
                                        str(file), prefix], check=True, stderr=subprocess.PIPE)
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
                                          ('xMin', 'yMin', 'xMax', 'yMax')] + [''.join(word.itertext()), line_id])
                doc['pages'].append(dict(page=number, w=float(page.attrib['width']), h=float(page.attrib['height']),
                    iw=iw, ih=ih, img=str(target.relative_to(ROOT)), lines=lines, words=words,
                    chars=[[round(c[a],2) for a in ('x0','top','x1','bottom')]+[c['text']]
                           for c in glyphs.pages[number-1].chars if c['text'].strip()]))
        docs['TRAVEL_'+key] = doc
    for guide in spec['guides']:
        for i, section in enumerate(guide['sections']):
            source = 'TRAVEL_' + section['source']
            doc = docs[source]
            page = next(p for p in doc['pages'] if p['page'] == section['page'])
            try:
                rects = [r for q in section['quotes'] for r in anchor_quote(page, q, section.get('region'))]
            except ValueError as e:
                raise ValueError(f'{guide["id"]}/{i}: {e}') from e
            section['claim'] = 'travel-guide-' + guide['id'] + '-' + str(i)
            claims[section['claim']] = dict(note=spec['note']+' '+guide['scope'], items=[dict(
                source=source, page=section['page'], sha256=doc['sha256'], rects=rects,
                quotes=section['quotes'])])
    # Archive links are navigation only, not falsely promoted to quote verification.
    library = [dict(id=d['id'], title=d['title'], p=d['path'], u=d.get('download_url') or d.get('url') or d['landing_url'], topics=d['topics'],
                    version=d.get('document_version', '文件未標明版本'), restriction=d.get('restriction', ''))
               for d in archive.values()]
    def js(value):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<','\\u003c')
    output = ('// Generated from hash-pinned reviewed source fragments.\n'
              'Object.assign(REFERENCE_PAGES,'+js(docs)+');\n'
              'Object.assign(REFERENCE_CLAIMS,'+js(claims)+');\n'
              'const TRAVEL_GUIDES='+js(spec['guides'])+';\n'
              'const TRAVEL_PDF_LIBRARY='+js(library)+';\n')
    (ROOT / 'review/travel-reference-pages.js').write_text(output)
    print(json.dumps(dict(guides=len(spec['guides']), claims=len(claims), pages=sum(len(d['pages']) for d in docs.values()))))


if __name__ == '__main__':
    build()
