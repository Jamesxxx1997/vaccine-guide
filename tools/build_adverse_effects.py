#!/usr/bin/env python3
"""
副作用表格 → 可追溯資料。人只寫「哪份 PDF、哪一頁、哪個表、哪幾列」（review/adverse-effects.src.json），
百分比與頻率文字一律從 PDF 文字層抽出（不手抄）。字與行的來源＝pdftotext -bbox-layout（與定位器
tools/build_reference_pages.py 同一份字串、同一個分行規則），每列產生一個 claim：引句＝該列帶內的每一視覺行原文，
region＝列帶；所以引句在定位器的區域串流裡必定連續、唯一。
輸出：review/adverse-claims.json（claims，key 以 ae: 開頭；build_reference_pages 會合併）、review/adverse-effects.js（前端資料）。
任何一列找不到、欄數不符、數值格式不對 → 直接失敗，不產出。

用法：uv run --python 3.12 python tools/build_adverse_effects.py   （只需 poppler 的 pdftotext）
"""
from __future__ import annotations
import json, re, subprocess, sys, unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from build_reference_pages import reading_lines, region_words, normalize as builder_normalize  # noqa: E402

SPEC = ROOT / 'review/adverse-effects.src.json'
OUT_CLAIMS = ROOT / 'review/adverse-claims.json'
OUT_JS = ROOT / 'review/adverse-effects.js'
NS = {'h': 'http://www.w3.org/1999/xhtml'}

def norm(s: str) -> str:
    return re.sub(r'[^0-9A-Za-z一-鿿㐀-䶿≥≧<>%./-]', '', unicodedata.normalize('NFKC', s))

def sources() -> dict:
    return json.loads(subprocess.check_output(['node', str(ROOT / 'tools/export_reference_inputs.mjs')], text=True))

def bbox_words(pdf_path: Path, page_number: int):
    """pdftotext -bbox-layout 的字：[x0,y0,x1,y1,text]（與定位器相同來源），另回傳頁寬高。"""
    xml = subprocess.check_output(['pdftotext', '-f', str(page_number), '-l', str(page_number), '-bbox-layout', str(pdf_path), '-']).decode('utf-8', 'replace')
    xml = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', xml)
    page = ET.fromstring(xml).find('.//h:page', NS)
    words = []
    for w in page.findall('.//h:word', NS):
        words.append([float(w.attrib['xMin']), float(w.attrib['yMin']), float(w.attrib['xMax']), float(w.attrib['yMax']), ''.join(w.itertext())])
    return words, float(page.attrib['width']), float(page.attrib['height'])

def find_label(words, label, after_top=0.0, pick='unique'):
    """pick='unique'：整頁恰好一次；pick='first'：取 after_top 之後最上面的一個（表格列依序處理）。標籤可跨連續多個字。"""
    n = norm(label)
    cands = [w for w in words if norm(w[4]) == n and w[1] >= after_top]
    if not cands:
        for line in reading_lines([w for w in words if w[1] >= after_top]):
            for i in range(len(line)):
                acc, x1 = '', line[i][2]
                for v in line[i:]:
                    acc += norm(v[4]); x1 = v[2]
                    if acc == n:
                        cands.append([line[i][0], line[i][1], x1, line[i][3], label]); break
                    if not n.startswith(acc):
                        break
    if not cands:
        # pdftotext 有時把相鄰儲存格黏成一個字（「罕見過敏反應，…」）：標籤是該字的前綴也接受，x1 依字元比例估
        for w in words:
            t = norm(w[4])
            if w[1] >= after_top and t != n and t.startswith(n) and len(t) > len(n):
                cands.append([w[0], w[1], w[0] + (w[2] - w[0]) * len(n) / len(t), w[3], label])
    if pick == 'first' and cands:
        return sorted(cands, key=lambda w: w[1])[0]
    if len(cands) != 1:
        raise SystemExit(f'✗ 標籤「{label}」在頁面上找到 {len(cands)} 次（需恰好 1 次；可用 anchor 縮小範圍）')
    return cands[0]

def row_region(width, top, bottom):
    return [0, round(top, 2), round(width, 2), round(bottom, 2)]

def lines_text(words, region):
    return [' '.join(w[4] for w in line) for line in reading_lines(region_words(words, region))]

def check_unique(words, region, quotes, where):
    """每個引句在區域串流（定位器用的正規化）裡必須恰好出現一次，否則定位器會拒絕。"""
    stream = ''.join(builder_normalize(w[4]) for w in reading_lines(region_words(words, region)) for w in w)
    for q in quotes:
        n = builder_normalize(q)
        if n and stream.count(n) != 1:
            raise SystemExit(f'✗ {where}：引句在列帶內出現 {stream.count(n)} 次（需 1 次）：{q[:50]}')

