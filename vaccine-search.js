/* Search the authored registry, not rendered patient results or whole PDFs. */
(() => {
  'use strict';
  // Search-only spelling normalization; never alter source quotes or PDF glyphs.
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/皰/g,'疱').replace(/[\s\p{P}]/gu,'');
  const zosterAliases=['帶狀皰疹','皮蛇','欣剋疹','欣克疹','Shingrix','RZV','shingles','herpes zoster'];
  // 民眾常用說法（只影響搜尋命中，不改任何來源文字）
  const covidAliases=['新冠','新冠肺炎','新型冠狀病毒','COVID','COVID-19','SARS-CoV-2','武漢肺炎','莫德納','Moderna','Spikevax','mNEXSPIKE','Novavax','Nuvaxovid','諾瓦瓦克斯','mRNA'];
  const fluAliases=['流感','季節性流感','Influenza','flu'];
  // 每支疫苗的民眾說法／疾病名／商品名（篩檢器 id → 別名；成人時程以 en 對應）。只影響搜尋與名稱篩選，不改來源文字。
  const ALIASES={
    hepb:['B肝','B型肝炎','乙肝','HBV','Hepatitis B'],
    bcg:['卡介苗','結核','BCG'],
    dtap5:['五合一','百日咳','破傷風','白喉','小兒麻痺','b型嗜血桿菌','Hib','DTaP'],
    hexa:['六合一','百日咳','破傷風','白喉','小兒麻痺','B肝','Hexaxim','哈多星'],
    pcv:['肺炎鏈球菌','肺炎疫苗','結合型','PCV','13價','15價','20價'],
    ppv23:['肺炎鏈球菌','肺炎疫苗','23價','多醣體','PPV23','PPSV23'],
    flu:fluAliases,
    mmr:['麻疹','腮腺炎','德國麻疹','MMR'],
    var:['水痘','Varicella'],
    hepa:['A肝','A型肝炎','甲肝','HAV','Hepatitis A'],
    jelive:['日本腦炎','日腦','JE'],jeinact:['日本腦炎','日腦','JE'],
    dtapipv:['四合一','百日咳','破傷風','白喉','小兒麻痺','DTaP-IPV','Tdap-IPV'],
    tdap:['Tdap','三合一','百日咳','破傷風','白喉','減量破傷風'],
    hpv:['HPV','子宮頸癌疫苗','九價','人類乳突病毒','菜花','Gardasil','嘉喜'],
    shingrix:zosterAliases,
    rsv:['RSV','呼吸道融合病毒','細胞融合病毒','Arexvy','Abrysvo','欣剋融','艾沛兒'],
    rota:['輪狀病毒','輪狀','Rotarix','RotaTeq','輪達停','羅特律'],
    mcv4:['腦膜炎雙球菌','流行性腦脊髓膜炎','腦膜炎','MCV4','MenB','Menveo','腦寧安'],
    covid:covidAliases,
  };
  const ADULT_ALIASES={'Tdap':ALIASES.tdap,'MMR':ALIASES.mmr,'Influenza':fluAliases,'COVID-19':covidAliases,'Hepatitis B':ALIASES.hepb,'Hepatitis A':ALIASES.hepa,
    'PCV13／15／20':ALIASES.pcv,'PPV23':ALIASES.ppv23,'JE':ALIASES.jelive,'HPV':ALIASES.hpv,'Shingrix':zosterAliases,'MCV4／MenB':[...ALIASES.mcv4,'B型腦膜炎'],
    'Mpox':['M痘','猴痘','Mpox'],'RSV':ALIASES.rsv};
  const extraAliases=v=>ALIASES[v.id]||ADULT_ALIASES[v.en]||[];
  // 問句裡的病人條件 → 規則文字裡的用詞（挑出該顯示的段落用；不做臨床判定）
  const CONDITION_SYNONYMS=[['孕婦',['懷孕','孕期','有孕','孕婦','懷孕中']],['哺乳',['哺乳','餵母奶','餵奶','母乳','授乳']],
    ['免疫',['免疫不全','免疫功能','化療','免疫抑制','器官移植','免疫低下']],['類固醇',['類固醇']],['過敏',['過敏']],['蛋',['蛋過敏','雞蛋','對蛋']],
    ['發燒',['發燒','感冒','生病','急性']],['HIV',['HIV','愛滋']],['血小板',['血小板','紫斑']],['GBS',['GBS','格林','吉蘭']],['免疫球蛋白',['免疫球蛋白','IVIG','輸血']],
    ['活性減毒',['活性減毒','活疫苗','減毒']],['間隔',['間隔','多久','幾週','幾個月','幾天']]];
  const plain=html=>{const t=document.createElement('template');t.innerHTML=html||'';return t.content.textContent.trim();};
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
  const entries=[];
  for(const g of TRAVEL_GUIDES)entries.push({id:'guide:'+g.id,guide:g.id,title:g.title,category:'旅遊／產品說明',
    aliases:[g.id.replace(/-/g,' '),...g.names,...g.diseases],
    sections:g.sections.map(s=>({label:s.label,text:s.text,ref:{claim:s.claim}}))});
  for(const v of VAX){
    const sections=[{label:'接種時程',text:plain(v.sched),ref:ReferenceUI.vaccine(v.id,v.n+' 接種時程 '+plain(v.sched))}];
    for(const r of v.rules){const key=exKey(v.id,r.s,r.t);sections.push({label:{stop:'接種禁忌',warn:'注意事項／需評估',info:'其他接種說明'}[r.lv]||'接種說明',severity:r.lv,text:plain(r.t),ref:r.claim?{claim:r.claim}:EXCERPTS[key]?{exact:key}:{sources:[r.s],query:plain(r.t),note:'本條尚未建立逐字摘錄；請核對完整來源。'}});}
    const caveat=v.extra?{label:'產品限制與補充說明',text:plain(v.extra),ref:ReferenceUI.vaccineExtra(v.id,plain(v.extra))}:null;
    if(caveat)sections.push(caveat);
    entries.push({id:'vax:'+v.id,title:v.n,category:'接種前篩檢資料',aliases:[v.en,...extraAliases(v)],sections,caveat});
  }
  ADULT.forEach((v,i)=>{
    const section=(text,label='接種說明',options={})=>({label,text:plain(text),ref:ReferenceUI.adult(i,plain(text),options)});
    const notes=(v.notes||[]).map((text,n)=>section(text,'接種說明',{claim:v.noteClaims?.[n]}));
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
  // 感染後接種間隔：把間隔規則分頁的總表（每列已綁 claim，原句可開原件）建成可搜尋條目，
  // 讓「得新冠多久後可以打」「感冒可以打流感疫苗嗎」這類問題找得到。中文整理與原句分開列。
  const POSTINF_KEYWORDS={
    'postinf-general-cdc':['感冒','發燒','生病','急性病','急性','上呼吸道','通則','任何感染','任何疫苗'],
    'postinf-flu-qa':[...fluAliases,'感冒','上呼吸道','得過流感','得流感'],
    'flu-acip-annual-precaution':[...fluAliases,'ACIP','得過流感','得流感'],
    'postinf-covid-qa':[...covidAliases,'確診','得新冠','得過新冠','染疫'],
    'shingrix-prior-episode':[...zosterAliases,'皮蛇復發','復發','發作','長皮蛇','長過皮蛇'],
    'varicella-natural-infection':['水痘','Varicella','長過水痘','得過水痘','出過水痘'],
    'postinf-mpox-qa':['M痘','猴痘','Mpox','mpox','得過M痘'],
  };
  // 時序字眼（感染後多久…）才代表在問「感染後間隔」；「可以打」只是問句，不足以把總表列排到疫苗卡前面
  const POSTINF_TIMING=['感染後','感染','得過','得到','確診後','確診','痊癒','康復','好了','多久','多久後','間隔','之後','幾週','幾個月','幾天','要等'];
  const POSTINF_ASK=['可以打','能打','能不能打','可不可以打','要打嗎','還要打','需要打'];
  const POSTINF_GENERIC=[...POSTINF_TIMING,...POSTINF_ASK];
  const postinfRows=[...document.querySelectorAll('#postinfTbl tbody tr[data-ref-claim]')];
  postinfRows.forEach((tr,i)=>{
    const cells=[...tr.children].map(td=>td.textContent.trim());if(cells.length<4)return;
    const claim=tr.dataset.refClaim,quotes=[...tr.querySelectorAll('q')].map(q=>q.textContent.trim());
    const ref={claim};
    entries.push({id:'postinf:'+i,postinfRow:i,title:cells[0],category:'感染後接種間隔',
      aliases:[...(POSTINF_KEYWORDS[claim]||[]),...POSTINF_GENERIC],
      sections:[{label:'中文整理（本站彙整）',text:cells[1],ref},{label:'原句摘錄（逐字，點字看原件）',text:quotes.join('　'),ref},{label:'出處',text:cells[3],ref}]});
  });
  // 副作用（review/adverse-effects.js）：每個原件表格一個條目，列＝段落（綁 claim 可開原件）
  const ADVERSE_GENERIC=['副作用','不良反應','會不會','會發燒','發燒','紅腫','痠痛','疼痛','腫','頭痛','疲倦','過敏反應','反應','多少','機率','比例','％','%'];
  if(typeof ADVERSE_EFFECTS!=='undefined'&&ADVERSE_EFFECTS?.tables){
    for(const t of ADVERSE_EFFECTS.tables){
      const v=VAX.find(x=>x.id===t.vaccine);
      const sections=t.rows.map(r=>t.kind==='percent'?{label:r.reaction,text:t.columns.map((c,i)=>c+'：'+r.values[i]).join('；'),ref:{claim:r.claim}}
        :t.kind==='freq'?{label:r.label,text:r.text,ref:{claim:r.claim}}:{label:r.label||'說明',text:(r.summary?r.summary+'　原句：':'')+r.text,ref:{claim:r.claim}});
      entries.push({id:'ae:'+t.id,adverse:t,title:t.product+'：'+(t.title||'副作用'),category:'副作用（原件表格）',
        aliases:[...(v?[v.n,v.en,...extraAliases(v)]:[t.vaccine]),...t.rows.map(r=>r.reaction||r.label||'').filter(Boolean),...ADVERSE_GENERIC],sections});
    }
  }
  // 過敏與成分：指引判讀（allergy-guidance.js）＋各產品過敏原（review/allergens.js）
  const ALLERGY_GENERIC=['過敏','過敏反應','蛋過敏','雞蛋','明膠','乳膠','酵母','neomycin','抗生素','PEG','polysorbate','皮膚測試','成分','賦形劑','可以打','能打','anaphylaxis'];
  // 疾病臨床（review/clinical.js）：每條陳述一個條目，類別「疾病臨床（流感）」；別名＝標籤、問句、藥名中英、民眾用語
  const CLINICAL_GENERIC=['克流感','瑞樂沙','瑞貝塔','紓伏效','易剋冒','oseltamivir','zanamivir','peramivir','baloxavir','favipiravir','tamiflu','xofluza','relenza','rapiacta','avigan','抗病毒','公費','快篩','PCR','檢驗','隔離','請假','上班','上學','傳染','潛伏期','退燒','孕婦','腎功能','洗腎','小孩','兒童','重症','危險徵兆','通報','疫苗','高劑量','佐劑','兩劑','保護力'];
  if(typeof CLINICAL!=='undefined'&&CLINICAL.diseases){
    const DN={flu:'流感',covid:'COVID-19',hpv:'HPV'};
    for(const d of Object.values(CLINICAL.diseases)){
      const dname=DN[d.id]||d.id;
      for(const [pid,list] of Object.entries(d.panels||{})){
        for(const it of list){
          const sections=it.refs.length?[{label:it.label,text:(it.answer||it.summary)+' '+it.refs.map(r=>r.quote).join(' '),ref:{claim:it.refs[0].claim}}]:[];
          const tagWords=Object.values(it.tags||{}).filter(v=>typeof v==='string');
          entries.push({id:'clinical:'+it.id,clinical:it,disease:d.id,panel:pid,title:(it.question||it.label)+'（'+dname+'）',category:'疾病臨床（'+dname+'）',
            aliases:[dname,dname+'疫苗',it.question||'',...(it.keywords||[]),...tagWords,...(it.tags&&it.tags.group?[it.tags.group]:[]),...CLINICAL_GENERIC].filter(Boolean),sections});
        }
      }
    }
  }
  const vaxAliases=id=>{const v=(typeof VAX!=='undefined'?VAX:[]).find(x=>x.id===id);return v?[v.n,v.en,...extraAliases(v)]:(ALIASES[id]||[]);};
  if(window.AllergyGuidance?.rulesData){
    for(const r of AllergyGuidance.rulesData){
      const quotes=r.claims.flatMap(c=>(typeof REFERENCE_CLAIMS!=='undefined'&&REFERENCE_CLAIMS[c]?.items||[]).flatMap(it=>(it.quotes||[]).map(q=>({q,c}))));
      entries.push({id:'allergy:'+r.id,allergyRule:r.id,title:r.title+'（'+r.verdict+'）',category:'過敏與成分（指引判讀）',
        // 規則提到的疫苗 → 借用該疫苗卡的完整別名（含「流感疫苗」等），否則仿單成分條目會因多命中一個別名而排到判讀前面
        aliases:[...ALLERGY_GENERIC,...(/流感/.test(r.title)?vaxAliases('flu'):[]),...(/MMR/.test(r.title)?vaxAliases('mmr'):[]),...(/黃熱病/.test(r.title)?['黃熱病','黃熱病疫苗','Stamaril']:[]),...(/COVID|mRNA/.test(r.title)?vaxAliases('covid'):[])],
        sections:[{label:'判讀（本站整理）',text:r.text,ref:{claim:r.claims[0]}},...quotes.map(x=>({label:'指引原句',text:x.q,ref:{claim:x.c}}))]});
    }
  }
  if(typeof ALLERGENS!=='undefined'&&ALLERGENS?.products){
    for(const p of ALLERGENS.products){
      const v=VAX.find(x=>x.id===p.vaccine);
      const sections=[...(p.components||[]).map(c=>({label:c.label,text:c.text,ref:{claim:c.claim}})),
        ...(p.allergens||[]).filter(a=>a.claim).map(a=>({label:a.label+'：'+a.status,text:a.text,ref:{claim:a.claim}})),
        ...(p.warnings||[]).map(w=>({label:w.label,text:w.text,ref:{claim:w.claim}}))];
      const originName=({TFDA:'台灣 TFDA',FDA:'美國 FDA',EMA:'歐盟 EMA',MHRA:'英國 MHRA',HPRA:'愛爾蘭 HPRA',TGA:'澳洲 TGA',Medsafe:'紐西蘭 Medsafe',HSA:'新加坡 HSA',HealthCanada:'加拿大 Health Canada'})[p.origin]||'台灣 TFDA';
      if(sections.length)entries.push({id:'allergen:'+p.id,allergenProduct:p.id,title:p.product+'：成分與過敏原（'+originName+' 仿單）',category:'過敏與成分（仿單原句）',
        aliases:[p.product,...(v?[v.n,v.en,...extraAliases(v)]:[]),...ALLERGY_GENERIC,...(p.allergens||[]).filter(a=>a.status==='有').map(a=>a.label)],sections});
    }
  }
  // 關鍵字模式：整句問題不會是任何條目的子字串，改成反向比對「哪些別名出現在問題裡」，
  // 依命中別名總長度排序（疾病名＋「多久」比只有疾病名分數高）。只在逐詞比對沒有結果時啟用。
  function keywordFind(query){
    const q=norm(query);if(q.length<3)return [];
    const usable=a=>a.length>=(/^[\x00-\x7f]+$/.test(a)?3:2);
    // 英文別名只做「整個詞」比對（依非字母數字切詞），避免 "ZZZ-unmatched" 命中 "match"、"between" 命中 "tween"；中文別名維持子字串
    const asciiKey=t=>String(t||'').normalize('NFKC').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ');
    const qTokens=' '+asciiKey(query)+' ';
    const asciiHit=a=>{const k=asciiKey(a);return !!k&&qTokens.includes(' '+k+' ');};
    return entries.map(e=>{
      const hits=[...new Set([e.title,...e.aliases].filter(a=>{const n=norm(a);return usable(n)&&(/^[\x00-\x7f]+$/.test(n)?asciiHit(a):q.includes(n));}).map(norm))];
      const GENERIC_ALL=[...POSTINF_GENERIC,...ADVERSE_GENERIC,...ALLERGY_GENERIC,...(typeof CLINICAL_GENERIC!=='undefined'?CLINICAL_GENERIC:[])].map(norm);
      // 通用詞若正好出現在條目標題裡（例：「PEG」對「PEG／polysorbate 過敏 → mRNA 疫苗」規則），對該條目就是專有詞；
      // 但「過敏」「可以打」這種每條規則標題都有的字不升級，否則所有規則同分
      const BROAD=['過敏','過敏反應','可以打','能打','成分','賦形劑','反應','副作用','不良反應'].map(norm);
      const titleNorm=norm(e.title);
      // 只升級英文成分名（peg、neomycin、polysorbate…）；中文「蛋過敏」「明膠」留在通用詞，否則會蓋過疫苗名的權重
      const specific=hits.filter(h=>!GENERIC_ALL.includes(h)||(!BROAD.includes(h)&&/^[\x00-\x7f]+$/.test(h)&&titleNorm.includes(h)));
      if(!hits.length||(e.postinfRow!==undefined&&!specific.length&&!hits.some(h=>/感染|確診|痊癒|康復|得過/.test(h))))return null;
      // 疾病名（specific）加倍計分；總表列若同時命中疾病名與「多久／可以打」類問句字眼，再加分，
      // 讓「感冒可以打流感疫苗嗎」排在總表列而不是疫苗名稱卡（疫苗名卡仍在結果內）。
      const generic=hits.filter(h=>!specific.includes(h));
      const timing=hits.filter(h=>POSTINF_TIMING.map(norm).includes(h));
      const topical=e.adverse?ADVERSE_GENERIC:(e.allergyRule||e.allergenProduct)?ALLERGY_GENERIC:e.clinical?CLINICAL_GENERIC:[];
      const topicHit=hits.some(h=>topical.map(norm).includes(h));
      const score=hits.reduce((n,h)=>n+h.length*(specific.includes(h)?2:1),0)
        +(e.postinfRow!==undefined?(specific.length&&timing.length?7:1):0)
        +((e.adverse||e.allergyRule||e.clinical)?(specific.length&&topicHit?7:(topicHit?2:0)):0)
        // 仿單成分條目只是「該廠牌含什麼」，判讀（指引規則）與疫苗卡要排在它前面 → 加分減半
        +(e.allergenProduct?(specific.length&&topicHit?3:(topicHit?1:0)):0);
      // 問句提到的病人條件（懷孕、蛋過敏…）→ 優先顯示含該條件用詞的規則段落
      const matchedSyn=CONDITION_SYNONYMS.filter(([,syn])=>syn.some(w=>q.includes(norm(w))));
      const conditions=matchedSyn.map(([canon])=>canon);
      // 段落分數＝含幾個「條件標準詞＋問句實際用字」（例：問「感冒」→ 含「感冒」又含「發燒」的段落 2 分，只含「發燒」的一般發燒句 1 分）
      const condWords=[...new Set(matchedSyn.flatMap(([canon,syn])=>[canon,...syn.filter(w=>q.includes(norm(w)))]).map(norm))];
      const condCount=s=>{const t=norm(s.label+s.text);return condWords.filter(w=>t.includes(w)).length;};
      const byCondition=conditions.length?e.sections.filter(s=>condCount(s)>0)
        .sort((a,b)=>condCount(b)-condCount(a)||(b.severity?1:0)-(a.severity?1:0)):[];   // 同分時規則條文優先於時程摘要
      const byHit=e.sections.filter(s=>hits.some(h=>norm(s.label+s.text).includes(h)));
      const matches=byCondition.length?byCondition:(byHit.length?byHit:e.sections.slice(0,1));
      const condBonus=byCondition.length?10*condCount(byCondition[0]):0;   // 問句有病人條件時，真正含該條件條文的卡片要排在只命中疫苗名的前面
      return {entry:e,matches,score:score+condBonus,hit:true,keywords:[...hits,...conditions.filter(c=>!hits.includes(norm(c)))]};
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
  }
  function find(query){
    const terms=String(query||'').trim().split(/\s+/).map(norm).filter(Boolean);if(!terms.length)return [];
    const exact=findExact(terms);
    return exact.length?exact:keywordFind(query);
  }
  function findExact(terms){
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
    const keywords=found[0]?.keywords;
    status.textContent=!input.value.trim()?'不必先選目的地，直接輸入疫苗名稱或問題（例：得新冠多久後可以打）。':found.length?(keywords?`整句沒有逐字命中，改以問題中的關鍵字比對：${keywords.join('、')}；找到 ${found.length} 組。`:`找到 ${found.length} 組已整理資料；可直接查原文或展開完整說明。`):'本站已整理內容沒有命中；不表示不存在該疫苗或接種建議。';
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
      if(r.entry.postinfRow!==undefined)actions.append(button('前往間隔規則總表',()=>revealPostinf(r.entry)));
      else if(r.entry.adverse)actions.append(button('前往副作用分頁',()=>{ReferenceUI.clear();Array.from(document.getElementById('tabs').children).find(t=>/副作用/.test(t.textContent))?.click();window.AdverseEffects?.show(r.entry.adverse.vaccine);document.getElementById('adverseRoot')?.scrollIntoView?.({block:'start'});}));
      else if(r.entry.clinical)actions.append(button('前往疾病臨床分頁',()=>{ReferenceUI.clear();Array.from(document.getElementById('tabs').children).find(t=>/疾病臨床/.test(t.textContent)).click();if(window.Clinical)Clinical.show(r.entry.disease,r.entry.panel);const el=document.querySelector('[data-clinical-item="'+r.entry.clinical.id+'"]');if(el){el.scrollIntoView({block:'center'});el.classList.add('hit-flash');setTimeout(()=>el.classList.remove('hit-flash'),1600);}}));
      else if(r.entry.allergyRule||r.entry.allergenProduct)actions.append(button('前往過敏與成分分頁',()=>{ReferenceUI.clear();Array.from(document.getElementById('tabs').children).find(t=>/過敏/.test(t.textContent))?.click();const el=r.entry.allergyRule?document.querySelector(`.allergy-rule[data-allergy-rule="${r.entry.allergyRule}"]`):document.querySelector(`#allergenMatrix tr[data-allergy-product="${r.entry.allergenProduct}"]`);el?.scrollIntoView?.({block:'center'});}));
      else if(!r.entry.guide)actions.append(button('前往'+(r.entry.id.startsWith('vax:')?'接種前篩檢':'成人時程')+'原卡片',()=>reveal(r.entry)));
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
  function revealPostinf(entry){
    ReferenceUI.clear();
    const tab=Array.from(document.getElementById('tabs').children).find(t=>/間隔規則/.test(t.textContent));tab?.click();
    const row=postinfRows[entry.postinfRow];if(!row)return;
    row.setAttribute('tabindex','-1');row.focus({preventScroll:true});row.scrollIntoView?.({block:'center'});
  }
  window.VaccineListFilters=Object.freeze({refresh(){filters.forEach(f=>f.refresh());}});
  window.VaccineSearch=Object.freeze({find,open,get count(){return entries.length;}});
  draw();
})();
