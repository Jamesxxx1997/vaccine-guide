// 人工覆核打勾（human-verify.js）：單位偵測、id 穩定性、指紋、舊證據偵測、合併、同步呼叫路徑。
// 全部在 jsdom 裡跑，fetch 與 localStorage 都是 stub，不打任何真實網路、不碰真實 token。
// 用法：node tools/test_human_verify.cjs
const assert=require('node:assert/strict');
const vm=require('node:vm');
const setup=require('./reference_test_env.cjs');

// ── stub 環境 ──────────────────────────────────────────────────────
function makeEnv(opts={}){
  const calls=[];                 // [{url, method, body}]
  const ls={};
  const env=setup({beforeScripts(w){
    w.scrollTo=()=>{};
    // jsdom 已經有一個真的 localStorage，直接指派會被忽略（human-verify.js 取到的還是原來那個），
    // 必須用 defineProperty 覆蓋才攔得到。
    Object.defineProperty(w,'localStorage',{configurable:true,value:{
      getItem:k=>(k in ls?ls[k]:null),
      setItem:(k,v)=>{ls[k]=String(v);},
      removeItem:k=>{delete ls[k];},
      clear:()=>{for(const k of Object.keys(ls))delete ls[k];},
    }});
    w.fetch=async(url,init={})=>{
      const method=init.method||'GET';
      const rec={url:String(url),method,body:init.body?JSON.parse(init.body):null,headers:init.headers||{}};
      calls.push(rec);
      const r=opts.respond&&opts.respond(rec,calls);
      if(r)return r;
      return {ok:false,status:404,async json(){return {};}};
    };
    if(opts.seedToken)ls['hv:token']=opts.seedToken;
    if(opts.seedRecords)ls['hv:records']=JSON.stringify(opts.seedRecords);
  }});
  return {...env,calls,ls};
}
const ok=obj=>({ok:true,status:200,async json(){return obj;}});

// 收集「所有分頁、所有疫苗／疾病都渲染過」之後的完整單位集合。
// 副作用分頁一次只渲染一支疫苗、疾病臨床一次只渲染一個面板，所以要逐一 show 再 refresh。
function sweep(env){
  const {win,doc}=env, HV=win.HumanVerify;
  HV.refresh(doc);
  if(win.AdverseEffects)for(const v of win.AdverseEffects.vaccines){win.AdverseEffects.show(v);HV.refresh(doc);}
  if(win.Clinical){
    const CL=win.eval('typeof CLINICAL!=="undefined"?CLINICAL:null');
    for(const dId of Object.keys(CL.diseases))
      for(const pid of Object.keys(CL.diseases[dId].panels)){win.Clinical.show(dId,pid);HV.refresh(doc);}
  }
  return HV;
}

// ════════════════════════════════════════════════════════════════════
// 1. 單位偵測：各 panel 的數量與 id 唯一性、指紋非空
// ════════════════════════════════════════════════════════════════════
const env=makeEnv();
assert(typeof env.win.HumanVerify==='object','HumanVerify 已載入');
const HV=sweep(env);
const ids=HV.unitIds();
const kind=p=>ids.filter(i=>i.startsWith(p)).length;

const VAX=env.win.eval('VAX');
assert.equal(kind('contra:'),VAX.length,`禁忌總表每支疫苗一列：${kind('contra:')} vs VAX ${VAX.length}`);

const intervalRows=ids.filter(i=>i.startsWith('row:interval-general:'));
assert(intervalRows.length>=7,'間隔通則表列數 ≥7：'+intervalRows.length);

// 疾病臨床：卡片＋估計值表列。多條同議題會合成一張議題卡（＝一個單位），所以單位數低於資料 item 數，
// 這是使用者指定的最小單位定義（議題卡整張一個單位），不是漏抓。
const clinicalUnits=kind('clinical:')+kind('clinical-topic:');
assert(clinicalUnits>=250,'疾病臨床單位 ≥250（卡＋估計值表列）：'+clinicalUnits);

