import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {syncTravel,downloadOfficial} from './sync_travel_data.mjs';
const require=createRequire(import.meta.url),core=require('../travel-data-core.js');
const table=objects=>({headers:Object.keys(objects[0]),rows:objects.map((x,i)=>({record:i+1,values:Object.values(x)}))});
const a=(extra={})=>({effective:'2026-09-01',severity_level:'第一級:注意(Watch)',alert_disease:'測試疾病',areaDesc:'甲',areaDesc_EN:'A',ISO3166:'AA',areaDetail:'',instruction:'注意',...extra});
const presc=()=>table([{'國名(中)':'甲','國名(英)':'A','疫苗':'test'}]);
test('bounded official retries preserve actual provenance and use only complete official alternatives',async()=>{
  const url='https://www.cdc.gov.tw/CountryEpidLevel/ExportCSV?fileName=TCDCTravelAlertAll.csv&type=0';
  const calls=[],waits=[];
  const result=await downloadOfficial(url,{request:async u=>{calls.push(u);if(calls.length<3)throw Error('timeout');return {bytes:Buffer.from('original'),modified:null};},wait:async ms=>waits.push(ms)});
  assert.deepEqual(calls,[url,url,'https://od.cdc.gov.tw/cdc/TCDCTravelAlert.csv']);
  assert.equal(result.url,calls[2]);assert.deepEqual(result.bytes,Buffer.from('original'));assert.deepEqual(waits,[1500]);
  let count=0;
  await assert.rejects(downloadOfficial(url,{request:async()=>{count++;throw Error('offline');},wait:async()=>{}}),/offline/);
  assert.equal(count,4);
  await assert.rejects(downloadOfficial('https://untrusted.example/data.csv'),/Unapproved/);
});
test('strict CSV parser preserves quoted newlines, commas, leading zero and HTML as strings',()=>{
  const t=core.parseCSV('\uFEFFa,b\r\n"01","<img>,x\n""quote"""\r\n');
  assert.deepEqual(t.rows[0].values,['01','<img>,x\n"quote"']);
  for(const raw of ['a,a\n1,2','a,b\n"x,y','a,b\n1,2,3','a,b\n"x"z,2'])assert.throws(()=>core.parseCSV(raw));
});
test('unknown severity and invalid calendar dates fail closed',()=>{
  assert.throws(()=>core.rank('第四級'));assert.throws(()=>core.dateOf('2026-02-30'));
});
test('latest lifted suppresses older active, same-day conflict never chosen by source order',()=>{
  const rows=[a(),a({severity_level:'解除'})];
  for(const input of [rows,[...rows].reverse()]){
    const c=core.build({alerts:table(input),prescriptions:presc()}).countries.AA;
    assert.deepEqual(c.a.map(a=>a[0]).sort(),[0,1]);assert(c.a.every(a=>a[5].conflict));
  }
  assert.equal(core.build({alerts:table([a(),a({effective:'2026-09-02',severity_level:'解除'})]),prescriptions:presc()}).countries.AA.a.length,0);
});
test('complete history keeps old still-active diseases; no 30-day cutoff',()=>{
  assert.equal(core.build({alerts:table([a({effective:'2019-01-01'})]),prescriptions:presc()}).countries.AA.a.length,1);
});
test('same ISO never merges distinct destinations; ambiguous aliases stay separate',()=>{
  const c=core.build({alerts:table([a({ISO3166:'GP'}),a({areaDesc:'乙',areaDesc_EN:'B',ISO3166:'GP'})]),prescriptions:presc()}).countries;
  assert(c['GP::a']);assert(c['GP::b']);assert(!c.GP);
});
test('reviewed COVID rename resolves latest state, unmatched old names are visibly unresolved',()=>{
  const old=a({alert_disease:'嚴重特殊傳染性肺炎',effective:'2020-03-21',severity_level:'第三級:警告(Warning)'});
  let c=core.build({alerts:table([old,a({alert_disease:'新冠併發重症',effective:'2023-11-01'})]),prescriptions:presc()}).countries.AA;
  assert.equal(c.a.length,1);assert.equal(c.a[0][0],1);assert.equal(c.a[0][1],'新冠併發重症');
  c=core.build({alerts:table([old]),prescriptions:presc()}).countries.AA;
  assert.equal(c.a.length,0);assert.equal(c.unresolved[0][0],3);assert(c.unresolved[0][5].historical);
});
test('sync failure preserves last good bundle and immutable raw bytes, records a visible failure status',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'travel-sync-test-'));
  try{
    const context={};vm.runInNewContext(await fs.readFile(new URL('../review/travel-current.js',import.meta.url),'utf8')+';this.bundle=TRAVEL_CURRENT',context);
    const raws=await Promise.all(Object.values(context.bundle.tables).map(t=>fs.readFile(new URL('../'+t.p,import.meta.url))));
    let calls=0;
    assert(await syncTravel({outRoot:root,downloadSource:async()=>({bytes:raws[calls++],modified:'Fri, 21 Aug 2026 09:32:04 GMT'}),now:()=> '2026-09-06T06:00:00Z'}));
    const bundle=await fs.readFile(path.join(root,'review/travel-current.js'));
    calls=0;
    assert.equal(await syncTravel({outRoot:root,downloadSource:async()=>{if(calls++)throw Error('network offline');return {bytes:raws[0],modified:null};},now:()=> '2026-09-07T06:00:00Z'}),false);
    assert.deepEqual(await fs.readFile(path.join(root,'review/travel-current.js')),bundle);
    assert.match(await fs.readFile(path.join(root,'review/travel-sync-status.js'),'utf8'),/failed/);
    assert.equal((await fs.readdir(path.join(root,'data/travel/sources'))).length,2);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
