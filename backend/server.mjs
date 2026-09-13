// Local comparison service; with PUBLIC=1 it can be deployed (Cloud Run etc.) as a fixed-origin CDC relay.
// 公開模式仍不是開放代理：只轉送疾管署旅遊搜尋頁與結果，Origin 白名單、每 IP 限流、並行上限、逾時全部保留。
// 環境變數：PORT（Cloud Run 會給 8080）、PUBLIC=1、ALLOWED_ORIGINS（逗號分隔，含 https://<pages 網域>）、
//          PUBLIC_HOSTS（逗號分隔，可留空＝接受任何 Host）、RATE_LIMIT（每 IP 每 10 分鐘，預設 60）
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {CDC,SEARCH_PATH,RESULT_PATH,isAsset,upstream,search,rewriteHTML,relayResult,searchFields,localRequestURL} from './cdc-core.mjs';
const PUBLIC=process.env.PUBLIC==='1';
const port=Number(process.env.PORT||process.env.TRAVEL_PORT||8901);
const bind=process.env.BIND||(PUBLIC?'0.0.0.0':'127.0.0.1');   // BIND=127.0.0.1 可在本機測公開模式而不對外開埠
const scheme=PUBLIC?'https':'http';
const appOrigins=new Set((process.env.ALLOWED_ORIGINS||'http://localhost:8899,http://127.0.0.1:8899').split(',').map(s=>s.trim()).filter(Boolean));
const publicHosts=(process.env.PUBLIC_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean);
const hostOptions=PUBLIC?{hosts:publicHosts,scheme}:{};
// 每 IP 簡易限流（10 分鐘視窗）；Cloud Run 會在 X-Forwarded-For 給出真實來源 IP。
const rateLimit=Number(process.env.RATE_LIMIT||60),buckets=new Map();
function clientIP(req){const xff=PUBLIC?String(req.headers['x-forwarded-for']||'').split(',')[0].trim():'';return xff||req.socket.remoteAddress||'?';}
function limited(req){
  const now=Date.now();if(buckets.size>5000)for(const [k,b] of buckets)if(b.reset<now)buckets.delete(k);
  const ip=clientIP(req);let b=buckets.get(ip);if(!b||b.reset<now){b={n:0,reset:now+600000};buckets.set(ip,b);}
  return ++b.n>rateLimit;
}
const sessions=new Map(),assets=new Map();let active=0,assetBytes=0;
const mime='text/html; charset=utf-8';
function output(res,status,data,type='application/json; charset=utf-8',extra={}){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(data);}
async function bodyOf(req) {let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>8192)throw Error('輸入內容過長。');}return data;}
function session(req,res) {
  for(const [key,s] of sessions)if(s.expires<Date.now())sessions.delete(key);
  const header=String(req.headers['x-relay-session']||'');
  let id=/^[a-f0-9]{48}$/.test(header)?header:/(?:^|;\s*)vaccineCdcRelay=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
  if(!sessions.has(id)) {
    if(sessions.size>=100)throw Error('試用工作階段已滿，請稍後再試。');
    id=randomBytes(24).toString('hex');sessions.set(id,{id,jar:new Map(),expires:Date.now()+15*60000});
    // 公開模式：跨站 iframe 需 SameSite=None; Secure 才會帶 Cookie；主要路徑改走 X-Relay-Session 標頭，Cookie 只是備援。
    res.setHeader('Set-Cookie',`vaccineCdcRelay=${id}; Path=/; HttpOnly; ${PUBLIC?'SameSite=None; Secure':'SameSite=Strict'}; Max-Age=900`);
  }
  return sessions.get(id);
}
const service=http.createServer(async(req,res)=>{
  let held=false;
  try {
    let url;try{url=localRequestURL(req.url,req.headers.host,port,hostOptions);}catch(error){return output(res,403,JSON.stringify({error:error.message}));}
    const ownOrigin=url.origin,origin=req.headers.origin;
    if(origin&&origin!==ownOrigin&&!appOrigins.has(origin))return output(res,403,JSON.stringify({error:'不允許的來源。'}));
    if(appOrigins.has(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS')return output(res,204,'','text/plain',{'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Content-Type'});
    if(req.method==='GET'&&url.pathname==='/api/health')return output(res,200,JSON.stringify({ok:true,scope:PUBLIC?'public':'local-trial',source:CDC}));
    if(req.method==='GET'&&url.pathname==='/proxy-client.js')return output(res,200,await fs.readFile(new URL('./proxy-client.js',import.meta.url)),'application/javascript; charset=utf-8');
    if(req.method==='GET'&&url.pathname==='/') {res.writeHead(302,{Location:SEARCH_PATH});return res.end();}
    const api=req.method==='POST'&&url.pathname==='/api/search';
    const post=req.method==='POST'&&url.pathname===RESULT_PATH;
    const initial=req.method==='GET'&&url.pathname===SEARCH_PATH;
    const asset=req.method==='GET'&&isAsset(url.pathname);
    if(!api&&!post&&!initial&&!asset)return output(res,404,JSON.stringify({error:'此試用僅轉送旅遊搜尋；其他內容請開啟官網。'}));
    if((api||post)&&!origin)return output(res,403,JSON.stringify({error:'搜尋需由試用介面送出。'}));
    if(!asset){if(limited(req))return output(res,429,JSON.stringify({error:'查詢次數過多，請 10 分鐘後再試。'}));if(active>=4)return output(res,429,JSON.stringify({error:'查詢中，請稍後再試。'}));active++;held=true;}
    if(api) {
      if(!String(req.headers['content-type']).startsWith('application/json'))throw Error('需使用 JSON 查詢。');
      const data=JSON.parse(await bodyOf(req));
      if(Object.keys(data).some(k=>k!=='query'))throw Error('僅接受國家或疾病搜尋字詞。');
      return output(res,200,JSON.stringify(await search(data.query)));
    }
    if(asset) {
      const key=url.pathname+url.search,cached=assets.get(key);
      if(cached&&Date.now()-cached.at<3600000)return output(res,200,cached.data,cached.type,{'Cache-Control':'public, max-age=3600'});
      const result=await upstream(key);const data=Buffer.from(result.data),type=result.headers.get('content-type')||'application/octet-stream';
      if(!type.includes('text/html')&&data.length<4*1024*1024){assetBytes-=cached?.data.length||0;if(assetBytes+data.length>32*1024*1024){assets.clear();assetBytes=0;}assets.set(key,{data,type,at:Date.now()});assetBytes+=data.length;}
      return output(res,200,data,type,{'Cache-Control':'public, max-age=3600'});
    }
    const s=session(req,res);let body;
    if(post) {
      if(!String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded'))throw Error('搜尋表單格式錯誤。');
      body=searchFields(await bodyOf(req));
    }
    const start=performance.now();
    const result=await upstream(initial?SEARCH_PATH:RESULT_PATH,{method:req.method,body,jar:s.jar});
    const raw=new TextDecoder().decode(result.data);
    const html=post?relayResult(raw,body.get('SearchData')):rewriteHTML(raw,{full:initial,query:url.searchParams.get('q')||'',session:s.id});
    output(res,200,html,mime,{'Server-Timing':`cdc;dur=${Math.round(performance.now()-start)}`,'Referrer-Policy':'no-referrer',
      'Content-Security-Policy':`default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors ${[...appOrigins].join(' ')}`});
  }catch(error){output(res,502,JSON.stringify({error:error.message||'官方查詢暫時無法使用；不代表沒有疫情。'}));}
  finally{if(held)active--;}
});
service.requestTimeout=30000;
if(process.argv[1]===fileURLToPath(import.meta.url))service.listen(port,bind,()=>console.log(PUBLIC?`CDC relay (public mode) on ${bind}:${port}; allowed origins: ${[...appOrigins].join(' ')}`:`Travel comparison service: http://localhost:${port}/ (loopback only)`));
export {service};
