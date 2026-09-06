/* Local snapshot viewer: never fetch an arbitrary URL supplied in the query. */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search),key=params.get('table')||'alerts';
  const table=ReferenceTables.get(key),container=document.getElementById('csv-viewer');
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
