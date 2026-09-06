/* Runs only inside the isolated CDC relay origin. Never reads the parent DOM. */
(() => {
  const start=performance.now();let searches=0,currentRequest=null,sequence=0;
  const tell=data=>parent.postMessage({type:'vaccine-cdc-proxy',...data},'*');
  const label=text=>{const el=document.getElementById('vaccine-proxy-status');if(el)el.textContent=' '+text;};
  const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(method,url,...rest){this.__isCdcResult=new URL(url,location.href).pathname==='/InternationalEpidemicLevel/SearchResult';return open.call(this,method,url,...rest);};
  XMLHttpRequest.prototype.send=function(body){
    if(this.__isCdcResult){
      const previous=currentRequest;currentRequest=this;previous?.abort();
      document.getElementById('DiseaseView')?.replaceChildren();
      const at=performance.now(),query=(new URLSearchParams(typeof body==='string'?body:'').get('SearchData')||'').trim(),seq=++sequence;
      label('正在向疾管署搜尋…');tell({phase:'search-start',query,sequence:seq});
      this.addEventListener('loadend',()=>{
        if(currentRequest!==this)return;
        const networkMs=performance.now()-at;
        setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(currentRequest!==this)return;
          let result;
          try {
            const parsed=new DOMParser().parseFromString(this.responseText,'text/html');
            const payload=parsed.querySelectorAll('template[data-vaccine-result]');
            if(this.status!==200||payload.length!==1)throw Error();
            result=JSON.parse(payload[0].content.textContent);
            if(result.version!==1||result.query!==query||!Array.isArray(result.rows)||result.count!==result.rows.length)throw Error();
          }catch{label('搜尋未成功；請改查官網，不代表沒有疫情。');tell({phase:'error',query,sequence:seq});return;}
          searches++;const elapsedMs=performance.now()-at,firstResultMs=searches===1?performance.now():null;
          label(`搜尋 ${ (elapsedMs/1000).toFixed(2) } 秒${firstResultMs?`；首次進入至結果 ${(firstResultMs/1000).toFixed(2)} 秒`:''}`);
          tell({phase:'results',query,sequence:seq,networkMs,elapsedMs,firstResultMs,count:result.count,result});
        })),0);
      });
    }
    return send.call(this,body);
  };
  addEventListener('load',()=>{
    tell({phase:'page-loaded',elapsedMs:performance.now(),scriptMs:performance.now()-start});
    // Preserve the whole page; start at its relevant search field inside the frame.
    document.querySelector('input[name="SearchData"]')?.scrollIntoView({block:'center'});
  });
  addEventListener('submit',event=>{if(event.target.id!=='form0'){event.preventDefault();label('其他功能請另開疾管署官網。');}},true);
  addEventListener('input',event=>{if(event.target.matches('input[name="SearchData"]')){
    const pending=currentRequest;currentRequest=null;pending?.abort();
    document.getElementById('DiseaseView')?.replaceChildren();label('字詞已變更，請按搜尋取得新結果。');tell({phase:'query-changed',sequence:++sequence});
  }},true);
})();
