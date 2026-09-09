/* Search the authored registry, not rendered patient results or whole PDFs. */
(() => {
  'use strict';
  // Search-only spelling normalization; never alter source quotes or PDF glyphs.
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/皰/g,'疱').replace(/[\s\p{P}]/gu,'');
  const zosterAliases=['帶狀皰疹','皮蛇','欣剋疹','欣克疹','Shingrix','RZV','shingles','herpes zoster'];
  const extraAliases=v=>v.id==='shingrix'||v.en==='Shingrix'?zosterAliases:[];
  const plain=html=>{const t=document.createElement('template');t.innerHTML=html||'';return t.content.textContent.trim();};
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
  const entries=[];
  for(const g of TRAVEL_GUIDES)entries.push({id:'guide:'+g.id,guide:g.id,title:g.title,category:'旅遊／產品說明',
    aliases:[g.id.replace(/-/g,' '),...g.names,...g.diseases],
    sections:g.sections.map(s=>({label:s.label,text:s.text,ref:{claim:s.claim}}))});
  for(const v of VAX){
    const sections=[{label:'接種時程',text:plain(v.sched),ref:ReferenceUI.vaccine(v.id,v.n+' 接種時程 '+plain(v.sched))}];
    for(const r of v.rules){const key=exKey(v.id,r.s,r.t);sections.push({label:{stop:'接種禁忌',warn:'注意事項／需評估',info:'其他接種說明'}[r.lv]||'接種說明',severity:r.lv,text:plain(r.t),ref:EXCERPTS[key]?{exact:key}:{sources:[r.s],query:plain(r.t),note:'本條尚未建立逐字摘錄；請核對完整來源。'}});}
    const caveat=v.extra?{label:'產品限制與補充說明',text:plain(v.extra),ref:ReferenceUI.vaccineExtra(v.id,plain(v.extra))}:null;
    if(caveat)sections.push(caveat);
    entries.push({id:'vax:'+v.id,title:v.n,category:'接種前篩檢資料',aliases:[v.en,...extraAliases(v)],sections,caveat});
  }
  ADULT.forEach((v,i)=>{
    const section=(text,label='接種說明',options={})=>({label,text:plain(text),ref:ReferenceUI.adult(i,plain(text),options)});
    const notes=(v.notes||[]).map(text=>section(text));
    const sections=[{label:'時程摘要',text:plain(v.brief),ref:ReferenceUI.adult(i,plain(v.brief),{brief:true})},
      ...notes];
    // Keep authored qualifying blocks with a stand-alone search hit. These
    // are references to existing text, not new clinical rules or inferences.
    const context=(s,items)=>{s.context=items.filter(x=>x&&x!==s).map(({label,text,ref})=>({label,text,ref}));};
    const withNotes=(s,indices)=>context(s,indices.map(n=>notes[n]));
    if(v.en==='MMR')withNotes(sections[0],[0]);
    if(v.en==='Influenza')for(const s of notes.slice(1,7))withNotes(s,[1,7]);
    if(v.en==='Hepatitis A')for(const s of [sections[0],notes[1]])withNotes(s,[0]);
    if(v.en==='JE'){withNotes(sections[0],[0,1]);withNotes(notes[2],[1]);}
    if(v.en==='HPV')for(const s of [sections[0],notes[1]])withNotes(s,[0]);
    if(v.en==='Shingrix')for(const s of sections)withNotes(s,[0,1,2,3]);
    if(v.en==='MCV4／MenB'||v.en==='Mpox')for(const s of sections)withNotes(s,[0]);
    if(v.en==='RSV')for(const s of sections)withNotes(s,[0,1,2,3]);
    if(v.pcv){
      const lead=section(PCV_BRIDGE.lead,'公費適用對象與銜接前提');
      const items=PCV_BRIDGE.items.map(text=>section(text,PCV_BRIDGE.h));
      context(sections[0],[lead]);
      for(const s of items)context(s,[lead,...(s===items[3]?[items[4]]:[])]);
      sections.push(lead,...items,...PCV_BRIDGE.ipd.map(text=>({...section(text,'IPD 高風險對象'),context:[lead]})));
    }
    if(v.sero){
      const lead=section(v.sero.lead,v.sero.t,{sero:true});
      const prerequisites=v.en==='Hepatitis B'?[notes[0]]:[];
      context(lead,prerequisites);sections.push(lead);
      for(const text of v.sero.items||[])sections.push({...section(text,v.sero.t,{sero:true}),context:[...prerequisites,lead]});
      for(const branch of v.sero.branch||[]){
        const items=branch.items.map(text=>section(text,v.sero.t+' · '+branch.h,{sero:true}));
        items.forEach((s,j)=>context(s,[...prerequisites,lead,...items.slice(0,j)]));sections.push(...items);
      }
    }
    entries.push({id:'adult:'+i,title:v.n,category:'成人時程',aliases:[v.en,...extraAliases(v)],sections});
  });
  function find(query){
    const terms=String(query||'').trim().split(/\s+/).map(norm).filter(Boolean);if(!terms.length)return [];
    return entries.map(e=>{
      const heading=norm([e.title,...e.aliases].join(' ')),full=heading+norm(e.sections.map(s=>s.label+s.text).join(' '));
      const sectionScore=s=>terms.filter(t=>norm(s.label+s.text).includes(t)).length;
      const matches=e.sections.filter(s=>terms.every(t=>(heading+norm(s.label+s.text)).includes(t)))
        .sort((a,b)=>sectionScore(b)-sectionScore(a));
      return {entry:e,matches,score:terms.every(t=>heading.includes(t))?2:1,hit:terms.every(t=>full.includes(t))};
    }).filter(r=>r.hit).sort((a,b)=>b.score-a.score);
  }
  const root=node('section',undefined,'vaccine-search card');root.id='vaccineSearch';root.dataset.refUi='';root.setAttribute('aria-labelledby','vaccineSearchTitle');
  root.innerHTML='<h2 id="vaccineSearchTitle">疫苗與原文搜尋</h2><form role="search" id="vaccineSearchForm"><label for="vaccineQuery">疫苗、疾病、商品名或接種問題</label><div class="travel-search-row"><input type="search" id="vaccineQuery" maxlength="150" placeholder="例如：霍亂、Dukoral、MMR、B 型肝炎" autocomplete="off" aria-controls="vaccineSearchResults"><button type="submit">查疫苗</button><button type="button" id="vaccineSearchClear">清除</button></div></form><p class="sub">搜尋本站疫苗篩檢資料、成人時程與旅遊／產品說明；不是完整 PDF 全文，也不包含即時疫情或個人條件推算。</p><p id="vaccineSearchStatus" role="status"></p><div id="vaccineSearchResults"></div><div id="vaccineSearchDetail"></div>';
  document.getElementById('p-screen').before(root);
  const input=root.querySelector('input'),results=root.querySelector('#vaccineSearchResults'),status=root.querySelector('#vaccineSearchStatus'),detail=root.querySelector('#vaccineSearchDetail');
  let limit=8;
  function open(entry){
    ReferenceUI.clear();detail.replaceChildren();
    const close=button('收合疫苗說明',()=>{ReferenceUI.clear();detail.replaceChildren();input.focus();});
    if(entry.guide){TravelVaccineGuides.open(entry.guide,null,detail);detail.prepend(close);return;}
    detail.append(close,node('h3',entry.title+' · '+entry.category),node('p','下方沿用本站既有整理文字；點字或停留可核對來源，並非依個人條件判定。','sub'));
    for(const s of entry.sections){detail.append(node('h4',s.label));const p=node('p',s.text,'travel-guide-section');ReferenceUI.bind(p,s.ref);detail.append(p);}
    detail.scrollIntoView?.({block:'start'});
  }
  function draw(){
    ReferenceUI.clear();results.replaceChildren();const found=find(input.value);
    status.textContent=!input.value.trim()?'不必先選目的地，直接輸入疫苗名稱。':found.length?`找到 ${found.length} 組已整理資料；可直接查原文或展開完整說明。`:'本站已整理內容沒有命中；不表示不存在該疫苗或接種建議。';
    for(const r of found.slice(0,limit)){
      const card=node('article',undefined,'vaccine-search-result');card.dataset.searchEntry=r.entry.id;
      card.append(node('small',r.entry.category),node('h3',r.entry.title));
      const s=r.matches[0]||r.entry.sections[0];
      if(s?.context?.length){
        const context=node('div',undefined,'vaccine-search-context');context.append(node('h4','適用前提與同段說明'));
        for(const c of s.context){const p=node('p',c.label+'：'+c.text);ReferenceUI.bind(p,c.ref);context.append(p);}card.append(context);
      }
      if(s){const p=node('p',s.label+'：'+s.text,'vaccine-search-excerpt');ReferenceUI.bind(p,s.ref);card.append(p);}
      if(r.entry.caveat&&s!==r.entry.caveat){const p=node('p',r.entry.caveat.label+'：'+r.entry.caveat.text,'vaccine-search-caveat');ReferenceUI.bind(p,r.entry.caveat.ref);card.append(p);}
      const actions=node('div',undefined,'travel-search-row');
      actions.append(button('展開劑次／禁忌與原文',()=>open(r.entry)));
      if(!r.entry.guide)actions.append(button('前往'+(r.entry.id.startsWith('vax:')?'接種前篩檢':'成人時程')+'原卡片',()=>reveal(r.entry)));
      card.append(actions);
      results.append(card);
    }
    if(found.length>limit)results.append(button('顯示更多疫苗資料',()=>{limit+=8;draw();}));
  }
  input.addEventListener('input',()=>{limit=8;detail.replaceChildren();draw();});
  root.querySelector('form').onsubmit=e=>{e.preventDefault();draw();};
  root.querySelector('#vaccineSearchClear').onclick=()=>{input.value='';detail.replaceChildren();draw();input.focus();};
  // Keep cards in the original DOM order: reference bindings use these indices.
  // Hiding is presentation only; clinical state and tally always include all VAX.
  const filters=[];
  function addListFilter({id,label,list,items,before}){
    const box=node('div',undefined,'card vaccine-list-filter');box.dataset.refUi='';
    const field=node('input');field.type='search';field.id=id;field.autocomplete='off';field.maxLength=100;
    field.placeholder='例如：皰疹、皮蛇、Shingrix';field.setAttribute('aria-controls',list.id);
    const caption=node('label',label);caption.htmlFor=id;
    const row=node('div',undefined,'travel-search-row'),count=node('p',undefined,'sub');count.setAttribute('role','status');
    const refresh=()=>{
      const terms=field.value.trim().split(/\s+/).map(norm).filter(Boolean);
      const cards=[...list.querySelectorAll(':scope > .vax')];let visible=0;
      cards.forEach((card,i)=>{const v=items[i];if(!v)return;
        const heading=norm([v.n,v.en,...extraAliases(v)].join(' '));
        card.hidden=!terms.every(t=>heading.includes(t));if(!card.hidden)visible++;
      });
      count.textContent=`顯示 ${visible}／${items.length} 項。僅篩選疫苗名稱，不改變病人條件或接種判定。`+
        (list.id==='results'?' 下方統計仍涵蓋全部疫苗；列表外未建立篩檢規則的提示會保留。':'')+
        (!visible?' 查無名稱不代表不存在該疫苗；可用上方「疫苗與原文搜尋」查更多已整理內容。':'');
    };
    const clear=button('顯示全部',()=>{field.value='';refresh();field.focus();});
    field.addEventListener('input',()=>{ReferenceUI.clear();refresh();});
    row.append(field,clear);box.append(caption,row,count);before.before(box);
    filters.push({field,list,items,refresh});refresh();
  }
  addListFilter({id:'screenVaccineQuery',label:'在接種前篩檢找疫苗',list:document.getElementById('results'),items:VAX,before:document.getElementById('tally')});
  addListFilter({id:'adultVaccineQuery',label:'在成人時程找疫苗',list:document.getElementById('adultList'),items:ADULT,before:document.getElementById('adultList')});
  function reveal(entry){
    ReferenceUI.clear();const screen=entry.id.startsWith('vax:');
    const filter=filters[screen?0:1],index=screen?VAX.findIndex(v=>'vax:'+v.id===entry.id):Number(entry.id.split(':')[1]);
    const tab=Array.from(document.getElementById('tabs').children)[screen?0:2];tab.click();
    filter.field.value='';filter.refresh();
    const card=filter.list.querySelectorAll(':scope > .vax')[index];if(!card)return;
    card.classList.add('open');card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView?.({block:'center'});
  }
  window.VaccineListFilters=Object.freeze({refresh(){filters.forEach(f=>f.refresh());}});
  window.VaccineSearch=Object.freeze({find,open,get count(){return entries.length;}});
  draw();
})();