assert(kind('allergen:')>=50,'過敏矩陣產品列 ≥50：'+kind('allergen:'));
assert(kind('allergy-rule:')>=10,'指引判讀卡 ≥10：'+kind('allergy-rule:'));
assert(kind('adverse:')>=60,'副作用原件表 ≥60：'+kind('adverse:'));
assert(kind('alert:')>=5,'警示框 ≥5：'+kind('alert:'));
assert(ids.includes('alert:abrysvo-pregnancy-weeks'),'Abrysvo 孕婦週數警示框有明確 id');

assert.equal(new Set(ids).size,ids.length,'每個單位 id 唯一');
for(const id of ids){
  const f=HV.fingerprintOf(id);
  assert(f&&typeof f.fp==='string'&&f.fp.length>=16,'fp 非空：'+id);
  assert(!/:\s*$/.test(id)&&!/undefined/.test(id),'id 不含 undefined／空尾：'+id);
  assert(!/^\d+$/.test(id.split(':').pop()),'rowKey 不是純列序：'+id);   // 穩定性：不能用列序當 key
}

// 同一頁載入兩次，同一個單位的 fp 必須相同（指紋只依內容，不依載入次序或時間）
const env2=makeEnv();
const HV2=sweep(env2);
const ids2=HV2.unitIds();
assert.deepEqual([...ids].sort(),[...ids2].sort(),'兩次載入偵測到同一組單位 id');
let sameFp=0;
for(const id of ids){assert.equal(HV.fingerprintOf(id).fp,HV2.fingerprintOf(id).fp,'fp 跨載入穩定：'+id);sameFp++;}
assert(sameFp===ids.length,'全部單位 fp 一致');

// ════════════════════════════════════════════════════════════════════
// 2. 勾選 → localStorage 有記錄、UI 變 ☑；再勾一次 → checked:false
// ════════════════════════════════════════════════════════════════════
{
  const e=makeEnv();const H=sweep(e);
  const target='contra:'+VAX[0].id;
  assert(H.unitIds().includes(target),'測試目標單位存在：'+target);
  const tr=e.doc.querySelector(`#contraTbl tr[data-verify-vaccine="${VAX[0].id}"]`);
  const btn=tr.querySelector('.hv-ctl .hv-btn');
  assert(btn,'單位掛上了打勾控制');
  assert(/^☐/.test(btn.textContent),'初始為未覆核：'+btn.textContent);

  btn.dispatchEvent(new e.win.MouseEvent('click',{bubbles:true,cancelable:true}));
  const saved=JSON.parse(e.ls['hv:records']);
  assert.equal(saved.units[target].checked,true,'localStorage 記錄 checked:true');
  assert(saved.units[target].at,'記錄帶時間戳');
  assert(saved.units[target].fp,'記錄帶指紋');
  assert(/^☑ 已覆核 \d{4}-\d{2}-\d{2}$/.test(btn.textContent),'UI 變 ☑ 已覆核＋日期：'+btn.textContent);
  assert.equal(H.stateOf(target),'checked','狀態＝checked');
  assert(e.ls['hv:pending'].includes(target),'待上傳佇列含此單位');

  btn.dispatchEvent(new e.win.MouseEvent('click',{bubbles:true,cancelable:true}));
  const saved2=JSON.parse(e.ls['hv:records']);
  assert.equal(saved2.units[target].checked,false,'再勾一次 → checked:false（帶新 at 才能同步刪除）');
  assert(saved2.units[target].at>saved.units[target].at||saved2.units[target].at>=saved.units[target].at,'取消勾帶較新的 at');
  assert(/^☐/.test(btn.textContent),'UI 回到未覆核');
  console.log('PASS 勾選/取消：localStorage 與 UI 同步，取消是 checked:false 而非刪 key');
}

