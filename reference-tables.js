/* Read-only source CSVs. Values remain strings; HTML and formulas never execute. */
const ReferenceTables=(()=>{
  const get=key=>typeof REFERENCE_TABLES==='undefined'?null:REFERENCE_TABLES[key];
  const value=(table,row,header)=>row.values[table.headers.indexOf(header)]||'';
  function select(table,data){
    return table.rows.filter(row=>{
      if(data.country||data.countryKey){
        const country=value(table,row,'areaDesc')||value(table,row,'國名(中)');
        // Some source destinations share an ISO code; identity must also agree.
        const iso=value(table,row,'ISO3166').trim();
        if(data.countryKey&&/^[A-Z]{2}$/.test(data.countryKey)&&iso&&iso!==data.countryKey)return false;
        const english=(value(table,row,'areaDesc_EN')||value(table,row,'國名(英)')).trim();
        if(country.trim()!==data.country&&!(data.countryEnglish&&english===data.countryEnglish))return false;
      }
      if(data.disease&&value(table,row,'alert_disease').trim()!==data.disease)return false;
      if(data.date&&!value(table,row,'effective').startsWith(data.date))return false;
      if(data.detail!==undefined&&value(table,row,'areaDetail').trim()!==data.detail)return false;
      if(data.level&& !value(table,row,'severity_level').startsWith(['','第一級','第二級','第三級'][+data.level]))return false;
      if(data.vaccine&&value(table,row,'疫苗').trim()!==data.vaccine)return false;
      return true;
    });
  }
  function mount(container,table,data,{compact=false}={}){
    const esc=exEsc, matched=select(table,data), matchedIDs=new Set(matched.map(r=>r.record));
    let only=!!(data.country||data.disease||data.vaccine),term='',page=0,keyColumns=true;
    const preferred=table.headers.includes('areaDesc')?
      ['areaDesc','alert_disease','severity_level','effective','instruction','areaDetail']:
      ['國名(中)','疫苗','主類別','次類別','疾病','警示日期'];
    const size=40;
    const related=data.disease?select(table,{...data,level:undefined}):[];
    const conflict=related.filter(r=>!matchedIDs.has(r.record));
    container.classList.add('ref-csv');
    container.innerHTML=`<h3>${esc(table.n)} · CSV 原始資料</h3>
      <div class="ref-meta">資料快照 ${esc(table.v)} · 原檔 ${table.rows.length} 筆${data.country?' · '+esc(data.country):''}</div>
      ${data.disease&&!matched.length?'<div class="note warn">來源一致性警告：這筆網頁摘要找不到相同目的地、疾病、日期、等級的原始紀錄。請勿把其他地區或等級當成證據；請切換全表核對官方資料。</div>':''}
      ${conflict.length?`<div class="note warn">原檔同日另有不同等級紀錄（資料列 ${conflict.map(r=>r.record).join('、')}）。黃色僅對應網頁顯示等級；本視窗不裁決哪筆公告優先，請查官方最新資料。</div>`:''}
      <div class="ref-csv-controls"><label>範圍 <select aria-label="CSV 顯示範圍"><option value="match">對應紀錄（${matched.length} 筆）</option><option value="all">全部原始資料</option></select></label>
      <label>搜尋 <input type="search" aria-label="搜尋 CSV 原始值" placeholder="原始欄位內容"></label>
      <label>欄位 <select aria-label="CSV 欄位順序"><option value="key">核對欄位優先</option><option value="original">原檔順序</option></select></label></div>
      <div class="ref-csv-scroll" tabindex="0" role="region" aria-label="可上下左右捲動的 CSV 原始表格"><table><thead><tr><th scope="col">資料列號</th>${table.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
      <div class="ref-csv-controls"><button type="button" data-csv-prev>上一批</button><span class="ref-csv-count" aria-live="polite"></span><button type="button" data-csv-next>下一批</button></div>
      <div class="ref-meta">黄色列為目前文字對應紀錄。資料列號不含標頭；全表保留歷史及解除警示。網站的分組／統計不是原始欄位。</div>
      <div class="ref-actions"><a href="${esc(table.p)}" target="_blank" rel="noopener">開啟本次 CSV 快照 ↗</a><a href="${esc(table.u)}" target="_blank" rel="noopener">官方最新 CSV ↗</a></div>`;
    const scope=container.querySelector('select'),input=container.querySelector('input'),viewport=container.querySelector('.ref-csv-scroll');
    scope.value=only?'match':'all';
    const draw=()=>{
      const filtered=(only?matched:table.rows).filter(row=>!term||row.values.some(v=>v.toLocaleLowerCase().includes(term)));
      page=Math.min(page,Math.max(0,Math.ceil(filtered.length/size)-1));
      const batch=filtered.slice(page*size,(page+1)*size);
      const headers=keyColumns?[...preferred,...table.headers.filter(h=>!preferred.includes(h))]:table.headers;
      container.querySelector('thead tr').innerHTML='<th scope="col">資料列號</th>'+headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('');
      container.querySelector('tbody').innerHTML=batch.length?batch.map(row=>`<tr data-csv-record="${row.record}" class="${only||matchedIDs.has(row.record)&&data.country?'ref-csv-match':''}"><th scope="row">${row.record}</th>${headers.map(h=>`<td>${esc(value(table,row,h))}</td>`).join('')}</tr>`).join(''):
        `<tr><td colspan="${table.headers.length+1}">沒有符合的原始紀錄。可切換「全部原始資料」核對；不代表目前沒有旅遊風險。</td></tr>`;
      container.querySelector('.ref-csv-count').textContent=`${filtered.length? page*size+1:0}–${Math.min((page+1)*size,filtered.length)} / ${filtered.length} 筆`;
      container.querySelector('[data-csv-prev]').disabled=page===0;
      container.querySelector('[data-csv-next]').disabled=(page+1)*size>=filtered.length;
      viewport.scrollTop=0;
    };
    scope.onchange=()=>{only=scope.value==='match';page=0;draw();};
    container.querySelector('[aria-label="CSV 欄位順序"]').onchange=e=>{keyColumns=e.target.value==='key';draw();};
    input.oninput=()=>{term=input.value.trim().toLocaleLowerCase();page=0;draw();};
    container.querySelector('[data-csv-prev]').onclick=()=>{page--;draw();};
    container.querySelector('[data-csv-next]').onclick=()=>{page++;draw();};
    if(compact)container.classList.add('ref-csv-compact');
    draw();
  }
  return {get,select,mount};
})();
