// Read-only UI audit and concrete verdict reproductions; no network or publishing.
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'/tmp/vaccine-audit');fs.mkdirSync(out,{recursive:true});
const {dom,win,doc}=require('./reference_test_env.cjs')({beforeScripts(w){w.scrollTo=()=>{}}});
const data=win.eval('ALLERGENS'),rows=[...doc.querySelectorAll('#allergenMatrix tbody tr')];
const result={rows:rows.length,optionsA:doc.querySelectorAll('#allergyA option[value^="product:"]').length,optionsB:doc.querySelectorAll('#allergyB option').length-1,badges:rows.every(r=>r.querySelector('.origin-badge')),orderErrors:[],search:{},evaluation:{}};
const products=rows.map(r=>data.products.find(p=>p.id===r.dataset.allergyProduct));let seen=new Set(),prev;
for(const p of products){if(p.vaccine!==prev&&seen.has(p.vaccine))result.orderErrors.push(p.id);seen.add(p.vaccine);prev=p.vaccine;}
for(const v of seen){let foreign=false;for(const p of products.filter(p=>p.vaccine===v)){if(p.origin!=='TFDA')foreign=true;else if(foreign)result.orderErrors.push(p.id);}}
for(const q of ['蛋過敏可以打流感疫苗嗎','對PEG過敏可以打莫德納嗎','Shingrix 成分'])result.search[q]=win.VaccineSearch.find(q).slice(0,5).map(r=>({id:r.entry.id,title:r.entry.title}));
for(const [a,b] of [['product:S20','S76'],['product:S20','S58'],['product:S41','S87'],['key:other_antibiotics','S81'],['key:peg_polysorbate','S76'],['key:egg','S89']]){
 const el=win.AllergyGuidance.evaluate(a,b);result.evaluation[a+' -> '+b]={rules:[...el.querySelectorAll('[data-allergy-rule]')].map(x=>x.dataset.allergyRule),text:el.textContent};
}
result.distinctOrderedPairs=0;result.pairsWithSharedListedAllergens=0;
for(const a of data.products)for(const b of data.products)if(a.id!==b.id){result.distinctOrderedPairs++;if(a.allergens.some(x=>x.status==='有'&&b.allergens.some(y=>y.key===x.key&&y.status==='有')))result.pairsWithSharedListedAllergens++;}
fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,evaluation:Object.fromEntries(Object.entries(result.evaluation).map(([k,v])=>[k,v.rules]))},null,2));
dom.window.close();
