// Exhaustive inventory of reference entry points, with inspectable source geometry.
const fs=require('node:fs');
const {dom,win,doc,errors}=require('./reference_test_env.cjs')();
const api=win.referenceTest;
const rows=[];
for(const section of doc.querySelectorAll('.panel')){
  for(const [i,el] of [...section.querySelectorAll('.ref-target')].entries()){
    const data=api.refs.get(el),items=api.evidence(data);
    rows.push({panel:section.id,index:i,text:el.textContent.trim(),data,
      items:items.map(({doc:d,view:v,exact:e})=>({source:Object.entries(win.eval('REFERENCE_PAGES')).find(([k,d2])=>d===d2)?.[0]||d.n,
        page:v?.page.page,grade:v?.grade||e?.status,rects:v?.rects?.length||0,locatedRow:!!v?.locatedRow,
        text:!v,matched:v?.rects?.flatMap(r=>(v.page.chars||v.page.words||[]).filter(c=>
          (c[0]+c[2])/2>=r[0]&&(c[0]+c[2])/2<=r[2]&&(c[1]+c[3])/2>=r[1]&&(c[1]+c[3])/2<=r[3]).map(c=>c[4])).join('')||''}))});
  }
}
const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(rows,null,2));
for(const id of new Set(rows.map(r=>r.panel))){
 const group=rows.filter(r=>r.panel===id),zero=group.filter(r=>r.items.some(i=>!i.text)&&!r.items.some(i=>i.rects));
 console.log(id,group.length,'no yellow in any PDF',zero.length);
 console.log(zero.map(r=>`${r.index}\t${r.items.map(i=>i.source).join(',')}\t${r.text.replace(/\s+/g,' ').slice(0,190)}`).join('\n'));
}
if(errors.length)throw Error(errors.join('\n'));
dom.window.close();
