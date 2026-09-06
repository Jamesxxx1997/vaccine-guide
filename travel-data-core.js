/* Pure CDC dataset parsing/consolidation. No HTTP, UI, or individual medical advice. */
const TravelDataCore=(()=>{
  'use strict';
  const norm=s=>String(s??'').normalize('NFKC').trim().toLocaleLowerCase();
  // Official 2024-09-01 rename, not a fuzzy disease match. Preserve raw strings
  // in evidence; only the temporal grouping identity is shared.
  // https://www.cdc.gov.tw/Disease/SubIndex/N6XvFa1YP9CXYdB0kNSA9A
  const diseaseIdentity=s=>s==='嚴重特殊傳染性肺炎'?'新冠併發重症':s;
  function parseCSV(text){
    text=String(text).replace(/^\uFEFF/,'');
    const rows=[];let row=[],field='',quoted=false,closed=false;
    const cell=()=>{row.push(field);field='';closed=false;};
    const record=()=>{cell();if(row.some(v=>v!==''))rows.push(row);row=[];};
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
      if(ch==='"'){if(field||closed)throw Error('Invalid CSV quotation');quoted=true;}
      else if(ch===',')cell();
      else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;record();}
      else {if(closed)throw Error('Unexpected text after CSV quotation');field+=ch;}
    }
    if(quoted)throw Error('Unterminated CSV quotation');
    if(field||row.length||closed)record();
    if(rows.length<2)throw Error('Empty CSV dataset');
    const headers=rows.shift();
    if(new Set(headers).size!==headers.length)throw Error('Duplicate CSV headers');
    if(rows.some(r=>r.length!==headers.length))throw Error('CSV column count changed');
    return {headers,rows:rows.map((values,i)=>({record:i+1,values}))};
  }
  const objects=table=>table.rows.map(r=>Object.fromEntries(table.headers.map((h,i)=>[h,r.values[i]])));
  function requireFields(table,names){for(const n of names)if(!table.headers.includes(n))throw Error('Source schema changed: missing '+n);}
  function dateOf(value){
    const date=String(value).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid source date: '+value);
    return date;
  }
  function rank(value){
    if(/^解除/.test(value))return 0;
    const i=['第一級','第二級','第三級'].findIndex(s=>value.startsWith(s));
    if(i<0)throw Error('Unknown official warning level: '+value);
    return i+1;
  }
  function build(tables){
    requireFields(tables.alerts,['effective','severity_level','alert_disease','areaDesc','areaDesc_EN','ISO3166','areaDetail','instruction']);
    requireFields(tables.prescriptions,['國名(中)','國名(英)','疫苗']);
    const alerts=objects(tables.alerts),prescriptions=objects(tables.prescriptions),ident=a=>norm(a.areaDesc_EN||a.areaDesc);
    const isoNames=new Map();
    for(const a of alerts){const iso=a.ISO3166.trim();if(!isoNames.has(iso))isoNames.set(iso,new Set());isoNames.get(iso).add(ident(a));}
    const keyOf=a=>{const iso=a.ISO3166.trim();return iso?(isoNames.get(iso).size===1?iso:iso+'::'+ident(a)):a.areaDesc.trim();};
    const countries=Object.create(null),latest=new Map();
    alerts.forEach((a,index)=>{
      const n=a.areaDesc.trim();if(!n)throw Error('Missing destination in alert');
      const key=keyOf(a),date=dateOf(a.effective),level=rank(a.severity_level.trim());
      if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe destination key');
      if(!countries[key])countries[key]={n,en:a.areaDesc_EN.trim(),a:[],unresolved:[],v:[],isGlobal:n==='全球'};
      const group=JSON.stringify([key,diseaseIdentity(a.alert_disease.trim()),a.areaDetail.trim()]);
      const previous=latest.get(group),item={a,key,date,level,record:index+1};
      if(!previous||date>previous[0].date)latest.set(group,[item]);
      else if(date===previous[0].date)previous.push(item);
    });
    let conflictGroups=0;
    for(const records of latest.values()){
      const levels=[...new Set(records.map(r=>r.level))];
      const conflict=levels.length>1;if(conflict)conflictGroups++;
      // Same-day conflicts are retained, including active vs lifted; never pick
      // one by source row ordering or silently prefer the most severe record.
      for(const level of levels){
        if(level===0&&!conflict)continue;
        const r=records.find(r=>r.level===level),c=countries[r.key];
        // An old-name COVID record with no matching post-rename destination
        // must not be advertised as a current 2020 L3. Keep it visibly unresolved,
        // never fabricate a replacement L1 or silently declare it lifted.
        if(r.a.alert_disease.trim()==='嚴重特殊傳染性肺炎'){
          c.unresolved.push([level,r.a.alert_disease.trim(),r.date,r.a.areaDetail.trim(),0,
            {records:records.filter(x=>x.level===level).map(x=>x.record),instruction:r.a.instruction.trim(),historical:true}]);
          continue;
        }
        c.a.push([level,r.a.alert_disease.trim(),r.date,r.a.areaDetail.trim(),c.isGlobal?1:0,
          {conflict,levels,records:records.filter(x=>x.level===level).map(x=>x.record),instruction:r.a.instruction.trim()}]);
      }
    }
    const nameIndex=new Map(),englishIndex=new Map();
    function register(key,c){
      for(const [index,name] of [[nameIndex,c.n],[englishIndex,c.en]]){
        if(!name)continue;const normalized=norm(name);if(!index.has(normalized))index.set(normalized,new Set());index.get(normalized).add(key);
      }
    }
    Object.entries(countries).forEach(([k,c])=>register(k,c));
    for(const p of prescriptions){
      const n=p['國名(中)'].trim(),en=p['國名(英)'].trim(),v=p['疫苗'].trim();
      if(!n)throw Error('Missing destination in prescription');
      const byName=nameIndex.get(norm(n)),byEnglish=englishIndex.get(norm(en));
      let key=byName?.size===1?[...byName][0]:byEnglish?.size===1?[...byEnglish][0]:null;
      // Conflicting explicit names stay separate even if an English alias is shared.
      if(byName?.size>1)key=null;
      if(key===null){key=n;if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe destination key');if(countries[key])key='prescription::'+n+'::'+en;countries[key]={n,en,a:[],v:[],isGlobal:false};register(key,countries[key]);}
      if(v&&!countries[key].v.includes(v))countries[key].v.push(v);
    }
    for(const c of Object.values(countries))c.a.sort((a,b)=>Number(b[5].conflict)-Number(a[5].conflict)||b[0]-a[0]||b[2].localeCompare(a[2]));
    const global=Object.entries(countries).filter(([,c])=>c.isGlobal).flatMap(([key,c])=>c.a.map(a=>({key,alert:a})));
    return {countries,global,conflictGroups,latestEffective:alerts.map(a=>dateOf(a.effective)).sort().at(-1)};
  }
  return Object.freeze({parseCSV,objects,build,dateOf,rank});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=TravelDataCore;
