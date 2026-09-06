// Explicit static allowlist. Never publish workspace state, dependencies or secrets.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const output=await fs.mkdtemp(path.join(os.tmpdir(),'vaccine-pages-'));
const files=['index.html','csv-viewer.html','csv-viewer.js','csv-viewer.css','reference-ui.js','reference-ui.css','reference-geometry.js','reference-scopes.js','reference-tables.js','travel-data.js','travel-search.js','travel-search.css','travel-vaccine-guides.js','.nojekyll'];
for(const f of files)await fs.copyFile(f,path.join(output,f));
async function copyDir(dir,filter){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);if(!filter(file,entry))continue;
    if(entry.isSymbolicLink())throw Error('Refusing symlink in public assets: '+file);
    if(entry.isDirectory())await copyDir(file,filter);
    else{await fs.mkdir(path.join(output,path.dirname(file)),{recursive:true});await fs.copyFile(file,path.join(output,file));}
  }
}
await copyDir('review',(f,e)=>e.isDirectory()?['review/img','review/pages','review/travel-pages'].some(d=>f===d||f.startsWith(d+'/')):
  /\.(jpg|png)$/.test(f)||['review/excerpts.js','review/reference-pages.js','review/reference-tables.js','review/travel-current.js','review/travel-sync-status.js','review/travel-reference-pages.js'].includes(f));
await copyDir('sources',(f,e)=>!f.includes('/_text')&&(e.isDirectory()||/\.(pdf|csv|html|md|json)$/i.test(f)));
await copyDir('data/travel/sources',()=>true);
// Include only raw public assets; source tools, handoffs and study data stay out.
await fs.mkdir(path.join(output,'data'),{recursive:true});
console.log(output);
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'path='+output+'\n');
