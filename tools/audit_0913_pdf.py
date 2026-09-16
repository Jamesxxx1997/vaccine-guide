"""Read-only fresh PDF geometry/hash audit, independent of the anchor builder.

Run audit_0913.cjs first. Checks every al:/ae: rectangle against freshly read
glyph coordinates and Poppler word boxes, preserving stored rectangle order.
The comparison normalization matches the site's contract (punctuation ignored);
this proves selected text, not clinical interpretation or complete table columns.
"""
import collections, hashlib, json, re, subprocess, sys, unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
import pdfplumber

ROOT=Path(__file__).resolve().parent.parent
OUT=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/vaccine-audit')
D=json.loads((OUT/'inputs.json').read_text())
norm=lambda s:re.sub(r'[^a-z0-9\u3400-\u9fff]','',unicodedata.normalize('NFKC',s).lower())
ns={'h':'http://www.w3.org/1999/xhtml'}
group=collections.defaultdict(list)
for cid,c in D['claims'].items():
    for it in c['items']:group[(it['source'],it['page'])].append((cid,it))
hashes=json.loads((ROOT/'review/label-claims.json').read_text())['hashes']
hash_errors=[]
for sid,expected in hashes.items():
    actual=hashlib.sha256((ROOT/D['sources'][sid]['p']).read_bytes()).hexdigest()
    if expected!=actual or D['pages'].get(sid,{}).get('sha256')!=actual:hash_errors.append(sid)
results=[]
for sid in sorted({s for s,p in group}):
    pdfpath=ROOT/D['sources'][sid]['p']
    with pdfplumber.open(pdfpath) as pdf:
        for _,pn in sorted(k for k in group if k[0]==sid):
            page=pdf.pages[pn-1]
            glyphs=collections.defaultdict(list)
            for c in page.chars:
                if c['text'].strip():glyphs[tuple(round(c[a],2) for a in ('x0','top','x1','bottom'))].append(c['text'])
            xml=subprocess.check_output(['pdftotext','-f',str(pn),'-l',str(pn),'-bbox-layout',str(pdfpath),'-']).decode('utf-8','replace')
            xml=re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]','',xml)
            words=[tuple(float(w.attrib[a]) for a in ('xMin','yMin','xMax','yMax'))+(''.join(w.itertext()),) for w in ET.fromstring(xml).findall('.//h:word',ns)]
            for cid,it in group[(sid,pn)]:
                chars=[];bad=[];bbox_misses=[]
                for i,r in enumerate(it['rects']):
                    values=glyphs.get(tuple(r),[])
                    if len(set(values))==1:chars.append(values[0])
                    else:bad.append({'index':i,'rect':r,'glyphs':values})
                    # Poppler word rectangles can be taller than glyphs; require
                    # actual positive overlap on both axes, never infer characters.
                    if not any(min(r[2],w[2])-max(r[0],w[0])>0 and min(r[3],w[3])-max(r[1],w[1])>0 for w in words):bbox_misses.append(i)
                got=''.join(chars);quote=''.join(it['quotes'])
                results.append({'claim':cid,'source':sid,'page':pn,'rects':len(it['rects']),'textEqual':norm(got)==norm(quote),'badGlyphs':bad,'bboxMisses':bbox_misses,
                                **({'selectedText':got,'quote':quote} if norm(got)!=norm(quote) or bad or bbox_misses else {})})
            page.close()
    print(sid,'done',flush=True)
summary={'claims':len(results),'rects':sum(x['rects'] for x in results),'pages':len(group),'pdfs':len({s for s,p in group}),'hashes':len(hashes),'hashErrors':hash_errors,
         'failures':[r for r in results if not r['textEqual'] or r['badGlyphs'] or r['bboxMisses']]}
(OUT/'geometry.json').write_text(json.dumps({'summary':summary,'results':results},ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False,indent=2))
