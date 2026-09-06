/* Search is local to the last successfully validated official dataset.
   A successful search never implies a personal vaccination recommendation. */
(() => {
  'use strict';
  const input=document.getElementById('travelQuery');
  if(!input)return;
  const form=document.getElementById('travelSearchForm'),results=document.getElementById('travelSearchResults');
  const status=document.getElementById('travelSearchStatus'),selection=document.getElementById('tvCountry');
  const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}]/gu,'');
  let limit=12;
  function matches(query) {
    const q=normalize(query);
    if(!q)return [];
    return Object.entries(TRAVEL).map(([key,c])=>({key,c,
      exact:[c.n,c.en].some(n=>normalize(n)===q),
      country:[c.n,c.en].some(n=>normalize(n).includes(q)),
      disease:[...new Set(c.a.map(a=>a[1]))].filter(n=>normalize(n).includes(q)),
      vaccine:c.v.filter(n=>normalize(n).includes(q))
    })).filter(r=>r.country||r.disease.length||r.vaccine.length)
      .sort((a,b)=>Number(b.exact)-Number(a.exact)||Number(b.country)-Number(a.country)||a.c.n.localeCompare(b.c.n,'zh-Hant'));
  }
  function clearSelection() {
    selection.value='';travelCalc();
    document.getElementById('travelVaccineDetails').replaceChildren();
  }
  function choose(key) {
    if(!Object.hasOwn(TRAVEL,key))return;
    selection.value=key;
    input.value=TRAVEL[key].n;
    results.replaceChildren();
    status.textContent='已選擇 '+TRAVEL[key].n+'。以下為來源資料，不是個人接種處方。';
    selection.dispatchEvent(new Event('change',{bubbles:true}));
    document.dispatchEvent(new CustomEvent('travel:destination',{detail:{key}}));
  }
  function draw(submit=false) {
    const rows=matches(input.value);
    if(submit&&rows.filter(r=>r.exact).length===1){choose(rows.find(r=>r.exact).key);return;}
    results.replaceChildren();
    if(!input.value.trim()){status.textContent='輸入國名或疾病，查看對應目的地。';return;}
    status.textContent=rows.length?`找到 ${rows.length} 個目的地，請選擇要查看的國家／地區。`:'目前資料找不到符合項目；不代表沒有疫情。可改用其他名稱或核對疾管署官網。';
    const ul=document.createElement('ul');ul.className='travel-search-list';
    for(const row of rows.slice(0,limit)) {
      const li=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.className='travel-search-result';button.dataset.travelCountry=row.key;
      const title=document.createElement('strong');title.textContent=row.c.n+(row.c.en?' · '+row.c.en:'');
      const text=document.createElement('small');
      text.textContent=row.disease.length?'警示疾病命中：'+row.disease.join('、'):row.vaccine.length?'處方箋項目命中（不代表需接種）：'+row.vaccine.join('、'):`${row.c.a.length} 筆最新狀態紀錄 · 查看來源與疫苗資料`;
      button.append(title,text);button.onclick=()=>choose(row.key);li.append(button);ul.append(li);
    }
    results.append(ul);
    if(rows.length>limit){const more=document.createElement('button');more.type='button';more.textContent='顯示更多目的地';more.onclick=()=>{limit+=12;draw();};results.append(more);}
  }
  input.addEventListener('input',()=>{limit=12;clearSelection();draw();});
  form.addEventListener('submit',e=>{e.preventDefault();draw(true);});
  document.getElementById('travelSearchClear').onclick=()=>{input.value='';clearSelection();draw();input.focus();};
  window.TravelSearch=Object.freeze({matches,choose,refresh:()=>{travelInit();clearSelection();draw();}});
})();
