"""Recompute every stored unknown-cell scan without changing production files.

Uses the production regex matcher to check freshness, then separately scans
additional candidate synonyms. Candidate hits require human interpretation.
"""
import json, re, sys, unicodedata
from pathlib import Path
import sweep_allergens as scan
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/vaccine-audit')
D=json.loads((OUT/'inputs.json').read_text())
extra={'egg':[r'ovalbumen',r'卵清',r'鷄'], 'other_antibiotics':[r'ciprofloxacin',r'新霉素',r'氨基糖苷',r'aminoglycoside',r'兩性黴素',r'二性黴素',r'多粘',r'多黏'],
       'peg_polysorbate':[r'聚乙烯',r'聚山梨醇',r'聚山梨糖',r'吐温',r'聚氧乙'], 'yeast':[r'komagataella'], 'gelatin':[r'gelafundin',r'膠原',r'collagen']}
diffs=[];candidates=[];dismissed=[];count=0;pages=0
for f in sorted((ROOT/'review/allergens.src.d').glob('*.json')):
 d=json.loads(f.read_text());sid=d['source'];sw=json.loads((ROOT/'review/allergen_sweep.d'/f.name).read_text());texts=scan.page_texts(ROOT/D['sources'][sid]['p']);pages+=len(texts)
 listed={a['key']:a for a in d['allergens']}
 for key in scan.SYN:
  if listed.get(key,{}).get('status','未載明')!='未載明':continue
  count+=1;old=sw['cells'].get(key);fresh=scan.hits_for(texts,scan.SYN[key])
  if not old or old['patterns']!=scan.SYN[key] or old['hits']!=fresh:diffs.append({'source':sid,'key':key,'storedHits':len(old['hits']) if old else None,'freshHits':len(fresh),'patternChanged':bool(old and old['patterns']!=scan.SYN[key])})
  reason=d.get('sweep',{}).get('dismissed',{}).get(key)
  if reason or fresh:dismissed.append({'source':sid,'key':key,'reason':reason,'related':listed.get(key,{}).get('related'),'hits':fresh})
  if key in extra:
   hits=scan.hits_for(texts,extra[key])
   if hits:candidates.append({'source':sid,'key':key,'hits':hits})
 if sw['pages']!=len(texts):diffs.append({'source':sid,'error':'page count differs'})
 print(sid,'done',flush=True)
result={'cells':count,'pagesScanned':pages,'diffs':diffs,'extraCandidates':candidates,'dismissedReview':dismissed}
(OUT/'sweep.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in result.items() if k!='dismissedReview'},ensure_ascii=False,indent=2))
