// Full field/branch coverage, separate from the small interaction smoke tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {dom,win,doc,root,errors}=require('./reference_test_env.cjs')();
const api=win.referenceTest,geom=win.eval('ReferenceGeometry'),tables=win.eval('ReferenceTables');
const documents=win.eval('REFERENCE_PAGES');
let targets=0,csvCases=0,branches=0;
const issues=[];
const tick=()=>new Promise(r=>setTimeout(r,0));
function evidence(el){assert(el);if(!api.refs.has(el))el=el.querySelector('.ref-target');assert(el,'Reference target missing');targets++;return api.evidence(api.refs.get(el));}
function highlighted(el,label){const items=evidence(el);if(!items.some(i=>i.view?.rects?.length||i.table||i.doc?.text))issues.push('No evidence: '+label);return items;}
const action=(id,value)=>{const el=doc.getElementById(id);el.value=value;el.dispatchEvent(new win.Event(id==='cMonths'||id==='riskAge'?'input':'change',{bubbles:true}));};
function within(view,bounds,label){for(const r of view.rects||[])assert(geom.inside(r,bounds),`${label}: out-of-scope ${r}`);}
function checkPDFGeometry(items){for(const {view:v} of items){if(!v)continue;for(const r of v.rects||[]){assert(r.every(Number.isFinite));assert(r[0]>=0&&r[1]>=0&&r[2]<=v.page.w+1&&r[3]<=v.page.h+1);}}}
(async()=>{
  await tick();
  const vaxes=win.eval('VAX');
  for(const [i,card] of [...doc.querySelectorAll('#results > .vax')].entries()){
    for(const target of card.querySelectorAll('.vax-name .ref-target,.vax-head > .pill,.vax-body .hit-txt')){
      const data=api.refs.get(target);
      if(target.textContent.includes('未觸發'))continue;
      checkPDFGeometry(highlighted(target,'screen '+vaxes[i].id+' '+target.textContent));
    }
  }
  // Validate the original S2 row identity independently of the application's aliases.
  const expected={hepb:'HepB',bcg:'BCG',dtap5:'DTaP-IPV-Hib',pcv:'PCV',flu:'Influenza',mmr:'MMR',var:'Varicella',hepa:'HepA',jelive:'JE-CV',jeinact:'JE',dtapipv:'DTaP-IPV',tdap:'Tdap',ppv23:'PPV',hpv:'HPV',rota:'Rotavirus',hexa:'DTaP-IPV-HepB-Hib',mcv4:'MCV4'};
  for(const [i,card] of [...doc.querySelectorAll('#results > .vax')].entries()){
    const id=vaxes[i].id;if(!expected[id])continue;
    const v=evidence(card.querySelector('.vax-head > .pill'))[0].view;
    const row=v.focus.find(b=>b[0]>150),text=v.page.words.filter(w=>geom.inside(w,row)).map(w=>w[4]).join('');
    assert(geom.norm(text).includes(geom.norm(expected[id])),id+': '+text);
    assert(v.rects.every(r=>v.focus.some(b=>geom.inside(r,b))),id+' neighbouring row highlighted');
    assert(v.rects.some(r=>r[0]<153)&&v.rects.some(r=>r[0]>=153),id+' missing category or vaccine mark');
    if(id==='pcv')assert(!text.includes('PPV'));
    if(id==='flu')assert(!text.includes('LAIV'));
  }
  for(const el of doc.querySelectorAll('#conds label > span'))highlighted(el,'condition '+el.textContent);
  for(const el of doc.querySelectorAll('#childTbl td'))highlighted(el,'child '+el.textContent);
  for(const el of doc.querySelectorAll('#adultList .vax-name,#adultList .adv-brief,#adultList .vax-body li,#adultList .vax-body p'))highlighted(el,'adult '+el.textContent);
  for(const el of doc.querySelectorAll('#adultList .adv-brief')){
    if(!/個月|週/.test(el.textContent))continue;
    const items=evidence(el);assert.equal(items.length,2);
    assert(items[0].view.page.page>1,'Interval/week summary must preview the explanatory note first');
    assert(items[0].view.rects.length,'Adult explanatory note missing highlights');
    assert.equal(items[1].view.page.page,1);
  }
  for(const el of doc.querySelectorAll('#ipdBox .ref-target,#sexBox .ref-target,#chrBox .ref-target'))highlighted(el,'risk '+el.textContent);
  for(const el of doc.querySelectorAll('#minAgeTbl td')){
    const items=evidence(el);if(el.textContent.trim()!=='—')assert(items[0].view.rects.length,'minimum cell '+el.textContent);
    else assert(!items[0].view.rects.length,'Empty source cell must not borrow another column');
    within(items[0].view,items[0].view.focus[0],'minimum cell');
  }
  for(const el of doc.querySelectorAll('#p-interval .fold-body li,#p-interval tbody td')){
    if(el.closest('#minAgeTbl'))continue;
    highlighted(el,'interval '+el.textContent);
  }
  for(const el of doc.querySelectorAll('#p-catchup tbody td'))highlighted(el,'symbol '+el.textContent);
  // Every source entry, including documents whose first page is only a cover.
  for(const row of doc.querySelectorAll('#srcTbl tr')){
    const key=row.cells[0].textContent.trim();if(!documents[key]?.pages)continue;
    assert(evidence(row.cells[0])[0].view.rects.length,'Source title not located '+key);
  }
  console.log('PASS initial clinical fields, classifications, 50 minimum-age cells and source titles');
  const checksumBefore=JSON.stringify(win.eval('EXCERPTS'));
  for(const input of doc.querySelectorAll('#conds input')){
    input.checked=true;input.dispatchEvent(new win.Event('change',{bubbles:true}));await tick();branches++;
    for(const el of doc.querySelectorAll('#results .hit-txt')){
      const data=api.refs.get(el);if(data?.exact){const e=win.eval('EXCERPTS')[data.exact],v=evidence(el)[0].view;
        if(e.status==='gist')assert.equal(v.rects.length,0);else if(e.type==='pdf')assert(v.rects.length);}
    }
    input.checked=false;
  }
  for(const month of [0,1,2,4,5,6,12,15,18,27,60,72]){
    action('cMonths',String(month));await tick();branches++;
    for(const el of doc.querySelectorAll('#cOut li')){const v=highlighted(el,'child output '+el.textContent)[0].view;assert(v.locatedRow,'Child result must have pinned vaccine row');}
  }
  for(const vx of win.eval('CATCHUP')){
    action('cuVax',vx.id);await tick();
    for(const row of vx.rows){
      doc.getElementById('cuDone').value=String(row.done);
      if(row.last)doc.getElementById('cuLast').value=row.last;
      if(row.route)doc.getElementById('cuRoute').value=row.route;
      win.eval('catchupCalc()');await tick();branches++;
      for(const el of doc.querySelectorAll('#cuExtra .ref-target,#cuDoneWrap .ref-target')){
        const data=api.refs.get(el);assert.equal(data.catchupId,vx.id,'Stale catchup control vaccine');
        assert.equal(data.catchupIndex,vx.rows.indexOf(row),'Stale catchup control branch');
      }
      for(const el of doc.querySelectorAll('#cuOut .iv-out,#cuOut li')){
        const view=evidence(el)[0].view;assert.equal(view.anchorId,vx.id);
        assert.equal(view.anchorKind,'catchup');assert(view.rects.length,`${vx.id} ${JSON.stringify(row)}`);
      }
    }
  }
  for(const input of doc.querySelectorAll('#ipdBox input,#sexBox input,#chrBox input')){
    input.checked=true;input.dispatchEvent(new win.Event('change',{bubbles:true}));await tick();branches++;
    for(const el of doc.querySelectorAll('#riskOut .hit-txt'))highlighted(el,'risk output '+el.textContent);
    input.checked=false;
  }
  console.log('PASS condition, child schedule, catchup and adult risk branches');
  const list=win.eval('IV_LIST');
  for(let a=0;a<list.length;a++)for(let b=0;b<list.length;b++){
    doc.getElementById('ivA').value=a;doc.getElementById('ivB').value=b;win.eval('ivCheck()');api.wire();branches++;
    const out=doc.getElementById('ivOut'),items=evidence(out);
    assert(items.length,'interval source missing '+a+':'+b);
    if(out.querySelector('.src'))assert(items.some(i=>i.view?.rects.length||i.doc?.text),'interval no text '+a+':'+b);
    else assert(items.every(i=>!i.view),'Invalid/same-vaccine state retained previous PDF');
  }
  await tick();assert.equal(JSON.stringify(win.eval('EXCERPTS')),checksumBefore,'Legacy evidence grades mutated');
  console.log('PASS all ordered interval pairs, including invalid same-vaccine states');
  // CSV bytes, cells and record order cross-checked using the standard CSV parser.
  for(const [key,table] of Object.entries(win.eval('REFERENCE_TABLES'))){
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(root+'/'+table.p)).digest('hex'),table.sha256);
    const raw=JSON.parse(execFileSync('python3',['-c','import csv,json,sys; print(json.dumps(list(csv.reader(open(sys.argv[1], encoding="utf-8-sig", newline=""))),ensure_ascii=False))',root+'/'+table.p],{encoding:'utf8',maxBuffer:8*1024*1024}));
    assert.deepEqual(Array.from(table.headers),raw[0]);
    assert.equal(table.rows.length,raw.length-1);
    table.rows.forEach((r,i)=>{assert.equal(r.record,i+1);assert.deepEqual(Array.from(r.values),raw[i+1]);});
  }
  for(const [key,country] of Object.entries(win.eval('TRAVEL'))){
    action('tvCountry',key);await tick();branches++;
    for(const el of doc.querySelectorAll('#tvOut .ref-target')){
      const items=evidence(el);assert(items.length&&items.every(i=>i.table),'Travel text still uses PDF placeholder '+el.textContent);
    }
    for(const a of country.a){
      const rows=tables.select(tables.get('alerts'),{countryKey:key,country:country.n,countryEnglish:country.en,level:a[0],disease:a[1],date:a[2],detail:a[3]});
      assert(rows.length,`${key} alert missing ${JSON.stringify(a)}`);csvCases++;
    }
    for(const v of country.v){assert(tables.select(tables.get('prescriptions'),{country:country.n,countryEnglish:country.en,vaccine:v}).length,key+' vaccine '+v);csvCases++;}
  }
  console.log('PASS all '+Object.keys(win.eval('TRAVEL')).length+' destinations and '+csvCases+' underlying alert/vaccine records');
  const travel=win.eval('TRAVEL');
  assert.equal(tables.get('alerts').v,win.eval('TRAVEL_META.updated'),'Preview and summary snapshot dates differ');
  assert(!travel.GP);assert(travel['GP::guadeloupe']);assert(travel['GP::saint martin']);assert(travel['GP::st.barthelemy']);
  assert.equal(travel['GP::guadeloupe'].a.find(a=>a[1]==='茲卡病毒感染症')[2],'2019-07-08');
  assert.equal(travel['GP::saint martin'].a.find(a=>a[1]==='茲卡病毒感染症')[2],'2020-11-06');
  for(const key of ['BR','DE','ES']){
    const country=travel[key],table=tables.get('alerts');
    const alert=country.a.find(a=>a[1]===(key==='BR'?'屈公病':'M痘'));assert(alert);
    const filter={countryKey:key,country:country.n,countryEnglish:country.en,level:alert[0],disease:alert[1],date:alert[2],detail:alert[3]};
    const match=tables.select(table,filter),related=tables.select(table,{...filter,level:undefined});
    assert(related.length>match.length,'Expected conflicting source levels '+key);
    const conflictView=doc.createElement('div');tables.mount(conflictView,table,filter);
    assert(conflictView.textContent.includes('同日另有不同等級'));
    assert.equal(conflictView.querySelectorAll('.ref-csv-match').length,match.length);
  }
  // User's screenshot: hover, move inside, scroll, page/search and pin.
  action('tvCountry','TT');await tick();
  const target=[...doc.querySelectorAll('#tvOut .ref-target')].find(e=>e.textContent==='千里達及托巴哥');
  target.dispatchEvent(new win.MouseEvent('mouseover',{bubbles:true}));await new Promise(r=>setTimeout(r,260));
  const tip=doc.getElementById('reference-tip');assert(!tip.hidden&&tip.querySelector('.ref-csv'));
  tip.dispatchEvent(new win.MouseEvent('mouseenter'));
  tip.querySelector('.ref-csv-scroll').dispatchEvent(new win.Event('scroll'));assert(!tip.hidden,'CSV scroll closed hover');
  const scope=tip.querySelector('[aria-label="CSV 顯示範圍"]');scope.value='all';scope.dispatchEvent(new win.Event('change'));
  assert.equal(tip.querySelectorAll('tbody tr').length,40);
  tip.querySelector('[data-csv-next]').click();assert.equal(tip.querySelector('tbody tr').dataset.csvRecord,'41');
  const search=tip.querySelector('input');search.value='千里達';search.dispatchEvent(new win.Event('input'));
  assert([...tip.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('千里達')));
  target.click();assert(doc.querySelector('#reference-panel .ref-csv'));
  action('tvCountry','JP');await tick();assert(doc.getElementById('reference-panel').hidden,'Changed country left old pinned evidence visible');
  const fixture=doc.createElement('div');
  const raw='<img src=x onerror="window.bad=true">';
  tables.mount(fixture,{n:'CSV test',headers:['國名(中)','疫苗'],rows:[{record:1,values:['01',raw]}],p:'test.csv',u:'https://example.org/test.csv',v:'test'},{});
  assert(!fixture.querySelector('img'));assert(fixture.textContent.includes(raw));assert(fixture.textContent.includes('01'));
  assert.equal(errors.length,0,errors.join('\n'));
  if(issues.length)throw Error([...new Set(issues)].join('\n'));
  console.log(`PASS coverage: ${targets} reference checks, ${branches} dynamic branches, ${csvCases} CSV alert/vaccine mappings, both full CSV snapshots`);
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
