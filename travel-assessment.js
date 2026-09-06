/* One destination context; source provenance is never inferred from a vaccine.
   This is related-reading navigation, not a clinical recommendation engine. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),root=$('travelAssessment');if(!root)return;
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');
  const globalName=s=>/^(全球|全世界|global|worldwide)$/i.test(String(s).trim());
  const sourceURL='https://www.cdc.gov.tw/InternationalEpidemicLevel/Index/NlUwZUNvckRWQ09CbDJkRVFjaExjUT09';
  const additional={rabies:['狂犬病'],typhoid:['傷寒'],hepa:['A型肝炎'],je:['日本腦炎'],
    meningococcal:['流行性腦脊髓膜炎'],tbe:['蜱媒腦炎','壁蝨腦炎']};
  let batch=null,selected='';
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
  const clearSources=()=>ReferenceUI.clear();
  function clear(){batch=null;selected='';clearSources();$('travelAssessmentStatus').textContent='尚未選擇目的地；未列出旅遊評估項目。';$('travelAssessmentCountries').replaceChildren();$('travelAssessmentCards').replaceChildren();}
  function validate(data){
    if(!data||typeof data.query!=='string'||!Array.isArray(data.rows)||data.rows.length>10000||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('即時結果格式或取得時間無法確認。');
    const rows=data.rows.map(row=>{
      for(const k of ['country','disease','level','date','region','url'])if(typeof row[k]!=='string'||row[k].length>4000)throw Error('即時結果欄位格式變更。');
      if(!row.country.trim()||!row.disease.trim()||!/^\d{4}\/\d{2}\/\d{2}$/.test(row.date)||!/^第[一二三]級/.test(row.level))throw Error('即時結果缺少可核對的國家、日期或等級。');
      const url=new URL(row.url);if(url.origin!=='https://www.cdc.gov.tw'||url.username||url.password)throw Error('即時來源不是疾管署。');
      return {...row,country:row.country.trim(),url:url.href};
    });
    const conflicts=new Map();
    for(const row of rows){const key=JSON.stringify([row.country,row.disease,row.region,row.date]);if(!conflicts.has(key))conflicts.set(key,new Set());conflicts.get(key).add(row.level);}
    for(const row of rows)row.conflict=conflicts.get(JSON.stringify([row.country,row.disease,row.region,row.date])).size>1;
    return {...data,rows,source:sourceURL};
  }
  function liveEvidence(row,data){return {query:`${row.country} · ${row.disease} · ${row.level} · ${row.date}`,
    external:{n:'疾管署旅遊疫情搜尋：本次原始結果',v:'取得時間 '+data.fetchedAt,p:'',u:row.url,
      textLabel:'官方搜尋結果（非 PDF／非 CSV 快照）',
      text:`國家／地區：${row.country}\n疾病：${row.disease}\n等級：${row.level}\n一級行政區：${row.region||'原欄空白'}\n官方發布日期：${row.date}\n查詢字詞：${data.query||'顯示所有'}\n本次取得時間：${data.fetchedAt}`}};}
  function snapshotRow(a,key){const c=TRAVEL[key];return {country:c.n,disease:a[1],level:LV_NAME[a[0]]||'等級待核對',date:a[2],region:a[3]||'',conflict:!!a[5]?.conflict,
    ref:{csv:['alerts'],csvFilter:{countryKey:key,country:c.n,countryEnglish:c.en,disease:a[1],date:a[2],level:a[0],detail:a[3]||''}}};}
  function sourceText(row){return `${row.country} · ${row.disease} · ${row.level} · ${row.date}${row.region?' · '+row.region:''}${row.conflict?'【同日等級衝突，待核對】':''}`;}
  function why(row){const p=node('p',sourceText(row),'travel-reason');ReferenceUI.bind(p,row.ref);return p;}
  function groups(rows,prescriptions=[]){
    const map=new Map(),unknown=[];
    function add(g,row,prescription){if(!map.has(g.id))map.set(g.id,{guide:g,reasons:[],prescriptions:[]});const item=map.get(g.id);if(row)item.reasons.push(row);if(prescription)item.prescriptions.push(prescription);}
    for(const row of rows){const guides=TRAVEL_GUIDES.filter(g=>[...g.diseases,...(additional[g.id]||[])].some(d=>norm(d)===norm(row.disease)));
      if(!guides.length)unknown.push(row);else guides.forEach(g=>add(g,row));}
    for(const p of prescriptions){const g=TravelVaccineGuides.find(p.name);if(g)add(g,null,p);else unknown.push({prescription:p});}
    return {items:[...map.values()],unknown};
  }
  function guideCard(item,country){
    const g=item.guide,card=node('article',undefined,'vax warn travel-assessment-card');card.dataset.assessmentGuide=g.id;
    const head=node('div',undefined,'vax-head');head.append(node('span','評估閱讀','badge warn'),node('h3',g.title,'vax-name'));card.append(head);
    const body=node('div',undefined,'travel-assessment-body');body.append(node('strong','為什麼列出'));
    item.reasons.forEach(r=>body.append(why(r)));
    for(const p of item.prescriptions){const el=node('p',`疾管署旅遊處方箋列出：${p.name}（不是疫情警示，也不是入境強制要求）`,'travel-reason');ReferenceUI.bind(el,p.ref);body.append(el);}
    body.append(node('p',g.scope,'sub'));
    const first=g.sections[0],text=node('p',first.label+'：'+first.text,'travel-guide-section');ReferenceUI.bind(text,{claim:first.claim});body.append(text);
    const versions=[...new Set(g.sections.flatMap(s=>(REFERENCE_CLAIMS[s.claim]?.items||[]).map(i=>REFERENCE_PAGES[i.source]?.v).filter(Boolean)))];
    body.append(node('p','疫苗文件版本：'+versions.join('／'),'sub'));
    body.append(button('劑次・禁忌・注意事項／PDF',()=>TravelVaccineGuides.open(g.id,{country,diseases:item.reasons.map(r=>r.disease),kind:batch.label==='每日快照'?'snapshot':'live'})));
    card.append(body);return card;
  }
  function renderGroup(host,rows,prescriptions,country){
    const result=groups(rows,prescriptions);for(const item of result.items)host.append(guideCard(item,country));
    if(result.unknown.length){const section=node('article',undefined,'card');section.append(node('h3','尚無對應的已整理疫苗說明'),node('p','下列資料仍須核對防護方式；未收錄說明不等於沒有疫苗或不需預防。'));
      for(const r of result.unknown){if(r.prescription){const p=node('p',r.prescription.name);ReferenceUI.bind(p,r.prescription.ref);section.append(p);}else section.append(why(r));}host.append(section);}
    return result.items.length;
  }
  function choose(country){
    if(!batch||!batch.countries.includes(country))return;
    clearSources();$('travelVaccineDetails').replaceChildren();selected=country;
    const host=$('travelAssessmentCards');host.replaceChildren();
    $('travelAssessmentCountries').querySelectorAll('[data-assessment-country]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.assessmentCountry===country)));
    const rows=batch.rows.filter(r=>r.country===country),prescriptions=batch.prescriptions||[];
    if(batch.ambiguous?.has(norm(country)))host.append(node('p','名稱近似但未確認同一地區：'+batch.ambiguous.get(norm(country)).map(c=>'「'+c+'」').join('、')+'。未自動合併；目前僅顯示原名完全相符的紀錄，請核對其他名稱。','note warn'));
    if(rows.some(r=>r.conflict))host.append(node('p','同日、同一地區與疾病出現不同警示等級，以下保留全部依據，不自行裁定有效等級。','note warn'));
    const count=renderGroup(host,rows,prescriptions,country);
    if(!rows.length&&!prescriptions.length)host.append(node('p','沒有目的地特有紀錄，不代表沒有旅遊風險。請核對官方最新資料。'));
    if(batch.globals.length){const section=node('section',undefined,'travel-global');section.append(node('h3','全球警示（與目的地特有疫情分開）'));renderGroup(section,batch.globals,[],country);host.append(section);}
    $('travelAssessmentStatus').textContent=`${country} · ${batch.label} · 疫情資料取得／快照時間 ${batch.fetchedAt} · 目的地相關閱讀 ${count} 項。${batch.prescriptionAt?' 處方箋快照：'+batch.prescriptionAt+'。':''}尚未以左側個人條件逐項判定，非個人接種處方。`;
  }
  function present(){
    const host=$('travelAssessmentCountries');host.replaceChildren();
    const labels=new Map();for(const c of batch.countries){const key=norm(c);if(!labels.has(key))labels.set(key,[]);labels.get(key).push(c);}
    batch.ambiguous=new Map([...labels].filter(([,v])=>v.length>1));
    for(const country of batch.countries){const b=button(country,()=>choose(country));b.dataset.assessmentCountry=country;b.setAttribute('aria-pressed','false');host.append(b);}
    const exact=batch.countries.filter(c=>norm(c)===norm(batch.query));
    if(exact.length===1)choose(exact[0]);
    else {$('travelAssessmentStatus').textContent=`${batch.label} · 取得時間 ${batch.fetchedAt} · ${batch.rows.length} 筆目的地紀錄、${batch.globals.length} 筆全球警示。${batch.countries.length?'請選擇實際目的地，再列出相關項目。':'未找到目的地特有紀錄；不代表沒有疫情。'}${batch.ambiguous.size?' 名稱近似但未確認同一地區，未自動合併；請核對各個原始國名。':''}`;
      if(batch.globals.length){const p=node('div',undefined,'card');p.append(node('h3','本次全球警示（尚未套用到個別旅客）'));batch.globals.forEach(r=>p.append(why(r)));$('travelAssessmentCards').append(p);}}
  }
  function receive(data,mode){
    clear();const checked=validate(data);
    const rows=checked.rows.map(r=>({...r,ref:liveEvidence(r,checked)}));
    batch={query:checked.query,label:mode==='proxy'?'B · 代理同次完整搜尋':'A · 即時代查',fetchedAt:checked.fetchedAt,
      rows:rows.filter(r=>!globalName(r.country)),globals:rows.filter(r=>globalName(r.country)),
      countries:[...new Set(rows.filter(r=>!globalName(r.country)).map(r=>r.country))].sort((a,b)=>a.localeCompare(b,'zh-Hant'))};
    present();
  }
  function snapshot(key){
    if(!Object.hasOwn(TRAVEL,key))return;clear();const c=TRAVEL[key];
    const rows=c.a.filter(a=>!a[4]&&!c.isGlobal).map(a=>snapshotRow(a,key));
    const globals=c.isGlobal?c.a.map(a=>snapshotRow(a,key)):(TravelData.current?.global||[]).map(r=>snapshotRow(r.alert,r.key));
    batch={query:c.n,label:'每日快照',fetchedAt:TRAVEL_META.updated,rows,globals,countries:c.isGlobal?[]:[c.n],
      prescriptionAt:TRAVEL_META.provenance?.prescriptions?.fetchedAt||TRAVEL_META.updated,
      prescriptions:c.isGlobal?[]:c.v.map(name=>({name,ref:{csv:['prescriptions'],csvFilter:{countryKey:key,country:c.n,countryEnglish:c.en,vaccine:name}}}))};
    present();
  }
  document.addEventListener('travel:clear',clear);
  document.addEventListener('travel:destination',e=>snapshot(e.detail.key));
  window.TravelAssessment=Object.freeze({clear,receive,validate,choose,groups,get state(){return {selected,mode:batch?.label,countries:batch?.countries.slice()||[],count:batch?.rows.length||0};}});
  clear();
})();
