/* Local snapshot viewer: never fetch an arbitrary URL supplied in the query. */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search),key=params.get('table')||'alerts';
  const table=ReferenceTables.get(key),container=document.getElementById('csv-viewer');
  if(window.TravelData?.error){
    container.innerHTML='<p role="alert">現行同步資料無法驗證，暫停表格顯示；請重新載入或查閱疾管署官網，不回退到舊版本。</p>';
    return;
  }
  if(!table){
    container.innerHTML='<p role="alert">找不到這份 CSV 快照，請使用上方資料集連結。</p>';
    return;
  }
  const filter={};
  for(const name of ReferenceTables.filterKeys)if(params.has(name))filter[name]=params.get(name);
  document.getElementById('viewer-title').textContent=table.n+'｜完整 CSV 表格';
  document.title=table.n+'｜CSV 完整表格';
  document.querySelector(`[data-table="${key}"]`).setAttribute('aria-current','page');
  ReferenceTables.mount(container,table,filter,{fullPage:true});
})();
