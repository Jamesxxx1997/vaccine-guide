/* Source-aware direct click/hover layer. No clinical rules are changed here. */
(() => {
  'use strict';
  const docs = typeof REFERENCE_PAGES === 'undefined' ? {} : REFERENCE_PAGES;
  const claims = typeof REFERENCE_CLAIMS === 'undefined' ? {} : REFERENCE_CLAIMS;
  const geometry = ReferenceGeometry;
  const scopes = ReferenceScopes;
  const esc = exEsc;
  const refs = new WeakMap();
  const norm = t => t.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]/g, '');
  const fileKey = fragment => Object.keys(docs).find(k => docs[k].p.includes(fragment));
  const vaccineFiles = {
    hepb:'B型肝炎疫苗說明',bcg:'卡介苗接種敬告',dtap5:'五合一疫苗',pcv:'成人PCV20',
    flu:'流感疫苗接種須知_公費',mmr:'MMR疫苗說明',var:'水痘疫苗說明',hepa:'A型肝炎疫苗說明',
    jelive:'日本腦炎活性減毒疫苗接種須知',jeinact:'日本腦炎疫苗說明_含不活化',
    tdap:'Td_Tdap',ppv23:'接種須知_PPV23',hpv:'HPV疫苗接種須知',
    shingrix:'帶狀疱疹疫苗說明',rsv:'RSV疫苗說明',rota:'輪狀病毒疫苗說明',
    mcv4:'流行性腦脊髓膜炎_腦膜炎',covid:'COVID19疫苗接種須知_莫德納'
  };
  const childIds = ['hepb','bcg','dtap5','pcv','var','mmr','jelive','flu','hepa','dtapipv'];
  const aliases = {hepb:'B型肝炎',bcg:'卡介苗',dtap5:'五合一',pcv:'肺炎鏈球菌',var:'水痘',
    mmr:'麻疹腮腺炎德國麻疹',jelive:'日本腦炎',flu:'流感',hepa:'A型肝炎',dtapipv:'DTaP-IPV'};
  // S5 114.01: manually checked row boundaries in PDF points, not fuzzy matches.
  const childRows={hepb:[104,132],bcg:[132,160],dtap5:[160,219],pcv:[219,251],
    var:[251,279],mmr:[279,307],jelive:[307,351],flu:[351,378],hepa:[378,407],dtapipv:[407,450]};
  const childFootnotes={bcg:[451,467],jelive:[467,482],flu:[483,514],hepa:[514,561]};
  const adultRows=[[100,121],[121,142],[142,163],[163,184],[184,205],[205,224],[224,269],[269,315],
    [315,339],[339,364],[364,385],[385,406],[406,427],[427,448]];
  const adultNotes=[1,2,3,4,5,6,7,7,8,9,10,11,12,13];
  const adultHash='baecc2b1adabcce924d6c228b876e397d4d019ba871749b97ab5441ab2b9426a';
  const adultById={tdap:0,mmr:1,flu:2,covid:3,hepb:4,hepa:5,pcv:6,ppv23:7,hpv:9,shingrix:10,mcv4:11,rsv:13};
  function identity(id,query){
    if(['shingrix','rsv','covid'].includes(id))return {claim:'class-'+id,query};
    return {sources:['S2'],classId:id,query};
  }
  const childOf=text=>childIds.find(id=>norm(text).includes(norm(aliases[id])))||
    (/DTaP.IPV|Tdap.IPV/.test(text)?'dtapipv':undefined);
  function catchupData(query){
    const id=document.getElementById('cuVax').value,v=CATCHUP.find(v=>v.id===id);
    const done=+document.getElementById('cuDone').value,last=document.getElementById('cuLast')?.value,route=document.getElementById('cuRoute')?.value;
    const index=v?.rows.findIndex(r=>r.done===done&&(!r.last||r.last===last)&&(!r.route||r.route===route));
    return {sources:['S8'],catchupId:id,catchupIndex:index,query,
      note:'此為依輸入條件推算的結果；藍框定位原表對應列，箭頭含義另見備註 1。黃色只標原文字詞，不把推算當成病人紀錄。'};
  }

  function bind(el, data) {
    if (!el || !el.textContent.trim()) return;
    const explicit=el.closest('[data-ref-claim]')?.dataset.refClaim;
    if(explicit && claims[explicit])data={...data,claim:explicit,note:claims[explicit].note};
    if(data.claim&&claims[data.claim])data={...data,note:claims[data.claim].note};
    if(refs.has(el)&&el.id!=='ivOut'&&!el.closest('#cuExtra,#cuDoneWrap')&&!explicit)return;
    refs.set(el, {...data, query:data.query || el.textContent.trim()});
    el.classList.add('ref-target');
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-haspopup', 'dialog');
    el.setAttribute('aria-label', `查來源：${el.textContent.trim().slice(0,150)}`);
  }
  function inline(text, data) {
    const span = document.createElement('span');
    span.textContent = text; bind(span, data); return span;
  }
  function byVax(id) { return fileKey(vaccineFiles[id] || '\u0000'); }
  function vaxSources(id) {
    if(id==='hexa')return ['S9'];
    if(id==='rota')return ['S10','S9',byVax(id)].filter(Boolean);
    if(id==='dtapipv')return ['S5','S3'];
    if(['bcg','dtap5'].includes(id))return [byVax(id),'S5'].filter(Boolean);
    return [byVax(id), childIds.includes(id)?'S5':null, 'S4'].filter(Boolean);
  }
  function fromLinks(el, fallback) {
    const keys = new Set();
    const links=el?[...(el.matches('a')?[el]:[]),...el.querySelectorAll('a')]:[];
    links.forEach(a => {
      for (const [key, doc] of Object.entries(docs)) {
        const href = a.getAttribute('href');
        if (href && (href === doc.p || href === doc.u)) keys.add(key);
      }
    });
    return keys.size ? [...keys] : fallback;
  }
  function wire() {
    observer.disconnect();
    document.querySelectorAll('#conds label').forEach(label=>{
      const id=label.querySelector('input').dataset.c;
      const rules=VAX.flatMap(v=>v.rules.filter(r=>r.c===id).map(r=>({key:exKey(v.id,r.s,r.t),name:v.n})))
        .filter(r=>EXCERPTS[r.key]);
      rules.sort((a,b)=>(EXCERPTS[a.key].status==='verbatim'?-1:0)-(EXCERPTS[b.key].status==='verbatim'?-1:0));
      bind(label.querySelector('span'),{exacts:rules,query:label.textContent,note:'以下列出這項篩檢條件所連結的各疫苗規則。條件名稱為介面摘要；請逐支核對適用範圍。'});
    });
    document.querySelectorAll('[data-ref-claim]').forEach(el=>{
      if(el.tagName==='TR')[...el.cells].forEach(cell=>bind(cell,{}));
      else if(el.tagName!=='SUMMARY')bind(el,{});
    });
    document.querySelectorAll('details > summary').forEach(summary=>{
      if(summary.querySelector('.ref-expand'))return;
      const button=document.createElement('button');button.type='button';button.className='ref-expand';button.textContent='展開／收合';
      button.onclick=e=>{e.preventDefault();e.stopPropagation();summary.parentElement.open=!summary.parentElement.open;};
      summary.append(button);
    });
    // Vaccine fields remain separate targets, including a closed card's tags.
    document.querySelectorAll('#results > .vax').forEach((card, i) => {
      const v = VAX[i]; if (!v) return;
      const name = card.querySelector('.vax-name');
      if (!name.dataset.referenceReady) {
        name.dataset.referenceReady = '1'; name.replaceChildren();
        name.append(inline(v.n, identity(v.id,v.n)));
        const small = document.createElement('small');
        small.append(inline(v.en, identity(v.id,v.n)), ' · ',
          inline(v.fund, {sources:v.id==='rota'?['S10']:
            [...vaxSources(v.id)].sort((a,b)=>(a==='S5'?-1:b==='S5'?1:0)),
            childRow:v.id,adultNote:adultNotes[adultById[v.id]],query:v.n+' 公費 自費 接種對象', note:'公費標籤是摘要，並不代表所有年齡或身分都符合給付。請核對來源版本及適用對象。'}));
        name.append(small);
      }
      bind(card.querySelector('.vax-head > .pill'), {sources:
        ['shingrix','rsv','covid'].includes(v.id)?[byVax(v.id),'S4'].filter(Boolean):['S2'],
        claim:['shingrix','rsv','covid'].includes(v.id)?'class-'+v.id:undefined,
        classification:v.type,classId:v.id,query:(aliases[v.id]||v.n)+' '+(v.type==='live'?'活性減毒':'不活化'),
        note:'分類標籤請對照原表或製劑說明；本頁「不活化」亦包含非活性製劑的整理歸類。'});
      card.querySelectorAll('.hit').forEach(hit => {
        const book = hit.querySelector('.exq');
        if (book) bind(hit.querySelector('.hit-txt'), {exact:book.dataset.ex});
        else if (hit.textContent.includes('建議時程：')) bind(hit.querySelector('.hit-txt'), {
          sources:vaxSources(v.id),childRow:v.id,purpose:'schedule', query:v.n+' 接種時程 '+v.sched,
          note:'時程可能綜合兒童、成人及不同製劑；各來源分開列出，請按適用族群核對。'});
        else if (v.id==='hpv'&&hit===card.querySelector('.vax-body > .hit:last-child'))bind(hit.querySelector('.hit-txt'),hpvPolicy());
        else if (v.extra && hit===card.querySelector('.vax-body > .hit:last-child')) bind(hit.querySelector('.hit-txt'),
          {sources:[...new Set([...v.extra.matchAll(/S\d+N?/g)].map(m=>m[0]))].filter(k=>docs[k]),
            adultNote:adultNotes[adultById[v.id]],query:hit.textContent,
            note:'此段包含產品、許可證或整理說明；PDF 與仿單文字來源分開列出。'});
      });
    });
    document.querySelectorAll('.exq').forEach(book => {
      bind(book, {exact:book.dataset.ex});
      if (book.closest('#contraTbl')) bind(book.closest('li'), {exact:book.dataset.ex});
    });
    document.querySelectorAll('.ref-extra-vax').forEach(el=>bind(el,{sources:[el.dataset.source]}));
    document.querySelectorAll('#contraTbl tr').forEach((tr,i) =>
      bind(tr.cells[0], identity(VAX[i].id,VAX[i].n)));
    document.querySelectorAll('#childTbl tr').forEach((tr,i) => {
      [...tr.cells].forEach(td=>bind(td,{sources:['S5'],query:tr.textContent,
        childRow:childIds[i],anchor:aliases[childIds[i]], note:'上方為同一頁的年齡欄標頭，下方為該疫苗列；兩塊是分開裁出的來源影像。'}));
    });
    document.querySelectorAll('#p-child > .note').forEach(el=>bind(el,{sources:['S10']}));
    document.querySelectorAll('#p-child > .card li, #cOut li').forEach(el=>bind(el,{sources:['S5'],childRow:childOf(el.textContent),query:el.textContent}));
    document.querySelectorAll('#adultList > .vax').forEach((card,i)=>{
      const v=ADULT[i]; if(!v) return;
      bind(card.querySelector('.vax-name'),{sources:[v.s],query:v.n,adultRow:i});
      bind(card.querySelector('.adv-brief'),{sources:[v.s],query:v.brief,adultRow:i,adultNote:adultNotes[i],adultBrief:true});
      if(v.sero)bind(card.querySelector('.vax-head > .pill'),{sources:[v.sero.s],
        adultNote:adultNotes[i],sero:true,query:v.sero.s==='S6'?'B型肝炎表面抗體陰性':'判斷為具麻疹及德國麻疹免疫力條件'});
      card.querySelectorAll('.vax-body li,.vax-body p').forEach(el=>{
        const sero=el.closest('.sero');
        const explicit=[...el.textContent.matchAll(/〔(S\d+)〕/g)].map(m=>m[1]);
        bind(el,{sources:explicit.length?explicit:[sero&&v.sero?v.sero.s:v.s],
          adultNote:adultNotes[i],sero:!!sero,query:el.textContent});
      });
    });
    document.querySelectorAll('#p-interval tbody tr').forEach(tr=>{
      let sources=tr.closest('#minAgeTbl')?['S3']:['S2'];
      if(tr.textContent.includes('Shingrix')) sources=['S4'];
      if(tr.textContent.includes('COVID-19')) sources=['S12'];
      const note=/編者判斷|自行歸類/.test(tr.textContent)?'此處含編者歸類，並非官方原文斷言；相關文件僅供核對。':undefined;
      [...tr.cells].forEach((el,col)=>bind(el,{sources,query:tr.textContent,note,
        minRow:tr.closest('#minAgeTbl')?[...tr.parentElement.children].indexOf(tr):undefined,minCol:col,
        intervalRow:tr.closest('table').tHead?.textContent.includes('組合')?[...tr.parentElement.children].indexOf(tr):undefined,
        bloodRow:tr.closest('table').tHead?.textContent.includes('曾接受的血液製劑')?[...tr.parentElement.children].indexOf(tr):undefined}));
    });
    [...document.querySelectorAll('#p-interval > details')].slice(0,2).forEach((fold,i)=>
      fold.querySelectorAll('li').forEach((el,j)=>bind(el,{sources:['S2'],classId:(i?scopes.inact:scopes.live)[j],query:el.textContent})));
    document.querySelectorAll('#p-interval .fold-body li,#p-interval .note,#p-interval > .sub').forEach(el=>bind(el,contextFor(el)));
    const iv=document.getElementById('ivOut');
    if(iv.querySelector('.src')){
      const a=IV_LIST[document.getElementById('ivA').value],b=IV_LIST[document.getElementById('ivB').value];
      const pair=[a?.id,b?.id].sort().join('|');
      const intervalRow=pair==='opv|rota'?4:a?.type==='inact'&&b?.type==='inact'?0:a?.type!==b?.type?2:
        [a?.id,b?.id].includes('bcg')?7:a?.oral||b?.oral?8:[a?.id,b?.id].includes('yf')?5:3;
      bind(iv,{sources:fromLinks(iv,['S2']),intervalRow,query:iv.textContent});
    } else bind(iv,{external:{n:'間隔檢查操作提示',text:iv.textContent,textLabel:'操作提示（非來源引文）'},query:iv.textContent});
    document.querySelectorAll('#p-catchup tbody tr').forEach((tr,i)=>[...tr.cells].forEach(el=>bind(el,{sources:['S8'],symbol:i,query:tr.textContent})));
    document.querySelectorAll('#p-catchup > .card p,#p-catchup > .card li,#cuOut .note,#cuOut li,#cuOut .seq,#cuOut .iv-out').forEach(el=>
      bind(el,el.closest('#cuOut')?catchupData(el.textContent):{sources:fromLinks(el.closest('.card'),['S8']),query:el.textContent}));
    document.querySelectorAll('#riskOut .hit-txt,#riskOut li').forEach(el=>bind(el,{
      sources:fromLinks(el.closest('.vax,.card'),['S4']),adultNote:riskNote(el.closest('.vax')?.querySelector('.vax-name')?.textContent),query:el.textContent,
      note:'風險篩選為本頁依條件整理，請用來源核對適用對象。'}));
    document.querySelectorAll('#srcTbl tr').forEach(tr=>{
      const key=tr.cells[0]?.textContent.trim();
      if(docs[key]) [...tr.cells].forEach(el=>bind(el,{sources:[key],sourceTitle:true,query:docs[key].n}));
    });
    document.querySelectorAll('.vax-head .chev').forEach(el=>{
      if(el.dataset.referenceReady)return;
      el.dataset.referenceReady='1';
      const button=document.createElement('button'); button.type='button';button.className='ref-expand';
      button.setAttribute('aria-label','展開或收合疫苗內容');button.textContent='展開／收合';
      // Existing card handlers still perform the toggle; reference clicks are captured earlier.
      el.replaceChildren(button);
    });
    wireRemainingText();
    document.querySelectorAll('#cuExtra .ref-target,#cuDoneWrap .ref-target').forEach(el=>bind(el,catchupData(el.textContent)));
    document.querySelectorAll('#tvOut [data-ref-disease]').forEach(el=>{
      if(el.querySelector('.ref-csv-warning'))return;
      const data=contextFor(el),item=evidence(data)[0];
      if(item?.table&&!ReferenceTables.select(item.table,item.filter).length){
        const warning=document.createElement('p');warning.className='ref-csv-warning';
        warning.append(inline('來源一致性警告：本筆摘要未找到相同目的地／日期／等級的 CSV 紀錄；請勿據此判定旅遊警示，點此核對原始資料。',data));el.append(warning);
      }
    });
    document.querySelectorAll('.panel').forEach(el=>observer.observe(el,{childList:true,subtree:true}));
  }
  function hpvPolicy(){return {external:{n:'國民健康署 HPV 公費接種公告',v:'查核 2026-09-06',p:'',
    u:'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4878&pid=19321',textLabel:'國健署官方網頁（非 PDF）',
    text:'國民健康署於官方公告說明，自 114 年 9 月起，公費 HPV 疫苗擴大至 113 年入學的全體國中生（包含男女），採校園集中接種方式。此為公告內容摘要，不是逐字 PDF 引文；各年度資格與補接種期限應以國健署當年度規定為準。'}};}
  function riskNote(text=''){
    return /流感/.test(text)?3:/B.*肝/.test(text)?5:/A.*肝/.test(text)?6:/肺炎/.test(text)?7:
      /帶狀/.test(text)?10:/RSV/.test(text)?13:/HPV/.test(text)?9:/Tdap/.test(text)?1:/M.*痘|Mpox/.test(text)?12:/腦脊/.test(text)?11:undefined;
  }
  function contextFor(el) {
    const claim=el.closest('[data-ref-claim]')?.dataset.refClaim;
    if(claim&&claims[claim])return {claim,note:claims[claim].note,query:el.textContent};
    const section=el.closest('.panel');
    const block=el.closest('li,td,p,.note,.hit,.iv-out,h2,h3,legend,label')||el;
    const query=block.textContent.trim();
    if(/HPV|人類乳突/.test(query)&&/國民健康署|國健署/.test(query))return hpvPolicy();
    const linked=fromLinks(el.closest('a')||el.closest('.src'),[]);
    if(linked.length)return {sources:linked,sourceTitle:true,query:linked.map(k=>docs[k].n).join(' ')};
    const computed=el.closest('#cOut,#cuOut,#riskOut,#tally')||/未觸發|無觸發|本工具|本頁|推算|請選擇|輸入/.test(query);
    const note=computed?'此處含介面說明或依輸入推算的結果，並非 PDF 逐字引文；下列來源供核對其基礎規則。':undefined;
    if(section.id==='p-screen') {
      const card=el.closest('#results > .vax');
      const v=card?VAX[[...card.parentElement.children].indexOf(card)]:null;
      if(v)return {sources:[...new Set(v.rules.map(r=>r.s))],query:v.n+' '+query,note};
      return {sources:fromLinks(block,['S1','S2']),query,note};
    }
    if(section.id==='p-child')return {sources:['S5'],query,note};
    if(section.id==='p-adult') {
      if(el.closest('#tvOut,#tvMeta,[data-ref-csv]')){
        const explicit=el.closest('[data-ref-csv]')?.dataset;
        const href=el.closest('a')?.getAttribute('href');
        const key=explicit?.refCsv|| (href===TRAVEL_META.src_alert?'alerts':href===TRAVEL_META.src_presc?'prescriptions':
          el.closest('#tvOut .vax')?'alerts':el.closest('#tvOut .card')?'prescriptions':null);
        return {csv:key?[key]:['alerts','prescriptions'],query,
          csvFilter:{currentCountry:!el.closest('#tvMeta')&&!explicit?.refCountryKey,
            countryKey:explicit?.refCountryKey,country:TRAVEL[explicit?.refCountryKey]?.n,countryEnglish:TRAVEL[explicit?.refCountryKey]?.en,
            disease:explicit?.refDisease,date:explicit?.refDate,
            detail:explicit?.refDetail,level:explicit?.refLevel,vaccine:explicit?.refVaccine}};
      }
      const input=el.closest('label')?.querySelector('input'),id=input?.dataset.i;
      if(id){
        const notes={multi:5,msm:6,sti:12,csw:12,pwid:5,hivpos:11,partner:5,lung:13,cvd:13,liver:6,renal:3,dialysis:5,dm:3,ltcf:13,bmi30:3,major:3,hemo:6,transplant:5,hcw:1,pregplan:1};
        const extra={msm:'男同性戀',hivpos:'人類免疫缺乏病毒感染患者',partner:'同住者或性伴侶為帶原者',renal:'腎臟功能 不全',major:'罕見疾病患者及重大傷病患者'};
        return {sources:['S4'],adultNote:notes[id]||7,query:query+' '+(extra[id]||''),note:'風險條件為介面摘要；高亮來源內的對應用語，請連同該疫苗的適用範圍核對。'};
      }
      if(el.closest('#riskOut'))return {sources:['S4'],adultNote:riskNote(query)||riskNote(el.closest('.vax')?.querySelector('.vax-name')?.textContent),query,note};
      if(/原住民/.test(query))return {sources:['S4'],adultNote:7,query,note};
      const card=el.closest('#adultList > .vax'),i=card?[...card.parentElement.children].indexOf(card):-1;
      if(i>=0)return {sources:el.closest('.sero')?[ADULT[i].sero.s]:['S4'],
        adultNote:adultNotes[i],sero:!!el.closest('.sero'),query,note};
      if(/抗體判讀|anti-HBs/.test(query))return {sources:['S6','S4'],adultNote:2,sero:true,query:'B型肝炎表面抗體陰性 判斷為具麻疹及德國麻疹免疫力條件',note};
      return {sources:fromLinks(el.closest('.vax,.card'),['S4']),query,note};
    }
    if(section.id==='p-interval') {
      let sibling=el;while(sibling&&sibling.parentElement!==section)sibling=sibling.parentElement;
      while(sibling && sibling.tagName!=='H2')sibling=sibling.previousElementSibling;
      const source=sibling?.textContent.includes('最小接種')?'S3':'S2';
      return {sources:[source],query,note};
    }
    if(section.id==='p-catchup')return el.closest('#cuOut,#cuExtra,#cuDoneWrap')?catchupData(query):{sources:fromLinks(el.closest('.card'),['S8']),query,note};
    return {sources:fromLinks(block,['S1','S4']),query,note:note||'此為網站來源／版本說明，並非單一官方逐字引文。'};
  }
  function wireRemainingText() {
    // A final text-node pass covers new calculator output and small labels too.
    // Inputs/selects/navigation remain controls; text in labels checks sources,
    // while the checkbox itself still changes the patient's conditions.
    document.querySelectorAll('.panel').forEach(section=>{
      const walker=document.createTreeWalker(section,NodeFilter.SHOW_TEXT);
      const pending=[];
      while(walker.nextNode()) {
        const node=walker.currentNode,el=node.parentElement;
        if(!norm(node.textContent)||el.closest('.ref-target,button,select,option,input,textarea,script,style,code,[data-ref-ui]'))continue;
        pending.push([node,contextFor(el)]);
      }
      pending.forEach(([node,data])=>node.replaceWith(inline(node.textContent,data)));
    });
  }
  // Matching chooses a context window only. It never upgrades EXCERPTS grades.
  function score(query, text) {
    const q=norm(query), t=norm(text); if(!q||!t)return 0;
    if(t.includes(q)) return 1000+q.length;
    let sum=0;
    for(let n=2;n<=5;n++) {
      const seen=new Set();
      for(let i=0;i<=q.length-n;i++) seen.add(q.slice(i,i+n));
      for(const gram of seen) if(t.includes(gram))sum+=n*n;
    }
    return sum/Math.sqrt(Math.max(25,t.length));
  }
  function locate(doc, data) {
    if(!doc.pages?.length) return null;
    if(doc===docs.S2&&data.classId){
      const view=scopes.classification(data.classId,doc);if(view)return view;
      return {page:doc.pages[0],top:0,height:doc.pages[0].h,rects:[],unlocated:true};
    }
    if(doc===docs.S3&&data.minRow!==undefined){
      const [y0,y1]=scopes.minRows[data.minRow];
      // Label, age and each interval occupy different fixed columns.
      const cols=[[50,278],[400,490],[495,590],[590,690],[690,790]],col=cols[data.minCol||0];
      return scopes.pinned(doc,'S3',1,[col[0],y0,col[1],y1],data.query,{anchorKind:'minimum',anchorId:data.minRow,headerBounds:[50,74,790,107]});
    }
    if(doc===docs.S2&&data.intervalRow!==undefined){
      const locations=[[1,460,104,758,139],[1,460,467,758,512],[1,460,779,758,810],
        [2,185,254,798,304],[2,185,167,538,216],[2,185,359,538,394],null,
        [2,185,136,538,160],[2,185,167,538,216]];
      const loc=locations[data.intervalRow];
      if(loc)return scopes.pinned(doc,'S2',loc[0],loc.slice(1),data.query,{anchorKind:'interval',anchorId:data.intervalRow});
    }
    if(doc===docs.S2&&data.bloodRow!==undefined){
      const rows=[[510,541],[540,582],[581,625],[624,652],[566,582],[651,723],[722,765]];
      const [y0,y1]=rows[data.bloodRow];
      return scopes.pinned(doc,'S2',1,[468,y0,757,y1],data.query,{anchorKind:'blood',anchorId:data.bloodRow});
    }
    if(doc===docs.S8&&data.symbol!==undefined)return scopes.pinned(doc,'S8',1,scopes.symbols[data.symbol],data.query,{anchorKind:'symbol'});
    if(doc===docs.S8&&scopes.catchupRows[data.catchupId]&&!/注意：|原表時程標示/.test(data.query)){
      const row=scopes.catchupRows[data.catchupId],y=scopes.catchupY[data.catchupId]?.[data.catchupIndex];
      const bounds=[35,row[0],810,row[1]],page=doc.pages[0];
      if(doc.sha256===scopes.hashes.S8){
        const focus=y?[[480,y-9,807,y+10]]:[bounds];
        const words=page.words.filter(w=>geometry.inside(w,focus[0]));
        // This is an explicitly reviewed table row, including numeric-only
        // completed/remaining-dose cells. Do not apply this to fuzzy searches.
        return geometry.context(page,y?geometry.merge(words.map(w=>w.slice(0,4))):[],{
          focus,locatedRow:true,anchorKind:'catchup',anchorId:data.catchupId,
          top:Math.max(90,row[0]-35),height:Math.min(page.h-row[0]+35,Math.max(200,row[1]-row[0]+70))});
      }
    }
    if(data.sourceTitle){
      for(const page of doc.pages.slice(0,3)){
        const bounds=[0,0,page.w,Math.min(page.h,220)],rects=geometry.matches(page,data.query,bounds,true);
        if(rects.length)return geometry.context(page,rects,{focus:[bounds],locatedRow:true});
      }
      return geometry.context(doc.pages[0],[],{locatedRow:true});
    }
    if(doc===docs.S5 && doc.sha256==='8822516fd4653f3278cf9503fbd4af3567d7d37e9742450f9e64d9a37d55db75' && childRows[data.childRow]) {
      const [top,bottom]=childRows[data.childRow];
      const page=doc.pages[0],bounds=[20,top,page.w-20,bottom];
      const footnote=childFootnotes[data.childRow];
      const query=data.query.replace(/第\s*([1-4])\s*劑/g,(_,n)=>'第'+['','一','二','三','四'][+n]+'劑');
      const rects=geometry.matches(page,query,bounds,true);
      if(footnote)rects.push(...geometry.matches(page,query,[20,footnote[0],page.w-20,footnote[1]],true));
      return {page,top:top-3,height:bottom-top+6,header:true,footnote,
        rects,focus:[bounds],locatedRow:true};
    }
    let searchScopes=doc.pages.map(page=>({page,bounds:[0,0,page.w,page.h]}));
    if(doc===docs.S4&&doc.sha256===adultHash&&data.adultRow!==undefined) {
      const page=doc.pages[0],[top,bottom]=adultRows[data.adultRow],bounds=[40,top,810,bottom];
      return geometry.context(page,geometry.matches(page,data.query,bounds,true),{focus:[bounds],locatedRow:true});
    }
    if(doc===docs.S4&&doc.sha256===adultHash&&data.adultNote) {
      const heads=doc.pages.slice(1).flatMap(page=>page.lines.filter(l=>/^\s*\d+[、，]/.test(l[4]))
        .map(l=>({page:page.page,y:l[1],id:parseInt(l[4],10)})));
      const start=heads.find(h=>h.id===data.adultNote),end=heads.find(h=>h.id===data.adultNote+1);
      if(start)searchScopes=doc.pages.filter(p=>p.page>=start.page&&(!end||p.page<=end.page)).map(page=>({page,
        bounds:[20,page.page===start.page?(data.sero&&data.adultNote===2?431:start.y-2):20,page.w-20,
          end&&page.page===end.page?end.y-2:page.h-35]})).filter(s=>s.bounds[3]>s.bounds[1]);
    }
    let best={page:doc.pages[0],line:null,value:-1};
    for(const {page,bounds} of searchScopes) for(const line of page.lines.filter(l=>geometry.inside(l,bounds))) {
      let value=score(data.query,line[4]);
      if(data.anchor && norm(line[4]).includes(norm(data.anchor)))value+=10000;
      if(data.purpose==='schedule' && /疫苗說明/.test(doc.n) && norm(line[4]).includes('接種時程'))value+=10000;
      if(value>best.value)best={page,line,value,bounds};
    }
    const page=best.page;
    if(best.value<=0)return {page,top:0,height:page.h,unlocated:true};
    const height=Math.min(page.h, page.w>page.h?220:280);
    const top=best.line?Math.max(0,Math.min(page.h-height,(best.line[1]+best.line[3])/2-height/2)):0;
    const bounds=[best.bounds[0],Math.max(best.bounds[1],top),best.bounds[2],Math.min(best.bounds[3],top+height)];
    const rects=geometry.matches(page,data.query,bounds,!!data.adultNote);
    return {page,top,height,rects,focus:rects.length?rects:[best.line.slice(0,4)]};
  }
  function overlay(rects,page,top=0,height=page.h,cls='ref-highlight') {
    return (rects||[]).map(r=>`<i class="${cls}" style="left:${r[0]/page.w*100}%;top:${(r[1]-top)/height*100}%;width:${(r[2]-r[0])/page.w*100}%;height:${(r[3]-r[1])/height*100}%"></i>`).join('');
  }
  function overviewHtml(view) {
    return `<div class="ref-overview"><span class="ref-page-image" style="aspect-ratio:${view.page.w}/${view.page.h}"><img src="${esc(view.page.img)}" alt="完整 PDF 第 ${view.page.page} 頁定位圖">${overlay(view.rects,view.page)}${overlay([[0,view.top,view.page.w,view.top+view.height]],view.page,0,view.page.h,'ref-location')}</span><div class="ref-meta">整頁位置 · 藍框為下方摘錄區域</div></div>`;
  }
  function fullPageHtml(view) {
    return `<div class="ref-full ref-page-image" style="aspect-ratio:${view.page.w}/${view.page.h}"><img src="${esc(view.page.img)}" alt="來源 PDF 完整第 ${view.page.page} 頁">${overlay(view.rects,view.page)}</div>`;
  }
  function viewLabel(view) {
    return view.verified?'原文片段已定位（網頁可能為整理／譯文）':view.grade?EX_STATUS[view.grade]?.[0]:
      view.rects?.length?'匹配原文字詞（非整句逐字核對）':view.locatedRow?'相關欄列定位（非逐字引文）':'相關來源區域（未找到可高亮片段）';
  }
  function cropHtml(view) {
    const {page,top,height}=view;
    const crop=(y,h)=>`<span class="ref-crop" style="aspect-ratio:${page.w}/${h}"><img src="${esc(page.img)}" width="${page.iw}" height="${page.ih}" style="top:-${y/h*100}%" alt="來源 PDF 第 ${page.page} 頁區域">${overlay(view.rects,page,y,h)}${view.locatedRow?overlay(view.focus,page,y,h,'ref-row-location'):''}</span>`;
    return (view.unlocated?'<div class="note">未能定位這段文字；以下僅顯示來源頁面，並非已找到原句。</div>':'')+
      (view.header?'<div class="ref-meta">同頁年齡欄標頭</div>'+crop(65,41)+'<div class="ref-meta">該疫苗列</div>':view.headerBounds?'<div class="ref-meta">同頁欄位標頭</div>'+crop(view.headerBounds[1],view.headerBounds[3]-view.headerBounds[1]):'')+crop(top,height)+
      (view.footnote?'<div class="ref-meta">同頁相關附註</div>'+crop(view.footnote[0],view.footnote[1]-view.footnote[0]):'');
  }
  function textExcerpt(doc, query) {
    if(!doc.text)return '';
    if(doc.text.length<1800)return doc.text;
    const parts=doc.text.split(/\n(?=## )/);
    return parts.sort((a,b)=>score(query,b)-score(query,a))[0].slice(0,7000);
  }
  function evidence(data) {
    if(data.exacts)return data.exacts.flatMap(entry=>evidence({exact:entry.key})).map((item,i)=>({...item,label:data.exacts[i].name+' · 對應篩檢規則'}));
    if(data.csv){
      const filter={...data.csvFilter};
      if(filter.currentCountry){filter.countryKey=document.getElementById('tvCountry').value;filter.country=TRAVEL[filter.countryKey]?.n;filter.countryEnglish=TRAVEL[filter.countryKey]?.en;}
      return data.csv.map(key=>({table:ReferenceTables.get(key),filter})).filter(item=>item.table)
        .map(item=>({...item,doc:item.table,view:null}));
    }
    if(data.adultBrief){
      const row=locate(docs.S4,{...data,adultNote:undefined}),note=locate(docs.S4,{...data,adultRow:undefined});
      const items=[{doc:docs.S4,view:note,label:'同疫苗附註：劑次、間隔與適用對象'},{doc:docs.S4,view:row,label:'成人時程表：年齡欄列'}];
      return /個月|週/.test(data.query)?items:items.reverse();
    }
    if(data.claim&&claims[data.claim])return claims[data.claim].items.map(item=>{
      const doc=docs[item.source];
      if(!doc)return null;
      const page=doc.pages?.find(p=>p.page===item.page);
      return {doc,label:item.label,note:item.note,view:page&&doc.sha256===item.sha256?
        geometry.context(page,geometry.merge(item.rects),{verified:true}):null};
    }).filter(Boolean);
    if(data.external)return [{doc:data.external,view:null}];
    if(data.exact && typeof EXCERPTS!=='undefined') {
      const e=EXCERPTS[data.exact];
      if(e?.type==='pdf'){
        const doc=Object.values(docs).find(d=>d.p===e.file);
        return [{exact:e,doc,view:geometry.legacy(doc,e)}];
      }
      if(e)return [{doc:docs[e.src]||{n:e.label,p:e.path},view:null}];
    }
    return [...new Set(data.sources||[])].filter(k=>docs[k]).map(k=>({doc:docs[k],view:locate(docs[k],data)}));
  }
  const tip=document.createElement('div');tip.id='reference-tip';tip.hidden=true;tip.role='tooltip';document.body.append(tip);
  const panel=document.createElement('aside');panel.id='reference-panel';panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','reference-title');document.body.append(panel);
  let hoverTimer, hideTimer, opener, activeTarget, restoringFocus=false;
  const clearTip=()=>{clearTimeout(hoverTimer);clearTimeout(hideTimer);tip.hidden=true;activeTarget=null;};
  function showTip(target) {
    const data=refs.get(target);if(!data)return;
    const item=evidence(data)[0];if(!item)return;
    activeTarget=target;
    tip.innerHTML=item.table?'<div class="ref-csv-mount"></div>':item.view?`<div class="ref-preview">${overviewHtml(item.view)}<div class="ref-preview-context">${cropHtml(item.view)}</div></div><div class="ref-meta">${esc(item.label||item.doc.n)} · 第 ${item.view.page.page} 頁 · ${esc(viewLabel(item.view))}</div>`:
      item.exact?exImgHtml(item.exact,Math.min(460,item.exact.iw*72/(item.exact.dpi||150)))+`<div class="ref-meta">${esc(EX_STATUS[item.exact.status]?.[0]||'原文')} · 第 ${item.exact.page} 頁</div>`:
      `<span class="ref-label">${esc(item.doc.textLabel||'網頁／文字來源，無 PDF 縮圖')}</span><div class="ref-text">${esc(textExcerpt(item.doc,data.query).slice(0,650)||'此項沒有本機原文摘錄；點擊查看來源連結。')}</div>`;
    tip.innerHTML+='<div class="ref-meta">點文字固定於右側查閱 · Esc 關閉預覽</div>';
    if(item.table)ReferenceTables.mount(tip.querySelector('.ref-csv-mount'),item.table,item.filter,{compact:true});
    tip.setAttribute('role',item.table?'dialog':'tooltip');
    tip.hidden=false;positionTip(target);
  }
  function positionTip(target) {
    tip.style.maxHeight='';
    const r=target.getBoundingClientRect(), w=tip.offsetWidth,h=tip.offsetHeight;
    tip.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+'px';
    const below=Math.max(0,innerHeight-12-r.bottom-10),above=Math.max(0,r.top-10-12);
    const useBelow=below>=h||below>=above,space=useBelow?below:above;
    // A tall CSV preview must not cover its own click target. If the target
    // occupies the entire viewport, keep click/Enter available instead.
    if(space<60){tip.hidden=true;return;}
    const height=Math.min(h,space);tip.style.maxHeight=height+'px';
    tip.style.top=(useBelow?r.bottom+10:r.top-height-10)+'px';
  }
  function closePanel(restore=true) {
    panel.hidden=true;document.body.classList.remove('reference-open');clearTip();
    document.querySelectorAll('.ref-selected').forEach(el=>el.classList.remove('ref-selected'));
    restoringFocus=true;if(restore&&opener?.isConnected)opener.focus({preventScroll:true});restoringFocus=false;
  }
  function openPanel(target) {
    const data=refs.get(target);if(!data)return;
    clearTip();exPanelClose();exTipHide();opener=target;
    document.querySelectorAll('.ref-selected').forEach(el=>el.classList.remove('ref-selected'));
    target.classList.add('ref-selected');
    const items=evidence(data);
    panel.innerHTML=`<div class="ref-panel-head"><h2 id="reference-title">來源原文對照</h2><button type="button" data-ref-close aria-label="關閉來源側欄">✕</button></div><div class="ref-panel-body"><blockquote class="ref-query">${esc(target.textContent.replace('📖','').trim()||data.query)}</blockquote>${data.note?`<div class="note">${esc(data.note)}</div>`:''}${!items.length?'<div class="note">此項尚無可載入的來源資料；請從「來源與版本」檢查原始文件。</div>':''}${items.map((item,i)=>{
      if(item.table)return `<section class="ref-evidence ref-csv-mount" data-csv-item="${i}"></section>`;
      if(item.exact&&!item.view){const e=item.exact;return `<section class="ref-evidence"><span class="ref-label">${esc(EX_STATUS[e.status]?.[0]||'原文')}</span>${exImgHtml(e,Math.min(600,e.iw*72/(e.dpi||150)))}<p class="ref-meta">原始裁圖；未建立整頁座標。第 ${e.page} 頁</p><a href="${esc(e.file)}#page=${e.page}" target="_blank" rel="noopener">開啟完整 PDF</a></section>`;}
      const {doc,view}=item;
      return `<section class="ref-evidence" data-item="${i}"><span class="ref-label">${esc(view?viewLabel(view):doc.textLabel||'網頁／文字來源')}</span><h3>${esc(item.label||doc.n)}</h3><div class="ref-meta">${esc(doc.n)} · ${esc(doc.v||'')} ${view?' · PDF 第 '+view.page.page+' 頁':''}</div>${item.note?`<div class="note">${esc(item.note)}</div>`:''}${view?`${overviewHtml(view)}<div class="ref-view">${cropHtml(view)}</div><div class="ref-actions"><button type="button" data-ref-full="${i}">查看完整頁面</button><a class="ref-pdf-link" href="${esc(doc.p)}#page=${view.page.page}" target="_blank" rel="noopener">開啟 PDF ↗</a></div><label class="ref-page-nav">來源頁碼 <select data-ref-page="${i}" aria-label="${esc(doc.n)}來源頁碼">${doc.pages.map(p=>`<option value="${p.page}" ${p.page===view.page.page?'selected':''}>第 ${p.page} 頁</option>`).join('')}</select></label><p class="ref-meta">${item.exact?.status==='gist'?'本條為整理／合併句，不畫逐字高亮。':'黃框只標匹配原文字詞，不表示整段整理或推算已獲原文支持；藍色列框僅供定位。'} ${item.exact?.status==='partial'?'未高亮部分並非逐字對應。':''}預設保留原頁寬度與鄰近段落，不放大窄裁圖。</p>`:`<div class="ref-text">${esc(textExcerpt(doc,data.query)||'此來源尚無本機文字摘錄，請開啟原始頁面核對。')}</div><div class="ref-actions">${doc.u?`<a href="${esc(doc.u)}" target="_blank" rel="noopener">開啟官方原始頁面 ↗</a>`:''}${doc.p?`<a href="${esc(doc.p)}" target="_blank" rel="noopener">開啟本機來源存檔 ↗</a>`:''}</div>`}</section>`;
    }).join('')}</div>`;
    panel.hidden=false;document.body.classList.add('reference-open');
    panel.querySelectorAll('[data-csv-item]').forEach(el=>{
      const item=items[+el.dataset.csvItem];ReferenceTables.mount(el,item.table,item.filter);
    });
    panel.querySelector('[data-ref-close]').onclick=closePanel;
    panel.querySelector('[data-ref-close]').focus({preventScroll:true});
    panel.querySelectorAll('.ref-view,.ref-evidence > .exwrap').forEach(view=>{
      const bar=document.createElement('div');bar.className='ref-actions';
      let zoom=1;
      for(const [label,delta] of [['放大 ＋',0.25],['縮小 −',-0.25]]){
        const button=document.createElement('button');button.type='button';button.textContent=label;
        button.onclick=()=>{zoom=Math.min(3,Math.max(1,zoom+delta));view.style.width=zoom*100+'%';};bar.append(button);
      }
      view.before(bar);
    });
    panel.querySelectorAll('[data-ref-full]').forEach(button=>button.onclick=()=>{
      const item=items[+button.dataset.refFull],section=button.closest('.ref-evidence');
      item.full=!item.full;
      section.querySelector('.ref-view').innerHTML=item.full?fullPageHtml(item.view):cropHtml(item.view);
      button.textContent=item.full?'返回摘錄區域':'查看完整頁面';
    });
    panel.querySelectorAll('[data-ref-page]').forEach(select=>select.onchange=()=>{
      const item=items[+select.dataset.refPage],section=select.closest('.ref-evidence');
      item.view.page=item.doc.pages.find(p=>p.page===+select.value);item.view.top=0;item.view.height=item.view.page.h;item.full=true;
      item.view.rects=[];item.view.focus=[];
      section.querySelector('.ref-label').textContent='手動翻頁・未套用原句高亮';
      section.querySelector('.ref-meta').textContent=item.doc.n+' · '+(item.doc.v||'')+' · PDF 第 '+select.value+' 頁';
      section.querySelector('.ref-view').innerHTML=fullPageHtml(item.view);
      section.querySelector('.ref-overview').outerHTML=overviewHtml(item.view);
      section.querySelector('.ref-pdf-link').href=item.doc.p+'#page='+select.value;
      section.querySelector('[data-ref-full]').hidden=true;
    });
  }
  const targetOf=e=>e.target instanceof Element?e.target.closest('.ref-target'):null;
  document.addEventListener('mouseover', e=>{
    const target=targetOf(e);if(!target||target.contains(e.relatedTarget))return;
    if(target.closest('.exq'))e.stopImmediatePropagation();
    clearTimeout(hideTimer);clearTimeout(hoverTimer);
    hoverTimer=setTimeout(()=>showTip(target),220);
  },true);
  document.addEventListener('mouseout',e=>{
    const target=targetOf(e);if(!target||target.contains(e.relatedTarget))return;
    if(target.closest('.exq'))e.stopImmediatePropagation();
    clearTimeout(hoverTimer);hideTimer=setTimeout(clearTip,140);
  },true);
  tip.addEventListener('mouseenter',()=>clearTimeout(hideTimer));
  tip.addEventListener('mouseleave',()=>{if(!tip.contains(document.activeElement))clearTip();});
  document.addEventListener('focusin',e=>{const target=targetOf(e);if(target&&panel.hidden&&!restoringFocus)showTip(target);});
  document.addEventListener('focusout',e=>{if(targetOf(e)&&!tip.contains(e.relatedTarget))clearTip();});
  // Capture is essential: otherwise a tag first toggles its parent card.
  document.addEventListener('click',e=>{
    const target=targetOf(e);if(!target||e.metaKey||e.ctrlKey)return;
    e.preventDefault();e.stopImmediatePropagation();openPanel(target);
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){clearTip();if(!panel.hidden){e.preventDefault();closePanel();}return;}
    const target=targetOf(e);
    if(target&&e.key==='ArrowDown'&&refs.get(target)?.csv){
      e.preventDefault();showTip(target);tip.querySelector('select')?.focus();return;
    }
    if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopImmediatePropagation();openPanel(target);}
  },true);
  window.addEventListener('scroll',e=>{if(!tip.contains(e.target))clearTip();},true);window.addEventListener('resize',clearTip);
  const observer=new MutationObserver(()=>{clearTip();if(!panel.hidden)closePanel();wire();});
  wire();
  // Shared presentation entry points; evidence and source grading remain private.
  window.ReferenceUI=Object.freeze({
    bind,
    clear(){clearTip();if(!panel.hidden)closePanel(false);exPanelClose();exTipHide();},
    vaccine(id,query){return {sources:vaxSources(id),childRow:id,purpose:'schedule',query,
      note:'時程可能綜合不同年齡與製劑；請分別核對適用來源。'};},
    vaccineExtra(id,query){return id==='hpv'?hpvPolicy():{sources:[...new Set([...query.matchAll(/S\d+N?/g)].map(m=>m[0]))].filter(k=>docs[k]),
      adultNote:adultNotes[adultById[id]],query,note:'產品限制與整理說明；不同文件分開核對，不視為整句逐字引文。'};},
    adult(index,query,{brief=false,sero=false}={}){const v=ADULT[index];
      const explicit=[...query.matchAll(/〔([^〕]+)〕/g)].flatMap(m=>[...m[1].matchAll(/S\d+N?/g)].map(s=>s[0])).filter(k=>docs[k]);
      return {
      sources:explicit.length?[...new Set(explicit)]:[sero&&v.sero?v.sero.s:v.s],adultNote:adultNotes[index],adultRow:brief?index:undefined,
      adultBrief:brief,sero,query};}
  });
  const help=document.createElement('p');help.className='reference-help';
  help.innerHTML='查來源：<b>點文字</b> → 右側原文；停留 → 整頁定位＋懸浮預覽。黃框＝匹配原文字詞，藍框＝位置；整理句不等於逐字引文。';
  document.getElementById('tabs').after(help);
  document.documentElement.dataset.referenceUi='direct-v1';
})();
