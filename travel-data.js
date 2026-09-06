/* The same validated dataset feeds search, source hover and the full CSV viewer. */
(() => {
  'use strict';
  let current=null,error='';
  try{
    if(typeof TRAVEL_CURRENT==='undefined')throw Error('尚未載入新的同步資料');
    if(TRAVEL_CURRENT.schemaVersion!==1||!TRAVEL_CURRENT.meta?.provenance||!TRAVEL_CURRENT.tables?.alerts?.rows?.length||!TRAVEL_CURRENT.tables?.prescriptions?.rows?.length)throw Error('同步資料格式未通過檢查');
    for(const key of Object.keys(TRAVEL_CURRENT.countries))if(['__proto__','prototype','constructor'].includes(key))throw Error('Invalid country key');
    current=TRAVEL_CURRENT;
    if(typeof REFERENCE_TABLES!=='undefined')Object.assign(REFERENCE_TABLES,current.tables);
    if(typeof TRAVEL!=='undefined'){
      for(const key of Object.keys(TRAVEL))delete TRAVEL[key];Object.assign(TRAVEL,current.countries);
      for(const key of Object.keys(TRAVEL_META))delete TRAVEL_META[key];Object.assign(TRAVEL_META,current.meta);
    }
  }catch(e){error=e.message;if(typeof TRAVEL!=='undefined')for(const key of Object.keys(TRAVEL))delete TRAVEL[key];}
  const time=value=>{if(typeof value!=='string'||!value.trim())return '未提供';const d=new Date(value);return Number.isNaN(d.getTime())?'未提供':d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});};
  function renderMeta(){
    const el=document.getElementById('tvMeta'),viewer=document.getElementById('travelViewerStatus');if(!el&&!viewer)return;
    const sync=typeof TRAVEL_SYNC_STATUS==='undefined'?null:TRAVEL_SYNC_STATUS;
    const stale=!current||Date.now()-Date.parse(current.meta.succeededAt)>36*60*60*1000;
    const failed=sync?.outcome==='failed';
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    if(viewer){
      viewer.textContent=(error?'同步資料未通過檢查，暫停顯示表格。':failed?'最近一次更新失敗，以下保留上次成功資料。':stale?'資料超過 36 小時未成功同步，請核對疾管署最新資料。':'已載入官方同步資料。')+
        (current?'最後成功同步：'+time(current.meta.succeededAt)+'（台灣時間）。':'')+' 此表包含歷史紀錄，不等於全為現行警示；不是每次開啟即時取回。'+(location.protocol==='file:'?' 本機檔案只顯示隨檔案保存的版本。':'');
      viewer.style.borderLeft='4px solid '+(error||failed||stale?'#e8b44f':'#7bcaa3');viewer.style.padding='12px';
    }
    if(!el)return;
    el.innerHTML=`<div class="travel-source-state ${current&&!stale&&!failed?'good':''}" data-ref-ui>
      <strong>${error?'同步資料未通過檢查，暫停站內旅遊查詢，請查官方':failed?'最近一次更新未成功，保留上次資料':stale?'資料已超過 36 小時未成功同步':'已載入官方同步資料'}</strong><br>
      ${current?'最後成功同步：'+esc(time(current.meta.succeededAt))+'（台灣時間）':'無可安全顯示的同步資料；不回退至舊整併規則。'}
      ${failed?'<br>最近嘗試：'+esc(time(sync.attemptedAt))+'；不將更新失敗解讀為沒有疫情。':''}
      ${current?'<br>警示來源：每日更新；資料內最新公告 '+esc(current.meta.latestEffective)+
        '<br>處方箋來源：每月更新；官方檔案修改時間 '+esc(time(current.meta.provenance.prescriptions.sourceModified)):''}
      <br>搜尋的是最後成功同步的資料，不是查詢當下向疾管署即時取回。
      <br>原表包含歷史公告；依相同目的地／疾病／細分地區取最新日期，同日等級衝突並列。新冠舊新名稱依官方更名合併時序，未能銜接者另列待核對。
      ${location.protocol==='file:'?'<br>本機檔案模式只顯示隨檔案保存的版本；請使用已發布網站取得後續同步。':''}</div>
      <div class="travel-source-links"><a href="csv-viewer.html?table=alerts" data-ref-csv="alerts">檢視警示原始資料</a><a href="csv-viewer.html?table=prescriptions" data-ref-csv="prescriptions">檢視處方箋原始資料</a><a data-ref-ui href="https://www.cdc.gov.tw/InternationalEpidemicLevel/Index/NlUwZUNvckRWQ09CbDJkRVFjaExjUT09" target="_blank" rel="noopener">疾管署官網最新查詢 ↗</a></div>`;
  }
  window.TravelData=Object.freeze({current,error,renderMeta});
  if(typeof travelInit==='function')travelInit();renderMeta();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderMeta();});
})();
