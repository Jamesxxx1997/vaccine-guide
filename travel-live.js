/* A/B comparison: new live responses are never substituted for the snapshot. */
(() => {
  'use strict';
  const root=document.getElementById('travelCompare');if(!root)return;
  const $=id=>document.getElementById(id),seconds=n=>(n/1000).toFixed(2);
  const local=['localhost','127.0.0.1'].includes(location.hostname)&&location.protocol==='http:';
  // No arbitrary URL setting or untrusted query-string backend override.
  const service=local?'http://'+location.hostname+':8901':null;
  let mode='snapshot',ready=false,request=0,controller,frame,frameTimer,proxyFinished=false,proxySequence=0,proxyQuery=null;
  const snapshotIds=['travelSearchForm','travelSearchStatus','travelSearchResults','tvMeta','tvOut'];
  const status=$('travelLiveStatus'),input=$('travelLiveQuery');
  function closeFrame(){clearTimeout(frameTimer);frame?.remove();frame=null;}
  function clear(){request++;controller?.abort();controller=null;closeFrame();proxyFinished=false;proxySequence=0;proxyQuery=null;document.dispatchEvent(new CustomEvent('travel:clear'));$('travelLiveResults').replaceChildren();$('travelVaccineDetails').replaceChildren();status.textContent='';}
  function select(next){
    if(!['snapshot','live','proxy'].includes(next))return;
    clear();mode=next;
    root.querySelectorAll('[data-travel-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.travelMode===mode)));
    snapshotIds.forEach(id=>$(id).hidden=mode!=='snapshot');
    $('travelLivePanel').hidden=mode==='snapshot';$('travelProxyPanel').hidden=mode!=='proxy';
    $('travelModeHelp').textContent=mode==='live'?'A：向疾管署即時代查，以本站卡片顯示結果；可接續閱讀疫苗說明與 PDF。':'B：在隔離的框內操作官方搜尋畫面；頁面載入與搜尋耗時分開顯示。';
    $('travelLiveSubmit').textContent=mode==='proxy'?'開啟代理並搜尋':'向疾管署搜尋';
    $('travelLiveSubmit').disabled=!ready;
    if(mode==='snapshot'&&$('tvCountry').value)document.dispatchEvent(new CustomEvent('travel:destination',{detail:{key:$('tvCountry').value}}));
    if(mode!=='snapshot'&&!ready)status.textContent=service?'試用服務未連線，請啟動本機服務；也可使用每日快照或另開官網。':'GitHub Pages 尚未接上常駐後端；這兩種模式目前在本機試用，不會自動改用舊快照冒充即時結果。';
  }
  function render(data,totalMs){
    const container=$('travelLiveResults');container.replaceChildren();
    const intro=document.createElement('p');intro.textContent=`收到 ${data.rows.length} 筆官方結果 · 取得時間 ${new Date(data.fetchedAt).toLocaleString('zh-TW')} · 等待 ${seconds(totalMs)} 秒（含準備及資料整理）`;container.append(intro);
    if(!data.rows.length){const p=document.createElement('p');p.textContent='官方這次沒有回傳符合項目，不代表沒有疫情。';container.append(p);}
    const jump=document.createElement('a');jump.href='#travelAssessment';jump.textContent='↑ 查看本次旅遊地區建議評估';container.append(jump);
    let limit=20;
    const list=document.createElement('div');container.append(list);
    const more=document.createElement('button');more.type='button';more.textContent='顯示更多官方結果';
    function draw(){list.replaceChildren();for(const row of data.rows.slice(0,limit)){
      const card=document.createElement('article');card.className='travel-live-card';card.dataset.refUi='';
      const title=document.createElement('h3');title.textContent=row.country+' · '+row.disease;
      const details=document.createElement('p');details.textContent=row.level+' · '+(row.region?'行政區：'+row.region+' · ':'')+'官方發布日期 '+row.date;
      const link=document.createElement('a');
      try{const url=new URL(row.url);link.href=url.origin==='https://www.cdc.gov.tw'&&!url.username&&!url.password?url.href:'https://www.cdc.gov.tw/';}catch{link.href='https://www.cdc.gov.tw/';}
      link.target='_blank';link.rel='noopener noreferrer';link.textContent='官方原始資料 ↗';
      const button=document.createElement('button');button.type='button';button.textContent='疫苗說明／PDF（相關閱讀）';
      button.onclick=()=>{document.dispatchEvent(new CustomEvent('travel:live',{detail:{country:row.country,diseases:[row.disease]}}));$('travelVaccineDetails').scrollIntoView?.({block:'start'});};
      card.append(title,details,link,button);list.append(card);
    }more.hidden=limit>=data.rows.length;}
    more.onclick=()=>{limit+=20;draw();};container.append(more);draw();
  }
  async function submit(event){
    event?.preventDefault();if(!ready||mode==='snapshot')return;
    const query=input.value.trim();if(!query||query.length>100){status.textContent='請輸入 1–100 字的國家或疾病名稱。';return;}
    clear();const id=request,at=performance.now();
    status.textContent='正在向疾管署查詢…';
    if(mode==='proxy'){
      frame=document.createElement('iframe');frame.title='疾管署旅遊搜尋：非官方代理試用';
      frame.setAttribute('sandbox','allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      frame.referrerPolicy='no-referrer';
      frame.src=service+'/InternationalEpidemicLevel/Index/NlUwZUNvckRWQ09CbDJkRVFjaExjUT09?q='+encodeURIComponent(query);
      $('travelProxyFrameHost').append(frame);
      frameTimer=setTimeout(()=>{if(id===request)status.textContent='代理載入超過 45 秒；尚未確認取得結果，請重試或另開官網。';},45000);
      return;
    }
    controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),45000);
    $('travelLiveSubmit').disabled=true;
    try {
      const response=await fetch(service+'/api/search',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({query}),signal:controller.signal});
      const data=await response.json();if(id!==request)return;
      if(!response.ok)throw Error(data.error||'查詢未成功。');
      if(data.query!==query||!Array.isArray(data.rows))throw Error('結果與查詢不一致，請重新搜尋。');
      TravelAssessment.receive(data,'live');render(data,performance.now()-at);status.textContent='即時代查完成；已帶入旅遊評估區，未更動每日快照。';
    }catch(error){if(id===request)status.textContent=error.name==='AbortError'?'查詢已逾時，未取得新結果；請重試或另開官網。':'查詢失敗：'+error.message+' 未使用舊資料替代。';}
    finally{clearTimeout(timer);if(id===request){controller=null;$('travelLiveSubmit').disabled=!ready;}}
  }
  addEventListener('message',event=>{
    if(!frame||event.source!==frame.contentWindow||event.origin!==service||mode!=='proxy'||event.data?.type!=='vaccine-cdc-proxy')return;
    const data=event.data;
    if(data.phase==='page-loaded'&&!proxyFinished)status.textContent=`官方畫面載入 ${seconds(data.elapsedMs)} 秒；仍需確認搜尋結果。`;
    if(['query-changed','search-start'].includes(data.phase)){
      if(!Number.isSafeInteger(data.sequence)||data.sequence<=proxySequence)return;
      proxySequence=data.sequence;proxyQuery=data.phase==='search-start'?String(data.query).trim():null;proxyFinished=false;
      clearTimeout(frameTimer);TravelAssessment.clear();$('travelLiveResults').replaceChildren();$('travelVaccineDetails').replaceChildren();
      if(data.phase==='query-changed')status.textContent='框內字詞已變更，請按框內搜尋取得新結果。';
      else {input.value=proxyQuery.slice(0,100);status.textContent='代理正在搜尋：'+(input.value||'顯示所有');}
    }
    if(data.phase==='error'&&(data.sequence===proxySequence||proxyQuery===null)){
      clearTimeout(frameTimer);proxyFinished=true;TravelAssessment.clear();status.textContent='代理搜尋失敗；未確認取得結果，不代表沒有疫情。';
    }
    if(data.phase==='results'&&!proxyFinished&&proxyQuery!==null&&data.sequence===proxySequence&&data.query===proxyQuery){
      clearTimeout(frameTimer);proxyFinished=true;
      try{
        if(data.result?.version!==1||data.result.query!==proxyQuery||data.count!==data.result.rows?.length||data.result.count!==data.count)throw Error('完整結果不一致。');
        TravelAssessment.receive(data.result,'proxy');
        const jump=document.createElement('a');jump.href='#travelAssessment';jump.textContent='↑ 查看本次旅遊地區建議評估';$('travelLiveResults').replaceChildren(jump);
        status.textContent=`代理搜尋結果已帶入旅遊評估區 · ${seconds(data.elapsedMs)} 秒${data.firstResultMs?` · 首次進入至結果 ${seconds(data.firstResultMs)} 秒`:''} · 完整 ${data.count} 筆（不受分頁限制）。`;
      }catch{TravelAssessment.clear();status.textContent='代理搜尋結果無法完整核對，未帶入建議；請重新搜尋。';}
    }
  });
  root.querySelectorAll('[data-travel-mode]').forEach(b=>b.onclick=()=>select(b.dataset.travelMode));
  $('travelLiveForm').addEventListener('submit',submit);
  input.addEventListener('input',()=>{clear();$('travelLiveSubmit').disabled=!ready;});
  async function reconnect(){
    if(!service||typeof fetch!=='function')return;
    $('travelReconnect').hidden=false;$('travelReconnect').disabled=true;
    try{const response=await fetch(service+'/api/health',{credentials:'omit',signal:AbortSignal.timeout(2500)});if(!response.ok)throw Error();const data=await response.json();
      ready=data.ok===true&&data.scope==='local-trial';if(!ready)throw Error();
      $('travelServiceState').textContent='本機兩模式試用已連線；只傳送國家／疾病，不傳送年齡或接種勾選條件。';
      if(mode!=='snapshot')status.textContent='試用服務已連線，請輸入字詞並搜尋。';
    }catch{ready=false;$('travelServiceState').textContent='本機試用服務尚未連線；啟動後請按重新連線。每日快照仍可使用。';}
    finally{$('travelReconnect').disabled=false;$('travelLiveSubmit').disabled=!ready;}
  }
  $('travelReconnect').onclick=reconnect;
  if(service&&typeof fetch==='function')reconnect();
  else $('travelServiceState').textContent='A／B 即時模式目前限本機試用；GitHub Pages 的每日快照維持可用。';
  window.TravelLive=Object.freeze({select,submit,get state(){return {mode,ready};}});
})();
