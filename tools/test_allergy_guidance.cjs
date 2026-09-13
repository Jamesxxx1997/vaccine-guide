// 過敏與成分分頁：每條指引判讀的 claim 都有頁碼＋glyph 框；卡片顯示的引句＝claim 逐字引句；[n] 標記與引句都綁 reference-ui；
// 若已有仿單成分資料，矩陣每個「有／無」格都綁原句 claim、「未載明」不得綁；A→B 工具給出分類。用法：node tools/test_allergy_guidance.cjs
const assert=require('node:assert/strict');
const {win,doc}=require('./reference_test_env.cjs')({beforeScripts(w){w.scrollTo=()=>{};}});
const claims=win.eval('REFERENCE_CLAIMS'),pages=win.eval('REFERENCE_PAGES');
const root=doc.getElementById('allergyRoot');
const rules=[...root.querySelectorAll('.allergy-rule')];
assert(rules.length>=11,'rules rendered');
let quotes=0,marks=0;
for(const card of rules){
  const ms=[...card.querySelectorAll('.ref-marks a.ref-mark')];assert(ms.length>0,'rule has claim marks');
  for(const m of ms){assert(m.classList.contains('ref-target'),'mark bound');marks++;}
  for(const q of card.querySelectorAll('.allergy-quotes q')){
    assert(q.classList.contains('ref-target'),'quote bound');
    const found=Object.values(claims).some(c=>c.items.some(it=>it.page&&it.rects&&it.rects.length&&it.quotes.includes(q.textContent)));
    assert(found,'displayed quote is a glyph-anchored claim quote: '+q.textContent.slice(0,40));quotes++;
  }
}
assert(quotes>=25,'enough quotes shown: '+quotes);
// 每個 alg-* claim 都定位到了，且來源頁確實被渲染（pagesOnly:claims）
for(const [id,c] of Object.entries(claims)){
  if(!id.startsWith('alg-'))continue;
  for(const it of c.items){assert(it.rects&&it.rects.length,id+' has rects');assert(pages[it.source].pages.some(p=>p.page===it.page&&p.img),id+' page rendered');}
}
// 點引句開面板並畫框
const q=root.querySelector('.allergy-rule[data-allergy-rule="egg-mmr"] q');q.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));
// 仿單成分資料（若已產生）
const data=win.eval('typeof ALLERGENS!=="undefined"?ALLERGENS:null');
let cells=0,related=0;
if(data&&data.products.length){
  const table=doc.getElementById('allergenMatrix');assert(table,'matrix rendered');
  for(const td of table.querySelectorAll('tbody td')){
    if(td.classList.contains('allergy-yes')||td.classList.contains('allergy-no')){assert(td.classList.contains('ref-target'),'有／無 cell bound');cells++;}
    else if(td.classList.contains('allergy-na')){assert(!td.classList.contains('ref-target'),'未載明 cell itself not bound');
      const rel=td.querySelector('q.allergy-related');if(rel){assert(rel.classList.contains('ref-target'),'related quote bound');const found=Object.values(claims).some(c=>c.items.some(it=>it.page&&it.rects&&it.rects.length&&it.quotes.includes(rel.textContent)));assert(found,'related quote is glyph-anchored: '+rel.textContent.slice(0,30));related++;}
      else assert(td.querySelector('.allergy-swept'),'未載明 cell carries a sweep record');}
  }
  const p0=data.products[0];const res=win.AllergyGuidance.evaluate('product:'+p0.id,p0.id);
  assert(res.querySelector('.allergy-rule[data-allergy-rule="same"]'),'same-vaccine verdict shown');
  if(data.products.length>1){const res2=win.AllergyGuidance.evaluate('product:'+p0.id,data.products[1].id);assert(res2.querySelector('.allergy-rule'),'A→B verdict shown');}
  const egg=win.AllergyGuidance.evaluate('key:egg',p0.id);assert(egg.textContent.length>10,'substance verdict shown');
}
setTimeout(()=>{
  const panel=doc.getElementById('reference-panel');
  assert(panel.querySelectorAll('.ref-highlight').length>0,'clicking a guideline quote shows glyph highlights');
  console.log(`PASS allergy guidance: ${rules.length} rules, ${marks} claim marks, ${quotes} anchored quotes; ${data?data.products.length:0} labelled products, ${cells} bound allergen cells, ${related} related-sentence cells; every 未載明 cell swept.`);
},300);