def build_percent(table, words, width):
    anchor = find_label(words, table['anchor']) if table.get('anchor') else None
    after = anchor[1] + 4 if anchor else 0.0   # 用 yMin：Poppler 的高字框 yMax 會跨到下一行，害第一列被跳過
    rows, claims, prev_top = [], {}, None
    for i, reaction in enumerate(table['rows']):
        lab = find_label(words, reaction, after_top=after, pick='first')
        if prev_top is not None and lab[1] - prev_top > 60:
            raise SystemExit(f'✗ {table["id"]} 列「{reaction}」與前一列相距 {lab[1]-prev_top:.0f}pt，不像同一張表')
        prev_top = lab[1]; after = lab[1] + 1
        region = row_region(width, lab[1] - 2, lab[3] + 2)
        cells = [w for w in reading_lines(region_words(words, region))[0] if w[0] > lab[2] + 1] if reading_lines(region_words(words, region)) else []
        values = [w[4] for w in cells]
        if len(values) != len(table['columns']):
            raise SystemExit(f'✗ {table["id"]} 列「{reaction}」抽到 {len(values)} 個值 {values}，欄位 {len(table["columns"])} 個')
        for v in values:
            if not re.fullmatch(r'[<>≥≧]?\d+(\.\d+)?%|-|—|–', v):
                raise SystemExit(f'✗ {table["id"]} 列「{reaction}」有非數值格：{v!r}')
        quotes = lines_text(words, region)
        if len(quotes) != 1:
            raise SystemExit(f'✗ {table["id"]} 列「{reaction}」的列帶不是單一視覺行：{quotes}')
        check_unique(words, region, quotes, f'{table["id"]}「{reaction}」')
        cid = f'ae:{table["id"]}:{i}'
        claims[cid] = dict(note=table.get('note', ''), items=[dict(source=table['source'], page=table['page'], region=region,
                           glyphRows=True, quotes=quotes, label=f'{table["product"]} · {reaction}')])
        rows.append(dict(reaction=reaction, values=values, claim=cid))
    return rows, claims

def build_freq(table, words, width):
    anchor = find_label(words, table['anchor']) if table.get('anchor') else None
    after = anchor[1] + 4 if anchor else 0.0   # 用 yMin：Poppler 的高字框 yMax 會跨到下一行，害第一列被跳過
    specs, labels = table['rows'], []
    for r in specs:
        labels.append(find_label(words, r['label'], after_top=after, pick='first'))
        after = labels[-1][1] + 1
    rows, claims = [], {}
    nofoot = lambda t: re.sub(r'(?<![A-Za-z0-9])[a-z]{1,2}(?![A-Za-z0-9])', '', t)
    for i, (r, lab) in enumerate(zip(specs, labels)):
        top = lab[1] - 2 - r.get('aboveLines', 0) * 14
        bottom = (labels[i + 1][1] - 2) if i + 1 < len(labels) else (lab[3] + 2 + r.get('extraLines', 0) * 14)
        if r.get('extraLines') is not None and i + 1 < len(labels):
            bottom = min(bottom, lab[3] + 2 + r['extraLines'] * 14)
        region = row_region(width, top, bottom)
        quotes = [q for q in lines_text(words, region) if not re.fullmatch(r'[a-zA-Z ,;]+', q.strip())]   # 純註腳字母行不當引句
        # 驗證用串流：逐字去註腳（a、b…）再串接；整行串起來再去會把「b b b」黏成 bbb 而去不掉
        stream = ''.join(nofoot(norm(w[4])) for line in reading_lines(region_words(words, region)) for w in line)
        text = r['text']
        if nofoot(norm(text)) not in stream and nofoot(norm(text)) not in stream.replace(norm(r['label']), '', 1):
            raise SystemExit(f'✗ {table["id"]} 列「{r["label"]}」的文字不在該列帶內：{text[:40]}… 帶內＝{stream[:90]}')
        if norm(r['label']) not in stream:
            raise SystemExit(f'✗ {table["id"]} 列帶內找不到標籤「{r["label"]}」')
        check_unique(words, region, quotes, f'{table["id"]}「{r["label"]}」')
        cid = f'ae:{table["id"]}:{i}'
        claims[cid] = dict(note=table.get('note', ''), items=[dict(source=table['source'], page=table['page'], region=region,
                           glyphRows=True, quotes=quotes, label=f'{table["product"]} · {r["label"]}')])
        rows.append(dict(label=r['label'], text=text, claim=cid))
    return rows, claims

