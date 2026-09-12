// 間隔規則頁「感染後多久可以接種」總表的原句摘錄，逐句對來源逐字比對。
// 用法：node tools/test_postinfection_quotes.cjs
// 每列以 data-ref-claim 指向 reference-claims；claim item 分兩種：
//   有 page（PDF）→ 每個 <q> 正規化後必須包含於該 item 的某一 quote（glyph 高亮的同一句）
//   無 page（網頁存檔）→ 每個 <q> 正規化後必須同時出現在 SRC[source].text（面板顯示的逐字摘錄）
//                        與 SRC[source].p 存檔（HTML 去標籤）全文——兩處都對得上才算逐字
// 另檢查：卡片規則的 q 引句必須也列在總表（避免兩處引句漂移）。
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
const fileCache=new Map();
function fileText(rel){
  if(!fileCache.has(rel)){
    const abs=path.join(root,rel);assert(abs.startsWith(root+path.sep));
    assert(fs.existsSync(abs),'archive exists: '+rel);
    let raw=fs.readFileSync(abs,'utf8');
    if(/\.html?$/i.test(rel)){
      raw=raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,'');
      raw=new JSDOM('<textarea>'+raw+'</textarea>').window.document.querySelector('textarea').value; // 解 HTML 實體
    }
    fileCache.set(rel,norm(raw));
  }
  return fileCache.get(rel);
}
const rows=Array.from(doc.querySelectorAll('#postinfTbl tbody tr'));
assert(rows.length>=8,'table has rows');
let checked=0;
for(const tr of rows){
  const qs=Array.from(tr.querySelectorAll('q'),q=>q.textContent.trim());
  assert(qs.length>0,'row has quotes: '+tr.textContent.slice(0,30));
  const claim=tr.dataset.refClaim;assert(claim,'row cites a claim: '+tr.textContent.slice(0,30));
  const items=claimItems(claim);
  for(const q of qs){
    const n=norm(q);
    const pdfHit=items.some(it=>it.page&&(it.quotes||[]).some(c=>norm(c).includes(n)));
    const webHit=items.some(it=>{
      if(it.page)return false;
      const src=SRC[it.source];assert(src,'SRC registered: '+it.source);
      assert(src.text&&src.p,'web source carries text + archive: '+it.source);
      // 網頁 item 的 quotes 供「開啟存檔跳至原句」的文字片段錨點使用：每句都要在 SRC.text 與存檔裡
      assert((it.quotes||[]).length,'web item carries quotes for text-fragment links: '+claim);
      for(const c of it.quotes)assert(norm(src.text).includes(norm(c))&&fileText(src.p).includes(norm(c)),`item quote not verbatim in ${it.source}: ${c.slice(0,40)}`);
      return it.quotes.some(c=>norm(c).includes(n))&&norm(src.text).includes(n)&&fileText(src.p).includes(n);
    });
    assert(pdfHit||webHit,`quote not verified for ${claim}: ${q.slice(0,40)}`);checked++;
  }
}
// 網頁來源的 SRC.text 逐字段（「中文整理：」之前）也要整段在存檔裡，不只總表挑出的句子
let textBlocks=0;
for(const key of ['S21','S22','S23','S25']){
  const verbatim=SRC[key].text.split('中文整理：')[0];
  // 略過：整行「（…）」編註（更新日期、上標說明）、題目行（Q… 結尾 ?/？）、「（節錄）」標示行
  for(const line of verbatim.split('\n').map(s=>s.trim()).filter(s=>s&&!/^（.*）$/.test(s)&&!/^Q[：:]?\d*[：:]?.*[?？]$/.test(s)&&!/（節錄）$/.test(s))){
    assert(fileText(SRC[key].p).includes(norm(line)),`${key} text line not in archive: ${line.slice(0,40)}`);textBlocks++;
  }
}
// 卡片規則的 q 引句也必須出現在總表
const tableQuotes=new Set(rows.flatMap(tr=>Array.from(tr.querySelectorAll('q'),q=>norm(q.textContent))));
const ruleQuotes=Array.from(html.matchAll(/\bq:\s*(\[[\s\S]*?\]|"[^"]+")\s*[},]/g),m=>m[1]);
assert(ruleQuotes.length>=2,'rule q fields found');
for(const literal of ruleQuotes){
  for(const q of [].concat(Function('return '+literal)()))assert(tableQuotes.has(norm(q)),'rule quote also listed in table: '+q.slice(0,30));
}
console.log(`PASS postinfection table: ${rows.length} rows, ${checked} quotes verified (PDF claim quotes or SRC.text+archive), ${textBlocks} SRC.text verbatim lines in archives, ${ruleQuotes.length} rule q fields mirrored`);
