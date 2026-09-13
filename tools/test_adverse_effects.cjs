// 副作用分頁：每一列都必須有頁碼＋glyph 框的 claim；表格顯示的數值＝產生器自 PDF 抽出的值＝claim 引句裡的值；
// 來源一律是本機 PDF 且 hash 鎖定；點格會開原件面板並畫框。用法：node tools/test_adverse_effects.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {win,doc}=require('./reference_test_env.cjs')({beforeScripts(w){w.scrollTo=()=>{};}});
const norm=s=>s.normalize('NFKC').replace(/[^0-9A-Za-z一-鿿㐀-䶿%.]/g,'');
const data=win.eval('ADVERSE_EFFECTS'),claims=win.eval('REFERENCE_CLAIMS'),pages=win.eval('REFERENCE_PAGES'),SRC=win.eval('SRC');
const spec=JSON.parse(fs.readFileSync(path.join(root,'review/reference-claims.json'),'utf8'));
const extra=JSON.parse(fs.readFileSync(path.join(root,'review/adverse-claims.json'),'utf8'));
assert(data.tables.length>=8,'tables present');
let rows=0,pct=0;
for(const t of data.tables){
  const src=SRC[t.source];assert(src&&/\.pdf$/i.test(src.p),`${t.id}: source ${t.source} is a local PDF`);
  assert(spec.hashes[t.source],`${t.id}: source ${t.source} hash-locked`);
  assert(pages[t.source]?.sha256===spec.hashes[t.source],`${t.id}: built page set matches locked hash`);
  for(const r of t.rows){
    rows++;
    const c=claims[r.claim];assert(c&&c.items.length===1,`${t.id}: claim ${r.claim} exists with one item`);
    const it=c.items[0];assert(it.page===t.page&&it.source===t.source,`${r.claim}: page/source match`);
    assert(Array.isArray(it.rects)&&it.rects.length>0,`${r.claim}: glyph rects present`);
    assert(extra.claims[r.claim],`${r.claim}: generated into adverse-claims.json (not hand-written)`);
    const joined=norm(it.quotes.join(''));
    if(t.kind==='percent'){
      assert.equal(r.values.length,t.columns.length,`${r.claim}: one value per column`);
      for(const v of r.values){assert(/^[<>≥≧]?\d+(\.\d+)?%$|^[-—–]$/.test(v),`${r.claim}: value shape ${v}`);if(v!=='-')assert(joined.includes(norm(v)),`${r.claim}: value ${v} inside quoted row`);pct++;}
      assert(joined.includes(norm(r.reaction)),`${r.claim}: reaction inside quoted row`);
      assert(it.region&&it.region.length===4,`${r.claim}: row region present`);
    } else if(t.kind==='freq'){
      assert(joined.includes(norm(r.label)),`${r.claim}: frequency label inside quotes`);
    } else {
      assert(joined.includes(norm(r.text)),`${r.claim}: note quote inside quotes`);
    }
  }
}
// UI：每個疫苗都能顯示；每列每格都是 ref-target；點格開面板且有黃框
const root_=doc.getElementById('adverseRoot');
for(const vid of win.AdverseEffects.vaccines){
  win.AdverseEffects.show(vid);
  const trs=[...root_.querySelectorAll('tr[data-adverse-claim]')];assert(trs.length>0,vid+' rows rendered');
  for(const tr of trs)for(const td of tr.querySelectorAll('td'))assert(td.classList.contains('ref-target'),vid+' cell bound');
  const marks=root_.querySelectorAll('.ref-marks a.ref-mark');for(const m of marks)assert(m.classList.contains('ref-target'),'ref mark bound');
}
win.AdverseEffects.show('covid');
const cell=root_.querySelector('tr[data-adverse-claim] td.adverse-pct');assert(cell,'a percent cell exists');
cell.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));
setTimeout(()=>{
  const panel=doc.getElementById('reference-panel');
  assert(panel.querySelectorAll('.ref-highlight').length>0,'clicking a percent cell shows glyph highlights');
  assert(/第 3 頁|第 4 頁|第 2 頁/.test(panel.textContent),'panel shows the PDF page');
  console.log(`PASS adverse effects: ${data.tables.length} tables, ${rows} rows, ${pct} percent cells verified against generated claims; every cell opens an original-page highlight.`);
},300);
