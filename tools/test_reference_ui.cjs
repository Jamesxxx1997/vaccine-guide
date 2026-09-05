// Usage: NODE_PATH=/path/to/jsdom/node_modules node tools/test_reference_ui.cjs
// jsdom exercises local DOM events only; it does not control a browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
const errors=[];
const logs=new VirtualConsole();logs.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{
  url:'http://localhost:8899/index.html',runScripts:'outside-only',
  pretendToBeVisual:true,virtualConsole:logs
});
const win=dom.window,doc=win.document;
for(const script of doc.scripts){
  const relative=script.getAttribute('src');
  const file=relative?path.resolve(root,relative):null;
  if(file)assert(file.startsWith(root+path.sep));
  vm.runInContext(file?fs.readFileSync(file,'utf8'):script.textContent,dom.getInternalVMContext(),
    {filename:relative||'index-inline.js'});
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS',name);}
const panel=()=>doc.querySelector('#reference-panel');
const click=el=>{assert(el,'Target exists');el.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));};
const hover=async el=>{el.dispatchEvent(new win.MouseEvent('mouseover',{bubbles:true}));await wait(270);};
const close=()=>click(panel().querySelector('[data-ref-close]'));
const label=(scope,text)=>[...scope.querySelectorAll('.ref-target')].find(el=>el.textContent===text);
const sources=()=>[...panel().querySelectorAll('img')].map(i=>i.getAttribute('src'));
const normalize=t=>t.normalize('NFKC').replace(/[^a-z0-9\u3400-\u9fff]/gi,'').toLowerCase();
function cropText(crop){
  const image=crop.querySelector('img').getAttribute('src');
  const page=Object.values(win.eval('REFERENCE_PAGES')).flatMap(d=>d.pages||[]).find(p=>p.img===image);
  const h=Number(crop.style.aspectRatio.split('/')[1]);
  const top=-parseFloat(crop.querySelector('img').style.top)*h/100;
  return page.lines.filter(l=>(l[1]+l[3])/2>=top&&(l[1]+l[3])/2<=top+h).map(l=>l[4]).join(' ');
}
const change=(id,value,event='change')=>{doc.getElementById(id).value=value;doc.getElementById(id).dispatchEvent(new win.Event(event,{bubbles:true}));};
(async()=>{
  await wait(20);
  const first=doc.querySelector('#results > .vax');
  await test('Direct layer loads, all seven sections are covered',()=>{
    assert.equal(doc.documentElement.dataset.referenceUi,'direct-v1');
    for(const section of doc.querySelectorAll('.panel')) {
      assert(section.querySelectorAll('.ref-target').length>10,section.id);
      const walker=doc.createTreeWalker(section,win.NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
        const n=walker.currentNode;
        if(!/[a-z0-9\u3400-\u9fff]/i.test(n.textContent))continue;
        assert(n.parentElement.closest('.ref-target,button,select,option,input,textarea,script,style,code'),
          section.id+' uncovered: '+n.textContent);
      }
    }
  });
  await test('Funding click opens sources without expanding the card',()=>{
    click(label(first,'公費'));assert(!panel().hidden);assert(!first.classList.contains('open'));
    assert(sources().some(s=>s.includes('S5-')));assert(panel().textContent.includes('公費標籤是摘要'));close();
  });
  await test('Type hover gives a real PDF preview; click pins it',async()=>{
    const type=label(first,'不活化');await hover(type);
    assert(!doc.querySelector('#reference-tip').hidden);
    assert(doc.querySelector('#reference-tip img').src.includes('S2-'));
    click(type);assert(!panel().hidden);assert(sources()[0].includes('S2-'));close();
    assert(doc.querySelector('#reference-tip').hidden,'Closing must not reopen tooltip');
  });
  await test('Card expand button remains functional; schedule text opens sources',()=>{
    click(first.querySelector('.ref-expand'));assert(first.classList.contains('open'));
    click([...first.querySelectorAll('.ref-target')].find(el=>el.textContent.startsWith('建議時程：')));
    assert(sources().length>=3);assert(first.classList.contains('open'));
    const sourceText=normalize(cropText(panel().querySelector('.ref-crop')));
    assert(sourceText.includes('接種時程')&&sourceText.includes('出生滿6個月'),sourceText);close();
  });
  await test('Every child vaccine and schedule cell opens its pinned S5 row + age header',()=>{
    const anchors=['B型肝炎','卡介苗','五合一','PCV13','水痘','MMR','日本腦炎','流感','A型肝炎','DTaP-IPV'];
    for(const [i,tr] of [...doc.querySelectorAll('#childTbl tr')].entries()) for(const td of tr.cells){
      click(td);assert(!panel().hidden);assert(sources().length>=2);
      assert(sources().every(s=>s.includes('S5-')));
      assert(normalize(cropText(panel().querySelectorAll('.ref-crop')[1])).includes(normalize(anchors[i])),anchors[i]);
      if(i===1)assert(normalize(cropText(panel().querySelectorAll('.ref-crop')[2])).includes('58個月'),'BCG 5-8 month footnote');
      assert(normalize(cropText(panel().querySelector('.ref-crop'))).includes('24hr'), 'Age header present');close();
    }
  });
  await test('Rotavirus notice gives actual web text, never an unrelated PDF',async()=>{
    const notice=doc.querySelector('#p-child > .note');await hover(notice);
    assert(doc.querySelector('#reference-tip').textContent.includes('出生滿6週'));
    click(notice);assert.equal(sources().length,0);
    assert(panel().textContent.includes('2027'));assert(panel().querySelector('a').href.includes('87058'));close();
  });
  await test('Child calculator rerendered text remains reference-enabled',async()=>{
    change('cMonths','12','input');await wait(20);
    assert(doc.querySelectorAll('#cOut li.ref-target').length>10);
    click(doc.querySelector('#cOut li'));assert(sources()[0].includes('S5-'));close();
  });
  await test('Adult B hepatitis antibody interpretation uses S6',()=>{
    const adult=[...doc.querySelectorAll('#adultList > .vax')].find(c=>c.querySelector('.vax-name').textContent.includes('B 型'));
    click(adult.querySelector('.sero p'));assert(sources()[0].includes('S6-'));close();
  });
  await test('Interval table and four-day grace note use different proper sources',()=>{
    click(doc.querySelector('#minAgeTbl tr').cells[1]);assert(sources()[0].includes('S3-'));close();
    const grace=[...doc.querySelectorAll('#p-interval .note')].find(n=>n.textContent.includes('4 天寬限'));
    click(grace);assert(sources()[0].includes('S3-'));close();
  });
  await test('Changing interval choices refreshes the source context',async()=>{
    change('ivA','0');change('ivB','1');await wait(20);
    click(doc.querySelector('#ivOut'));assert(sources()[0].includes('S2-'));close();
  });
  await test('All 124 rule keys remain accessible through rule text',()=>{
    const keys=new Set();
    for(const book of doc.querySelectorAll('#contraTbl .exq')){
      assert(book.closest('li').classList.contains('ref-target'));keys.add(book.dataset.ex);
    }
    assert.equal(keys.size,124);
  });
  await test('Exact, partial, gist and text statuses are not upgraded',()=>{
    for(const [key,e] of Object.entries(win.eval('EXCERPTS'))){
      const book=doc.querySelector(`#contraTbl [data-ex="${key}"]`);click(book.closest('li'));
      assert(!panel().hidden);
      if(e.status==='gist')assert.equal(panel().querySelectorAll('.exhl,.ref-highlight').length,0,key);
      if(e.type==='pdf'){
        const source=Object.values(win.eval('REFERENCE_PAGES')).find(d=>d.p===e.file);
        assert(sources().includes(source.pages[e.page-1].img),key);
        assert(panel().querySelector('.ref-label').textContent===win.eval('EX_STATUS')[e.status][0],key);
        if(e.status!=='gist')assert(panel().querySelectorAll('.ref-highlight').length>0,key);
      }
      else assert.equal(sources().length,0,key);
      close();
    }
  });
  await test('Screening update keeps condition checkboxes and new rule text working',async()=>{
    const checkbox=doc.querySelector('#conds input[data-id="fever"]')||[...doc.querySelectorAll('#conds input')].find(i=>i.parentElement.textContent.includes('發燒或正患'));
    checkbox.checked=true;checkbox.dispatchEvent(new win.Event('change',{bubbles:true}));await wait(20);
    const hit=doc.querySelector('#results .hit .exq');assert(hit);click(hit.closest('.hit').querySelector('.hit-txt'));
    assert(!panel().hidden);assert(sources()[0].includes('review/pages/'));assert(panel().querySelector('.ref-highlight'));close();
  });
  await test('Catch-up results are reference-enabled after recalculation',async()=>{
    change('cuVax','hepb');await wait(20);
    click(doc.querySelector('#cuOut li'));assert(sources()[0].includes('S8-'));close();
  });
  await test('Keyboard Enter opens; Escape closes and restores focus',()=>{
    const target=doc.querySelector('#childTbl td');
    target.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    assert(!panel().hidden);
    panel().dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert(panel().hidden);assert.equal(doc.activeElement,target);
  });
  await test('Whole-page view, zoom and source page selector work',()=>{
    click(label(doc.querySelector('#results > .vax'),'不活化'));
    click(panel().querySelector('[data-ref-full]'));assert(panel().querySelector('.ref-full'));
    const zoom=[...panel().querySelectorAll('button')].find(b=>b.textContent==='放大 ＋');click(zoom);
    assert.equal(panel().querySelector('.ref-view').style.width,'125%');
    const select=panel().querySelector('[data-ref-page]');select.value='2';select.dispatchEvent(new win.Event('change'));
    assert(panel().querySelector('.ref-pdf-link').href.endsWith('#page=2'));close();
  });
  await test('All 14 adult rows highlight within their vaccine row and keep full-width context',()=>{
    const rows=[[100,121],[121,142],[142,163],[163,184],[184,205],[205,224],[224,269],[269,315],[315,339],[339,364],[364,385],[385,406],[406,427],[427,448]];
    for(const [i,card] of [...doc.querySelectorAll('#adultList > .vax')].entries()){
      click(card.querySelector('.vax-name .ref-target')||card.querySelector('.vax-name'));
      assert(sources()[0].includes('S4-')&&sources()[0].endsWith('-1.jpg'));
      const overview=panel().querySelector('.ref-overview');assert(overview);
      const source=win.eval('REFERENCE_PAGES').S4.pages[0];
      const marks=overview.querySelectorAll('.ref-highlight');assert(marks.length>0,'adult '+i);
      for(const m of marks){const y=parseFloat(m.style.top)*source.h/100;assert(y>=rows[i][0]-2&&y<=rows[i][1]+2,'adult '+i+' y '+y);}
      const crop=panel().querySelector('.ref-crop');assert(Number(crop.style.aspectRatio.split('/')[1])>=200);
      assert(Number(crop.style.aspectRatio.split('/')[0])===source.w);close();
    }
  });
  await test('MMR antibody badge opens its antibody paragraph, not page-one legend',()=>{
    const card=doc.querySelectorAll('#adultList > .vax')[1];
    click(card.querySelector('.vax-head > .pill'));
    assert(sources()[0].includes('S4-')&&sources()[0].endsWith('-2.jpg'));close();
  });
  await test('Verified product rows map every cell to the correct PDF and highlight',async()=>{
    const expected={'class-shingrix':['S4-','-5.jpg'],'class-covid':['S12-','-1.jpg'],'class-rsv':['S13-','-18.jpg'],'class-dukoral':['S15-','-2.jpg'],'class-vaxchora':['S16-','-2.jpg']};
    for(const [claim,[source,suffix]] of Object.entries(expected)){
      const row=doc.querySelector('tr[data-ref-claim="'+claim+'"]');
      for(const cell of row.cells){click(cell);assert(sources()[0].includes(source)&&sources()[0].endsWith(suffix),claim);assert(panel().querySelector('.ref-highlight'),claim);close();}
      await hover(row.cells[0]);assert(doc.querySelector('#reference-tip .ref-overview'));assert(doc.querySelector('#reference-tip .ref-highlight'));
    }
    click(doc.querySelector('tr[data-ref-claim="class-rsv"] td'));assert(sources().some(s=>s.includes('S14-')&&s.endsWith('-22.jpg')));close();
    click(doc.querySelector('tr[data-ref-claim="class-covid"] td'));assert(sources().some(s=>s.includes('S12N-')));close();
  });
  await test('Cholera policy retains Taiwan and international evidence separately',()=>{
    click(doc.querySelector('[data-ref-claim="cholera-policy"]'));
    for(const [prefix,suffix] of [['S2-','-1.jpg'],['S15-','-4.jpg'],['S17-','-8.jpg']])assert(sources().some(s=>s.includes(prefix)&&s.endsWith(suffix)),prefix);
    assert(panel().textContent.includes('非 PDF'));close();
  });
  await test('Cholera calculator is formulation-aware in both orders and clears stale references',async()=>{
    const list=win.eval('IV_LIST');
    const id=key=>String(list.findIndex(v=>v.id===key));
    for(const key of ['cholera','dukoral','vaxchora'])for(const reverse of [false,true]){
      change('ivA',id(reverse?'yf':key));change('ivB',id(reverse?key:'yf'));await wait(20);
      assert(doc.querySelector('#ivOut').textContent.includes('3 週'),key);
      click(doc.querySelector('#ivOut'));assert(sources().some(s=>s.includes('S15-')));close();
    }
    change('ivA',id('vaxchora'));change('ivB',id('rota'));await wait(20);
    assert(!doc.querySelector('#ivOut').textContent.includes('2 週'));
    change('ivA','0');change('ivB','1');await wait(20);click(doc.querySelector('#ivOut'));
    assert(sources().every(s=>!s.includes('S15-')));close();
  });
  await test('Manual page change clears old highlights and matching status',()=>{
    click(doc.querySelector('tr[data-ref-claim="class-rsv"] td'));
    const section=panel().querySelector('.ref-evidence');assert(section.querySelector('.ref-highlight'));
    const select=section.querySelector('[data-ref-page]');select.value='1';select.dispatchEvent(new win.Event('change'));
    assert.equal(section.querySelectorAll('.ref-highlight,.ref-row-location').length,0);
    assert(section.querySelector('.ref-label').textContent.includes('手動翻頁'));
    assert(section.querySelector('.ref-meta').textContent.endsWith('第 1 頁'));close();
  });
  await test('Every source preview file exists and matches current source hash',()=>{
    for(const source of Object.values(win.eval('REFERENCE_PAGES'))){
      if(!source.pages)continue;
      const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source.p))).digest('hex');
      assert.equal(source.sha256,hash);
      for(const p of source.pages){assert(fs.existsSync(path.join(root,p.img)));assert(p.iw>0&&p.ih>0);}
    }
  });
  assert.deepEqual(errors,[]);console.log(`\n${count} test groups passed.`);win.close();
})().catch(e=>{console.error(e);win.close();process.exitCode=1;});
