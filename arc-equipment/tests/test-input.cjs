const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');require('../catalog-core.js');require('../sheet-model.js');require('../order-model.js');
const dir=path.join(__dirname,'..'),layout=require('../sheet-layout.json'),catalog=require('../catalog.json');
async function mount(old){
 const elements=new Map(),listeners={},drawn=[],alerts=[];let blob,clicked=0;
 const el=key=>{if(!elements.has(key))elements.set(key,{value:'',textContent:'',innerHTML:'',hidden:false,clientWidth:800,style:{},dataset:{},events:{},open:false,classList:{toggle(){}},addEventListener(k,f){(this.events[k]??=[]).push(f)},matches(){return false},focus(){},showModal(){this.open=true},close(){this.open=false;for(const f of this.events.close||[])f()},scrollIntoView(){}});return elements.get(key)};
 let ctx={setTransform(){},fillRect(){},drawImage(){},measureText(s){return{width:s.length*4}},fillText(t){drawn.push(String(t))},save(){},restore(){},beginPath(){},rect(){},clip(){}},ImageClass=class{complete=true;naturalWidth=1786};
 if(process.env.ARC_QA_DIR){const native=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas');native.GlobalFonts.registerFromPath(process.env.ARC_QA_FONT,'sans-serif');const cv=native.createCanvas(1785,2526),nativeCtx=cv.getContext('2d');ctx=new Proxy(nativeCtx,{get(t,k){if(k==='fillText')return(...args)=>{drawn.push(String(args[0]));return t.fillText(...args)};const v=t[k];return typeof v==='function'?v.bind(t):v},set(t,k,v){t[k]=v;return true}});Object.assign(el('#arc-canvas'),{toDataURL:()=>cv.toDataURL('image/jpeg',.95)});ImageClass=class extends native.Image{set src(v){super.src=fs.readFileSync(path.join(dir,v))}};}
 Object.assign(el('#arc-canvas'),{getContext:()=>ctx});el('#arc-canvas').toDataURL??=()=> 'data:image/jpeg;base64,/9j/2Q==';
 const storage=new Map(old?[['arc-equipment-v1',JSON.stringify(old)]]:[]);
 const meta=['title','date','ld','move','notes','pd','pm','al','st'].map(key=>Object.assign(el('[data-meta="'+key+'"]'),{dataset:{meta:key}}));
 const document={querySelector:el,querySelectorAll:selector=>selector==='[data-meta]'?meta:[],createElement:()=>({click(){clicked++}})};
 const context={ArcCatalog,ArcSheet,ArcOrder,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame:f=>setTimeout(f,0),cancelAnimationFrame:clearTimeout,setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,230)),clearTimeout,TextEncoder,Uint8Array,Blob,URL:{createObjectURL:b=>(blob=b,'blob:test'),revokeObjectURL(){}},atob,alert:s=>alerts.push(s),fetch:async url=>({ok:true,json:async()=>url.includes('catalog')?catalog:layout}),Image:ImageClass};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'app.js'),'utf8'),context);await new Promise(r=>setTimeout(r,30));
 const click=(where,selector,dataset)=>el(where).events.click.forEach(f=>f({target:{closest:s=>s===selector?{dataset}:null}}));
 return {el,drawn,alerts,storage,click,blob:()=>blob,clicked:()=>clicked,input(selector,value,where='#arc-app'){const target=el(selector);target.value=value;const match=selector.match(/\[data-([a-z-]+)(?:="([^"]*)")?\]/);target.dataset[match[1]]=match[2]||'';target.matches=s=>s==='[data-'+match[1]+']';el(where).events.input[0]({target});}};
}

(async()=>{
 const a=await mount();assert.equal(a.el('[data-total]').textContent,'¥0');assert(a.el('[data-list]').innerHTML.includes('検索して機材'));
 const pro=catalog.items.find(i=>i.name==='Aputure LS 600c Pro II'),stand=catalog.items.find(i=>i.name==="40'センチュリースタンド");
 a.input('[data-search]','600c');await new Promise(r=>setTimeout(r,110));assert(a.el('[data-results]').innerHTML.includes('Pro II'));
 a.click('#arc-app','[data-add]',{add:pro.id});assert.equal(a.el('[data-total]').textContent,'¥19,500');
 a.input('[data-qty="item1"]','3');assert.equal(a.el('[data-total]').textContent,'¥58,500');
 a.click('#arc-app','[data-add]',{add:stand.id});a.input('[data-qty="item2"]','6');assert.equal(a.el('[data-total]').textContent,'¥66,300');
 a.input('[data-meta="title"]','機材表テスト');a.input('[data-meta="date"]','2026-10-12');
 a.click('#arc-app','[data-edit]',{edit:'item2'});assert(a.el('#arc-editor').open);a.input('[data-edit-note]','人物用','#arc-editor');a.click('#arc-editor','[data-action]',{action:'close-editor'});
 a.click('#arc-app','[data-action]',{action:'preview'});await new Promise(r=>setTimeout(r,230));
 const saved=JSON.parse(a.storage.get('arc-order-list-v1'));assert.equal(saved.jobs[0].records[0].qty,'3');assert.equal(saved.jobs[0].meta.title,'機材表テスト');
 a.el('[data-action="pdf"]').events.click[0]();assert.equal(a.clicked(),1);assert(!a.drawn.some(s=>/¥|円/.test(s)),'Price leaked to PDF');
 if(process.env.ARC_QA_DIR){fs.mkdirSync(process.env.ARC_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.ARC_QA_DIR,'sheet.pdf'),Buffer.from(await a.blob().arrayBuffer()));}
 a.click('#arc-app','[data-remove]',{remove:'item1'});assert.equal(a.el('[data-total]').textContent,'¥7,800');a.el('[data-action="undo"]').events.click[0]();assert.equal(a.el('[data-total]').textContent,'¥66,300');
 a.click('#arc-app','[data-action]',{action:'copy-job'});assert.equal(a.el('[data-meta="date"]').value,'');assert.equal(a.el('[data-meta="title"]').value,'機材表テスト（コピー）');assert.equal(a.el('[data-total]').textContent,'¥66,300');
 a.click('#arc-app','[data-action]',{action:'new-job'});assert.equal(a.el('[data-total]').textContent,'¥0');
 a.input('[data-search]','600c');a.click('#arc-app','[data-action]',{action:'custom'});a.click('#arc-editor','[data-action]',{action:'close-editor'});a.el('[data-action="pdf"]').events.click[0]();assert(a.alerts.length,'Ambiguous name did not block PDF');
 const migrated=await mount({inputs:['Titan 4本','センチ大 ×6','','','','']});assert.equal(migrated.el('[data-total]').textContent,'¥33,800');
 console.log('PASS: search/add, direct quantity editing, project metadata, notes, live totals, preview/PDF with prices excluded, remove/undo, copy/new projects, ambiguous-name blocking and legacy migration');
})().catch(e=>{console.error(e);process.exitCode=1});
