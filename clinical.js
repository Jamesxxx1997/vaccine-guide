// 疾病臨床分頁（#p-clinical）：疾病選單 → 六面板（公費資格與用藥／檢驗／隔離返班／特殊族群與重症／Q&A／疫苗銜接）。
// 資料來自 review/clinical.js（tools/build_clinical.py 產生），每條陳述的每個 [n] 都是 glyph 定位 claim，點了開原件黃框。
// 新疾病只加資料不改本檔。
(function(){
  const root=document.getElementById('clinicalRoot');
  if(!root||typeof CLINICAL==='undefined')return;
  const PANELS=[['antiviral','公費資格與用藥'],['test','檢驗判讀'],['isolation','隔離・返班・返校'],['special','特殊族群與重症徵兆'],['qa','常見 Q&A'],['vaccine','疫苗銜接']];
  const DISEASE_NAMES={flu:'流感',covid:'COVID-19',hpv:'HPV'};
  const AUTH_LABEL={TFDA:'TFDA 仿單','疾管署':'疾管署',CDC:'美國 CDC',WHO:'WHO',IDSA:'IDSA',ACIP:'ACIP',paper:'文獻','廠商':'原廠說明書',PMDA:'日本 PMDA'};
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e;};
  const bind=(el,claim,quote)=>{if(window.ReferenceUI&&claim){el.dataset.refClaim=claim;el.dataset.refQuote=quote||'';ReferenceUI.bind(el,{claim});}return el;};
  // [1][2][3] 標記：每個 ref 一個，點了開該來源原句；offset 讓同一張議題卡內的編號連續
  function marks(refs,offset=0){
    const wrap=node('span',undefined,'ref-marks');
    refs.forEach((r,i)=>{const a=node('a','['+(offset+i+1)+']','ref-mark');a.href='#';a.title=(srcName(r.source)||r.source)+' 第 '+r.page+' 頁'+(r.note?' · '+r.note:'');a.onclick=e=>e.preventDefault();bind(a,r.claim,r.quote);wrap.append(a,' ');});
    return wrap;
  }
  function quoteLines(refs,offset=0){
    const frag=document.createDocumentFragment();
    refs.forEach((r,i)=>{const q=node('q',r.quote,'adverse-quote');bind(q,r.claim,r.quote);const line=node('p');line.append(node('b','['+(offset+i+1)+'] '),q,' ',node('small','— '+(srcName(r.source)||r.source)+'，第 '+r.page+' 頁'+(r.note?'（'+r.note+'）':''),'sub'));frag.append(line);});
    return frag;
  }
  // 議題卡：同一議題（tags.topic 相同）的多條陳述（中文／英文、疾管署／CDC／WHO）合成一張卡，每行帶機關徽章，[n] 連續編號，原句合併列出
  function topicCard(topic,items){
    const card=node('section',undefined,'card clinical-item clinical-topic');card.dataset.clinicalTopic=topic;card.dataset.clinicalItem=items[0].id;card.dataset.refUi='';
    card.append(node('h4',topic));
    let offset=0;const allRefs=[];
    for(const it of items){
      const line=node('p',undefined,'clinical-summary');line.dataset.clinicalItem=it.id;
      line.append(node('span',AUTH_LABEL[it.authority]||it.authority||'來源','origin-badge'),' ',it.answer||it.summary,' ',marks(it.refs,offset));
      card.append(line);offset+=it.refs.length;allRefs.push(...it.refs);
    }
    const det=node('details',undefined,'clinical-quotes');det.append(node('summary','原句（'+allRefs.length+'）'));det.append(quoteLines(allRefs));card.append(det);
    return card;
  }
  const srcName=id=>{const s=(typeof SRC!=='undefined'&&SRC)||{};return s[id]?s[id].n:'';};
  function itemCard(it){
    const card=node('section',undefined,'card clinical-item');card.dataset.clinicalItem=it.id;card.dataset.refUi='';
    const h=node('h4');h.append(it.type==='qa'&&it.question?it.question:it.label);
    if(it.authority)h.append(' ',node('span',AUTH_LABEL[it.authority]||it.authority,'origin-badge'));
    card.append(h);
    const p=node('p',undefined,'clinical-summary');p.append(it.answer||it.summary,' ',marks(it.refs));card.append(p);
    const det=node('details',undefined,'clinical-quotes');det.append(node('summary','原句（'+it.refs.length+'）'));det.append(quoteLines(it.refs));
    card.append(det);
    return card;
  }
  // ── 抗病毒藥選擇器：規則 item（type=rule，tags.when 條件）依病人輸入評估，每個結論卡都帶原句 [n] ──
  const DRUGS=[['oseltamivir','Oseltamivir（克流感／易剋冒）'],['zanamivir','Zanamivir（瑞樂沙）'],['peramivir','Peramivir（瑞貝塔）'],['baloxavir','Baloxavir（紓伏效）'],['favipiravir','Favipiravir（Avigan，儲備藥）']];
  const VERDICT_CLASS={'可用':'ok','不建議':'warn','不適用':'bad','需審核':'warn','儲備藥':'bad','注意':'warn'};
  function matches(when,p){
    if(!when)return true;
    const n=v=>(v===''||v===null||v===undefined)?null:Number(v);
    const age=n(p.age),wt=n(p.weight),crcl=n(p.crcl),hrs=n(p.hours);
    if(when.ageMin!==undefined&&(age===null||age<when.ageMin))return false;
    if(when.ageMax!==undefined&&(age===null||age>when.ageMax))return false;
    if(when.weightMin!==undefined&&(wt===null||wt<when.weightMin))return false;
    if(when.weightMax!==undefined&&(wt===null||wt>when.weightMax))return false;
    if(when.pregnant!==undefined&&(p.pregnant==='yes')!==when.pregnant)return false;
    if(when.crclMax!==undefined&&(crcl===null||crcl>when.crclMax))return false;
    if(when.crclMin!==undefined&&(crcl===null||crcl<when.crclMin))return false;
    if(when.hoursMax!==undefined&&(hrs===null||hrs>when.hoursMax))return false;
    if(when.hoursMin!==undefined&&(hrs===null||hrs<when.hoursMin))return false;
    if(when.setting!==undefined&&p.setting!==when.setting)return false;
    if(when.purpose!==undefined&&p.purpose!==when.purpose)return false;
    if(when.highRisk!==undefined&&(p.highRisk==='yes')!==when.highRisk)return false;
    return true;
  }
  function selector(disease){
    const rules=Object.values(disease.panels).flat().filter(it=>it.type==='rule'&&it.tags&&it.tags.drug&&it.tags.verdict);   // 只收有 verdict 的規則；政策條目雖帶 drug 標籤但不是規則
    const box=node('section',undefined,'card clinical-selector');box.dataset.refUi='';
    box.append(node('h3','抗病毒藥選擇器'),node('p','輸入病人條件，每個藥給「可用／不建議／不適用／需審核」，每條結論都是仿單或指引原句，點 [n] 開原件。公費資格另見下方「公費用藥資格」。','sub'));
    if(!rules.length){box.append(node('p','規則資料尚未收錄。','sub'));return box;}
    const form=node('form',undefined,'clinical-form');form.onsubmit=e=>e.preventDefault();
    const field=(name,label,input)=>{const l=node('label');l.append(label+' ');input.name=name;l.append(input);form.append(l,' ');return input;};
    const num=(ph)=>{const i=node('input');i.type='number';i.placeholder=ph;i.style.width='6em';return i;};
    const sel=(opts)=>{const s=node('select');for(const [v,t] of opts){const o=node('option',t);o.value=v;s.append(o);}return s;};
    field('age','年齡（歲）',num('例 30'));field('weight','體重（kg）',num('例 60'));
    field('pregnant','懷孕',sel([['no','否'],['yes','是']]));field('crcl','CrCl（mL/min）',num('可留空'));
    field('hours','發病至今（小時）',num('例 30'));field('setting','情境',sel([['outpatient','門診'],['inpatient','住院／重症']]));
    field('purpose','目的',sel([['treatment','治療'],['pep','暴露後預防']]));field('highRisk','重症高風險',sel([['no','否'],['yes','是']]));
    const go=node('button','評估');go.type='submit';form.append(go);
    const out=node('div',undefined,'clinical-verdicts');
    form.addEventListener('submit',()=>{
      const p=Object.fromEntries(new FormData(form).entries());out.replaceChildren();if(window.ReferenceUI)ReferenceUI.clear();
      for(const [drug,name] of DRUGS){
        const hits=rules.filter(r=>r.tags.drug===drug&&matches(r.tags.when,p));
        const card=node('div',undefined,'clinical-verdict');card.dataset.drug=drug;
        const order=['不適用','儲備藥','需審核','不建議','注意','可用'];
        const top=hits.map(r=>r.tags.verdict).sort((a,b)=>order.indexOf(a)-order.indexOf(b))[0]||'無對應規則';
        const h=node('h4');h.append(name+'：',node('span',top,'allergy-verdict '+(VERDICT_CLASS[top]||'')));card.append(h);
        if(!hits.length)card.append(node('p','此條件沒有規則命中；請看下方仿單事實。','sub'));
        for(const r of hits){const line=node('p');line.append(node('b',r.tags.verdict+'：'),r.summary,' ',marks(r.refs));card.append(line);}
        out.append(card);
      }
    });
    box.append(form,out);return box;
  }
  function renderPanel(disease,panelId){
    const items=(disease.panels[panelId]||[]).filter(it=>!(panelId==='antiviral'&&it.type==='rule'&&it.tags&&it.tags.drug&&it.tags.verdict));
    const wrap=node('div',undefined,'clinical-panel');wrap.dataset.panel=panelId;
    if(panelId==='antiviral')wrap.append(selector(disease));
    if(!items.length){wrap.append(node('p','此面板尚未收錄內容。','sub'));return wrap;}
    // 同議題（tags.topic）的條目合成一張議題卡：整個面板內跨 group 合併（例：CDC 與 WHO 各在自己的 group），卡放在第一條出現的位置
    const byTopic=new Map();
    for(const it of items){const t=it.tags&&it.tags.topic;if(t){if(!byTopic.has(t))byTopic.set(t,[]);byTopic.get(t).push(it);}}
    const done=new Set();
    // 依 tags.group 分組（分片可給 group 讓同藥／同主題的陳述相鄰）
    const groups=new Map();
    for(const it of items){const g=(it.tags&&it.tags.group)||'';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(it);}
    for(const [g,list] of groups){
      let heading=false;
      for(const it of list){
        const t=it.tags&&it.tags.topic;
        if(t&&byTopic.get(t).length>1){if(done.has(t))continue;done.add(t);if(g&&!heading){wrap.append(node('h3',g));heading=true;}wrap.append(topicCard(t,byTopic.get(t)));}
        else{if(g&&!heading){wrap.append(node('h3',g));heading=true;}wrap.append(itemCard(it));}
      }
    }
    return wrap;
  }
  // ── 站內關鍵字搜尋（不經 LLM）：輸入拆成詞（空白分隔，中文再逐字連續子串），對 問句／標籤／整理句／keywords／tags／group 逐一比對；
  //    命中在問句或 keywords 的權重高；依命中詞數與權重排序；點結果跳到該卡片並閃爍 ──
  const normQ=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');
  function kwSearch(disease,query){
    const terms=String(query||'').trim().split(/[\s,，、/／]+/).map(normQ).filter(t=>t.length>=1);
    if(!terms.length)return [];
    const out=[];
    for(const [pid,list] of Object.entries(disease.panels)){
      for(const it of list){
        const fields=[['q',normQ(it.question)],['k',(it.keywords||[]).map(normQ).join('\u0001')],['l',normQ(it.label)],['s',normQ((it.answer||it.summary))],['g',normQ((it.tags&&it.tags.group)||'')],['t',Object.values(it.tags||{}).filter(v=>typeof v==='string').map(normQ).join('\u0001')]];
        let score=0,hit=[];
        for(const term of terms){let best=0;for(const [f,txt] of fields){if(txt&&txt.includes(term)){const w={q:5,k:5,l:3,g:2,t:2,s:1}[f];if(w>best)best=w;}}if(best){score+=best*term.length;hit.push(term);}}
        if(hit.length===terms.length||(hit.length&&hit.length>=Math.ceil(terms.length*0.6)))out.push({item:it,panel:pid,score:score+hit.length*4,hit});
      }
    }
    return out.sort((a,b)=>b.score-a.score);
  }
  function searchBox(disease){
    const box=node('div',undefined,'clinical-search');
    const input=node('input');input.type='search';input.placeholder='關鍵字搜尋（例：快篩陰性 克流感、家人確診 預防、請假幾天、孕婦、洗腎）';input.setAttribute('aria-label','疾病臨床關鍵字搜尋');
    const results=node('div',undefined,'clinical-search-results');
    const chips=node('div',undefined,'clinical-chips');
    const qas=Object.values(disease.panels).flat().filter(it=>it.type==='qa'&&it.question);
    for(const it of qas.slice(0,12)){const b=node('button',it.question,'chip');b.type='button';b.onclick=()=>{input.value=it.question;run();};chips.append(b);}
    const PANEL_NAME=Object.fromEntries(PANELS);
    function run(){
      const q=input.value;results.replaceChildren();if(!q.trim())return;
      const hits=kwSearch(disease,q).slice(0,20);
      if(!hits.length){results.append(node('p','沒有命中；試試藥名（克流感、紓伏效）、族群（孕婦、洗腎、小孩）或情境（請假、上班、快篩陰性）。','sub'));return;}
      results.append(node('p',`命中 ${hits.length} 條（依關鍵字命中數排序）`,'sub'));
      for(const h of hits){
        const row=node('div',undefined,'clinical-search-row');
        const a=node('a',(h.item.question||h.item.label),'clinical-search-link');a.href='#';
        a.onclick=e=>{e.preventDefault();show(disease.id,h.panel);const el=root.querySelector('[data-clinical-item="'+h.item.id+'"]');if(el){el.scrollIntoView({block:'center'});el.classList.add('hit-flash');setTimeout(()=>el.classList.remove('hit-flash'),1600);}};
        row.append(node('span',PANEL_NAME[h.panel]||h.panel,'origin-badge'),' ',a,node('div',(h.item.answer||h.item.summary).slice(0,90)+'…','sub'),node('small','命中：'+h.hit.join('、'),'sub'));
        results.append(row);
      }
    }
    input.addEventListener('input',run);
    box.append(input,chips,results);return box;
  }
  const diseases=Object.values(CLINICAL.diseases);
  const nav=node('nav',undefined,'clinical-nav');nav.setAttribute('aria-label','疾病');
  const tabs=node('nav',undefined,'clinical-tabs');tabs.setAttribute('aria-label','面板');
  const body=node('div',undefined,'clinical-body');
  const searchWrap=node('div');
  let current={disease:null,panel:'antiviral'};
  function show(diseaseId,panelId){
    const d=CLINICAL.diseases[diseaseId];if(!d)return;current={disease:diseaseId,panel:panelId};
    nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.disease===diseaseId)));
    tabs.replaceChildren();
    for(const [pid,name] of PANELS){const b=node('button',name+'（'+((d.panels[pid]||[]).length)+'）');b.type='button';b.dataset.panel=pid;b.setAttribute('aria-pressed',String(pid===panelId));b.onclick=()=>show(diseaseId,pid);tabs.append(b);}
    if(window.ReferenceUI)ReferenceUI.clear();
    if(searchWrap.dataset.disease!==diseaseId){searchWrap.replaceChildren(searchBox(d));searchWrap.dataset.disease=diseaseId;}
    body.replaceChildren(renderPanel(d,panelId));
    try{history.replaceState(null,'','#clinical/'+diseaseId+'/'+panelId);}catch(e){}
  }
  for(const d of diseases){const b=node('button',DISEASE_NAMES[d.id]||d.id);b.type='button';b.dataset.disease=d.id;b.setAttribute('aria-pressed','false');b.onclick=()=>show(d.id,'antiviral');nav.append(b);}
  root.append(nav,searchWrap,tabs,body);
  const m=/^#clinical\/([a-z0-9-]+)\/([a-z]+)/.exec(location.hash||'');
  if(m&&CLINICAL.diseases[m[1]])show(m[1],PANELS.some(p=>p[0]===m[2])?m[2]:'antiviral');
  else if(diseases.length)show(diseases[0].id,'antiviral');
  window.Clinical=Object.freeze({show,matches,kwSearch:(d,q)=>kwSearch(CLINICAL.diseases[d],q),get current(){return current;},items(diseaseId){const d=CLINICAL.diseases[diseaseId];return d?Object.values(d.panels).flat():[];}});
})();
