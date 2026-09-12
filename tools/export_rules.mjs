// 從 index.html 匯出全部規則（vid/vname/lv/s/t/claim/q）→ stdout JSON
// q＝文字來源（TEXT_SRC）規則的逐字引句（字串或陣列），build_excerpts 會對存檔逐字驗證
// 用法：node tools/export_rules.mjs > /tmp/rules.json
import fs from 'fs';
const js = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .match(/<script>([\s\S]*)<\/script>/)[1];
const marker = 'VAX.push(...VAX_SELFPAY);';
const seg = js.slice(js.indexOf('const FEVER'), js.indexOf(marker) + marker.length);
const VAX = eval(seg + '\nVAX');
const out = [];
for (const v of VAX)
  for (const r of v.rules)
    out.push({ vid: v.id, vname: v.n, ven: v.en, lv: r.lv, s: r.s, t: r.t, claim: r.claim || null, q: r.q || null });
console.log(JSON.stringify(out, null, 1));
