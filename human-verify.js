/* 人工覆核打勾（human verification checkmarks）
   目的：醫師對照過原件（[n] → PDF 紅框）之後，在該最小單位打勾，下次不必重開原文件再 verify 一次。
   ─────────────────────────────────────────────────────────────────────
   最小單位：表格的一列、卡片一張、警示框一個。每個單位有跨版本穩定的 unitId（不用列序）。
   指紋 fp：把單位牽涉到的所有 claim 的 source/page/quotes/sha256 ＋ 單位可見文字正規化後雜湊。
            證據（引句／頁碼／PDF sha256）或單位文字變了 → fp 變 → 保留勾但標「舊證據」。
   儲存：localStorage（快取／離線佇列）＋ GitHub repo 的 human-verified 分支（跨裝置）。
         沒有 token 只讀遠端、只寫本機；有 fine-grained PAT 才寫遠端。
   本檔不做任何臨床判定，也不改動既有內容；只加 UI 與記錄。 */
(() => {
  'use strict';

  // ── 常數 ──────────────────────────────────────────────────────────
  const OWNER='jamesxxx1997', REPO='vaccine-guide', BRANCH='human-verified', PATH='human-verified.json';
  const API=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const RAW=`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;
  const LS_RECORDS='hv:records', LS_TOKEN='hv:token', LS_SYNC='hv:lastSync', LS_PENDING='hv:pending';
  const PUSH_DEBOUNCE=2000, MAX_RETRY=3;

  // 站上頂層 const（SRC／REFERENCE_CLAIMS／CLINICAL／VAX／ALLERGENS／ADVERSE_EFFECTS）不在 window 上，
  // 一律用 typeof 探測（gotchas D）。
  const CLAIMS=(typeof REFERENCE_CLAIMS!=='undefined'&&REFERENCE_CLAIMS)||{};
  const SRCS=(typeof SRC!=='undefined'&&SRC)||{};
  const CLIN=(typeof CLINICAL!=='undefined'&&CLINICAL)||null;

  // ── 小工具 ────────────────────────────────────────────────────────
  const nowISO=()=>new Date().toISOString();
  const dateOf=iso=>{try{const d=new Date(iso);return isNaN(d)?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}catch(e){return '';}};
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  // 正規化：NFKC、去所有空白與標點、小寫。rowKey 與指紋的文字部分共用同一套，跨版本才穩定。
  const norm=s=>String(s==null?'':s).normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
  // 指紋的文字部分必須只含「內容」，不含任何 JS 事後注入的 UI，否則指紋會隨 UI 掛載時機漂移
  // → 明明沒人改資料，單位卻自己變成「舊證據」。
  // 要剝掉的：本檔的 .hv-ctl／.hv-bar；[n] 引註標記 .ref-marks；
  // ★ reference-ui.js 的 wire() 會在初次渲染「之後」把「展開／收合」按鈕（.ref-expand）塞進
  //   每個 details>summary 與 .vax-head .chev —— 實際踩過：clinical 卡片的指紋因此在第二次
  //   偵測時改變（1093…→3b66…），勾完幾百毫秒就變舊證據。
  const UI_NOISE='.hv-ctl,.hv-bar,sup.ref-marks,.ref-marks,.ref-expand';
  // 取元素文字時必須剝掉我們自己插進去的 UI，否則第二次 refresh 算出來的 rowKey／指紋會被
  //「☐ 已覆核」這串字污染 → id 漂移、指紋永遠對不上。（實際踩過：unitIds 261→312）
  function ownText(el){
    if(!el)return '';
    if(!el.querySelector||!el.querySelector(UI_NOISE))return el.textContent;
    const clone=el.cloneNode(true);
    clone.querySelectorAll(UI_NOISE).forEach(n=>n.remove());
    return clone.textContent;
  }

  // 同步版 FNV-1a 64（用兩個 32-bit 半部模擬，避免依賴 BigInt／SubtleCrypto 的 async）。
  // 這裡只要「內容變了雜湊就會變」，不需要密碼學強度。
  function fnv1a64(str){
    let h1=0x811c9dc5>>>0, h2=0xcbf29ce4>>>0;   // 兩條獨立的 FNV-1a 32，串成 64 bit 十六進位
    for(let i=0;i<str.length;i++){
      const c=str.charCodeAt(i);
      h1^=c&0xff; h1=Math.imul(h1,0x01000193)>>>0;
      h2^=(c>>>8)&0xff; h2=Math.imul(h2,0x01000193)>>>0;
      h2^=c&0xff; h2=Math.imul(h2,0x01000193)>>>0;
    }
    return (h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0');
  }

  const safeLS={
    get(k){try{return localStorage.getItem(k);}catch(e){return null;}},
    set(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}},
    del(k){try{localStorage.removeItem(k);}catch(e){}},
  };

  // ── 記錄存放 ──────────────────────────────────────────────────────
  // 形狀：{version:1, updatedAt, units:{unitId:{checked,at,fp,claims[],srcVer{},note}}}
  function emptyStore(){return {version:1,updatedAt:nowISO(),units:{}};}
  function loadLocal(){
    const raw=safeLS.get(LS_RECORDS);
    if(!raw)return emptyStore();
    try{const o=JSON.parse(raw);return (o&&o.units)?o:emptyStore();}catch(e){return emptyStore();}
  }
  let store=loadLocal();
  let pending=(()=>{try{const a=JSON.parse(safeLS.get(LS_PENDING)||'[]');return new Set(Array.isArray(a)?a:[]);}catch(e){return new Set();}})();
  let remoteSha=null;            // GitHub contents API 的 blob sha，PUT 時要帶
  let syncState={mode:'local',text:'本機（未設定 token）',at:null};

  const saveLocal=()=>{store.updatedAt=nowISO();safeLS.set(LS_RECORDS,JSON.stringify(store));safeLS.set(LS_PENDING,JSON.stringify([...pending]));};
  const getToken=()=>safeLS.get(LS_TOKEN)||'';

  // 合併規則：同一個 unitId 以 at 較新者為準（取消勾也是一筆帶新 at 的 checked:false，所以能同步刪除）。
  function mergeStores(a,b){
    const out={version:1,updatedAt:nowISO(),units:{}};
    for(const src of [a,b]){
      if(!src||!src.units)continue;
      for(const [id,rec] of Object.entries(src.units)){
        const cur=out.units[id];
        if(!cur||String(rec.at||'')>String(cur.at||''))out.units[id]={...rec};
      }
    }
    return out;
  }

  // ── 單位偵測 ──────────────────────────────────────────────────────
  // 每個 unit：{id, el, panel, claims[]}
  // claims 從三個地方收：元素（含後代）的 data-ref-claim（逗號可多個）、clinical item 的 refs[].claim、
  // 以及 allergy 矩陣格／adverse 列上的 dataset。
  function claimsIn(el){
    const out=new Set();
    const collect=n=>{
      const v=n.dataset&&(n.dataset.refClaim||n.dataset.adverseClaim);
      if(v)String(v).split(',').map(x=>x.trim()).filter(Boolean).forEach(c=>out.add(c));
    };
    collect(el);
    el.querySelectorAll('[data-ref-claim],[data-adverse-claim]').forEach(collect);
    return out;
  }
  // clinical item 的 refs 走 CLINICAL 資料（頁面上 [n] 也帶 data-ref-claim，但 details 收合時仍在 DOM，兩邊會一致）
  function clinicalClaims(itemId){
    const out=new Set();
    if(!CLIN)return out;
    for(const d of Object.values(CLIN.diseases||{}))
      for(const list of Object.values(d.panels||{}))
        for(const it of list)
          if(it.id===itemId)for(const r of it.refs||[])if(r.claim)out.add(r.claim);
    return out;
  }

  const panelOf=el=>{const p=el.closest('.panel');return p?p.id:'';};

  function detect(root){
    const scope=root||document;
    const found=new Map();   // id → unit（同 id 只留第一個，避免重複掛）
    const add=(id,el,extraClaims)=>{
      if(!id||found.has(id))return;
      const claims=claimsIn(el);
      if(extraClaims)for(const c of extraClaims)claims.add(c);
      found.set(id,{id,el,panel:panelOf(el),claims:[...claims].sort()});
    };

    // (0) 明確標記優先：任何帶 data-verify-unit 的元素
    for(const el of scope.querySelectorAll('[data-verify-unit]'))add(el.dataset.verifyUnit,el);

    // (b) 禁忌總表：一支疫苗一列（整列含禁忌欄與注意事項欄）
    for(const tr of scope.querySelectorAll('#contraTbl tr[data-verify-vaccine]'))
      add('contra:'+tr.dataset.verifyVaccine,tr);

    // (a) 被標記為可覆核的靜態表：整張表的每個 tbody 列都是單位（不是只有帶 claim 的列——
    //     間隔通則表 7 列只有 1 列帶 claim，使用者要 7 列都能勾）
    for(const table of scope.querySelectorAll('table[data-verify-table]')){
      const tkey=table.dataset.verifyTable;
      for(const tr of table.querySelectorAll('tbody tr')){
        if(tr.closest('#contraTbl'))continue;                    // 禁忌表已用 vaccine id
        const first=tr.querySelector('td,th');
        if(!first)continue;
        let rowKey=norm(ownText(first)).slice(0,60);
        if(!rowKey)rowKey='row'+([...tr.parentNode.children].indexOf(tr)+1);   // 極少數空首格（例：colspan 備註列）
        add('row:'+tkey+':'+rowKey,tr);
      }
    }

    // (a′) 其他表格中帶 [data-ref-claim] 的列（TR 上或 TD 上都算）
    for(const table of scope.querySelectorAll('table')){
      if(table.dataset.verifyTable)continue;
      if(table.classList.contains('clinical-est')||table.classList.contains('adverse-table'))continue;
      if(table.id==='allergenMatrix'||table.classList.contains('srclist'))continue;
      const tkey=table.id||('panel-'+panelOf(table));
      for(const tr of table.querySelectorAll('tbody tr')){
        if(!tr.matches('[data-ref-claim]')&&!tr.querySelector('[data-ref-claim]'))continue;
        const first=tr.querySelector('td,th');if(!first)continue;
        add('row:'+tkey+':'+norm(ownText(first)).slice(0,60),tr);
      }
    }

    // (c) clinical：估計值表的列優先（此時議題卡本身不再是單位），其次議題卡，其次一般卡
    const estRows=new Set();
    for(const tr of scope.querySelectorAll('table.clinical-est tbody tr[data-clinical-item]')){
      const iid=tr.dataset.clinicalItem;
      estRows.add(tr.closest('.clinical-topic'));
      add('clinical:'+iid,tr,clinicalClaims(iid));
    }
    for(const card of scope.querySelectorAll('.clinical-topic[data-clinical-topic]')){
      if(estRows.has(card))continue;                              // 估計值表的卡：單位已下放到每一列
      const extra=new Set();
      for(const line of card.querySelectorAll('[data-clinical-item]'))
        for(const c of clinicalClaims(line.dataset.clinicalItem))extra.add(c);
      if(card.dataset.clinicalItem)for(const c of clinicalClaims(card.dataset.clinicalItem))extra.add(c);
      add('clinical-topic:'+card.dataset.clinicalTopic,card,extra);
    }
    for(const card of scope.querySelectorAll('.clinical-item[data-clinical-item]')){
      if(card.classList.contains('clinical-topic'))continue;
      add('clinical:'+card.dataset.clinicalItem,card,clinicalClaims(card.dataset.clinicalItem));
    }

    // (d) 過敏：矩陣每個產品列、指引判讀卡
    for(const tr of scope.querySelectorAll('#allergenMatrix tbody tr[data-allergy-product]'))
      add('allergen:'+tr.dataset.allergyProduct,tr);
    for(const card of scope.querySelectorAll('.allergy-rule[data-allergy-rule]'))
      add('allergy-rule:'+card.dataset.allergyRule,card);

    // (e) 副作用：每張原件表格／段落一個單位（dataset.adverseTable 是資料裡的穩定 key）
    for(const sec of scope.querySelectorAll('[data-adverse-table]'))
      add('adverse:'+sec.dataset.adverseTable,sec);

    return [...found.values()];
  }

  // ── 指紋 ──────────────────────────────────────────────────────────
  // 序列化內容：每個 claim 的 source|page|sha256|quotes（排序後），加上單位可見文字正規化。
  // 顯示差異時要能說出「哪個 claim 變了」，所以 evidence 也逐 claim 存一份小雜湊。
  function visibleText(el){
    const clone=el.cloneNode(true);
    clone.querySelectorAll(UI_NOISE).forEach(n=>n.remove());
    return norm(clone.textContent).slice(0,4000);
  }
  function claimSig(cid){
    const c=CLAIMS[cid];
    if(!c)return cid+'|MISSING';
    const parts=(c.items||[]).map(it=>[it.source||'',it.page==null?'':it.page,it.sha256||'',(it.quotes||[]).join('')].join('|'));
    return cid+'|'+parts.join('');
  }
  function srcVersions(claims){
    const out={};
    for(const cid of claims){
      for(const it of (CLAIMS[cid]&&CLAIMS[cid].items)||[]){
        const s=SRCS[it.source];
        if(it.source)out[it.source]=s?String(s.v||''):'';
      }
    }
    return out;
  }
  function fingerprint(unit){
    const sigs=unit.claims.map(claimSig);
    return {
      fp:fnv1a64(sigs.join('')+''+visibleText(unit.el)),
      claims:unit.claims.slice(),
      srcVer:srcVersions(unit.claims),
      text:fnv1a64(visibleText(unit.el)),
      per:Object.fromEntries(unit.claims.map((c,i)=>[c,fnv1a64(sigs[i])])),
    };
  }
  // 舊證據差異：新增／移除的 claim、來源版本 X→Y、僅文字變動
  function describeDiff(rec,cur){
    const out=[];
    const oldC=new Set(rec.claims||[]), newC=new Set(cur.claims);
    const added=[...newC].filter(c=>!oldC.has(c)), removed=[...oldC].filter(c=>!newC.has(c));
    if(added.length)out.push('新增引用：'+added.join('、'));
    if(removed.length)out.push('移除引用：'+removed.join('、'));
    for(const [s,v] of Object.entries(cur.srcVer||{})){
      const ov=(rec.srcVer||{})[s];
      if(ov!==undefined&&ov!==v)out.push(`來源 ${s} 版本 ${ov||'（空）'} → ${v||'（空）'}`);
    }
    const changed=[...newC].filter(c=>oldC.has(c)&&rec.per&&rec.per[c]&&rec.per[c]!==cur.per[c]);
    if(changed.length)out.push('引句／頁碼／檔案雜湊變動：'+changed.join('、'));
    if(!out.length&&rec.text&&rec.text!==cur.text)out.push('僅頁面文字變動（引用來源未變）');
    if(!out.length)out.push('指紋變動（來源與文字細節）');
    return out;
  }

  // ── 狀態 ──────────────────────────────────────────────────────────
  const units=new Map();     // unitId → {id, el, panel, claims, cur(fingerprint)}
  // unitId → 「不是該單位主元素上」的額外控制（同一單位被重複渲染時才有）。
  // 每次 refresh 重建一次；paint 靠它查，不掃全文件。
  const extraCtls=new Map();
  const STATE={UNCHECKED:'unchecked',CHECKED:'checked',STALE:'stale'};
  function stateOf(id){
    const rec=store.units[id];
    if(!rec||!rec.checked)return STATE.UNCHECKED;
    const u=units.get(id);
    if(!u)return STATE.CHECKED;
    return rec.fp===u.cur.fp?STATE.CHECKED:STATE.STALE;
  }

  // ── UI：每個單位的小控制 ──────────────────────────────────────────
  function hostFor(unit){
    // 表格列 → 第一格底部；其他（卡片／警示框／section）→ 元素底部左側
    if(unit.el.tagName==='TR'){const td=unit.el.querySelector('td,th');return td||unit.el;}
    return unit.el;
  }
  function renderCtl(unit){
    const host=hostFor(unit);
    let ctl=host.querySelector(':scope > .hv-ctl');
    if(!ctl){
      ctl=node('div',undefined,'hv-ctl');
      ctl.dataset.hvUnit=unit.id;
      const btn=node('button',undefined,'hv-btn');btn.type='button';
      const re=node('button','重新確認','hv-recheck');re.type='button';re.hidden=true;
      re.title='以目前的引句與來源版本更新這筆覆核紀錄';
      ctl.append(btn,re);
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggle(unit.id);});
      re.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();reconfirm(unit.id);});
      host.appendChild(ctl);
    }
    paint(unit.id);
    return ctl;
  }
  function paint(id){
    const unit=units.get(id);if(!unit)return;
    const rec=store.units[id], st=stateOf(id);
    unit.el.dataset.hvState=st;
    // 同一個單位可能在畫面上出現不只一次（例：過敏 A→B 選擇器會再渲染一張同 id 的指引判讀卡），
    // 它們共用同一筆紀錄，所以每一個掛著這個 id 的控制都要一起更新，不然會有一邊顯示過時的狀態。
    // 用 extraCtls 這個索引查，不要在這裡掃全文件——paint 會被每個單位各叫一次，
    // 全文件 querySelectorAll 會讓 redrawAll 變成 O(n²)（實測 260 個單位要 2.2 秒）。
    const own=hostFor(unit).querySelector(':scope > .hv-ctl');
    if(own)paintOne(own,id,rec,st,unit);
    for(const ctl of extraCtls.get(id)||[])
      if(ctl!==own&&ctl.isConnected)paintOne(ctl,id,rec,st,unit);
  }
  function paintOne(ctl,id,rec,st,unit){
    const btn=ctl.querySelector('.hv-btn'), re=ctl.querySelector('.hv-recheck');
    if(!btn||!re)return;
    ctl.dataset.hvState=st;
    const host=ctl.parentElement;
    if(host&&host!==unit.el){const row=host.closest('tr,section,div.card,.allergy-rule');if(row)row.dataset.hvState=st;}
    if(st===STATE.UNCHECKED){
      btn.textContent='☐ 已覆核';btn.title='標記這一項我已對照過原件';btn.setAttribute('aria-pressed','false');
      re.hidden=true;
    } else if(st===STATE.CHECKED){
      btn.textContent='☑ 已覆核 '+dateOf(rec.at);btn.title='覆核時間：'+rec.at+'（再按一次取消）';btn.setAttribute('aria-pressed','true');
      re.hidden=true;
    } else {
      const diff=describeDiff(rec,unit.cur);
      btn.textContent='☑⚠ 舊證據（'+dateOf(rec.at)+' 覆核）';
      btn.title='覆核後證據有變動：\n'+diff.map(d=>'· '+d).join('\n')+'\n（再按一次取消勾選）';
      btn.setAttribute('aria-pressed','true');
      re.hidden=false;
    }
  }

  // ── 勾選動作 ──────────────────────────────────────────────────────
  function writeRec(id,checked){
    const unit=units.get(id);if(!unit)return;
    const cur=unit.cur;
    const prev=store.units[id]||{};
    store.units[id]={checked,at:nowISO(),fp:cur.fp,claims:cur.claims,srcVer:cur.srcVer,text:cur.text,per:cur.per,note:prev.note||''};
    pending.add(id);
    saveLocal();
    paint(id);
    renderBars();
    schedulePush();
  }
  function toggle(id){writeRec(id,!(store.units[id]&&store.units[id].checked));}
  function reconfirm(id){writeRec(id,true);}

  // ── 同步：讀 ──────────────────────────────────────────────────────
  function b64encode(str){
    const bytes=new TextEncoder().encode(str);
    let bin='';for(const b of bytes)bin+=String.fromCharCode(b);
    return btoa(bin);
  }
  function b64decode(b64){
    const bin=atob(String(b64).replace(/\s+/g,''));
    const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function ghHeaders(){
    const h={'Accept':'application/vnd.github+json'};
    const t=getToken();if(t)h['Authorization']='Bearer '+t;
    return h;
  }
  async function fetchRemote(){
    // 先走 contents API（有 token 帶 auth；沒 token 也可用匿名 60 次／小時），失敗再退 raw.githubusercontent
    try{
      const r=await fetch(API+'?ref='+encodeURIComponent(BRANCH),{headers:ghHeaders(),cache:'no-store'});
      if(r.ok){
        const j=await r.json();
        remoteSha=j.sha||null;
        return JSON.parse(b64decode(j.content||''));
      }
    }catch(e){/* 離線或被擋，往下退 */}
    try{
      const r=await fetch(RAW+'?t='+Date.now(),{cache:'no-store'});
      if(r.ok)return await r.json();
    }catch(e){}
    return null;
  }

  // ── 同步：寫 ──────────────────────────────────────────────────────
  let pushTimer=null, pushing=false;
  function schedulePush(){
    if(!getToken()){setSync('local','本機（未設定 token）');return;}
    setSync('pending',`本機已存，${pending.size} 筆待上傳`);
    if(pushTimer)clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>{pushTimer=null;pushRemote();},PUSH_DEBOUNCE);
  }
  async function pushRemote(){
    const token=getToken();
    if(!token||pushing)return false;
    pushing=true;
    try{
      for(let attempt=0;attempt<MAX_RETRY;attempt++){
        // 每次嘗試都先取遠端合併（第一次也取，避免蓋掉別台裝置的勾）
        const remote=await fetchRemote();
        if(remote)store=mergeStores(remote,store);
        const payload=JSON.stringify({version:1,updatedAt:nowISO(),units:store.units},null,1);
        const body={message:`human-verified: ${pending.size} unit(s) @ ${nowISO()}`,content:b64encode(payload),branch:BRANCH};
        if(remoteSha)body.sha=remoteSha;
        let r;
        try{
          r=await fetch(API,{method:'PUT',headers:{...ghHeaders(),'Content-Type':'application/json'},body:JSON.stringify(body)});
        }catch(e){setSync('offline',`離線，${pending.size} 筆待上傳`);return false;}
        if(r.ok){
          const j=await r.json().catch(()=>({}));
          remoteSha=(j.content&&j.content.sha)||null;
          pending.clear();saveLocal();
          const t=nowISO();safeLS.set(LS_SYNC,t);
          setSync('synced','已同步 '+t.slice(11,16));
          redrawAll();
          return true;
        }
        if(r.status===409||r.status===422){remoteSha=null;continue;}   // sha 衝突 → 重新 GET 合併再試
        if(r.status===401||r.status===403){setSync('error','token 無效或無寫入權限');return false;}
        setSync('error','上傳失敗（HTTP '+r.status+'）');
        return false;
      }
      setSync('error',`衝突重試 ${MAX_RETRY} 次未成功，${pending.size} 筆仍在本機`);
      return false;
    } finally { pushing=false; }
  }
  function setSync(mode,text){syncState={mode,text,at:nowISO()};renderBars(true);}

  // ── 狀態列（每個 panel 頂端一條）────────────────────────────────
  const bars=new Map();   // panelId → {el, filter}
  function panelUnits(panelId){return [...units.values()].filter(u=>u.panel===panelId);}
  function ensureBar(panelId){
    const panel=document.getElementById(panelId);
    if(!panel)return null;
    let bar=bars.get(panelId);
    if(bar&&bar.el.isConnected)return bar;
    const el=node('div',undefined,'hv-bar');
    el.dataset.hvPanel=panelId;
    const stat=node('span',undefined,'hv-stat');
    const filter=node('select',undefined,'hv-filter');
    for(const [v,t] of [['all','全部'],['unchecked','未覆核'],['stale','舊證據']]){const o=node('option',t);o.value=v;filter.append(o);}
    filter.setAttribute('aria-label','覆核狀態篩選');
    filter.addEventListener('change',()=>applyFilter(panelId));   // 狀態就存在 <select> 自己身上，不另存一份免得兩邊不同步
    const sync=node('span',undefined,'hv-sync');
    const settings=node('button','設定','hv-mini');settings.type='button';settings.onclick=openSettings;
    const exp=node('button','匯出 JSON','hv-mini');exp.type='button';exp.onclick=exportJSON;
    const imp=node('button','匯入 JSON','hv-mini');imp.type='button';imp.onclick=importJSON;
    el.append(node('span','人工覆核','hv-label'),stat,filter,sync,settings,exp,imp);
    panel.insertBefore(el,panel.firstChild);
    bar={el,stat,filter,sync};
    bars.set(panelId,bar);
    return bar;
  }
  function renderBars(syncOnly){
    for(const panelId of new Set([...units.values()].map(u=>u.panel)).values()){
      if(!panelId)continue;
      const bar=ensureBar(panelId);if(!bar)continue;
      if(!syncOnly){
        const list=panelUnits(panelId);
        const done=list.filter(u=>stateOf(u.id)!==STATE.UNCHECKED).length;
        const stale=list.filter(u=>stateOf(u.id)===STATE.STALE).length;
        bar.stat.textContent=`${done}／${list.length}`+(stale?` · 舊證據 ${stale}`:'');
      }
      bar.sync.textContent=syncState.text;
      bar.sync.dataset.hvSync=syncState.mode;
    }
    renderOverview();
  }
  function applyFilter(panelId){
    const bar=bars.get(panelId);if(!bar)return;
    const want=bar.filter.value;
    for(const u of panelUnits(panelId)){
      const st=stateOf(u.id);
      const hide=want==='unchecked'?st!==STATE.UNCHECKED:want==='stale'?st!==STATE.STALE:false;
      // 篩選只加淡化 class，不動 display，才不會弄壞表格結構（tr 的 display:none 會讓欄寬跳動）
      u.el.classList.toggle('hv-dim',hide);
    }
  }

  // ── 全站總覽（放在「來源與版本」分頁）────────────────────────────
  const PANEL_NAME={'p-screen':'接種前篩檢','p-child':'兒童時程','p-adult':'成人時程','p-interval':'間隔規則','p-contra':'禁忌總表','p-catchup':'補種','p-adverse':'副作用','p-allergy':'過敏與成分','p-clinical':'疾病臨床','p-src':'來源與版本'};
  function renderOverview(){
    const panel=document.getElementById('p-src');if(!panel)return;
    let box=document.getElementById('hvOverview');
    if(!box){
      box=node('section',undefined,'card');box.id='hvOverview';
      panel.appendChild(box);
    }
    box.replaceChildren();
    box.append(node('h2','人工覆核總覽'));
    box.append(node('p','已對照過原件的最小單位數。此頁只統計目前這次載入已渲染出來的單位；副作用與疾病臨床分頁會隨選擇的疫苗／疾病重新計數。','sub'));
    const table=node('table');
    const thead=node('thead'),hr=node('tr');
    for(const h of ['分頁','已覆核／單位數','舊證據'])hr.append(node('th',h));
    thead.append(hr);table.append(thead);
    const tb=node('tbody');
    let tot=0,totDone=0,totStale=0;
    for(const [pid,name] of Object.entries(PANEL_NAME)){
      const list=panelUnits(pid);if(!list.length)continue;
      const done=list.filter(u=>stateOf(u.id)!==STATE.UNCHECKED).length;
      const stale=list.filter(u=>stateOf(u.id)===STATE.STALE).length;
      tot+=list.length;totDone+=done;totStale+=stale;
      const tr=node('tr');tr.append(node('td',name),node('td',`${done}／${list.length}`),node('td',stale?String(stale):'—'));tb.append(tr);
    }
    const tr=node('tr');tr.className='hv-total';
    tr.append(node('td','合計'),node('td',`${totDone}／${tot}`),node('td',totStale?String(totStale):'—'));
    tb.append(tr);table.append(tb);
    const wrap=node('div',undefined,'scroller');wrap.append(table);box.append(wrap);
  }

  // ── 設定／匯出／匯入 ──────────────────────────────────────────────
  function openSettings(){
    let dlg=document.getElementById('hvSettings');
    if(dlg)dlg.remove();
    dlg=node('div',undefined,'hv-dialog');dlg.id='hvSettings';
    const card=node('div',undefined,'hv-dialog-card');
    card.append(node('h3','人工覆核・同步設定'));
    card.append(node('p','跨裝置同步需要一個 GitHub fine-grained personal access token，只授權本 repo（jamesxxx1997/vaccine-guide）的 Contents 讀寫即可。沒有 token 也能用，只是勾選只存在這台瀏覽器。','sub'));
    const warn=node('p','⚠️ token 只存在這個瀏覽器的 localStorage，不會送到本站以外的任何伺服器（只送 api.github.com）。github.io 上你自己帳號的其他站台與本站共用同一個 origin，會讀得到這個 token——只在你自己的站台安裝。','hv-warn');
    card.append(warn);
    const input=node('input');input.type='password';input.placeholder='github_pat_…（留空＝不啟用同步）';input.value=getToken();input.className='hv-token-input';
    card.append(input);
    const row=node('div',undefined,'hv-dialog-row');
    const save=node('button','儲存','hv-mini');save.type='button';
    save.onclick=()=>{const v=input.value.trim();if(v)safeLS.set(LS_TOKEN,v);else safeLS.del(LS_TOKEN);dlg.remove();if(v){setSync('pending','token 已設定，準備上傳');pushRemote();}else setSync('local','本機（未設定 token）');};
    const clr=node('button','清除 token','hv-mini');clr.type='button';
    clr.onclick=()=>{safeLS.del(LS_TOKEN);input.value='';setSync('local','本機（未設定 token）');};
    const close=node('button','關閉','hv-mini');close.type='button';close.onclick=()=>dlg.remove();
    row.append(save,clr,close);card.append(row);
    dlg.append(card);
    document.body.appendChild(dlg);
    return dlg;
  }
  function exportObject(){return {version:1,updatedAt:nowISO(),units:JSON.parse(JSON.stringify(store.units))};}
  function exportJSON(){
    const blob=new Blob([JSON.stringify(exportObject(),null,1)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='human-verified-'+dateOf(nowISO())+'.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function importJSON(){
    const inp=document.createElement('input');inp.type='file';inp.accept='application/json,.json';
    inp.onchange=()=>{
      const f=inp.files&&inp.files[0];if(!f)return;
      const fr=new FileReader();
      fr.onload=()=>{try{applyImport(JSON.parse(String(fr.result)));}catch(e){alert('匯入失敗：檔案不是有效的 JSON');}};
      fr.readAsText(f);
    };
    inp.click();
  }
  function applyImport(obj){
    if(!obj||!obj.units){alert('匯入失敗：缺少 units');return;}
    store=mergeStores(store,obj);                 // 合併，較新者勝
    for(const id of Object.keys(obj.units))pending.add(id);
    saveLocal();redrawAll();schedulePush();
  }

  // ── 掛載與重繪 ────────────────────────────────────────────────────
  let observer=null, muting=false;
  // 我們自己改 DOM 時暫停 observer：雙保險，避免掛控制／插狀態列又觸發一輪 redraw
  function quiet(fn){
    if(muting)return fn();
    muting=true;
    try{return fn();}
    finally{
      if(observer)observer.takeRecords();   // 丟掉自己造成的那批紀錄
      muting=false;
    }
  }
  // 重建「重複渲染」索引：掃一次全文件的 .hv-ctl，把不屬於主元素的歸到各自的 unitId 底下。
  // 整個 refresh 只做一次（不是每個單位一次），所以是 O(n) 不是 O(n²)。
  function indexExtraCtls(){
    extraCtls.clear();
    for(const ctl of document.querySelectorAll('.hv-ctl')){
      const id=ctl.dataset.hvUnit;if(!id)continue;
      const u=units.get(id);
      if(u&&hostFor(u).querySelector(':scope > .hv-ctl')===ctl)continue;   // 主元素上的那個，paint 會直接處理
      if(!extraCtls.has(id))extraCtls.set(id,[]);
      extraCtls.get(id).push(ctl);
    }
  }
  function refresh(root){
    return quiet(()=>{
      for(const u of detect(root)){
        u.cur=fingerprint(u);
        units.set(u.id,u);
        renderCtl(u);
      }
      indexExtraCtls();
      // 重繪過的 panel 重新套用篩選
      for(const [pid,bar] of bars)if(bar.el.isConnected)applyFilter(pid);
      renderBars();
    });
  }
  function redrawAll(){
    return quiet(()=>{
      // 已經掛過的單位：元素可能被換掉（分頁重繪），先清掉不在 DOM 裡的
      for(const [id,u] of [...units])if(!u.el.isConnected)units.delete(id);
      refresh(document);
      for(const id of units.keys())paint(id);
      renderBars();
    });
  }

  // 動態重繪：用 MutationObserver 監看三個會整塊 replaceChildren 的根節點。
  // 理由：clinical.js／adverse-effects.js／allergy-guidance.js 都用 replaceChildren 換整塊內容，
  // 且三者各自有 show()／run() 多個進入點（tab、搜尋跳轉、選擇器提交），逐一插 refresh 呼叫會漏；
  // observer 只看這三個根、childList 變動就 debounce 一次 refresh，改別人的檔最少。
  function observeRoots(){
    if(typeof MutationObserver==='undefined')return;
    let t=null;
    observer=new MutationObserver(records=>{
      // 自己插入的 .hv-ctl 也是 childList 變動；不濾掉會無限迴圈（掛控制→觸發→再掛→…）
      if(!records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>!isOurs(n))))return;
      if(t)clearTimeout(t);
      t=setTimeout(()=>{t=null;redrawAll();},60);
    });
    for(const id of ['clinicalRoot','adverseRoot','allergyRoot']){
      const el=document.getElementById(id);
      if(el)observer.observe(el,{childList:true,subtree:true});
    }
  }
  const isOurs=n=>n&&n.nodeType===1&&(n.classList&&(n.classList.contains('hv-ctl')||n.classList.contains('hv-bar')));

  // ── 啟動 ──────────────────────────────────────────────────────────
  async function boot(){
    refresh(document);                                   // 先用本機快取畫
    setSync(getToken()?'pending':'local',getToken()?'同步中…':'本機（未設定 token）');
    const remote=await fetchRemote();
    if(remote&&remote.units){
      store=mergeStores(remote,store);
      saveLocal();
      redrawAll();
      const last=safeLS.get(LS_SYNC);
      setSync(pending.size?'pending':'synced',pending.size?`本機已存，${pending.size} 筆待上傳`:('已同步 '+nowISO().slice(11,16)));
      if(pending.size&&getToken())schedulePush();
    } else {
      setSync(getToken()?'offline':'local',getToken()?`離線，${pending.size} 筆待上傳`:'本機（未設定 token）');
    }
  }

  const start=()=>{observeRoots();boot();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();

  // 測試／除錯用的最小公開 API（不含 token 讀取）
  window.HumanVerify=Object.freeze({
    refresh,
    redrawAll,
    toggle,
    reconfirm,
    stateOf,
    fingerprintOf:id=>{const u=units.get(id);return u?u.cur:null;},
    diffOf:id=>{const u=units.get(id),rec=store.units[id];return (u&&rec)?describeDiff(rec,u.cur):null;},
    unitIds:()=>[...units.keys()],
    unitsIn:panelId=>panelUnits(panelId).map(u=>u.id),
    exportObject,
    applyImport,
    mergeStores,
    pushRemote,
    fetchRemote,
    openSettings,
    get store(){return store;},
    get pending(){return [...pending];},
    get syncState(){return {...syncState};},
    STATE,
  });
})();
