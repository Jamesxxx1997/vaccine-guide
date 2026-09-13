// 打包白名單守門：index.html 實際載入的每個 script/樣式檔都必須被 tools/package_pages.mjs 複製到輸出目錄，
// 否則 Pages 部署後會 404（2026-09-13 副作用／過敏分頁曾因此上線缺檔）。用法：node tools/test_package_pages.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const refs=[...html.matchAll(/(?:src|href)="([^"$]+\.(?:js|css))"/g)].map(m=>m[1]).filter(f=>!/^https?:/.test(f));
assert(refs.length>=10,'page references found: '+refs.length);
const out=execFileSync('node',[path.join(root,'tools/package_pages.mjs')],{cwd:root,encoding:'utf8'}).trim().split('\n').pop();
const dir=fs.existsSync(out)?out:null;assert(dir,'package output dir printed: '+out);
const missing=[...new Set(refs)].filter(f=>!fs.existsSync(path.join(dir,f)));
assert.deepEqual(missing,[],'every referenced asset is packaged; missing: '+missing.join(', '));
for(const secret of ['review/adverse-effects.src.d','review/allergens.src.d','backend','node_modules','.git'])assert(!fs.existsSync(path.join(dir,secret)),secret+' must not be published');
fs.rmSync(dir,{recursive:true,force:true});
console.log(`PASS package allowlist: ${new Set(refs).size} referenced assets all packaged.`);
