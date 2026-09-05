#!/usr/bin/env python3
"""
從疾管署開放資料更新旅遊疫情與旅遊疫苗建議，並直接寫回 index.html。

用法：
    python3 update_travel.py            # 下載最新資料並更新 index.html
    python3 update_travel.py --offline  # 用 sources/旅遊/ 既有 CSV，不重新下載

資料來源（皆為疾管署開放資料，非爬網頁）：
    國際旅遊疫情建議等級  https://od.cdc.gov.tw/cdc/TCDCTravelAlert.csv        （每日更新）
    國際旅遊處方箋        https://od.cdc.gov.tw/quarantine/TMPrescription.csv  （每月更新）

GOTCHA：od.cdc.gov.tw 的憑證鏈不完整（缺中繼憑證），標準 curl/requests 會報
        "unable to get local issuer certificate"。這裡用 curl -k 取得；
        若要嚴格驗證，需先補齊中繼憑證到 CA bundle。
"""
import csv, io, json, re, subprocess, sys, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
CSV_DIR = ROOT / "sources" / "旅遊"
HTML = ROOT / "index.html"
BEGIN = "/* ===== TRAVEL_DATA_BEGIN (由 update_travel.py 產生，勿手動編輯) ===== */"
END   = "/* ===== TRAVEL_DATA_END ===== */"

SOURCES = {
    "TCDCTravelAlert.csv": "https://od.cdc.gov.tw/cdc/TCDCTravelAlert.csv",
    "TMPrescription.csv":  "https://od.cdc.gov.tw/quarantine/TMPrescription.csv",
}

# 出現在超過此國家數的疫苗，視為「旅遊門診常規討論項目」而非該目的地特有建議。
# 依實測：黃熱病 246 國、MMR 242、A肝 240、狂犬病 225、傷寒 188 → 幾乎全球通列；
# 瘧疾 110、小兒麻痺 67、腦膜炎 34、日本腦炎 24 → 確實隨目的地變動。
UNIVERSAL_THRESHOLD = 150

BLANKET_THRESHOLD = 200

LEVEL_RANK = {"第三級:警告(Warning)": 3, "第二級:警示(Alert)": 2, "第一級:注意(Watch)": 1}


def download():
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        dest = CSV_DIR / name
        print(f"  下載 {name} …", end=" ", flush=True)
        r = subprocess.run(["curl", "-sSk", "--max-time", "120", "-o", str(dest),
                            "-w", "%{http_code}", url], capture_output=True, text=True)
        code = r.stdout.strip()
        if code != "200" or not dest.exists() or dest.stat().st_size == 0:
            sys.exit(f"\n✗ 下載失敗（HTTP {code}）：{url}")
        print(f"HTTP {code}  {dest.stat().st_size//1024} KB")


def read_csv(name):
    return list(csv.DictReader(io.StringIO((CSV_DIR / name).read_text(encoding="utf-8-sig"))))


