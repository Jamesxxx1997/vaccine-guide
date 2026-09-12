// 把官方網頁「原樣」列印成 PDF 存檔（作為 reference 追溯的原件；不是本站的轉錄）。
// 用法：node tools/print_web_source.mjs <url> <out.pdf> [--expand "全部展開"] [--wait 2500]
//   --expand  先點擊頁面上文字等於該字串的按鈕／連結（例：疾管署 Q&A 的「全部展開」，否則手風琴答案不會印出）
// 作法：headless Chrome + DevTools Protocol（Node 22 內建 WebSocket），Page.printToPDF；
//       頁首頁尾用 Chrome 預設樣板（含標題、網址、列印日期、頁碼）當作出處戳記。
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [,, url, out, ...rest] = process.argv;
if (!url || !out) { console.error('usage: node tools/print_web_source.mjs <url> <out.pdf> [--expand 文字] [--wait ms]'); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const expandText = opt('--expand', null);
const waitMs = Number(opt('--wait', 2500));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
const port = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//); if (m) resolve(m[1]); });
  chrome.on('exit', c => reject(new Error('chrome exited ' + c)));
  setTimeout(() => reject(new Error('no DevTools port')), 15000);
});
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) events.push(m); });
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const waitEvent = (name, ms) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = events.findIndex(e => e.method === name); if (i >= 0) return res(events.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error('timeout ' + name)); setTimeout(poll, 50); })(); });
const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await waitEvent('Page.loadEventFired', 45000).catch(() => console.error('load event timeout; printing current state'));  // 有些官方站分析腳本不會停，等不到 load 也照印
await new Promise(r => setTimeout(r, waitMs));
let expanded = null;
if (expandText) {
  expanded = await evaluate(`(() => { const els=[...document.querySelectorAll('a,button')].filter(e=>e.textContent.trim()===${JSON.stringify(expandText)}); els.forEach(e=>e.click()); return els.length; })()`);
  await new Promise(r => setTimeout(r, 1200));
}
const title = await evaluate('document.title');
const finalUrl = await evaluate('location.href');
const pdf = await send('Page.printToPDF', { printBackground: true, displayHeaderFooter: true, preferCSSPageSize: false, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.6, marginBottom: 0.6, marginLeft: 0.4, marginRight: 0.4 });
fs.writeFileSync(out, Buffer.from(pdf.result.data, 'base64'));
ws.close(); chrome.kill();
console.log(JSON.stringify({ url: finalUrl, title, expandedClicks: expanded, bytes: fs.statSync(out).size, out }));
