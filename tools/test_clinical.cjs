// 疾病臨床分頁：每個 item 至少 1 個 glyph-anchored claim；顯示的整理句數字都在引句；[n] 與引句都綁 reference-ui；面板可切換；點引句畫框。
// 用法：node tools/test_clinical.cjs
const assert=require('node:assert/strict');
const {win,doc}=require('./reference_test_env.cjs')({beforeScripts(w){w.scrollTo=()=>{};}});
const claims=win.eval('REFERENCE_CLAIMS'),pages=win.eval('REFERENCE_PAGES'),data=win.eval('typeof CLINICAL!=="undefined"?CLINICAL:null');
assert(data&&data.diseases.flu,'CLINICAL data with flu present');
const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'');
let items=0,refs=0;
for(const [pid,list] of Object.entries(data.diseases.flu.panels)){
  for(const it of list){
    items++;assert(it.refs.length>=1,it.id+' has refs');
    for(const r of it.refs){const c=claims[r.claim];assert(c&&c.items.length===1,it.id+' claim exists '+r.claim);const ci=c.items[0];assert(ci.rects&&ci.rects.length,r.claim+' anchored');assert(ci.quotes.includes(r.quote),r.claim+' quote equals');assert(pages[ci.source].pages.some(p=>p.page===ci.page&&p.img),r.claim+' page rendered');refs++;}
    for(const n of (norm(it.summary+(it.answer||'')).match(/\d+(?:[.,]\d+)?/g)||[]).filter(n=>!/^(19|20)\d\d$/.test(n)))assert(it.refs.some(r=>norm(r.quote).includes(n)),it.id+' number '+n+' appears in a quote');
  }
}
assert(items>=3,'items present: '+items);
const root=doc.getElementById('clinicalRoot');assert(root.querySelectorAll('.clinical-item').length>0,'items rendered');
for(const m of root.querySelectorAll('a.ref-mark'))assert(m.classList.contains('ref-target'),'mark bound');
for(const q of root.querySelectorAll('q.adverse-quote'))assert(q.classList.contains('ref-target'),'quote bound');
// 議題卡：同 tags.topic 的多條陳述合成一張卡，卡內 [n] 連續、每行有機關徽章
const topicItems=Object.values(data.diseases.flu.panels).flat().filter(it=>it.tags&&it.tags.topic);
if(topicItems.length){const topics=[...new Set(topicItems.map(it=>it.tags.topic))];let shown=0;
  for(const [pid] of Object.entries(data.diseases.flu.panels)){win.Clinical.show('flu',pid);for(const card of root.querySelectorAll('.clinical-topic')){shown++;const marks=[...card.querySelectorAll('a.ref-mark')].map(a=>a.textContent);assert.deepEqual(marks,marks.map((_,i)=>'['+(i+1)+']'),'continuous numbering in topic card '+card.dataset.clinicalTopic);assert(card.querySelectorAll('.clinical-summary .origin-badge').length>=2,'topic card has ≥2 authority lines');}}
  assert(shown>0,'topic cards rendered: '+topics.length+' topics');win.Clinical.show('flu','antiviral');}
// 切換面板
const btn=[...root.querySelectorAll('.clinical-tabs button')].find(b=>b.dataset.panel==='qa');if(btn){btn.click();assert(root.querySelector('.clinical-panel').dataset.panel==='qa','panel switch');win.Clinical.show('flu','antiviral');}
// 選擇器：只有 type=rule 且有 verdict 的規則進入評估；提交後每個藥的結論卡不得出現 undefined
const form=root.querySelector('.clinical-form');if(form){form.querySelector('[name=age]').value='30';form.querySelector('[name=weight]').value='60';form.querySelector('[name=hours]').value='20';form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  const verdicts=[...root.querySelectorAll('.clinical-verdict')];assert(verdicts.length===5,'five drug verdict cards');for(const v of verdicts)assert(!/undefined/.test(v.textContent),'verdict card without undefined: '+v.textContent.slice(0,60));
  assert(verdicts.some(v=>/可用/.test(v.textContent)),'at least one 可用 verdict for a 30-year-old outpatient');}
const first=root.querySelector('q.adverse-quote');first.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));
setTimeout(()=>{const panel=doc.getElementById('reference-panel');assert(panel.querySelectorAll('.ref-highlight').length>0,'clicking a quote shows glyph highlights');console.log(`PASS clinical: ${items} items, ${refs} anchored refs; every summary number is quoted; marks and quotes bound.`);},300);
