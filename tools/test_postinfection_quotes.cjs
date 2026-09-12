// 間隔規則頁「感染後多久可以接種」總表：每列以 data-ref-claim 指向 reference-claims，
// 每個 <q> 必須包含於該 claim（含 ref 展開）某個「有頁碼的 PDF item」的 quote——
// 也就是 build_reference_pages 會在原件（官方 PDF 或官方網頁列印 PDF）上做 glyph 定位的同一句。
// 另：網頁列印來源（SRC.print）必須同時保有官方線上網址 u 與本機 PDF p。
// 用法：node tools/test_postinfection_quotes.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const norm=s=>s.normalize('NFKC').replace(/[^0-9A-Za-z一-鿿㐀-䶿]/g,'');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const doc=new JSDOM(html).window.document;
const spec=JSON.parse(fs.readFileSync(path.join(root,'review/reference-claims.json'),'utf8'));
const SRC=Function(`return (${html.match(/const SRC = (\{[\s\S]*?\n\});/)[1]})`)(); // 與 export_reference_inputs.mjs 同法，只讀登錄表
function claimItems(key,seen=new Set()){
  assert(spec.claims[key],'claim exists: '+key);assert(!seen.has(key),'no ref cycle');seen.add(key);
  return spec.claims[key].items.flatMap(item=>item.ref?claimItems(item.ref,seen):[item]);
}
const rows=Array.from(doc.querySelectorAll('#postinfTbl tbody tr'));
assert(rows.length>=8,'table has rows');
let checked=0;const sources=new Set();
for(const tr of rows){
  const qs=Array.from(tr.querySelectorAll('q'),q=>q.textContent.trim());
  assert(qs.length>0,'row has quotes: '+tr.textContent.slice(0,30));
  const claim=tr.dataset.refClaim;assert(claim,'row cites a claim: '+tr.textContent.slice(0,30));
  const items=claimItems(claim);
  for(const it of items){
    assert(it.page&&(it.quotes||[]).length,`claim ${claim}: every item is a PDF item with page + quotes (no self-authored text sources)`);
    assert(SRC[it.source]?.p&&/\.pdf$/i.test(SRC[it.source].p),`claim ${claim}: source ${it.source} is a local PDF`);
    assert(spec.hashes[it.source],`claim ${claim}: source ${it.source} hash-locked`);
    sources.add(it.source);
  }
  for(const q of qs){
    const n=norm(q);
    assert(items.some(it=>it.quotes.some(c=>norm(c).includes(n))),`quote not among glyph-anchored quotes of ${claim}: ${q.slice(0,40)}`);checked++;
  }
}
for(const key of sources){
  const src=SRC[key];
  if(src.print){assert(/^https:\/\//.test(src.u),`printed web source ${key} keeps its official URL`);assert(fs.existsSync(path.join(root,src.p)),`printed PDF exists: ${key}`);}
}
assert(!/\bq:\s*[\["]/.test(html.match(/const FEVER[\s\S]*?VAX\.push\(\.\.\.VAX_SELFPAY\);/)[0]),'no rule uses the retired q (self-transcribed quote) field');
console.log(`PASS postinfection table: ${rows.length} rows, ${checked} quotes matched to glyph-anchored PDF quotes across ${sources.size} sources (${[...sources].sort().join(', ')})`);
