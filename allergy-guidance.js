/* 過敏與成分分頁：
   - ALLERGENS（review/allergens.js，由 tools/build_allergens.py 從各仿單分片產生）：每支產品的成分段、10 種過敏原有／無／未載明（有／無各綁仿單原句 claim）、過敏警語
   - ALLERGY_RULES（本檔）：過敏專科／官方指引的「可考慮／不建議」判讀，每條只是中文整理，證據全部是 REFERENCE_CLAIMS 裡的逐字原句（[1][2] 各連其原件）
   本檔不做個人臨床判定；「A 過敏→B 可否」只依仿單已載明成分的交集與指引原句給出分類，決定權在醫師與過敏專科。 */
(() => {
  'use strict';
  const root=document.getElementById('allergyRoot');if(!root)return;
  const claims=(typeof REFERENCE_CLAIMS!=='undefined'&&REFERENCE_CLAIMS)||{};   // reference-pages.js 用頂層 const，不在 window 上
  const data=(typeof ALLERGENS!=='undefined'&&ALLERGENS)||{keys:[],products:[]};
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined&&text!==null)el.textContent=text;if(cls)el.className=cls;return el;};
  const bind=(el,claim,query)=>{if(claim&&window.ReferenceUI)ReferenceUI.bind(el,{claim,query:query||el.textContent});return el;};
  const marks=(ids)=>{const sup=node('sup',undefined,'ref-marks');ids.forEach((c,i)=>{const m=node('a','['+(i+1)+']','ref-mark');m.href='#';m.title=(claims[c]?.items?.[0]?.label)||c;m.onclick=e=>e.preventDefault();bind(m,c,'');sup.append(i?' ':'',m);});return sup;};
  const quotesOf=id=>(claims[id]?.items||[]).flatMap(it=>(it.quotes||[]).map(q=>({q,src:it.source,page:it.page,label:it.label})));
  const srcLabel=key=>{const s=((typeof SRC!=='undefined'&&SRC)||{})[key];return s?`${key}｜${s.n}`:key;};
  const vaccineName=id=>{const v=((typeof VAX!=='undefined'&&VAX)||[]).find(x=>x.id===id);return v?v.n:id;};

  // ── 指引判讀（中文整理＝本站；每條 claims 為逐字原句） ──
  const RULES=[
    {id:'same',title:'對某疫苗曾有嚴重過敏反應 → 同一疫苗再接種？',verdict:'不建議（原則上禁忌）',cls:'no',
     text:'CDC 通則與疾管署都把「對同一疫苗曾有嚴重過敏反應」列為再次接種的禁忌。要突破這個原則，指引的路徑是：先做立即型皮膚測試釐清是否 IgE 媒介與可疑成分，陰性可在監測下常規接種，陽性而仍需接種者可考慮監測下分次漸增給予——這是過敏專科的工作，不是門診當場決定。',
     claims:['alg-cdc-same-vaccine','alg-twcdc-contra','alg-aaaai-skintest','alg-aaaai-skintest-outcome']},
    {id:'shared',title:'對 A 疫苗過敏 → 想打「含相同已載明成分」的 B 疫苗？',verdict:'不建議直接接種；轉介評估後可考慮監測下分次給予',cls:'no',
     text:'CDC 通則：通常應轉介過敏科釐清可疑成分，再決定是否接種相同或含相同成分之其他疫苗。AAAAI 2012：病史與皮膚測試支持 IgE 媒介反應、又需要含相同成分之其他疫苗時，可考慮在監測下分次漸增給予（證據等級 C）。',
     claims:['alg-cdc-referral','alg-aaaai-graded']},
    {id:'none',title:'對 A 疫苗過敏 → 想打「無共同已載明成分」的 B 疫苗？',verdict:'可考慮（在具處置能力的場所接種並留觀）',cls:'ok',
     text:'指引沒有把「對另一支疫苗過敏」列為 B 疫苗的禁忌；但「未載明」不等於「不含」，仿單成分表只列主要賦形劑。疾管署要求接種場所具備處置 anaphylaxis 的人員與設備；反應原因未明者仍建議先做皮膚測試找成分。',
     claims:['alg-twcdc-contra','alg-aaaai-skintest']},
    {id:'egg-flu',title:'蛋過敏 → 流感疫苗',verdict:'可接種，不需額外措施',cls:'ok',
     text:'ACIP 2025–26：6 個月以上蛋過敏者都應接種流感疫苗，任何年齡合適的製劑（含雞胚蛋製）皆可；疾管署流感 Q&A 也說雞蛋過敏者可安心照一般流程接種。',
     claims:['alg-acip-egg','flu-egg-allergy-qa']},
    {id:'egg-mmr',title:'蛋過敏 → MMR',verdict:'可接種（蛋過敏非禁忌）',cls:'ok',
     text:'WAO ICON：蛋過敏已不是 MMR 禁忌，接種前不需篩檢；MMR 的過敏性休克多與明膠有關，不是蛋。S1（疾管署禁忌表）另列嚴重蛋過敏者可於門住診由熟悉處理過敏之醫事人員接種並留觀 30 分鐘。',
     claims:['alg-wao-mmr-egg']},
    {id:'egg-yf',title:'蛋過敏 → 黃熱病疫苗',verdict:'依皮膚測試分流（先過敏科）',cls:'warn',
     text:'黃熱病疫苗以雞胚培養、含可測得的卵白蛋白：WAO ICON 引述仿單流程——prick 1:10 陰性再 intradermal 1:100，皆陰性可常規接種，陽性則監測下分次給予。與流感、MMR 不可類推。黃熱病疫苗在台灣為專案進口，無 TFDA 仿單。',
     claims:['alg-wao-yf']},
    {id:'flu-prior',title:'曾對流感疫苗本身嚴重過敏 → 再打流感疫苗？',verdict:'不建議（禁忌）',cls:'no',
     text:'CDC 通則：曾對流感疫苗嚴重過敏者，不論懷疑成分為何，都是未來流感疫苗的禁忌。這與「蛋過敏」是兩回事。',
     claims:['alg-cdc-flu-contra']},
    {id:'gelatin',title:'明膠過敏 → 含明膠疫苗（MMR、水痘等）',verdict:'過敏性休克史：先過敏科評估',cls:'warn',
     text:'CDC 通則：曾對明膠或含明膠製品發生過敏性休克者，接種含明膠疫苗前應由過敏科評估。哪些疫苗含明膠見下方成分矩陣（依仿單原句）。',
     claims:['alg-cdc-gelatin','alg-wao-mmr-egg']},
    {id:'neomycin',title:'Neomycin 過敏 → 含 neomycin 疫苗',verdict:'遲發型（接觸性皮膚炎）：非禁忌；過敏性休克史：先評估',cls:'warn',
     text:'CDC 通則：遲發型 neomycin 反應不是含 neomycin 疫苗的禁忌；立即型過敏極少見，過敏性休克史者接種前應由過敏科評估。',
     claims:['alg-cdc-neomycin']},
    {id:'latex',title:'乳膠過敏 → 含天然乳膠包裝的疫苗',verdict:'依嚴重度分流',cls:'warn',
     text:'CDC 通則：乳膠嚴重過敏性休克史者，盡量避開含天然乳膠瓶塞或針筒的疫苗；只有接觸性過敏者可以接種。哪支產品的針筒／瓶塞含乳膠，看成分矩陣「乳膠」欄的仿單原句。',
     claims:['alg-cdc-latex']},
    {id:'peg',title:'PEG／polysorbate 過敏 → mRNA COVID-19 疫苗',verdict:'確認 PEG 過敏：避開 mRNA，可考慮換平台；不建議用皮膚測試預測',cls:'warn',
     text:'BSACI 2021：確認 PEG 過敏者應避開 mRNA 疫苗；曾耐受含 polysorbate 80 的流感疫苗者可考慮改打不含 PEG 的平台（文件所提 AZ 疫苗已過時，原則仍可參考）。AAAAI 2023 GRADE：對第 1 劑 mRNA 疫苗任何嚴重度立即型過敏者仍可接種後續劑次（強烈建議）；不建議接種前用疫苗或賦形劑測試預測風險，也不建議用 PEG／PS 皮膚測試預測。',
     claims:['alg-bsaci-peg','alg-aaaai2023-rec3','alg-aaaai2023-notest','alg-aaaai2023-peg']},
  ];
  const ruleById=id=>RULES.find(r=>r.id===id);
  const KEY_RULE={egg:null,gelatin:'gelatin',neomycin:'neomycin',other_antibiotics:'neomycin',yeast:null,latex:'latex',peg_polysorbate:'peg',formaldehyde:null,thimerosal:null,aluminium:null};

  function ruleCard(rule,extra){
    const card=node('section',undefined,'card allergy-rule');card.dataset.refUi='';card.dataset.allergyRule=rule.id;
    const h=node('h3');h.append(node('span',rule.verdict,'allergy-verdict '+rule.cls),' ',rule.title);card.append(h);
    const p=node('p',rule.text,'allergy-text');p.append(' ',marks(rule.claims));card.append(p);
    if(extra)card.append(extra);
    const list=node('div',undefined,'allergy-quotes');
    rule.claims.forEach((cid,i)=>{for(const {q,src,page} of quotesOf(cid)){const qq=node('q',q,'adverse-quote');qq.dataset.mark=i+1;bind(qq,cid,q);const meta=node('span',` [${i+1}] ${srcLabel(src)}，第 ${page} 頁`,'sub');const row=node('div');row.append(qq,meta);list.append(row);}});
    card.append(list);return card;
  }

  // ── A 過敏 → B 可否 ──
  const products=data.products||[];
  const keys=data.keys||[];
  function productAllergen(p,key){return (p.allergens||[]).find(a=>a.key===key);}
  function verdictFor(a,b){
    const bProd=products.find(p=>p.id===b);
    const out=node('div',undefined,'allergy-verdict-box');
    if(!bProd){out.append(node('p','請選擇要接種的疫苗（B）。'));return out;}
    if(a.startsWith('product:')){
      const aProd=products.find(p=>p.id===a.slice(8));
      if(aProd.id===bProd.id){out.append(ruleCard(ruleById('same')));return out;}
      const shared=keys.filter(k=>productAllergen(aProd,k)?.status==='有'&&productAllergen(bProd,k)?.status==='有');
      if(shared.length){
        const ul=node('ul');for(const k of shared){const li=node('li');li.append(node('b',keys.find(x=>x.key===k).label+'：'));const pa=productAllergen(aProd,k),pb=productAllergen(bProd,k);li.append(bind(node('q',pa.text,'adverse-quote'),pa.claim,pa.text),' ',bind(node('q',pb.text,'adverse-quote'),pb.claim,pb.text));ul.append(li);}
        const extra=node('div');extra.append(node('p',`兩支疫苗仿單都載明的共同成分（${shared.length}）：`,'sub'),ul);
        out.append(ruleCard(ruleById('shared'),extra));
      } else {
        const listed=k=>keys.filter(x=>productAllergen(k,x.key)?.status==='有').map(x=>x.label).join('、')||'（仿單未載明任何本表過敏原）';
        const extra=node('p',`兩支疫苗仿單沒有共同已載明的過敏原。A 載明：${listed(aProd)}；B 載明：${listed(bProd)}。「未載明」不等於不含，仿單只列主要賦形劑。`,'sub');
        out.append(ruleCard(ruleById('none'),extra));
      }
      return out;
    }
    const key=a.slice(4);const st=productAllergen(bProd,key);
    if(!st||st.status==='未載明'){out.append(node('p',`${bProd.product} 的仿單未載明「${keys.find(x=>x.key===key)?.label||key}」；無法據仿單判定，請查成分段與原件。`));}
    else if(st.status==='無'){const p=node('p');p.append(node('span','仿單載明不含','allergy-verdict ok'),' ',bind(node('q',st.text,'adverse-quote'),st.claim,st.text));out.append(p);}
    else {const p=node('p');p.append(node('span','仿單載明含有','allergy-verdict warn'),' ',bind(node('q',st.text,'adverse-quote'),st.claim,st.text));out.append(p);}
    let rid=KEY_RULE[key];
    if(key==='egg')rid=bProd.vaccine==='flu'?'egg-flu':bProd.vaccine==='mmr'?'egg-mmr':null;
    if(rid)out.append(ruleCard(ruleById(rid)));
    else if(key==='egg')out.append(node('p','此疫苗的蛋過敏處理指引原句尚未收錄（流感、MMR、黃熱病見下方指引一覽）。','sub'));
    else out.append(node('p','此過敏原目前沒有專科指引原句可引用；請以仿單原句與過敏科評估為準。','sub'));
    return out;
  }

  // ── 版面 ──
  const tool=node('section',undefined,'card');tool.dataset.refUi='';
  tool.append(node('h3','「我對 A 過敏，可以打 B 嗎？」'),node('p','A 可以是某支疫苗，或某種過敏原；B 是要接種的產品。結果只依仿單已載明成分的交集與指引原句分類，不是個人臨床判定。','sub'));
  const row=node('div',undefined,'travel-search-row');
  const selA=node('select'),selB=node('select');selA.id='allergyA';selB.id='allergyB';
  const optA0=node('option','A：對什麼過敏？');optA0.value='';selA.append(optA0);
  const gProd=node('optgroup');gProd.label='對某支疫苗過敏';for(const p of products){const o=node('option',p.product);o.value='product:'+p.id;gProd.append(o);}if(products.length)selA.append(gProd);
  const gKey=node('optgroup');gKey.label='對某種成分／過敏原過敏';for(const k of keys){const o=node('option',k.label);o.value='key:'+k.key;gKey.append(o);}if(keys.length)selA.append(gKey);
  const optB0=node('option','B：想接種的疫苗');optB0.value='';selB.append(optB0);for(const p of products){const o=node('option',p.product+'（'+vaccineName(p.vaccine)+'）');o.value=p.id;selB.append(o);}
  const result=node('div');result.id='allergyResult';
  const run=()=>{result.replaceChildren();if(window.ReferenceUI)ReferenceUI.clear();if(selA.value&&selB.value)result.append(verdictFor(selA.value,selB.value));};
  selA.onchange=run;selB.onchange=run;row.append(selA,selB);tool.append(row,result);
  if(!products.length)tool.append(node('p','仿單成分資料建置中（tools/build_allergens.py 尚未產出）；指引原句一覽已可使用。','sub'));
  root.append(tool);

  const matrix=node('section',undefined,'card');matrix.dataset.refUi='';matrix.append(node('h3','過敏原 × 疫苗（依 TFDA 仿單原句；點格開原件）'));
  if(products.length){
    const wrap=node('div',undefined,'scroller'),table=node('table');table.id='allergenMatrix';const thead=node('thead'),hr=node('tr');hr.append(node('th','產品'));for(const k of keys)hr.append(node('th',k.label));thead.append(hr);table.append(thead);
    const tbody=node('tbody');
    for(const p of products){const tr=node('tr');tr.dataset.allergyProduct=p.id;tr.append(node('td',p.product));
      for(const k of keys){const a=productAllergen(p,k.key);const td=node('td',a?a.status:'未載明','allergy-'+(a?.status==='有'?'yes':a?.status==='無'?'no':'na'));if(a?.claim)bind(td,a.claim,a.text);tr.append(td);}
      tbody.append(tr);}
    table.append(tbody);wrap.append(table);matrix.append(wrap,node('p','「未載明」＝仿單成分／警語段沒有寫，不代表不含。','sub'));
  } else matrix.append(node('p','尚無仿單成分資料。','sub'));
  root.append(matrix);

  const rules=node('section',undefined,'card');rules.dataset.refUi='';rules.append(node('h3','指引原句一覽（可考慮／不建議的依據）'),node('p','綠＝可接種或可考慮、黃＝需專科評估或分流、紅＝不建議／禁忌。中文為本站整理；[1][2] 各連到該句原件頁面。','sub'));
  for(const r of RULES)rules.append(ruleCard(r));
  root.append(rules);

  if(products.length){
    const comp=node('section',undefined,'card');comp.dataset.refUi='';comp.append(node('h3','各產品成分段與過敏警語（仿單逐字）'));
    for(const p of products){const det=node('details');det.append(node('summary',p.product+'（'+vaccineName(p.vaccine)+'）'));
      for(const c of p.components||[]){const q=node('q',c.text,'adverse-quote');bind(q,c.claim,c.text);const d=node('div');d.append(node('b',c.label+'：'),q);det.append(d);}
      for(const w of p.warnings||[]){const q=node('q',w.text,'adverse-quote');bind(q,w.claim,w.text);const d=node('div');d.append(node('b',w.label+'：'),q);det.append(d);}
      comp.append(det);}
    root.append(comp);
  }
  window.AllergyGuidance=Object.freeze({rules:RULES.map(r=>r.id),products:products.map(p=>p.id),evaluate(a,b){selA.value=a;selB.value=b;run();return result;}});
})();
