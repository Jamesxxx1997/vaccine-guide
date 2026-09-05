// 從 index.html 匯出全部規則（vid/vname/lv/s/t）→ stdout JSON
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
    out.push({ vid: v.id, vname: v.n, ven: v.en, lv: r.lv, s: r.s, t: r.t });
console.log(JSON.stringify(out, null, 1));
