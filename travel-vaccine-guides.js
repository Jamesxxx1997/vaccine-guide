/* Product-specific source guides. Warning -> related reading, never prescription. */
(() => {
  'use strict';
  const defaultContainer=document.getElementById('travelVaccineDetails');
  if(!defaultContainer||typeof TRAVEL_GUIDES==='undefined')return;
  const container=defaultContainer;
  const esc=exEsc;
  const normalized=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');
  const find=name=>TRAVEL_GUIDES.find(g=>g.id===name||g.names.some(n=>normalized(n)===normalized(name)));
  let selectedKey='',opened='';
  function library(topic){
    return TRAVEL_PDF_LIBRARY.filter(d=>d.topics.includes(topic)).map(d=>
      `<li><a href="${esc(d.p)}" target="_blank" rel="noopener">${esc(d.title)} ↗</a><br><small>${esc(d.version)}${d.restriction?' · '+esc(d.restriction):''}</small></li>`).join('');
  }
  function render(key,guide,live=null,host=defaultContainer){
    const container=host;
    if(key&&!live&&!Object.hasOwn(TRAVEL,key))return;
    ReferenceUI.clear();
    selectedKey=key;opened=guide?.id||'';
    const c=live?{n:live.country,a:live.diseases.map(d=>[null,d])}:TRAVEL[key]||{n:'未指定（獨立疫苗查詢）',a:[]};
    const related=TRAVEL_GUIDES.filter(g=>c.a.some(a=>g.diseases.includes(a[1])));
    container.innerHTML=`<section class="card travel-guides">
      <div data-ref-ui><h3>旅遊疫苗說明與原句核對</h3>
      <p>目前目的地：<strong>${esc(c.n)}</strong>。以下是資料導覽，不代表符合適應症、入境要求或個人接種處方。</p>
      ${live?`<p>目的地依據：${live.kind==='snapshot'?'每日快照／旅遊處方箋':'本次官方即時搜尋'}；以下疫苗說明沿用已標明版本的 PDF，並非疫情搜尋直接給出的接種建議。</p>`:''}
      ${related.length?`<h4>警示疾病相關閱讀</h4><div class="travel-guide-options">${related.map(g=>`<button type="button" data-guide="${g.id}">${esc(g.title)}</button>`).join('')}</div>`:''}
      <details><summary>其他疫苗／預防用藥說明</summary><div class="travel-guide-options">${TRAVEL_GUIDES.map(g=>`<button type="button" data-guide="${g.id}">${esc(g.title)}</button>`).join('')}</div></details></div>
      ${guide?`<article class="travel-guide-open" data-guide-open="${guide.id}">
        <header data-ref-ui><h3>${esc(guide.title)}</h3><p class="note warn">${esc(guide.scope)}</p><p>停留在下方文字可預覽原頁高亮；點文字固定於右側。中文是整理／譯文，不是逐字引文。</p></header>
        ${guide.sections.map(s=>`<p class="travel-guide-section" data-ref-claim="${esc(s.claim)}"><strong>${esc(s.label)}</strong><br>${esc(s.text)}</p>`).join('')}
        <details data-ref-ui><summary>這項的完整 PDF 存檔與其他製劑</summary><p>以下是完整文件連結；未將全份文件逐句整理，請核對年份、所在地政策及產品。</p><ul>${library(guide.id)}</ul></details>
      </article>`:'<p data-ref-ui>請點上方處方箋項目或相關閱讀，展開施打說明。</p>'}
      <details data-ref-ui><summary>完整旅遊疫苗 PDF 資料庫（${TRAVEL_PDF_LIBRARY.length} 份）</summary><p>包含其他疫區、特殊暴露與不同產品；收錄不代表適合一般旅客。此清單的完整 PDF 連結不等於已逐句核對。</p><ul>${TRAVEL_PDF_LIBRARY.map(d=>`<li><a href="${esc(d.p)}" target="_blank" rel="noopener">${esc(d.title)} ↗</a><small> · ${esc(d.version)}${d.restriction?' · '+esc(d.restriction):''}</small></li>`).join('')}</ul></details>
    </section>`;
    container.querySelectorAll('[data-ref-claim]').forEach(el=>ReferenceUI.bind(el,{claim:el.dataset.refClaim}));
    container.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>{render(key,find(b.dataset.guide),live,host);container.querySelector('.travel-guide-open')?.scrollIntoView?.({block:'nearest'});});
  }
  document.addEventListener('travel:destination',e=>render(e.detail.key));
  document.addEventListener('travel:live',e=>render('',undefined,e.detail));
  document.addEventListener('travel:vaccine',e=>{
    const guide=find(e.detail.name);
    render(e.detail.key,guide);
    if(!guide){const p=document.createElement('p');p.dataset.refUi='';p.className='note warn';p.textContent='此新項目尚未有逐句定位說明，請核對原始處方箋及完整 PDF 資料庫。';container.prepend(p);}
    container.scrollIntoView?.({block:'start'});
  });
  window.TravelVaccineGuides=Object.freeze({find,render,
    open(name,context=null,host=defaultContainer){const guide=find(name);if(!guide)return;render('',guide,context,host);host.scrollIntoView?.({block:'start'});},
    get state(){return {selectedKey,opened};}});
})();