def build_notes(table, words, width):
    rows, claims = [], {}
    # 中文整理（summary）裡的任何百分比／數值，都必須出現在本表某條引句裡——沒有原句的數字不准出現在頁面上
    all_quotes = ''.join(r['quote'] for r in table['rows'])
    for r in table['rows']:
        for num in re.findall(r'\d+(?:\.\d+)?\s*%', r.get('summary', '')):
            bare = num.rstrip('%').strip()
            # 原件表格常把「(%)」寫在表頭、儲存格只有數字：此時整理句的「39.6%」只要 39.6 在引句裡以完整數字出現即可
            unit_in_title = '%' in table.get('title', '') or '％' in table.get('title', '')
            if num.replace(' ', '') not in all_quotes.replace(' ', '') and not (unit_in_title and re.search(r'(?<![\d.])' + re.escape(bare) + r'(?![\d.])', all_quotes)):
                raise SystemExit(f'✗ {table["id"]}：中文整理含未引用原句的數值「{num}」（{r.get("label","")}）——請補引句或刪掉數字')
    for i, r in enumerate(table['rows']):
        cid = f'ae:{table["id"]}:{i}'
        item = dict(source=table['source'], page=table['page'], glyphRows=True, quotes=[r['quote']], label=f'{table["product"]} · {r.get("label", "說明")}')
        # 表格列橫跨多個文字區塊（如四個年齡欄各自成塊）時，分片可給 region=[x0,y0,x1,y1]（pt）：
        # 定位改走區域閱讀序，引句必須等於該列帶內逐行原文，且在帶內唯一——這樣四欄數值才能一起被引、一起被框
        if r.get('region'):
            region = [float(v) for v in r['region']]
            expected = lines_text(words, region)
            if builder_normalize(r['quote']) != builder_normalize(' '.join(expected)):
                raise SystemExit(f'✗ {table["id"]}「{r.get("label","")}」：region 內原文為 {expected!r}，與 quote 不同——引句必須逐字等於列帶原文')
            check_unique(words, region, [r['quote']], f'{table["id"]}「{r.get("label","")}」')
            item['region'] = region
        claims[cid] = dict(note=table.get('note', ''), items=[item])
        rows.append(dict(label=r.get('label', ''), text=r['quote'], summary=r.get('summary', ''), claim=cid))
    return rows, claims

def main():
    check_only = None
    if len(sys.argv) >= 3 and sys.argv[1] == '--check':
        check_only = Path(sys.argv[2]).resolve()
    spec = json.loads(SPEC.read_text(encoding='utf-8')) if check_only is None else dict(tables=[])
    # 分片：review/adverse-effects.src.d/*.json（每份仿單一檔，多人／多 agent 並行不打架）
    frags = [check_only] if check_only else sorted((ROOT / 'review/adverse-effects.src.d').glob('*.json'))
    for frag in frags:
        more = json.loads(frag.read_text(encoding='utf-8'))
        ids = {t['id'] for t in spec['tables']}
        for t in more.get('tables', []):
            if t['id'] in ids:
                raise SystemExit(f'✗ 表格 id 重複：{t["id"]}（{frag.name}）')
            ids.add(t['id']); spec['tables'].append(t)
    docs = sources()
    out_tables, all_claims = [], {}
    for table in spec['tables']:
        doc = docs[table['source']]
        pdf_path = ROOT / doc['p']
        if pdf_path.suffix.lower() != '.pdf' or not pdf_path.is_file():
            raise SystemExit(f'✗ {table["id"]}：來源 {table["source"]} 不是本機 PDF 原件')
        words, width, height = bbox_words(pdf_path, table['page'])
        kind = table.get('kind', 'percent')
        rows, claims = dict(percent=build_percent, freq=build_freq, notes=build_notes)[kind](table, words, width)
        all_claims.update(claims)
        out_tables.append(dict(id=table['id'], vaccine=table['vaccine'], product=table['product'], kind=kind,
                               source=table['source'], page=table['page'], title=table.get('title', ''),
                               population=table.get('population', ''), columns=table.get('columns', []), rows=rows,
                               caveat=table.get('caveat', '')))
        print(f'{table["id"]}: {len(rows)} rows ({kind}) p.{table["page"]} {table["source"]}')
    if check_only is not None:
        # 只驗證：把 claims 交給 tools/check_claims.py 做定位（不寫輸出、不動 review/）
        tmp = ROOT / 'review' / f'.check-{check_only.stem}.json'
        tmp.write_text(json.dumps(dict(claims=all_claims), ensure_ascii=False), encoding='utf-8')
        print(f'check-only: {len(all_claims)} claims → {tmp.name}（接著跑 tools/check_claims.py {tmp}）')
        return
    OUT_CLAIMS.write_text(json.dumps(dict(claims=all_claims), ensure_ascii=False, indent=1), encoding='utf-8')
    js = json.dumps(dict(tables=out_tables, generatedFrom='review/adverse-effects.src.json + review/adverse-effects.src.d/*.json'), ensure_ascii=False).replace('</', '<\\/')
    OUT_JS.write_text('// Generated by tools/build_adverse_effects.py — 數值均自 PDF 文字層抽出，勿手改。\nconst ADVERSE_EFFECTS=' + js + ';\n', encoding='utf-8')
    print(f'wrote {OUT_CLAIMS.name} ({len(all_claims)} claims) and {OUT_JS.name} ({len(out_tables)} tables)')

if __name__ == '__main__':
    main()
