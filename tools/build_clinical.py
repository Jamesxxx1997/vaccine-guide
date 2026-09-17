#!/usr/bin/env python3
"""
疾病臨床模組（流感等）→ 可追溯資料。
分片：review/clinical.src.d/<disease>/<panel>.json（一主題一檔，可多檔）
{
  "disease":"flu", "panel":"antiviral|test|isolation|special|qa|vaccine",
  "items":[
    {"id":"flu-av-oseltamivir-dose-adult",           ← 全站唯一
     "type":"fact|rule|table-row|qa",
     "label":"Oseltamivir 成人治療劑量",
     "summary":"75 mg 每日兩次，共 5 天[[1]]；腎功能不全需調整[[2]]。",   ← 中文整理句；[[n]]＝緊接子句的句中引註（n 是本 item 第 n 個 ref）；每個數字都必須出現在某條引句
     "refs":[{"source":"S94","page":3,"quote":"逐字…","region":[x0,y0,x1,y1]（可選）,"note":"（可選）"}, …],
     "tags":{"drug":"oseltamivir","population":"adult","purpose":"treatment"},   ← 選擇器／篩選用，自由鍵值
             "topic":"議題名（同議題的 item 合成一張卡）",
             "row":{"次族群":"整體","流感 A 敏感度":"54.4%（48.9–59.8）[[1]]", …}   ← 估計值表：同議題每個 item 都有 row 就渲染成表（一列＝一工具×次族群），每格自帶 [[n]]；格內數字也受引句檢查
     "authority":"TFDA|疾管署|CDC|WHO|IDSA|ACIP|paper|廠商",
     "keywords":["快篩陰性","克流感","要不要吃"],          ← 寫死的搜尋關鍵字（民眾用語／同義詞），給站內關鍵字搜尋用，不經 LLM
     "question":"（type=qa 時）民眾問法",
     "answer":"（type=qa 時可省略，用 summary）"}
  ]
}
type=rule 的 item 可用 "basedOn":["其他 item id",…] 借用那些 item 的 refs（規則依據＝仿單／指引原句），也可自帶 refs；
"tags":{"drug":"baloxavir","verdict":"可用|不建議|不適用|需審核|儲備藥","when":{…條件…}} 供選擇器評估（條件鍵見 clinical.js：ageMin/ageMax（歲）、weightMin/weightMax（kg）、pregnant、crclMax、hoursMax、setting（outpatient|inpatient）、purpose（treatment|pep）、highRisk）。
規則：每個 item 至少 1 個 ref（或 basedOn 能解析出 ref）；ref 必須有 source/page/quote；quote 逐字、同一文字區塊內、該頁唯一（定位失敗會在 build_reference_pages 報錯）；
summary 內的數字（含 %、mg、天、小時、歲、公斤等）逐一檢查是否出現在該 item 任一引句（去空白比對），否則拒絕——沒有原句的數字不准出現在頁面上。
唯一豁免：西元年（19xx／20xx）視為文件名稱的一部分（WHO 2024、ACIP 2025-26），不是臨床數字；寫年份時必須與該來源在 index.html SRC 登記的版本一致（verifier 抽查）。
輸出：review/clinical-claims.json（claims，key cl:<disease>:<item id>:<n>）、review/clinical.js（const CLINICAL={diseases:{flu:{panels:{…}}}}）。
用法：uv run --python 3.12 python tools/build_clinical.py            # 全量
      uv run --python 3.12 python tools/build_clinical.py --check review/clinical.src.d/flu/antiviral.json   # 單檔，只寫 review/.check-cl-<name>.json 供 check_claims.py
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'review/clinical.src.d'
OUT_CLAIMS = ROOT / 'review/clinical-claims.json'
OUT_JS = ROOT / 'review/clinical.js'
PANELS = ['antiviral', 'test', 'isolation', 'special', 'qa', 'vaccine']
TYPES = {'fact', 'rule', 'table-row', 'qa'}
NUM = re.compile(r'\d+(?:[.,]\d+)?')

def norm(s: str) -> str:
    return re.sub(r'\s+', '', str(s or '')).replace('％', '%').replace('，', ',')

def numbers_ok(summary: str, quotes: list[str]) -> list[str]:
    """回傳 summary 裡沒有出現在任何引句的數字（去空白、全形化後比對）。"""
    summary = re.sub(r'\[\[\d+\]\]', '', summary)  # 句中引註標記本身的數字（如 [[2]]）不是臨床數字，掃描前先剝除
    hay = norm(' '.join(quotes))
    missing = []
    for n in NUM.findall(norm(summary)):
        bare = n.replace(',', '')
        if re.fullmatch(r'(19|20)\d\d', bare):   # 西元年（WHO 2024、JAMA IM 2025）是文件名稱，不是臨床數字
            continue
        if n in hay or bare in hay.replace(',', ''):
            continue
        missing.append(n)
    return missing

def load_fragments(paths):
    frags = []
    for p in paths:
        d = json.loads(Path(p).read_text(encoding='utf-8'))
        for req in ('disease', 'panel', 'items'):
            if req not in d:
                raise SystemExit(f'✗ {p}: 缺 {req}')
        if d['panel'] not in PANELS:
            raise SystemExit(f'✗ {p}: panel 必須是 {PANELS}')
        frags.append((Path(p), d))
    return frags

def main():
    check_only = None
    if len(sys.argv) >= 3 and sys.argv[1] == '--check':
        check_only = Path(sys.argv[2]).resolve()
    # --exclude a.json,b.json：全量建置時暫時略過還在寫的分片（agent 並行時用）
    excl = set()
    if '--exclude' in sys.argv:
        excl = set(sys.argv[sys.argv.index('--exclude') + 1].split(','))
    paths = [check_only] if check_only else [p for p in sorted(SRC_DIR.glob('*/*.json')) if p.name not in excl]
    frags = load_fragments(paths)
    claims, diseases, seen = {}, {}, set()
    all_items = {it['id']: it for _, d in frags for it in d['items'] if it.get('id')}
    for path, d in frags:
        dz = diseases.setdefault(d['disease'], dict(id=d['disease'], panels={}))
        panel = dz['panels'].setdefault(d['panel'], [])
        for it in d['items']:
            # basedOn：借用其他 item 的 refs（單檔 --check 時解析不到的就略過，但至少要有一個能用的 ref）
            if it.get('basedOn'):
                borrowed = []
                for bid in it['basedOn']:
                    src = all_items.get(bid)
                    if src:
                        borrowed += [dict(r, note=(r.get('note') or '') + ('' if not src.get('label') else f'（依據：{src["label"]}）')) for r in src.get('refs', [])]
                    elif check_only is None:
                        raise SystemExit(f'✗ {path.name}：{it["id"]} basedOn 找不到 {bid}')
                it = dict(it, refs=list(it.get('refs', [])) + borrowed)
            for req in ('id', 'type', 'label', 'summary', 'refs'):
                if req not in it:
                    raise SystemExit(f'✗ {path.name}：item 缺 {req}（{it.get("id","?")}）')
            if it['type'] not in TYPES:
                raise SystemExit(f'✗ {path.name}：{it["id"]} type 必須是 {sorted(TYPES)}')
            if it['id'] in seen:
                raise SystemExit(f'✗ {path.name}：item id 重複 {it["id"]}')
            seen.add(it['id'])
            if not it['refs']:
                if check_only is not None and it.get('basedOn'):
                    print(f'! {it["id"]}：basedOn 在單檔檢查時解析不到，全量建置時再驗'); continue
                raise SystemExit(f'✗ {path.name}：{it["id"]} 沒有 ref——沒有原句的陳述不准上頁面')
            out_refs = []
            for n, r in enumerate(it['refs']):
                if not (r.get('source') and r.get('page') and r.get('quote')):
                    raise SystemExit(f'✗ {path.name}：{it["id"]} 第 {n+1} 個 ref 缺 source/page/quote')
                cid = f'cl:{d["disease"]}:{it["id"]}:{n}'
                item = dict(source=r['source'], page=int(r['page']), glyphRows=True, quotes=[r['quote']],
                            label=f'{it["label"]} [{n+1}]' + (f' · {r["note"]}' if r.get('note') else ''))
                if r.get('region'):
                    item['region'] = [float(v) for v in r['region']]
                claims[cid] = dict(note=it.get('note', ''), items=[item])
                out_refs.append(dict(claim=cid, source=r['source'], page=int(r['page']), quote=r['quote'], note=r.get('note', '')))
            # 句中引註：summary／answer 可寫 [[n]]（n＝該 item 第 n 個 ref，從 1 起），渲染成緊接子句的 [n]；沒被句中引用的 ref 會排在句尾
            for m_ in re.finditer(r'\[\[(\d+)\]\]', it['summary'] + ' ' + (it.get('answer') or '')):
                if not (1 <= int(m_.group(1)) <= len(it['refs'])):
                    raise SystemExit(f'✗ {path.name}：{it["id"]} 句中引註 [[{m_.group(1)}]] 超出 refs 數（{len(it["refs"])}）')
            # tags.row：估計值表的一列（{欄名:格文字}；格內可寫 [[n]]），同一議題每個 item 都有 row 才會渲染成表；格內數字同樣必須出現在引句
            row = (it.get('tags') or {}).get('row')
            row_text = ''
            if row is not None:
                if not isinstance(row, dict) or not row:
                    raise SystemExit(f'✗ {path.name}：{it["id"]} tags.row 必須是非空物件')
                row_text = ' '.join(str(v) for v in row.values())
                for m_ in re.finditer(r'\[\[(\d+)\]\]', row_text):
                    if not (1 <= int(m_.group(1)) <= len(it['refs'])):
                        raise SystemExit(f'✗ {path.name}：{it["id"]} tags.row 句中引註 [[{m_.group(1)}]] 超出 refs 數（{len(it["refs"])}）')
            missing = numbers_ok(it['summary'] + ' ' + (it.get('answer') or '') + ' ' + row_text, [r['quote'] for r in it['refs']])
            if missing:
                raise SystemExit(f'✗ {path.name}：{it["id"]} 整理句含未引用原句的數字 {missing}——請補引句或刪掉數字')
            panel.append(dict(id=it['id'], type=it['type'], label=it['label'], summary=it['summary'], refs=out_refs, basedOn=it.get('basedOn', []),
                              tags=it.get('tags', {}), authority=it.get('authority', ''), question=it.get('question', ''),
                              answer=it.get('answer', ''), note=it.get('note', ''), keywords=[str(k) for k in (it.get('keywords') or [])]))
        print(f'{path.parent.name}/{path.name}: {len(d["items"])} items')
    if check_only is not None:
        tmp = ROOT / 'review' / f'.check-cl-{check_only.parent.name}-{check_only.stem}.json'
        tmp.write_text(json.dumps(dict(claims=claims), ensure_ascii=False), encoding='utf-8')
        print(f'check-only: {len(claims)} claims → {tmp.name}（接著跑 tools/check_claims.py {tmp}）')
        return
    OUT_CLAIMS.write_text(json.dumps(dict(claims=claims), ensure_ascii=False, indent=1), encoding='utf-8')
    js = json.dumps(dict(diseases=diseases), ensure_ascii=False).replace('</', '<\\/')
    OUT_JS.write_text('// Generated by tools/build_clinical.py — 每條陳述的每個 ref 都由 build_reference_pages 定位成 glyph 框；勿手改。\nconst CLINICAL=' + js + ';\n', encoding='utf-8')
    total = sum(len(p) for dz in diseases.values() for p in dz['panels'].values())
    print(f'wrote {OUT_CLAIMS.name} ({len(claims)} claims) and {OUT_JS.name} ({total} items, {len(diseases)} diseases)')

if __name__ == '__main__':
    main()
