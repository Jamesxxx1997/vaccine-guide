/* 副作用分頁：資料來自 review/adverse-effects.js（由 tools/build_adverse_effects.py 從 PDF 文字層抽出，含每列 claim）。
   每一格／每一列點字或停留 → 右側原件裁圖＋黃框（reference-ui）。本檔只做呈現，不含任何臨床判定。 */
(() => {
  'use strict';
  const root=document.getElementById('adverseRoot');if(!root||typeof ADVERSE_EFFECTS==='undefined')return;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined&&text!==null)el.textContent=text;if(cls)el.className=cls;return el;};
  const bind=(el,claim,query)=>{if(claim&&window.ReferenceUI)ReferenceUI.bind(el,{claim,query:query||el.textContent});return el;};
  // 多來源標記：「…描述文字… [1] [2]」，每個編號各自連到自己的 claim（使用者指定的呈現方式）
  const marks=(claims)=>{const sup=node('sup',undefined,'ref-marks');claims.forEach((c,i)=>{const m=node('a','['+(i+1)+']','ref-mark');m.href='#';m.onclick=e=>e.preventDefault();bind(m,c,'');sup.append(i?' ':'',m);});return sup;};
  const EXTRA_VACCINE_NAMES={menb:'腦膜炎雙球菌 B 型疫苗（Bexsero）',typhoid:'傷寒疫苗（Typhim Vi）',mpox:'M痘疫苗（Jynneos）'};   // 站上 VAX 沒有卡片的疫苗
  const vaccineName=id=>{const v=((typeof VAX!=='undefined'&&VAX)||[]).find(x=>x.id===id);return v?v.n:(EXTRA_VACCINE_NAMES[id]||id);};   // index.html 的 VAX/SRC 是頂層 const，不在 window 上
  const srcLabel=key=>{const s=((typeof SRC!=='undefined'&&SRC)||{})[key];return s?`${key}｜${s.n}（${s.v||''}）`:key;};
  const byVaccine=new Map();
  for(const t of ADVERSE_EFFECTS.tables){if(!byVaccine.has(t.vaccine))byVaccine.set(t.vaccine,[]);byVaccine.get(t.vaccine).push(t);}
  const nav=node('div',undefined,'travel-search-row');nav.setAttribute('role','tablist');
  const body=node('div');
  const count=node('p',undefined,'sub');
  let current=null;
  function renderPercent(t){
    const wrap=node('div',undefined,'scroller');const table=node('table');table.className='adverse-table';
    const thead=node('thead'),hr=node('tr');hr.append(node('th','不良反應'));for(const c of t.columns)hr.append(node('th',c));thead.append(hr);table.append(thead);
    const tbody=node('tbody');
    for(const r of t.rows){
      const tr=node('tr');tr.dataset.adverseClaim=r.claim;
      const q=r.reaction+' '+r.values.join(' ');
      tr.append(bind(node('td',r.reaction),r.claim,q));
      for(const v of r.values)tr.append(bind(node('td',v,/^[<>≥≧]?\d/.test(v)?'adverse-pct':'adverse-na'),r.claim,q));
      tbody.append(tr);
    }
    table.append(tbody);wrap.append(table);return wrap;
  }
  function renderFreq(t){
    const wrap=node('div',undefined,'scroller');const table=node('table');table.className='adverse-table';
    const thead=node('thead'),hr=node('tr');hr.append(node('th','發生頻率'),node('th','不良反應（原件用語）'));thead.append(hr);table.append(thead);
    const tbody=node('tbody');
    for(const r of t.rows){const tr=node('tr');tr.dataset.adverseClaim=r.claim;tr.append(bind(node('td',r.label),r.claim,r.label+' '+r.text),bind(node('td',r.text),r.claim,r.label+' '+r.text));tbody.append(tr);}
    table.append(tbody);wrap.append(table);return wrap;
  }
  function renderNotes(t){
    const list=node('div',undefined,'adverse-notes');
    for(const r of t.rows){
      const p=node('p',undefined,'adverse-note');
      if(r.label)p.append(node('b',r.label+'：'));
      p.append(node('span',r.summary||r.text));
      p.append(' ',marks([r.claim]));
      const q=node('q',r.text,'adverse-quote');bind(q,r.claim,r.text);
      const block=node('div',undefined,'adverse-note-block');block.append(p,q);list.append(block);
    }
    return list;
  }
  function show(vid){
    current=vid;body.replaceChildren();if(window.ReferenceUI)ReferenceUI.clear();
    nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.vid===vid)));
    const tables=byVaccine.get(vid)||[];
    for(const t of tables){
      const sec=node('section',undefined,'card adverse-card');sec.dataset.refUi='';sec.dataset.adverseTable=t.id;
      sec.append(node('h3',t.product+(t.population?' · '+t.population:'')));
      const title=node('p',t.title,'sub');sec.append(title);
      sec.append(t.kind==='percent'?renderPercent(t):t.kind==='freq'?renderFreq(t):renderNotes(t));
      const meta=node('p',undefined,'sub');meta.append('來源：'+srcLabel(t.source)+'，第 '+t.page+' 頁。'+(t.caveat?' '+t.caveat:''));sec.append(meta);
      body.append(sec);
    }
    count.textContent=tables.length?`${vaccineName(vid)}：${tables.length} 個原件表格／段落；數值與用語均自原件抽出，點格開原句黃框。`:'此疫苗尚未收錄副作用原件。';
  }
  for(const vid of byVaccine.keys()){const b=node('button',vaccineName(vid));b.type='button';b.dataset.vid=vid;b.setAttribute('aria-pressed','false');b.onclick=()=>show(vid);nav.append(b);}
  root.append(nav,count,body);
  const first=byVaccine.keys().next().value;if(first)show(first);
  window.AdverseEffects=Object.freeze({show,get current(){return current;},get vaccines(){return [...byVaccine.keys()];}});
})();