// ════════════════════════════════════════════════════════════════════
// 3. 證據變動 → 舊證據；差異文字含 claim id；「重新確認」後恢復 ☑
// ════════════════════════════════════════════════════════════════════
{
  const e=makeEnv();const H=sweep(e);
  // 找一個有 claim 的單位（間隔通則表的霍亂列帶 cholera-policy）
  const target=H.unitIds().find(id=>H.fingerprintOf(id).claims.length===1&&id.startsWith('row:'));
  assert(target,'找到單一 claim 的表格列單位');
  const claimId=H.fingerprintOf(target).claims[0];
  const before=H.fingerprintOf(target).fp;

  e.win.HumanVerify.toggle(target);
  assert.equal(H.stateOf(target),'checked','先勾起來');

  // 改掉該 claim 的 quotes（模擬來源重新擷取後引句變了）。
  // REFERENCE_CLAIMS 是頂層 const，只能在同一個 VM context 裡改；win.eval 拿到的是另一份綁定，改了看不見。
  vm.runInContext(`REFERENCE_CLAIMS[${JSON.stringify(claimId)}].items[0].quotes=REFERENCE_CLAIMS[${JSON.stringify(claimId)}].items[0].quotes.map(q=>q+'（測試改動）')`,e.dom.getInternalVMContext());
  H.redrawAll();

  assert.notEqual(H.fingerprintOf(target).fp,before,'quotes 改動後指紋改變');
  assert.equal(H.stateOf(target),'stale','狀態變舊證據');
  const diff=H.diffOf(target);
  assert(diff&&diff.length,'有差異說明');
  assert(diff.join('\n').includes(claimId),'差異文字含 claim id '+claimId+'：'+diff.join(' / '));

  // UI：☑⚠ 舊證據 + 重新確認按鈕出現
  const unitEl=e.doc.querySelector(`[data-hv-state="stale"]`);
  assert(unitEl,'DOM 上標了 stale');
  const ctl=unitEl.querySelector('.hv-ctl')||unitEl.querySelector('td .hv-ctl');
  assert(/^☑⚠ 舊證據/.test(ctl.querySelector('.hv-btn').textContent),'UI 顯示舊證據：'+ctl.querySelector('.hv-btn').textContent);
  const re=ctl.querySelector('.hv-recheck');
  assert(re&&!re.hidden,'重新確認按鈕可見');

  re.dispatchEvent(new e.win.MouseEvent('click',{bubbles:true,cancelable:true}));
  assert.equal(H.stateOf(target),'checked','重新確認後恢復 ☑');
  assert.equal(JSON.parse(e.ls['hv:records']).units[target].fp,H.fingerprintOf(target).fp,'記錄的 fp 已更新為目前指紋');
  console.log('PASS 舊證據：quotes 改動 → stale ＋ 差異含 claim id ＋ 重新確認恢復');
}

