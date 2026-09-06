const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {dom,win,doc,errors,root}=require('./reference_test_env.cjs')();
const tick=()=>new Promise(r=>setTimeout(r,25));
const act=(el,type='click')=>el.dispatchEvent(new win.Event(type,{bubbles:true,cancelable:true}));
(async()=>{
  await tick();
  const travel=win.eval('TRAVEL'),guides=win.eval('TRAVEL_GUIDES'),refs=win.referenceTest;
  const input=doc.getElementById('travelQuery');
  assert(doc.getElementById('tvCountry').hidden,'Legacy dropdown must not be visible');
  assert.equal(win.TravelSearch.matches('日本')[0].key,'JP');
  assert.equal(win.TravelSearch.matches('jApAn')[0].key,'JP');
  assert(win.TravelSearch.matches('霍亂').some(r=>r.key==='MZ'));
  assert(win.TravelSearch.matches('傷寒疫苗').length);
  assert.equal(win.TravelSearch.matches('unlikely query 9384').length,0);
  win.TravelSearch.choose('MZ');await tick();
  assert(!doc.getElementById('tvOut').textContent.includes('第三級'));
  assert(doc.querySelector('[data-guide="cholera"]'));
  assert(doc.getElementById('tvMeta').textContent.includes('每月'));
  assert(doc.getElementById('tvMeta').textContent.includes('不是查詢當下'));
  assert(Object.values(travel).every(c=>c.a.every(a=>a[1]!=='嚴重特殊傳染性肺炎')));
  assert(Object.values(travel).some(c=>c.unresolved?.length),'Unresolved historical records were silently discarded');
  for(const c of Object.values(travel))for(const v of c.v)assert(win.TravelVaccineGuides.find(v),'No guide for official item '+v);
  let count=0;
  for(const g of guides){
    win.TravelVaccineGuides.render('MZ',g);await tick();
    for(const s of g.sections){
      const el=doc.querySelector('[data-ref-claim="'+s.claim+'"]');assert(el&&refs.refs.has(el));
      const item=refs.evidence(refs.refs.get(el))[0];assert(item.view.rects.length,s.claim);
      assert.equal(item.view.page.page,s.page);assert.equal(item.doc.sha256,crypto.createHash('sha256').update(fs.readFileSync(root+'/'+item.doc.p)).digest('hex'));
      for(const r of item.view.rects){assert(r.every(Number.isFinite));assert(r[0]>=0&&r[1]>=0&&r[2]<=item.view.page.w&&r[3]<=item.view.page.h);}
      assert(fs.existsSync(root+'/'+item.view.page.img));count++;
    }
  }
  win.TravelVaccineGuides.render('MZ',win.TravelVaccineGuides.find('cholera'));await tick();
  let target=doc.querySelector('[data-ref-claim="travel-guide-cholera-0"]');
  target.dispatchEvent(new win.MouseEvent('mouseover',{bubbles:true}));await new Promise(r=>setTimeout(r,260));
  assert(!doc.getElementById('reference-tip').hidden);assert(doc.querySelector('#reference-tip .ref-highlight'));
  target.click();assert(!doc.getElementById('reference-panel').hidden);
  assert(doc.querySelector('#reference-panel .ref-highlight'));assert(doc.querySelector('#reference-panel .ref-overview'));
  const pages=doc.querySelector('[data-ref-page]');pages.value='8';act(pages,'change');
  assert(doc.querySelector('#reference-panel .ref-pdf-link').href.endsWith('#page=8'));
  assert(!doc.querySelector('#reference-panel .ref-highlight'),'Manually changing page left stale yellow marks');
  input.value='Japan';act(input,'input');await tick();
  assert(!doc.getElementById('tvOut').textContent);assert(!doc.getElementById('travelVaccineDetails').textContent);
  assert(doc.getElementById('reference-panel').hidden,'Typing new destination left stale evidence');
  act(doc.getElementById('travelSearchForm'),'submit');await tick();
  assert.equal(doc.getElementById('tvCountry').value,'JP');
  win.TravelSearch.choose('AU');await tick();
  assert(!doc.querySelector('#tvOut .badge.go'));assert(!doc.getElementById('tvOut').textContent.includes('無警示'));
  win.TravelSearch.choose('TT');await tick();
  target=[...doc.querySelectorAll('#tvOut .ref-target')].find(e=>e.textContent==='千里達及托巴哥');target.click();
  assert(doc.querySelector('#reference-panel .ref-csv'));assert(doc.querySelector('#reference-panel [data-csv-preview]').getAttribute('href').startsWith('csv-viewer.html?'));
  const hostile='<img src=x onerror="window.pwned=true">';
  win.eval('TRAVEL.XSS='+JSON.stringify({n:hostile,en:hostile,a:[[1,hostile,'2026-09-01',hostile,0]],v:[hostile]})+';travelInit();');
  win.TravelSearch.choose('XSS');await tick();
  assert(!doc.querySelector('#tvOut img'));assert(doc.getElementById('tvOut').textContent.includes(hostile));assert(!win.pwned);
  win.eval("TRAVEL_SYNC_STATUS.outcome='failed';TRAVEL_SYNC_STATUS.attemptedAt='2026-09-07T01:00:00Z'");
  win.TravelData.renderMeta();assert(doc.getElementById('tvMeta').textContent.includes('最近一次更新未成功'));
  for(const absent of [null,undefined,'','not-a-date']){
    win.TravelData.current.meta.provenance.prescriptions.sourceModified=absent;
    win.TravelData.renderMeta();
    assert(doc.getElementById('tvMeta').textContent.includes('官方檔案修改時間 未提供'));
    assert(!doc.getElementById('tvMeta').textContent.includes('1970'));
  }
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(`PASS travel search/CSV/PDF/state/XSS; ${guides.length} guides, ${count} hash-bound highlighted sections; every current prescription item mapped.`);
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
