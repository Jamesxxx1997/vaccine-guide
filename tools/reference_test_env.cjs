const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
module.exports=function setup(){
  const root=path.resolve(__dirname,'..'),errors=[];
  const logs=new VirtualConsole();logs.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{
    url:'http://localhost:8899/index.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:logs});
  for(const script of dom.window.document.scripts){
    const src=script.getAttribute('src');
    let code=src?fs.readFileSync(path.join(root,src),'utf8'):script.textContent;
    // Test-only access: never ship a public debug API or expose the reference WeakMap.
    if(src==='reference-ui.js')code=code.replace('  const help=document.createElement',
      '  window.referenceTest={refs,evidence,wire,locate};\n  const help=document.createElement');
    vm.runInContext(code,dom.getInternalVMContext(),{filename:src||'index-inline.js'});
  }
  return {dom,win:dom.window,doc:dom.window.document,root,errors};
};
