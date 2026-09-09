const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {dom,win,doc,errors}=require('./reference_test_env.cjs')();
const tick=()=>new Promise(r=>setTimeout(r,0));
const api=win.referenceTest,claims=win.eval('REFERENCE_CLAIMS'),pages=win.eval('REFERENCE_PAGES');
const vx=win.eval('VAX.find(v=>v.id==="shingrix")');
const hash='4d700717ea4026f1f2f4566efec7f5e755a9531b9e21419ac1605edbd363e924';
const checkRef=data=>{
  const items=api.evidence(data);assert(items.length);
  for(const item of items){assert(item.view?.rects.length,'Missing highlighted source for '+JSON.stringify(data));assert(['S20','S4'].some(k=>pages[k].p===item.doc.p));}
  return items;
};
(async()=>{
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(pages.S20.p)).digest('hex'),hash);
  assert.equal(pages.S20.sha256,hash);assert.equal(pages.S20.pages.length,16);
  assert(pages.S20.v.includes('2026-04-23')&&pages.S20.v.includes('2025-04-03'));
  for(const page of pages.S20.pages)assert(fs.existsSync(page.img));
  for(const [key,claim] of Object.entries(claims).filter(([k])=>k.startsWith('shingrix-'))){
    checkRef({claim:key});
    for(const item of claim.items){
      const page=pages[item.source].pages[item.page-1];assert.equal(item.sha256,pages[item.source].sha256);
      for(const r of item.rects)assert(r[0]>=0&&r[1]>=0&&r[2]<=page.w&&r[3]<=page.h&&r[2]>r[0]&&r[3]>r[1],key);
      if(item.source==='S20'&&item.page===3)for(const r of item.rects){
        assert(r[3]-r[1]<=14,'Verifier regression: tall font bbox spills into adjacent line: '+key);
        assert(page.chars.some(c=>r.every((n,j)=>n===c[j])),'Use real glyph boxes, not estimated height: '+key);
      }
    }
  }
  assert.deepEqual(Array.from(claims['shingrix-indication'].items,x=>x.page),[1,2]);
  const short=claims['shingrix-short'].items[0].quotes.join('');
  for(const text of ['免疫功能缺乏','疾病或治療','較短的疫苗接種時程而獲益','1至2個月'])assert(short.includes(text));
  assert(vx.sched.includes('0.5 mL')&&vx.sched.includes('肌肉注射')&&vx.sched.includes('非所有成人'));
  for(const age of [17,18,49,50,80]){
    const result=win.evalVax(vx,{on:{},years:age});
    assert.equal(result.lv,age<50?'warn':'go','Age '+age);
    if(age>=18&&age<50)assert(result.hits.some(h=>h.t.includes('較高帶狀疱疹風險')));
  }
  for(const [condition,level,required] of [['anaphy','stop','嚴重過敏'],['preg','warn','應避免'],['lactate','warn','尚未研究'],['itp','warn','不可因此改為皮下'],['fever','warn','輕微感染'],['immuno','go','不是本疫苗禁忌'],['gbs','go',null]]){
    const result=win.evalVax(vx,{on:{[condition]:true},years:55});assert.equal(result.lv,level,condition);
    if(required)assert(result.hits.some(h=>h.t.includes(required)),condition);
  }
  assert.equal(win.evalVax(vx,{on:{anaphy:true,immuno:true},years:55}).lv,'stop');
  for(const r of vx.rules){assert(r.claim);checkRef({claim:r.claim});}
  // Every new rule uses the same claim in the screening result, contraindication table and search.
  doc.getElementById('age').value='30';
  for(const c of ['anaphy','preg','lactate','itp','fever','immuno'])doc.querySelector(`#conds input[data-c="${c}"]`).checked=true;
  win.render();await tick();
  const card=Array.from(doc.querySelectorAll('#results > .vax')).find(c=>c.textContent.includes('Shingrix'));
  const entry=win.VaccineSearch.find('Shingrix').find(r=>r.entry.id==='vax:shingrix').entry;
  for(const q of ['Shingrix 哺乳','Shingrix 孕婦','Shingrix 懷孕','Shingrix 1-2','Shingrix 追加','Shingrix GBS'])assert(win.VaccineSearch.find(q).some(r=>r.entry.id==='vax:shingrix'),q);
  for(const r of vx.rules){
    const table=doc.querySelector(`#contraTbl [data-ref-claim="${r.claim}"]`);assert(table);checkRef(api.refs.get(table));
    const s=entry.sections.find(s=>s.text===r.t);assert(s);assert.equal(s.ref.claim,r.claim);checkRef(s.ref);
    if(typeof r.c!=='function'||r.t.startsWith('18–49')){const hit=card.querySelector(`[data-ref-claim="${r.claim}"]`);assert(hit);checkRef(api.refs.get(hit));}
  }
  for(const claim of [vx.scheduleClaim,vx.extraClaim])checkRef(api.refs.get(card.querySelector(`[data-ref-claim="${claim}"]`)));
  for(const el of doc.querySelectorAll('#adultList [data-ref-claim^="shingrix-"]')){checkRef(api.refs.get(el));el.click();assert(doc.querySelector('#reference-panel .ref-highlight'));}
  for(const s of win.VaccineSearch.find('Shingrix').find(r=>r.entry.id==='adult:10').entry.sections.filter(s=>s.ref.claim))checkRef(s.ref);
  const pregnancy=doc.querySelector('#conds input[data-c="preg"]').parentElement.querySelector('span');
  const combined=api.evidence(api.refs.get(pregnancy));assert(combined.some(i=>i.doc.p===pages.S20.p&&i.label.includes('帶狀疱疹')));
  // Keyboard focus and mouseover share previews; click pins the same original page with real yellow anchors.
  const target=doc.querySelector('#adultList [data-ref-claim="shingrix-short"]');
  target.dispatchEvent(new win.MouseEvent('mouseover',{bubbles:true}));await new Promise(r=>setTimeout(r,400));
  assert(!doc.getElementById('reference-tip').hidden);assert(doc.querySelector('#reference-tip .ref-highlight'));
  target.click();assert(doc.querySelector('#reference-panel .ref-pdf-link').href.includes('Shingrix_TFDA_2026-04-23.pdf#page=2'));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS Shingrix original hash/16 pages, 13 source claims, cross-page indication, dose/conditions, age/pregnancy/immune/bleeding cases, all UI surfaces, condition labels and preview/click.');
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
