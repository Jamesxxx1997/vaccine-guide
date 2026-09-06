// Anonymous, fixed-origin CDC search. No browser credentials or patient fields.
import {JSDOM} from 'jsdom';
export const CDC='https://www.cdc.gov.tw';
export const SEARCH_PATH='/InternationalEpidemicLevel/Index/NlUwZUNvckRWQ09CbDJkRVFjaExjUT09';
export const RESULT_PATH='/InternationalEpidemicLevel/SearchResult';
export const SEARCH_URL=CDC+SEARCH_PATH;
export function localRequestURL(raw,host,port) {
  if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(host))throw Error('只供本機試用。');
  if(!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\'))throw Error('無效的本機路徑。');
  const origin=`http://${host}`,url=new URL(raw,origin);
  if(url.origin!==origin)throw Error('路徑不可改變來源。');
  return url;
}
export function queryText(value,{empty=false}={}) {
  if(typeof value!=='string'||value.length>100||/[\u0000-\u001f\u007f]/u.test(value)||(!empty&&!value.trim()))throw Error('請輸入 1–100 字的國家或疾病名稱。');
  return value.trim();
}
export function officialURL(value) {
  const url=new URL(value,CDC);
  if(url.origin!==CDC||url.username||url.password)throw Error('僅允許疾管署固定來源。');
  return url;
}
export function isAsset(path) {
  return /^(?:\/(?:Content|Scripts|Images|images|fonts)\/.*\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot)|\/favicon\.ico)$/i.test(path)&&!path.includes('..')&&!path.includes('\\');
}
export function updateCookies(jar,response) {
  for(const raw of response.headers.getSetCookie()) {
    const pair=raw.split(';')[0],at=pair.indexOf('=');
    if(at>0)jar.set(pair.slice(0,at),pair.slice(at+1));
  }
}
export function searchFields(raw) {
  const fields=new URLSearchParams(raw),allowed=['SearchData','__RequestVerificationToken','X-Requested-With'];
  if([...fields.keys()].some(k=>!allowed.includes(k))||allowed.some(k=>fields.getAll(k).length>1))throw Error('僅接受不重複的官方搜尋表單欄位。');
  if(fields.has('X-Requested-With')&&fields.get('X-Requested-With')!=='XMLHttpRequest')throw Error('官方搜尋方式不符。');
  const token=fields.get('__RequestVerificationToken');if(!token||token.length>1024)throw Error('官方搜尋工作階段無效，請重新開啟代理。');
  queryText(fields.get('SearchData'),{empty:true});fields.delete('X-Requested-With');return fields;
}
export async function upstream(path,{method='GET',body,jar=new Map(),fetcher=fetch}={}) {
  const url=officialURL(path);
  if(!(method==='GET'&&(url.pathname===SEARCH_PATH||isAsset(url.pathname)))&&!(method==='POST'&&url.pathname===RESULT_PATH))throw Error('此路徑不在旅遊搜尋試用範圍。');
  const headers={Accept:'text/html,application/xhtml+xml,*/*;q=0.8'};
  if(!isAsset(url.pathname)&&jar.size)headers.Cookie=[...jar].map(([k,v])=>k+'='+v).join('; ');
  if(method==='POST')Object.assign(headers,{'Content-Type':'application/x-www-form-urlencoded',Origin:CDC,Referer:SEARCH_URL});
  const response=await fetcher(url,{method,body,headers,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('疾管署回應 HTTP '+response.status);
  if(!isAsset(url.pathname))updateCookies(jar,response);
  const reader=response.body.getReader(),chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>8*1024*1024){await reader.cancel();throw Error('官方回應超過試用大小限制。');}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return {data,headers:response.headers};
}
export function parseResults(html) {
  const dom=new JSDOM(html),d=dom.window.document;
  try {
    // Fail closed on layout changes or an HTTP-200 JSON error response.
    const shell=d.querySelector('.card-body#SearchData');
    if(!shell||d.querySelectorAll('.card-body#SearchData').length!==1)throw Error('官方結果格式已變更，請改查官網；不可解讀為沒有疫情。');
    // Verified empty response is exactly an empty official shell, not arbitrary
    // content without recognized rows. Never silently discard renamed groups.
    if([...d.body.children].some(e=>e!==shell&&e.tagName!=='STYLE')||[...d.body.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))throw Error('官方結果含有未辨識內容。');
    const groups=[...shell.children];
    if(!groups.length&&shell.textContent.trim())throw Error('官方回傳訊息而非結果。');
    if([...shell.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))throw Error('官方結果含有未辨識訊息。');
    if(groups.some(g=>!g.classList.contains('CaveatDiv')))throw Error('官方分組格式已變更，不能顯示部分結果。');
    const rows=[];
    for(const group of groups) {
      const level=group.querySelector('.a-block')?.textContent.trim();
      if(!/第[一二三]級/.test(level||''))throw Error('無法辨識官方警示等級。');
      const levelNumber={'一':1,'二':2,'三':3}[/第([一二三])級/.exec(level)[1]];
      const bodies=group.querySelectorAll('tbody.box'+levelNumber);
      if(bodies.length!==1||group.querySelectorAll('table').length!==1)throw Error('官方資料表格結構已變更。');
      const selected=[...bodies[0].querySelectorAll('tr')];
      const all=[...group.querySelectorAll('table tr')].filter(tr=>[...tr.children].map(td=>td.textContent.replace(/\s/g,'')).join('|')!=='疾病|國家/區域|一級行政區|發布日期');
      if(all.length!==selected.length||all.some(tr=>!selected.includes(tr)))throw Error('官方表格有未辨識資料列，不能略過。');
      if(!selected.length)throw Error('官方分組缺少資料列。');
      for(const tr of selected) {
        const cells=[...tr.children].filter(c=>c.tagName==='TD');
        if(cells.length!==4)throw Error('官方欄位格式變更。');
        const [disease,country,region,date]=cells.map(c=>c.textContent.trim());
        if(!disease||!country||!/^\d{4}\/\d{2}\/\d{2}$/.test(date))throw Error('官方結果缺少疾病、地區或日期。');
        const href=cells[1].querySelector('a')?.getAttribute('href');
        rows.push({level,disease,country,region,date,url:href?officialURL(href).href:SEARCH_URL});
      }
    }
    if(groups.length&&!rows.length)throw Error('官方表格沒有可辨識的資料列。');
    return rows;
  } finally {dom.window.close();}
}
export async function search(query,{fetcher=fetch}={}) {
  query=queryText(query);const start=performance.now(),jar=new Map();
  const initial=await upstream(SEARCH_PATH,{jar,fetcher});
  const dom=new JSDOM(new TextDecoder().decode(initial.data));
  const token=dom.window.document.querySelector('input[name="__RequestVerificationToken"]')?.value;
  dom.window.close();
  if(!token)throw Error('官方搜尋表單無法使用。');
  const preparedMs=performance.now()-start,posted=performance.now();
  const result=await upstream(RESULT_PATH,{method:'POST',jar,fetcher,body:new URLSearchParams({SearchData:query,__RequestVerificationToken:token})});
  const rows=parseResults(new TextDecoder().decode(result.data));
  return {query,rows,source:SEARCH_URL,fetchedAt:new Date().toISOString(),timing:{prepareMs:Math.round(preparedMs),searchMs:Math.round(performance.now()-posted),totalMs:Math.round(performance.now()-start)}};
}
export function rewriteHTML(html,{full=false,query=''}={}) {
  const dom=new JSDOM(html),d=dom.window.document;
  try {
    // Keep the official search UI. Other destinations explicitly leave the relay.
    for(const a of d.querySelectorAll('a[href]')) {
      const href=a.getAttribute('href');
      if(!href||href.startsWith('#')||href.startsWith('javascript:'))continue;
      try {const url=new URL(href,SEARCH_URL);if(!['https:','http:','mailto:','tel:'].includes(url.protocol)){a.removeAttribute('href');continue;}
        if(url.href!==SEARCH_URL){a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';}
      } catch {a.removeAttribute('href');}
    }
    if(full) {
      d.querySelectorAll('base,meta[http-equiv="refresh"],script[src*="googletagmanager"],script[src*="google-analytics"]').forEach(e=>e.remove());
      for(const script of d.querySelectorAll('script[src]')) {
        const url=new URL(script.getAttribute('src'),SEARCH_URL);
        if(url.origin!==CDC)script.remove();else script.setAttribute('src',url.pathname+url.search);
      }
      // Do not relay tracking/social widgets or transmit searches to third parties.
      d.querySelectorAll('script[src="/Scripts/addtoany.js"],script[src="/Scripts/Share.js"]').forEach(e=>e.remove());
      for(const form of d.forms)if(form.id!=='form0') {form.removeAttribute('action');form.addEventListener?.('submit',e=>e.preventDefault());}
      const input=d.querySelector('input[name="SearchData"]');if(input)input.setAttribute('value',queryText(query,{empty:true}));
      const script=d.createElement('script');script.src='/proxy-client.js';d.head.prepend(script);
      const notice=d.createElement('div');notice.id='vaccine-proxy-notice';
      notice.setAttribute('style','background:#fff4d6;color:#382800;padding:12px;font:16px/1.5 sans-serif;border-bottom:2px solid #bb8000');
      notice.textContent='非官方轉送試用｜以下保留疾管署旅遊搜尋畫面；僅供查國家／疾病，請勿輸入個資。其他連結另開官網。';
      const status=d.createElement('span');status.id='vaccine-proxy-status';status.textContent=' 載入中…';notice.append(status);d.body.prepend(notice);
      return dom.serialize();
    }
    return d.body.innerHTML;
  } finally {dom.window.close();}
}

// Same upstream response, full normalized records; never derive data from the
// visible pagination page. JSON is inert text, not executable inline script.
export function relayResult(html,query) {
  const rows=parseResults(html);
  const payload={version:1,query:queryText(query,{empty:true}),rows,count:rows.length,
    source:SEARCH_URL,fetchedAt:new Date().toISOString()};
  const json=JSON.stringify(payload).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  return rewriteHTML(html)+'<template data-vaccine-result>'+json+'</template>';
}
