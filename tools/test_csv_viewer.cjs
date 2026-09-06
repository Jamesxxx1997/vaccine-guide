// Regression for the user-visible snapshot link, not merely the embedded table.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
function load(url){
  const errors=[],logs=new VirtualConsole();logs.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'csv-viewer.html'),'utf8'),{url,runScripts:'outside-only',virtualConsole:logs});
  for(const script of dom.window.document.scripts)vm.runInContext(fs.readFileSync(path.join(root,script.getAttribute('src')),'utf8'),dom.getInternalVMContext());
  return {dom,win:dom.window,doc:dom.window.document,errors};
}
let checks=0;
for(const key of ['alerts','prescriptions']){
  const env=load('https://jamesxxx1997.github.io/vaccine-guide/csv-viewer.html?table='+key);
  const {doc,win}=env,api=win.eval('ReferenceTables'),table=api.get(key);
  assert(doc.querySelector('h1').textContent.includes(table.n));
  assert.equal(doc.querySelector('[aria-current="page"]').dataset.table,key);
  assert.equal(doc.querySelectorAll('tbody tr').length,40);
  const scope=doc.querySelector('[aria-label="CSV 顯示範圍"]');assert.equal(scope.value,'all');
  assert.equal(doc.querySelector('tbody tr').dataset.csvRecord,'1');
  doc.querySelector('[data-csv-next]').click();assert.equal(doc.querySelector('tbody tr').dataset.csvRecord,'41');
  doc.querySelector('[data-csv-prev]').click();assert.equal(doc.querySelector('tbody tr').dataset.csvRecord,'1');
  const search=doc.querySelector('input');search.value='千里達';search.dispatchEvent(new win.Event('input'));
  assert([...doc.querySelectorAll('tbody tr')].every(row=>row.textContent.includes('千里達')));
  const order=doc.querySelector('[aria-label="CSV 欄位順序"]');order.value='original';order.dispatchEvent(new win.Event('change'));
  assert.deepEqual([...doc.querySelectorAll('thead th')].slice(1).map(e=>e.textContent),Array.from(table.headers));
  for(const tr of doc.querySelectorAll('tbody tr'))assert.deepEqual([...tr.querySelectorAll('td')].map(e=>e.textContent),Array.from(table.rows[Number(tr.dataset.csvRecord)-1].values));
  const download=doc.querySelector('a[download]');assert.equal(download.getAttribute('href'),table.p);assert(!download.hasAttribute('target'));
  assert(!doc.querySelector('[data-csv-preview]'),'Fullpage should not link recursively to itself');
  assert.equal(env.errors.length,0);env.dom.window.close();checks++;
}
// Same widget is mounted by both the sidebar and hover: follow its ACTUAL link.
for(const key of ['alerts','prescriptions']){
  const env=load('https://jamesxxx1997.github.io/vaccine-guide/csv-viewer.html?table='+key);
  const api=env.win.eval('ReferenceTables'),table=api.get(key),container=env.doc.createElement('section');
  const filter={country:'千里達及托巴哥',countryEnglish:'Trinidad and Tobago',...(key==='alerts'?{countryKey:'TT',disease:'茲卡病毒感染症',date:'2020-11-06',detail:'',level:1}:{vaccine:'黃熱病疫苗'})};
  api.mount(container,table,filter,{compact:true});
  const link=container.querySelector('[data-csv-preview]');assert(link);assert(!link.hasAttribute('download'));
  const href=new URL(link.getAttribute('href'),'https://jamesxxx1997.github.io/vaccine-guide/index.html');
  assert.equal(href.pathname,'/vaccine-guide/csv-viewer.html');assert.equal(href.searchParams.get('table'),key);
  for(const [k,v] of Object.entries(filter))assert.equal(href.searchParams.get(k),String(v));
  const opened=load(href.href),matches=api.select(table,filter);
  assert.equal(opened.doc.querySelector('[aria-label="CSV 顯示範圍"]').value,'all');
  assert(opened.doc.querySelector(`tr[data-csv-record="${matches[0].record}"].ref-csv-match`),'Current context should be visible on arrival');
  const scope=opened.doc.querySelector('[aria-label="CSV 顯示範圍"]');scope.value='match';scope.dispatchEvent(new opened.win.Event('change'));
  assert.equal(opened.doc.querySelectorAll('.ref-csv-match').length,matches.length);
  assert.equal(opened.errors.length,0);opened.dom.window.close();env.dom.window.close();checks++;
}
for(const key of ['__proto__','constructor','missing','https://evil.example/file.csv']){
  const env=load('https://jamesxxx1997.github.io/vaccine-guide/csv-viewer.html?table='+encodeURIComponent(key));
  assert(env.doc.querySelector('[role=alert]'));assert(!env.doc.querySelector('table'));assert.equal(env.errors.length,0);env.dom.window.close();checks++;
}
{
  const attack='<img src=x onerror="window.bad=true">',env=load('file:///Users/example/vaccine-guide/csv-viewer.html?table=prescriptions&country='+encodeURIComponent(attack));
  assert(env.doc.querySelector('table'));assert(!env.doc.querySelector('img'));assert(env.doc.body.textContent.includes(attack));assert(!env.win.bad);
  assert.equal(env.errors.length,0);env.dom.window.close();checks++;
}
console.log(`PASS ${checks} CSV fullpage/actual-preview-link regression groups`);
