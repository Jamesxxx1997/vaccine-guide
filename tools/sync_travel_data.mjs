#!/usr/bin/env node
// Full official CSVs -> immutable source bytes + one atomically published bundle.
// No credentials, browser scraping, TLS bypass, or individual recommendations.
import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import {rootCertificates} from 'node:tls';
import {X509Certificate,createHash,randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),core=require('../travel-data-core.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const sources={
  alerts:{n:'國際旅遊疫情建議等級（完整資料）',url:'https://www.cdc.gov.tw/CountryEpidLevel/ExportCSV?fileName=TCDCTravelAlertAll.csv&type=0',frequency:'每日',required:['source','effective','areaDesc','severity_level','alert_disease','instruction']},
  prescriptions:{n:'國際旅遊處方箋',url:'https://od.cdc.gov.tw/quarantine/TMPrescription.csv',frequency:'每月',required:['國名(中)','國名(英)','主類別','次類別','疫苗']}
};
let intermediate;
async function chain(){
  if(intermediate)return intermediate;
  // Leaf AIA points here. The origin incorrectly serves a different intermediate.
  const response=await fetch('https://sslserver.twca.com.tw/cacert/Cyber_SSL_2023.crt',{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Intermediate certificate download failed');
  const cert=new X509Certificate(Buffer.from(await response.arrayBuffer()));
  const fingerprint='01:AF:23:24:D0:98:09:8F:5E:0C:DF:6F:AA:BA:DA:43:0B:21:CC:E7:77:F4:7E:AC:B2:62:48:B2:FD:A3:E5:31';
  const now=Date.now(),valid=c=>c.ca&&Date.parse(c.validFrom)<=now&&Date.parse(c.validTo)>now;
  const trusted=rootCertificates.map(p=>new X509Certificate(p)).find(c=>c.subject===cert.issuer&&valid(c)&&cert.verify(c.publicKey));
  if(cert.fingerprint256!==fingerprint||!valid(cert)||!trusted)throw Error('Intermediate chain no longer matches reviewed trusted certificate');
  intermediate=cert.toString();return intermediate;
}
async function download(url){
  const host=new URL(url).hostname;
  if(!['www.cdc.gov.tw','od.cdc.gov.tw'].includes(host)||!url.startsWith('https://'))throw Error('Unapproved source URL');
  const ca=host==='od.cdc.gov.tw'?[...rootCertificates,await chain()]:undefined;
  return await new Promise((resolve,reject)=>{
    const request=https.get(url,{ca,rejectUnauthorized:true,family:4,timeout:45000},response=>{
      if(response.statusCode!==200){response.resume();reject(Error('Official source HTTP '+response.statusCode));return;}
      const chunks=[];let size=0;
      response.on('data',b=>{size+=b.length;if(size>12*1024*1024){request.destroy(Error('Official source exceeds size limit'));return;}chunks.push(b);});
      response.on('error',reject);
      response.on('end',()=>resolve({bytes:Buffer.concat(chunks),contentType:response.headers['content-type']||'',modified:response.headers['last-modified']||null}));
    });
    const deadline=setTimeout(()=>request.destroy(Error('Official source total deadline exceeded')),60000);
    request.once('close',()=>clearTimeout(deadline));
    request.on('timeout',()=>request.destroy(Error('Official source timed out')));request.on('error',reject);
  });
}
// Both alert URLs are official complete-history exports, not rolling-window feeds.
export async function downloadOfficial(url,{request=download,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  if(!Object.values(sources).some(s=>s.url===url))throw Error('Unapproved dataset URL');
  const candidates=url===sources.alerts.url?[url,'https://od.cdc.gov.tw/cdc/TCDCTravelAlert.csv']:[url];
  let last;
  for(const candidate of candidates){
    for(let attempt=1;attempt<=2;attempt++){
      try{return {...await request(candidate),url:candidate};}
      catch(e){last=e;console.warn(`Official download ${new URL(candidate).hostname} attempt ${attempt}/2 failed: ${e.message}`);if(attempt<2)await wait(1500);}
    }
  }
  throw last;
}
async function atomic(file,text){
  const temporary=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temporary,text,{flag:'wx'});await fs.rename(temporary,file);}
  finally{await fs.unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function immutable(file,bytes){
  try{await fs.writeFile(file,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(hash(await fs.readFile(file))!==hash(bytes))throw Error('Immutable source collision');}
}
export async function syncTravel({outRoot=root,downloadSource=downloadOfficial,now=()=>new Date().toISOString()}={}){
const sourceDir=path.join(outRoot,'data/travel/sources'),review=path.join(outRoot,'review');
const attemptedAt=now();
await fs.mkdir(sourceDir,{recursive:true});await fs.mkdir(review,{recursive:true});
try{
  const tables={},provenance={},raws={};
  for(const [key,source] of Object.entries(sources)){
    const got=await downloadSource(source.url);
    const decoded=new TextDecoder('utf-8',{fatal:true}).decode(got.bytes);
    const table=core.parseCSV(decoded);
    for(const name of source.required)if(!table.headers.includes(name))throw Error(key+': missing '+name);
    // Empty/near-empty data must never erase the last known successful dataset.
    if(table.rows.length<100)throw Error(key+': implausibly small official dataset');
    const sha256=hash(got.bytes),relative='data/travel/sources/'+key+'-'+sha256+'.csv';
    const fetchedAt=now();
    const actualUrl=got.url||source.url;
    provenance[key]={url:actualUrl,sha256,fetchedAt,sourceModified:got.modified,frequency:source.frequency,records:table.rows.length,path:relative};
    tables[key]={...table,n:source.n,p:relative,u:actualUrl,v:fetchedAt.slice(0,10),sha256,sourceModified:got.modified,frequency:source.frequency};
    raws[key]=got.bytes;
  }
  const built=core.build(tables),succeededAt=now();
  const bundle={schemaVersion:1,meta:{updated:succeededAt.slice(0,10),succeededAt,mode:'scheduled-snapshot',countries:Object.values(built.countries).filter(c=>!c.isGlobal).length,
    alerts:Object.values(built.countries).reduce((n,c)=>n+c.a.length,0),universal:[],blanket_note:'只將來源明列的全球紀錄另區呈現，不按涵蓋國家數推論。',
    src_alert:provenance.alerts.url,src_presc:provenance.prescriptions.url,latestEffective:built.latestEffective,conflictGroups:built.conflictGroups,provenance},
    countries:built.countries,global:built.global,tables};
  for(const [key,bytes] of Object.entries(raws))await immutable(path.join(outRoot,provenance[key].path),bytes);
  const json=JSON.stringify(bundle).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  await atomic(path.join(review,'travel-current.js'),'// Generated from complete official CSVs; raw sources are immutable.\nconst TRAVEL_CURRENT='+json+';\n');
  await atomic(path.join(review,'travel-sync-status.js'),'const TRAVEL_SYNC_STATUS='+JSON.stringify({attemptedAt,succeededAt,outcome:'success'})+';\n');
  console.log(JSON.stringify({result:'success',countries:bundle.meta.countries,records:Object.fromEntries(Object.entries(tables).map(([k,t])=>[k,t.rows.length])),conflictGroups:built.conflictGroups,latestEffective:built.latestEffective,sourceModified:provenance.prescriptions.sourceModified}));
  return true;
}catch(e){
  await atomic(path.join(review,'travel-sync-status.js'),'const TRAVEL_SYNC_STATUS='+JSON.stringify({attemptedAt,outcome:'failed',message:'官方資料更新未成功；保留上次通過檢查的資料。'})+';\n');
  console.error('Failed; last successful bundle preserved:',e.message);return false;
}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(!await syncTravel())process.exitCode=1;
}
