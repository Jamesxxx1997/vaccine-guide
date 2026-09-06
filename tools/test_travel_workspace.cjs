const assert=require('node:assert/strict');
const {dom,win,doc,errors}=require('./reference_test_env.cjs')();
const tick=()=>new Promise(r=>setTimeout(r,25));
const input=doc.getElementById('vaccineQuery'),assessment=doc.getElementById('travelAssessmentCards');
const query=text=>{input.value=text;input.dispatchEvent(new win.Event('input'));};
const row=(country,disease='霍亂',extra={})=>({country,disease,level:'第一級:注意(Watch)',region:'',date:'2023/03/20',url:'https://www.cdc.gov.tw/InternationalTravel/Index/test',...extra});
const result=(query,rows)=>({version:1,query,rows,count:rows.length,fetchedAt:'2026-09-06T08:00:00.000Z'});
(async()=>{
  assert.equal(win.VaccineSearch.count,50);
  query('Ｄｕｋｏｒａｌ');assert(doc.querySelector('[data-search-entry="guide:cholera"]'));
  let target=doc.querySelector('#vaccineSearchResults .ref-target');
  target.click();assert(!doc.getElementById('reference-panel').hidden);assert(doc.querySelector('#reference-panel .ref-highlight'));assert(doc.querySelector('#reference-panel .ref-pdf-link').href.endsWith('#page=4'));
  query('ZZZ-unmatched');assert(doc.getElementById('reference-panel').hidden);assert(!doc.querySelector('.vaccine-search-result'));
  query('MMR');assert(win.VaccineSearch.find('MMR').some(r=>r.entry.id==='adult:1'));assert(win.VaccineSearch.find('B 型肝炎').some(r=>r.entry.id==='vax:hepb'));
  query('Vaxchora');assert(doc.querySelector('#vaccineSearchResults .ref-target').textContent.startsWith('Vaxchora 劑次'));
  for(const [q,source] of [['RSV 24','S9'],['Shingrix 1-2','S9'],['XFG','S12']]){
    const result=win.VaccineSearch.find(q).find(r=>r.entry.id.startsWith('adult:'));assert(result,q);
    assert(result.matches.some(s=>s.ref.sources.includes(source)),q);
  }
  const rules=id=>win.VaccineSearch.find('孕婦').find(r=>r.entry.id==='vax:'+id).entry.sections;
  for(const [q,id,required] of [
    ['PCV 從未接種','adult:6',['65 歲','19 歲至 64 歲','公費','從未接種']],
    ['B 型肝炎 自費追加','adult:4',['已依時程完成','表面抗體陰性','高危險群','可自費追加']],
    ['B 型肝炎 1 個月後再抽血','adult:4',['已依時程完成','可自費追加 1 劑','1 個月後再抽血']],
    ['JE 0-28','adult:8',['Vero 細胞培養不活化疫苗','旅遊前一週']],
    ['Shingrix 1-2','adult:10',['50 歲','18 歲','免疫功能低下']]
  ]){
    query(q);const card=doc.querySelector(`[data-search-entry="${id}"]`);assert(card,q);
    for(const text of required)assert(card.textContent.includes(text),q+' missing '+text);
    for(const el of card.querySelectorAll('.vaccine-search-context .ref-target'))assert(win.referenceTest.evidence(win.referenceTest.refs.get(el)).length,q+' context source');
  }
  assert.equal(rules('hpv').find(s=>s.text==='孕婦。').label,'接種禁忌');assert.equal(rules('hepa').find(s=>s.text==='孕婦。').label,'注意事項／需評估');
  query('Rotarix');assert(doc.getElementById('vaccineSearchResults').textContent.includes('未確認'));doc.querySelector('#vaccineSearchResults button').click();assert(doc.getElementById('vaccineSearchDetail').textContent.includes('已於 2022-08-25'));
  query('Vaxchora');doc.querySelector('#vaccineSearchResults button').click();await tick();assert(doc.querySelector('#vaccineSearchDetail [data-guide-open="cholera"]'));assert(doc.querySelector('#vaccineSearchDetail [data-ref-claim="travel-guide-cholera-1"]'));
  const guides=win.eval('TRAVEL_GUIDES');
  for(const g of guides){const entry=win.VaccineSearch.find(g.title).find(r=>r.entry.guide===g.id)?.entry;assert(entry,g.id);win.VaccineSearch.open(entry);await tick();
    for(const s of g.sections){const el=doc.querySelector(`#vaccineSearchDetail [data-ref-claim="${s.claim}"]`);const ev=win.referenceTest.evidence(win.referenceTest.refs.get(el));assert(ev.length);assert(ev.some(e=>e.view?.rects.length),s.claim);}}
  // All authored rules/notes retain an evidence path, including PCV and serology.
  for(const e of win.VaccineSearch.find('疫苗').map(r=>r.entry))for(const s of e.sections)assert(win.referenceTest.evidence(s.ref).length,`${e.id}: ${s.text}`);
  win.TravelSearch.choose('MZ');await tick();assert.equal(win.TravelAssessment.state.selected,'莫三比克');
  assert(assessment.querySelector('[data-assessment-guide="cholera"]'));
  const raw=assessment.querySelector('[data-assessment-guide="cholera"] .travel-reason');raw.click();assert(doc.querySelector('#reference-panel .ref-csv-match'));assert(doc.querySelector('#reference-panel [data-csv-preview]').href.includes('csv-viewer.html'));
  doc.getElementById('travelQuery').dispatchEvent(new win.Event('input'));assert.equal(assessment.textContent,'');assert(doc.getElementById('reference-panel').hidden);
  const two=result('霍亂',[row('莫三比克'),row('阿富汗'),row('全球','新冠併發重症')]);win.TravelAssessment.receive(two,'live');
  assert.equal(win.TravelAssessment.state.selected,'');assert.equal(doc.querySelectorAll('[data-assessment-country]').length,2);assert(!assessment.querySelector('.travel-assessment-card'));
  win.TravelAssessment.choose('莫三比克');assert.equal(assessment.querySelectorAll('[data-assessment-guide="cholera"]').length,1);assert(assessment.querySelector('.travel-global [data-assessment-guide="covid"]'));
  const liveReason=assessment.querySelector('.travel-reason');liveReason.click();assert(doc.getElementById('reference-panel').textContent.includes('2026-09-06T08:00:00.000Z'));assert(!doc.querySelector('#reference-panel .ref-csv'));
  win.TravelAssessment.receive(result('莫三比克',[row('莫三比克'),row('莫三比克','霍亂',{region:'北部'}),row('莫三比克','茲卡病毒感染症')]),'proxy');
  assert.equal(assessment.querySelectorAll('[data-assessment-guide="cholera"]').length,1);assert(assessment.textContent.includes('尚無對應'));assert(assessment.textContent.includes('茲卡'));
  const large=result('',Array.from({length:329},(_,i)=>row('目的地'+i)));win.TravelAssessment.receive(large,'proxy');assert.equal(win.TravelAssessment.state.count,329);win.TravelAssessment.choose('目的地328');assert.equal(win.TravelAssessment.state.selected,'目的地328');
  win.TravelAssessment.receive(result('甲國',[row('甲國'),row('甲 國','黃熱病')]),'live');assert.equal(win.TravelAssessment.state.selected,'');assert(doc.getElementById('travelAssessmentStatus').textContent.includes('名稱近似'));win.TravelAssessment.choose('甲國');assert(assessment.textContent.includes('未自動合併'));
  win.TravelAssessment.receive(result('甲國',[row('甲國'),row('甲國','霍亂',{level:'第三級:警告(Warning)'})]),'live');assert(assessment.textContent.includes('同日等級衝突'));assert(assessment.textContent.includes('不自行裁定'));
  const evil='<img src=x onerror=alert(1)>';win.TravelAssessment.receive(result(evil,[row(evil)]),'live');assert(!assessment.querySelector('img'));assert(assessment.textContent.includes(evil));
  for(const bad of [result('bad',[row('JP','霍亂',{url:'javascript:alert(1)'})]),{...large,fetchedAt:'bad'},result('bad',[row('JP','霍亂',{level:'unknown'})])]){assert.throws(()=>win.TravelAssessment.receive(bad,'live'));assert.equal(assessment.textContent,'');}
  win.TravelAssessment.receive(result('全球',[row('全球','新冠併發重症')]),'live');assert.equal(win.TravelAssessment.state.selected,'');assert(!assessment.querySelector('.travel-assessment-card'));
  assert.equal(errors.length,0,errors.join('\n'));console.log('PASS global vaccine search, all 38 guide anchors, snapshot CSV, live provenance, multi-country/global separation, 329 rows, unknown diseases, XSS and stale state.');
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
