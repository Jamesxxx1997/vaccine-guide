const assert=require('node:assert/strict');
const {dom,win,doc,errors}=require('./reference_test_env.cjs')({beforeScripts(w){w.scrollTo=()=>{};}});
const tick=()=>new Promise(r=>setTimeout(r,0));
const enter=(id,value)=>{const el=doc.getElementById(id);el.value=value;el.dispatchEvent(new win.Event('input',{bubbles:true}));};
const visible=id=>Array.from(doc.querySelectorAll(`#${id} > .vax`)).filter(el=>!el.hidden);
(async()=>{
  for(const q of ['皰疹','疱疹','帶狀皰疹','皮蛇','欣剋疹','欣克疹','Shingrix','ＳＨＩＮＧＲＩＸ','RZV','shingles','herpes zoster']){
    const ids=win.VaccineSearch.find(q).map(r=>r.entry.id);
    assert(ids.includes('vax:shingrix')&&ids.includes('adult:10'),q);
    for(const [input,list] of [['screenVaccineQuery','results'],['adultVaccineQuery','adultList']]){
      enter(input,q);assert.equal(visible(list).length,1,q+' '+list);assert(visible(list)[0].textContent.includes('Shingrix'));
    }
  }
  for(const q of ['HSV','單純皰疹','herpes simplex'])assert(!win.VaccineSearch.find(q).some(r=>['vax:shingrix','adult:10'].includes(r.entry.id)),q+' must not imply HSV prevention');
  const counts=doc.getElementById('tally').textContent;
  enter('screenVaccineQuery','not-a-vaccine');assert.equal(visible('results').length,0);assert.equal(doc.getElementById('tally').textContent,counts);
  assert(doc.getElementById('screenVaccineQuery').closest('.card').textContent.includes('查無名稱不代表不存在'));
  assert.equal(doc.querySelectorAll('#results > .vax').length,win.eval('VAX.length'));
  enter('screenVaccineQuery','皮蛇');
  const pregnant=doc.querySelector('#conds input[data-c="preg"]');pregnant.checked=true;pregnant.dispatchEvent(new win.Event('change',{bubbles:true}));
  await tick();assert.equal(visible('results').length,1);assert(pregnant.checked);
  enter('age','55');await tick();assert.equal(visible('results').length,1);assert(pregnant.checked);
  const card=visible('results')[0],target=card.querySelector('.vax-name .ref-target');
  target.click();assert(!doc.getElementById('reference-panel').hidden);
  assert(doc.getElementById('reference-panel').textContent.includes('帶狀疱疹'));
  assert(doc.querySelector('#reference-panel .ref-highlight'));
  enter('vaccineQuery','皰疹');
  for(const [entry,panel,list] of [['vax:shingrix','p-screen','results'],['adult:10','p-adult','adultList']]){
    const result=doc.querySelector(`[data-search-entry="${entry}"]`);assert(result);
    const button=Array.from(result.querySelectorAll('button')).find(b=>b.textContent.startsWith('前往'));
    button.click();await tick();assert(doc.getElementById(panel).classList.contains('on'));
    const focused=doc.activeElement;assert(focused.classList.contains('vax')&&focused.classList.contains('open'));
    assert(focused.textContent.includes('Shingrix'));assert(!focused.hidden);
    assert.equal(visible(list).length,list==='results'?20:14);assert(pregnant.checked);assert.equal(doc.getElementById('age').value,'55');
  }
  enter('adultVaccineQuery','皮蛇');await tick();
  const adult=visible('adultList')[0];adult.querySelector('.adv-brief').click();
  assert(doc.querySelector('#reference-panel .ref-highlight'),'Filtered adult source still highlights');
  doc.getElementById('adultVaccineQuery').closest('.card').querySelector('button').click();assert.equal(visible('adultList').length,14);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS 11 shingles aliases, HSV separation, both card filters, original-card navigation, preserved patient state/counts/order and source highlights.');
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
