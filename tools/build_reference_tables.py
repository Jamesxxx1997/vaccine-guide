#!/usr/bin/env python3
"""Package unchanged source CSVs for an offline, read-only reference viewer."""
import csv
import hashlib
import io
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent

def build():
    html = (ROOT / 'index.html').read_text()
    meta = json.loads(re.search(r'const TRAVEL_META=(.*?);', html).group(1))
    tables = {}
    for key, filename, title, url in [
        ('alerts', 'TCDCTravelAlert.csv', '國際旅遊疫情建議等級', meta['src_alert']),
        ('prescriptions', 'TMPrescription.csv', '國際旅遊處方箋', meta['src_presc'])]:
        path = ROOT / 'sources' / '旅遊' / filename
        raw = path.read_bytes()
        reader = csv.reader(io.StringIO(raw.decode('utf-8-sig'), newline=''))
        headers = next(reader)
        rows = []
        for number, values in enumerate(reader, 1):
            if len(values) != len(headers):
                raise ValueError(f'{filename}: record {number} has {len(values)} columns')
            # Record numbers exclude the header; unlike physical line numbers,
            # they remain correct for CSV fields containing quoted newlines.
            rows.append({'record': number, 'values': values})
        tables[key] = dict(n=title, p=str(path.relative_to(ROOT)), u=url,
                           v=meta['updated'], sha256=hashlib.sha256(raw).hexdigest(),
                           headers=headers, rows=rows)
    dest = ROOT / 'review/reference-tables.js'
    dest.write_text('// Generated from unchanged local CSV snapshots.\nconst REFERENCE_TABLES=' +
                    json.dumps(tables, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print({key: len(table['rows']) for key, table in tables.items()})

if __name__ == '__main__':
    build()
