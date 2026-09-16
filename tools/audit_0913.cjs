// Read-only independent audit; outputs evidence to a caller-selected directory.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'/tmp/vaccine-audit');
fs.mkdirSync(out,{recursive:true});
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const context=vm.createContext({});
for(const file of ['review/allergens.js','review/adverse-effects.js','review/reference-pages.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const data=vm.runInContext('({allergens:ALLERGENS,adverse:ADVERSE_EFFECTS,claims:REFERENCE_CLAIMS,pages:REFERENCE_PAGES})',context);
const sources=JSON.parse(require('node:child_process').execFileSync('node',['tools/export_reference_inputs.mjs'],{cwd:root,encoding:'utf8'}));
const errors=[],checks={products:0,cells:0,claims:0,unknown:0},expectedClaims={};
const equal=(a,b,where)=>{if(JSON.stringify(a)!==JSON.stringify(b))errors.push({where,expected:a,actual:b});};
const fields=(a,b,ks,where)=>ks.forEach(k=>equal(a[k],b[k],where+'.'+k));
const ac=read('review/allergen-claims.json').claims;
for(const f of fs.readdirSync(path.join(root,'review/allergens.src.d')).filter(f=>f.endsWith('.json')).sort()){
  const d=read('review/allergens.src.d/'+f),sid=f.slice(0,-5),p=data.allergens.products.find(x=>x.id===sid),sw=read('review/allergen_sweep.d/'+sid+'.json');
  checks.products++;if(!p){errors.push({where:sid,error:'missing product'});continue;}
  fields({...d,origin:d.origin||'TFDA',lang:d.lang||'zh',vaccineName:d.vaccineName||'',note:d.note||''},p,['vaccine','product','source','origin','lang','vaccineName','note'],sid);
  const claim=(id,q)=>{expectedClaims[id]=true;checks.claims++;const item=ac[id]?.items?.[0];if(!item){errors.push({where:id,error:'missing claim'});return;}
    equal(ac[id].items.length,1,id+'.items.length');fields({source:d.source,page:q.page,quotes:[q.quote],glyphRows:true},item,['source','page','quotes','glyphRows'],id);equal(q.region,item.region,id+'.region');
    const built=data.claims[id]?.items?.[0];if(!built)errors.push({where:id,error:'missing built claim'});else fields(item,built,['source','page','quotes','region','label','glyphRows'],id+'.built');
  };
  for(const [type,tag,defaultLabel] of [['components','comp','成分'],['warnings','warn','警語']]){
    equal((d[type]||[]).length,p[type].length,sid+'.'+type+'.length');
    (d[type]||[]).forEach((q,i)=>{const id=`al:${sid}:${tag}:${i}`;claim(id,q);fields({label:q.label||defaultLabel,text:q.quote,claim:id},p[type][i]||{},['label','text','claim'],id+'.product');});
  }
  equal(data.allergens.keys.length,p.allergens.length,sid+'.allergens.length');
  const expanded=data.allergens.keys.map(({key})=>d.allergens.find(a=>a.key===key)||{key,status:'未載明',note:'分片未列，視為未載明'});
  for(const a of expanded){checks.cells++;const actual=p.allergens.find(x=>x.key===a.key)||{};let expected={status:a.status,note:a.note||'',claim:null};
    if(a.status==='未載明'){
      checks.unknown++;if(a.related){const id=`al:${sid}:${a.key}:related`;claim(id,a.related);Object.assign(expected,{claim:id,text:a.related.quote,related:true,note:a.related.note??a.note??''});}
      const cell=sw.cells[a.key];if(!cell){errors.push({where:sid+':'+a.key,error:'missing sweep'});continue;}
      expected.sweep={hits:cell.hits.length,patterns:cell.patterns.length,dismissed:d.sweep?.dismissed?.[a.key]||'',date:sw.date||''};
    }else{const id=`al:${sid}:${a.key}`;claim(id,a);Object.assign(expected,{claim:id,text:a.quote});}
    fields(expected,actual,['status','note','claim','text','related','sweep'],sid+':'+a.key);
  }
}
equal(Object.keys(expectedClaims).sort(),Object.keys(ac).sort(),'claim id set');
equal(checks.products,data.allergens.products.length,'product count');
const notes=[];
for(const t of data.adverse.tables)if(t.kind==='notes')for(const r of t.rows){
  const nums=s=>(s.normalize('NFKC').match(/\d+(?:\.\d+)?/g)||[]);
  const missing=nums(r.summary||'').filter(x=>!nums(r.text).includes(x));
  notes.push({source:t.source,table:t.id,title:t.title,population:t.population,label:r.label,claim:r.claim,summary:r.summary,text:r.text,missingNumbers:missing});
}
const payload={sources,claims:Object.fromEntries(Object.entries(data.claims).filter(([k])=>/^(al:|ae:)/.test(k))),pages:Object.fromEntries(Object.entries(data.pages).map(([k,v])=>[k,{sha256:v.sha256,p:v.p}]))};
fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(payload));
fs.writeFileSync(path.join(out,'translation.json'),JSON.stringify({checks,errors,notes},null,2));
console.log(JSON.stringify({checks,errors,notesRows:notes.length,notesWithMissingNumbers:notes.filter(n=>n.missingNumbers.length).length},null,2));
