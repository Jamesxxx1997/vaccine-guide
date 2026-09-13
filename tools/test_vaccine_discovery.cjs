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
  // 民眾問題 → 感染後接種間隔總表（關鍵字模式），且原句可開原件（claim）
  {
    const top=win.VaccineSearch.find('得新冠多久後建議打新冠');
    assert(top.length&&top[0].entry.category==='感染後接種間隔'&&/COVID-19/.test(top[0].entry.title),'covid post-infection row ranks first');
    assert(top[0].keywords.includes('新冠')&&top[0].keywords.includes('多久'),'keywords reported');
    assert(top[0].entry.sections.some(s=>/12週（84天）/.test(s.text.normalize('NFKC'))||/12 週（84 天）/.test(s.text)),'row carries the 12-week text');
    assert(top[0].entry.sections.every(s=>s.ref?.claim==='postinf-covid-qa'),'sections open the claim');
    const flu=win.VaccineSearch.find('感冒可以打流感疫苗嗎');
    assert(flu.length&&/流感/.test(flu[0].entry.title)&&/感冒|上呼吸道/.test(flu[0].matches[0].text),'cold question surfaces the cold-and-flu-vaccine text first: '+flu[0].entry.id);
    assert(flu.some(r=>r.entry.category==='感染後接種間隔'&&/流感/.test(r.entry.title)),'flu rows of the table are in the results');
    const preg2=win.VaccineSearch.find('懷孕可以打流感疫苗嗎');
    assert(/孕婦/.test(preg2[0].matches[0].text),'pregnancy question: top result shows the pregnancy text, not the infection table: '+preg2[0].entry.id);
    const chemo=win.VaccineSearch.find('化療中可以打帶狀疱疹疫苗嗎');
    assert(/免疫/.test(chemo[0].matches[0].text),'chemo question: top result shows the immunocompromised text: '+chemo[0].entry.id);
    const zoster=win.VaccineSearch.find('皮蛇復發後多久可以打');
    assert(zoster.length&&zoster[0].entry.category==='感染後接種間隔'&&/Shingrix/.test(zoster[0].entry.title),'shingrix row for recurrence');
    assert(win.VaccineSearch.find('新冠').some(r=>r.entry.id==='vax:covid'),'covid alias reaches the screener card');
    // 副作用／過敏與成分：民眾問法要能到原件表格或指引判讀
    const ae=win.VaccineSearch.find('新冠疫苗副作用');assert(ae.length&&/^ae:covid/.test(ae[0].entry.id),'新冠副作用 → 原件表格排第一: '+(ae[0]&&ae[0].entry.id));
    assert(win.VaccineSearch.find('打帶狀疱疹疫苗會發燒嗎').slice(0,3).some(r=>/^ae:shingrix/.test(r.entry.id)),'皮蛇發燒 → Shingrix 副作用表在前三');
    assert(win.VaccineSearch.find('對明膠過敏可以打MMR嗎').slice(0,3).some(r=>r.entry.id==='allergy:gelatin'),'明膠→MMR 指引判讀在前三');
    assert(win.VaccineSearch.find('Shingrix 成分').some(r=>/^allergen:/.test(r.entry.id)),'品牌＋成分 → 仿單成分條目');
    const yf=win.VaccineSearch.find('蛋過敏可以打黃熱病疫苗嗎');assert(yf.slice(0,3).some(r=>r.entry.id==='allergy:egg-yf'),'蛋過敏→黃熱病 判讀在前三');
    assert(win.VaccineSearch.find('確診 新冠').some(r=>r.entry.category==='感染後接種間隔'),'two-term exact mode still reaches the table');
    assert.equal(win.VaccineSearch.find('not-a-vaccine').length,0,'keyword mode must not invent hits');
    // 結果卡的「前往間隔規則總表」會切到分頁並聚焦該列
    enter('vaccineQuery','得新冠多久後建議打新冠');
    const card=doc.querySelector('#vaccineSearchResults .vaccine-search-result');assert(card&&/感染後接種間隔/.test(card.textContent));
    const go=[...card.querySelectorAll('button')].find(b=>b.textContent==='前往間隔規則總表');assert(go);go.click();
    assert(doc.activeElement&&doc.activeElement.matches('#postinfTbl tr[data-ref-claim="postinf-covid-qa"]'),'row focused');
    enter('vaccineQuery','');
  }
  // 其他疫苗的民眾說法別名與問句條件
  {
    const ids=q=>win.VaccineSearch.find(q).map(r=>r.entry.id);
    assert(ids('百日咳').includes('vax:tdap')&&ids('百日咳').includes('vax:dtap5')&&ids('百日咳').includes('adult:0'),'pertussis alias');
    assert(ids('B肝').includes('vax:hepb')&&ids('B肝').includes('adult:4'),'HBV alias');
    assert(ids('子宮頸癌疫苗').includes('vax:hpv'),'HPV lay alias');
    assert(ids('肺炎疫苗').includes('vax:pcv')&&ids('肺炎疫苗').includes('vax:ppv23'),'pneumococcal lay alias hits both');
    assert(ids('日本腦炎').includes('vax:jelive')&&ids('日本腦炎').includes('vax:jeinact')&&ids('日本腦炎').includes('adult:8'),'JE alias');
    const preg=win.VaccineSearch.find('懷孕可以打流感疫苗嗎');
    const flu=preg.find(r=>r.entry.id==='adult:2');assert(flu,'flu adult entry found for pregnancy question');
    assert(flu.matches[0]&&/孕婦/.test(flu.matches[0].text),'pregnancy section selected: '+(flu.matches[0]&&flu.matches[0].text.slice(0,40)));
    assert(preg[0].keywords.includes('孕婦'),'condition reported in keywords');
    const egg=win.VaccineSearch.find('蛋過敏可以打流感疫苗嗎');
    const eggFlu=egg.find(r=>r.entry.id==='vax:flu');assert(eggFlu&&eggFlu.matches[0]&&/雞蛋過敏者可安心/.test(eggFlu.matches[0].text),'egg allergy section selected: '+(eggFlu&&eggFlu.matches[0]&&eggFlu.matches[0].text.slice(0,30)));
    assert(egg[0].entry.id==='vax:flu'||egg[0].entry.id==='allergy:egg-flu','flu card or the 蛋過敏→流感 guideline rule ranks first: '+egg[0].entry.id);
    assert(eggFlu.matches[0].ref&&eggFlu.matches[0].ref.claim==='flu-egg-allergy-qa','egg answer opens its claim');
    assert(!ids('HSV').includes('vax:shingrix'),'HSV still not zoster');
  }
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