def build():
    alerts = read_csv("TCDCTravelAlert.csv")
    presc  = read_csv("TMPrescription.csv")

    # ── 疫情警示 ──
    # ★ 關鍵：「解除」是獨立的一筆記錄，不是把原記錄刪掉。
    #   若先把「解除」濾掉再處理，已解除的舊警示會永遠留著（實測：泰國 M痘 2022 警示，
    #   實際已於 2026-04-28 解除，卻仍被當成現行）。
    #   正確做法：同一(國家,疾病,細分區域)取「effective 最新」的那筆，若最新是「解除」則整組不納入。
    latest = {}   # (key, disease, detail) -> (date, level_str, name, en)
    for a in alerts:
        name = a["areaDesc"].strip()
        if not name:
            continue
        key = (a["ISO3166"] or "").strip() or name
        grp = (key, a["alert_disease"].strip(), (a.get("areaDetail") or "").strip())
        date = a["effective"][:10]
        lv = a["severity_level"].strip()
        prev = latest.get(grp)
        # 同日期時，讓「解除」優先（解除公告與原警示同日發布視為已解除）
        if prev is None or date > prev[0] or (date == prev[0] and lv not in LEVEL_RANK):
            latest[grp] = (date, lv, name, a["areaDesc_EN"].strip())

    # ★ 全球性警示：某(等級,疾病)組合若涵蓋幾乎所有國家，代表它是一次性全球公告而非該目的地特有。
    #   實測：「嚴重特殊傳染性肺炎」第三級出現在全部 246 國、生效日一律 2020-03-21（COVID 初期
    #   全球警示，資料集中從未標記解除）；「新冠併發重症」第一級 245 國。若照原樣顯示，
    #   2026 年查日本會跳出「第三級：避免所有非必要旅遊」，明顯誤導。
    #   處理方式：不刪除（那是官方資料），改標記為 blanket，由前端分區呈現。
    active = {g: v for g, v in latest.items() if v[1] in LEVEL_RANK}
    lifted = len(latest) - len(active)
    disease_cov = {}
    for (key, disease, _d), (_dt, lv, _n, _e) in active.items():
        disease_cov.setdefault((LEVEL_RANK[lv], disease), set()).add(key)
    blanket = {p for p, c in disease_cov.items() if len(c) > BLANKET_THRESHOLD}

    by_country = {}
    for (key, disease, detail), (date, lv, name, en) in latest.items():
        rec = by_country.setdefault(key, {"n": name, "en": en, "a": [], "v": []})
        if not rec["en"]:
            rec["en"] = en
        if lv not in LEVEL_RANK:      # 最新狀態為「解除」→ 不顯示
            continue
        rank = LEVEL_RANK[lv]
        rec["a"].append([rank, disease, date, detail, 1 if (rank, disease) in blanket else 0])
    print(f"  已解除而排除 {lifted} 組")
    print(f"  標記為全球性警示（>{BLANKET_THRESHOLD} 國同時出現）："
          + "、".join(f"L{l} {d}" for l, d in sorted(blanket)) or "無")

    # ── 旅遊疫苗建議：先算每支疫苗涵蓋幾國，用以區分常規／目的地特有 ──
    coverage = {}
    for p in presc:
        v = p["疫苗"].strip()
        if v:
            coverage.setdefault(v, set()).add(p["國名(中)"].strip())
    universal = {v for v, c in coverage.items() if len(c) > UNIVERSAL_THRESHOLD}

    name_to_key = {r["n"]: k for k, r in by_country.items()}
    for p in presc:
        v = p["疫苗"].strip()
        if not v:
            continue
        cn = p["國名(中)"].strip()
        key = name_to_key.get(cn)
        if key is None:
            key = cn
            by_country[key] = {"n": cn, "en": p["國名(英)"].strip(), "a": [], "v": []}
            name_to_key[cn] = key
        rec = by_country[key]
        if not rec["en"]:
            rec["en"] = p["國名(英)"].strip()
        if v not in rec["v"]:
            rec["v"].append(v)

    for rec in by_country.values():
        rec["a"].sort(key=lambda x: (-x[0], x[2]), reverse=False)
        rec["a"].sort(key=lambda x: -x[0])

    meta = {
        "updated": datetime.date.today().isoformat(),
        "countries": len(by_country),
        "alerts": sum(len(r["a"]) for r in by_country.values()),
        "universal": sorted(universal),
        "blanket_note": "涵蓋超過 %d 國的同一警示視為全球性公告" % BLANKET_THRESHOLD,
        "src_alert": SOURCES["TCDCTravelAlert.csv"],
        "src_presc": SOURCES["TMPrescription.csv"],
    }
    return meta, by_country


def write_html(meta, data):
    block = (BEGIN + "\n"
             + "const TRAVEL_META=" + json.dumps(meta, ensure_ascii=False) + ";\n"
             + "const TRAVEL=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
             + END)
    html = HTML.read_text(encoding="utf-8")
    if BEGIN in html and END in html:
        html = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), lambda m: block, html, flags=re.S)
    else:
        sys.exit("✗ index.html 中找不到 TRAVEL_DATA 標記，請先加入標記區塊")
    HTML.write_text(html, encoding="utf-8")
    print(f"  寫入 index.html：{len(block)//1024} KB 資料區塊")


if __name__ == "__main__":
    if "--offline" not in sys.argv:
        print("下載疾管署開放資料：")
        download()
    else:
        print("離線模式，使用既有 CSV")
    meta, data = build()
    print(f"  國家/地區 {meta['countries']}　現行警示 {meta['alerts']} 筆")
    print(f"  視為旅遊常規（>{UNIVERSAL_THRESHOLD} 國通列）：{'、'.join(meta['universal'])}")
    write_html(meta, data)
    print("完成。")