(async()=>{
// ════════════════════════════════════════════════════════════════════
// 3b. 迴歸：勾完之後指紋不得自己漂移
//     reference-ui.js 的 wire() 會在初次渲染「之後」才把「展開／收合」按鈕（.ref-expand）插進
//     details>summary 與 .vax-head；human-verify 自己的 .hv-ctl 也是事後插的。
//     這些 UI 若被算進指紋，使用者勾完幾百毫秒後單位就會自己變「舊證據」（實際踩過）。
// ════════════════════════════════════════════════════════════════════
{
  const e=makeEnv();const H=sweep(e);
  // 只取「目前仍掛在 DOM 上」的單位：副作用與疾病臨床一次只渲染一支疫苗／一個面板，
  // sweep 走完後留在畫面上的是最後那一批，早先批次的單位已不在 units map 裡。
  H.redrawAll();
  const live=H.unitIds().filter(id=>H.fingerprintOf(id));
  const picks=['contra:','row:','alert:','allergen:','allergy-rule:','clinical:','clinical-topic:','adult:']
    .map(p=>live.find(i=>i.startsWith(p))).filter(Boolean);
  assert(picks.length>=7,'各類單位都抽到樣本：'+picks.length+' '+picks.join(','));
  const fpBefore=Object.fromEntries(picks.map(id=>[id,H.fingerprintOf(id).fp]));
  for(const id of picks)H.toggle(id);
  // 讓 reference-ui 的 wire() 與本檔的 MutationObserver debounce 都跑完，再重算一次
  await new Promise(r=>setTimeout(r,400));
  H.redrawAll();
  for(const id of picks){
    assert.equal(H.fingerprintOf(id).fp,fpBefore[id],'指紋不因事後注入的 UI 而漂移：'+id);
    assert.equal(H.stateOf(id),'checked','勾完仍是 checked（沒有自己變舊證據）：'+id);
  }
  // 單位 id 與數量也不得因為掛上控制而改變
  const n=H.unitIds().length;
  H.redrawAll();H.redrawAll();
  assert.equal(H.unitIds().length,n,'重複 redraw 不會長出新單位：'+n+' vs '+H.unitIds().length);
  console.log(`PASS 指紋穩定性：${picks.length} 類單位勾選後指紋與狀態不漂移，重複 redraw 單位數恆為 ${n}`);
}

// ════════════════════════════════════════════════════════════════════
// 3c. 動態重繪後能重新掛勾（切換 clinical 面板走 MutationObserver 路徑，不手動 refresh）
// ════════════════════════════════════════════════════════════════════
{
  const e=makeEnv();sweep(e);
  e.win.Clinical.show('flu','qa');
  await new Promise(r=>setTimeout(r,500));       // MutationObserver microtask + 60ms debounce
  const cards=[...e.doc.querySelectorAll('#clinicalRoot .clinical-item')];
  assert(cards.length>0,'qa 面板有卡片');
  const withCtl=cards.filter(c=>c.querySelector(':scope > .hv-ctl')).length;
  assert.equal(withCtl,cards.length,`切換面板後每張卡都重新掛上控制：${withCtl}/${cards.length}`);
  console.log(`PASS 動態重繪：切換 clinical 面板後 ${withCtl} 張卡自動重新掛勾（MutationObserver）`);
}

// ════════════════════════════════════════════════════════════════════
// 3d. 同一個單位在畫面上出現兩次時（過敏 A→B 選擇器會再渲染一張同 id 的指引判讀卡），
//     兩個控制必須顯示同一個狀態——它們共用同一筆紀錄。
// ════════════════════════════════════════════════════════════════════
{
  const e=makeEnv();const H=sweep(e);
  const AG=e.win.AllergyGuidance;
  AG.evaluate('product:'+AG.products[0],AG.products[1]);
  await new Promise(r=>setTimeout(r,400));
  H.redrawAll();
  const byId={};
  for(const c of e.doc.querySelectorAll('.allergy-rule[data-allergy-rule]'))
    (byId[c.dataset.allergyRule]=byId[c.dataset.allergyRule]||[]).push(c);
  const dupId=Object.keys(byId).find(k=>byId[k].length>1);
  if(dupId){
    H.toggle('allergy-rule:'+dupId);H.redrawAll();
    const texts=byId[dupId].map(c=>{const b=c.querySelector(':scope > .hv-ctl .hv-btn');return b?b.textContent:'NO-CTL';});
    assert.equal(new Set(texts).size,1,'重複渲染的同一單位，兩個控制顯示同一狀態：'+JSON.stringify(texts));
    assert(/^☑/.test(texts[0]),'兩者都是已覆核：'+texts[0]);
    console.log(`PASS 重複渲染：allergy-rule:${dupId} 出現 ${byId[dupId].length} 次，控制狀態一致（${texts[0]}）`);
  } else console.log('SKIP 重複渲染：本次選擇器結果沒有重複的判讀卡');
}

// ════════════════════════════════════════════════════════════════════
// 4. 合併：同 unitId 以 at 較新者為準（本機新／遠端新各一例）；匯出物件形狀
// ════════════════════════════════════════════════════════════════════
{
  const e=makeEnv();sweep(e);
  const M=e.win.HumanVerify.mergeStores;
  const older={version:1,units:{a:{checked:true,at:'2026-09-01T00:00:00.000Z',fp:'x'},c:{checked:true,at:'2026-09-01T00:00:00.000Z',fp:'c1'}}};
  const newer={version:1,units:{a:{checked:false,at:'2026-09-10T00:00:00.000Z',fp:'y'},b:{checked:true,at:'2026-09-05T00:00:00.000Z',fp:'z'}}};
  const m1=M(older,newer);   // 本機（第二參數）較新 → 勝
  assert.equal(m1.units.a.checked,false,'本機 at 較新 → 取消勾勝出');
  assert.equal(m1.units.a.fp,'y');
  assert.equal(m1.units.b.checked,true,'只在一邊出現的單位保留');
  assert.equal(m1.units.c.fp,'c1','只在另一邊出現的單位保留');
  const m2=M(newer,older);   // 換邊：仍應由 at 較新者勝，不看參數順序
  assert.equal(m2.units.a.checked,false,'遠端 at 較新 → 遠端勝（與參數順序無關）');
  assert.equal(Object.keys(m2.units).length,3,'聯集三個單位');

  const exp=e.win.HumanVerify.exportObject();
  assert.equal(exp.version,1,'匯出 version=1');
  assert(typeof exp.updatedAt==='string'&&/^\d{4}-/.test(exp.updatedAt),'匯出帶 updatedAt ISO');
  assert(exp.units&&typeof exp.units==='object','匯出帶 units 物件');
  // 匯入合併：較新者勝
  e.win.HumanVerify.applyImport({version:1,updatedAt:'2026-09-19T00:00:00.000Z',units:{'alert:abrysvo-pregnancy-weeks':{checked:true,at:'2099-01-01T00:00:00.000Z',fp:'imported',claims:[],srcVer:{}}}});
  assert.equal(e.win.HumanVerify.store.units['alert:abrysvo-pregnancy-weeks'].fp,'imported','匯入的較新紀錄勝出');
  console.log('PASS 合併與匯出匯入：at 較新者勝、聯集保留、匯出形狀正確');
}

// ════════════════════════════════════════════════════════════════════
// 5. 同步：無 token 不 PUT；有假 token 時 PUT 帶 sha 與 branch；409 後重 GET 再 PUT
// ════════════════════════════════════════════════════════════════════
{
  // 5a 無 token
  const e=makeEnv();sweep(e);
  e.win.HumanVerify.toggle('alert:abrysvo-pregnancy-weeks');
  await e.win.HumanVerify.pushRemote();
  assert.equal(e.calls.filter(c=>c.method==='PUT').length,0,'沒有 token 時完全不呼叫 PUT');
  assert(!Object.keys(e.ls).includes('hv:token'),'沒有寫入任何 token');
  console.log('PASS 無 token：只存本機，0 次 PUT');
}
{
  // 5b 假 token：第一次 PUT 回 409（sha 衝突）→ 重新 GET 合併 → 第二次 PUT 成功
  let putCount=0,getCount=0;
  const remoteDoc={version:1,updatedAt:'2026-09-18T00:00:00.000Z',units:{'contra:bcg':{checked:true,at:'2026-09-18T00:00:00.000Z',fp:'remote',claims:[],srcVer:{}}}};
  const b64=s=>Buffer.from(s,'utf8').toString('base64');
  const e=makeEnv({
    seedToken:'ghp_FAKE_TOKEN_FOR_TEST_ONLY',
    respond(rec){
      if(rec.method==='GET'&&rec.url.startsWith('https://api.github.com/')){
        getCount++;
        return ok({sha:'sha-'+getCount,content:b64(JSON.stringify(remoteDoc)),encoding:'base64'});
      }
      if(rec.method==='PUT'){
        putCount++;
        if(putCount===1)return {ok:false,status:409,async json(){return {message:'is at ... but expected ...'};}};
        return ok({content:{sha:'sha-after-put'}});
      }
      return null;
    }
  });
  const H=sweep(e);
  H.toggle('alert:abrysvo-pregnancy-weeks');
  await e.win.HumanVerify.pushRemote();

  const puts=e.calls.filter(c=>c.method==='PUT');
  assert.equal(puts.length,2,'409 之後重試一次，共 2 次 PUT：'+puts.length);
  for(const p of puts){
    assert.equal(p.body.branch,'human-verified','PUT body 帶 branch=human-verified');
    assert(typeof p.body.content==='string'&&p.body.content.length>0,'PUT body 帶 base64 content');
    assert(typeof p.body.message==='string','PUT body 帶 commit message');
    const decoded=JSON.parse(Buffer.from(p.body.content,'base64').toString('utf8'));
    assert.equal(decoded.version,1,'上傳內容 version=1');
    assert(decoded.units['alert:abrysvo-pregnancy-weeks'],'上傳內容含剛勾的單位');
    assert(decoded.units['contra:bcg'],'上傳內容保留了遠端原有的單位（已合併，不會蓋掉別台裝置）');
  }
  // 每次 PUT 前都會先 GET 合併遠端，所以兩次 PUT 帶的 sha 是「連續兩次 GET」拿到的、且不相同
  assert(/^sha-\d+$/.test(puts[0].body.sha),'第一次 PUT 帶 GET 拿到的 sha：'+puts[0].body.sha);
  assert(/^sha-\d+$/.test(puts[1].body.sha),'第二次 PUT 帶 sha：'+puts[1].body.sha);
  assert.notEqual(puts[1].body.sha,puts[0].body.sha,'409 後重新 GET 到新的 sha 才重試');
  assert(getCount>=2,'409 後確實重新 GET 過：'+getCount);
  const authed=e.calls.filter(c=>c.url.startsWith('https://api.github.com/'));
  assert(authed.every(c=>String((c.headers||{})['Authorization']||'').startsWith('Bearer ')),'GitHub API 呼叫帶 Bearer 授權');
  assert.equal(e.win.HumanVerify.pending.length,0,'成功上傳後待上傳佇列清空');
  assert.equal(e.win.HumanVerify.syncState.mode,'synced','同步狀態＝synced');
  console.log('PASS 同步：PUT 帶 sha＋branch，409 後重 GET 合併再 PUT，成功後清佇列');
}

// ════════════════════════════════════════════════════════════════════
// 6. 狀態列與篩選：篩選只淡化不動結構
// ════════════════════════════════════════════════════════════════════
{
  const e=makeEnv();const H=sweep(e);
  const bar=e.doc.querySelector('#p-contra .hv-bar');
  assert(bar,'禁忌總表分頁頂端有狀態列');
  assert(/\d+／\d+/.test(bar.querySelector('.hv-stat').textContent),'狀態列顯示 已覆核／總數：'+bar.querySelector('.hv-stat').textContent);
  const rowsBefore=e.doc.querySelectorAll('#contraTbl tr').length;
  const filter=bar.querySelector('.hv-filter');
  filter.value='unchecked';
  filter.dispatchEvent(new e.win.Event('change',{bubbles:true}));
  assert.equal(e.doc.querySelectorAll('#contraTbl tr').length,rowsBefore,'篩選不刪列，表格結構不變');
  assert(e.doc.querySelectorAll('#contraTbl tr.hv-dim').length===0,'全部未覆核時，篩「未覆核」不淡化任何列');
  H.toggle('contra:'+VAX[0].id);
  filter.dispatchEvent(new e.win.Event('change',{bubbles:true}));
  assert(e.doc.querySelector(`#contraTbl tr[data-verify-vaccine="${VAX[0].id}"]`).classList.contains('hv-dim'),'已覆核的列在「未覆核」篩選下被淡化');
  // 總覽
  const ovr=e.doc.getElementById('hvOverview');
  assert(ovr&&/人工覆核總覽/.test(ovr.textContent),'來源與版本分頁有全站總覽');
  assert(ovr.querySelector('tr.hv-total'),'總覽有合計列');
  console.log('PASS 狀態列／篩選／總覽：篩選只淡化，表格結構不變');
}

console.log(`PASS human-verify: ${ids.length} units (contra ${kind('contra:')}, interval-general ${intervalRows.length}, clinical ${clinicalUnits}, allergen ${kind('allergen:')}, allergy-rule ${kind('allergy-rule:')}, adverse ${kind('adverse:')}, alert ${kind('alert:')}); ids unique & stable across two loads; stale detection, merge and GitHub sync paths verified with stubs (no real network, no real token).`);
})().catch(e=>{console.error(e);process.exit(1);});
