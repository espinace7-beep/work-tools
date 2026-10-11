const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');require('../catalog-core.js');require('../sheet-model.js');
const dir=path.join(__dirname,'..'),layout=require('../sheet-layout.json'),catalog=require('../catalog.json');
async function mount(old){
 const elements=new Map(),listeners={},drawn=[],alerts=[];let blob,clicked=0;
 const el=key=>{if(!elements.has(key))elements.set(key,{value:'',textContent:'',innerHTML:'',hidden:false,clientWidth:800,style:{},dataset:{},events:{},open:false,classList:{toggle(){}},addEventListener(k,f){(this.events[k]??=[]).push(f)},matches(){return false},focus(){},showModal(){this.open=true},close(){this.open=false;for(const f of this.events.close||[])f()},scrollIntoView(){}});return elements.get(key)};
 let ctx={setTransform(){},fillRect(){},drawImage(){},measureText(s){return{width:s.length*4}},fillText(t){drawn.push(String(t))},save(){},restore(){},beginPath(){},rect(){},clip(){}},ImageClass=class{complete=true;naturalWidth=1786};
 if(process.env.ARC_QA_DIR){const native=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas');native.GlobalFonts.registerFromPath(process.env.ARC_QA_FONT,'sans-serif');const cv=native.createCanvas(1785,2526),nativeCtx=cv.getContext('2d');ctx=new Proxy(nativeCtx,{get(t,k){if(k==='fillText')return(...args)=>{drawn.push(String(args[0]));return t.fillText(...args)};const v=t[k];return typeof v==='function'?v.bind(t):v},set(t,k,v){t[k]=v;return true}});Object.assign(el('#arc-canvas'),{toDataURL:()=>cv.toDataURL('image/jpeg',.95)});ImageClass=class extends native.Image{set src(v){super.src=fs.readFileSync(path.join(dir,v))}};}
 Object.assign(el('#arc-canvas'),{getContext:()=>ctx});el('#arc-canvas').toDataURL??=()=> 'data:image/jpeg;base64,/9j/2Q==';
 const storage=new Map(old?[['arc-equipment-v1',JSON.stringify(old)]]:[]);
 const document={querySelector:el,querySelectorAll:()=>[],createElement:()=>({click(){clicked++}})};
 const context={ArcCatalog,ArcSheet,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame:f=>setTimeout(f,0),cancelAnimationFrame:clearTimeout,setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,230)),clearTimeout,TextEncoder,Uint8Array,Blob,URL:{createObjectURL:b=>(blob=b,'blob:test'),revokeObjectURL(){}},atob,alert:s=>alerts.push(s),fetch:async url=>({ok:true,json:async()=>url.includes('catalog')?catalog:layout}),Image:ImageClass};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'app.js'),'utf8'),context);await new Promise(r=>setTimeout(r,30));
 const click=(where,selector,dataset)=>el(where).events.click.forEach(f=>f({target:{closest:s=>s===selector?{dataset}:null}}));
 return {el,drawn,alerts,storage,click,blob:()=>blob,clicked:()=>clicked,input(selector,value){const target=el(selector);target.value=value;target.matches=s=>s===selector;el('#arc-editor').events.input[0]({target});}};
}
(async()=>{
 const a=await mount();assert.equal(a.el('[data-total]').textContent,'¥0');assert(a.el('[data-cells]').innerHTML.includes('data-cell="ld"'));assert.equal(a.el('[data-action="pdf"]').disabled,false);
 const blank=layout.fields.find(f=>f.kind==='name'&&!f.text&&f.cat===0);
 a.click('#arc-app','[data-cell]',{cell:blank.id});assert(a.el('#arc-editor').open);
 a.input('[data-edit-name]','600c');a.input('[data-edit-qty]','2');assert(a.el('[data-status]').textContent.includes('候補・単位確認'));
 a.el('[data-action="pdf"]').events.click[0]();assert(a.alerts.length,'Pending candidates did not block PDF');
 const item=catalog.items.find(i=>i.name==='Aputure LS 600c Pro II');a.click('#arc-editor','[data-pick]',{pick:item.id});assert.equal(a.el('[data-total]').textContent,'¥39,000');
 a.input('[data-edit-qty]','3');assert.equal(a.el('[data-total]').textContent,'¥58,500');
 a.click('#arc-editor','[data-action]',{action:'close-editor'});assert(!a.el('#arc-editor').open);
 a.click('#arc-app','[data-cell]',{cell:'title'});a.input('[data-edit-text]','機材表テスト');a.click('#arc-editor','[data-action]',{action:'close-editor'});
 a.click('#arc-app','[data-cell]',{cell:'date'});a.input('[data-edit-date]','2026-10-11');a.click('#arc-editor','[data-action]',{action:'close-editor'});
 const stand=layout.fields.find(f=>f.kind==='name'&&f.text.includes('ｾﾝﾁｭﾘｰ(大)'));a.click('#arc-app','[data-cell]',{cell:stand.qtyId});a.input('[data-edit-qty]','6');a.click('#arc-editor','[data-action]',{action:'close-editor'});
 assert.equal(a.el('[data-total]').textContent,'¥66,300');await new Promise(r=>setTimeout(r,230));
 const saved=JSON.parse(a.storage.get('arc-equipment-sheet-v3'));assert.equal(saved.values[blank.qtyId],'3');assert.equal(saved.values.title,'機材表テスト');
 a.el('[data-action="pdf"]').events.click[0]();assert.equal(a.clicked(),1);assert(!a.drawn.some(s=>/¥|円/.test(s)),'Private prices leaked to PDF canvas');assert(a.drawn.includes('Aputure LS 600c Pro II')||a.drawn.join('').includes('Aputure LS 600c Pro II'));
 if(process.env.ARC_QA_DIR){fs.mkdirSync(process.env.ARC_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.ARC_QA_DIR,'sheet.pdf'),Buffer.from(await a.blob().arrayBuffer()));}
 a.click('#arc-app','[data-cell]',{cell:blank.id});a.click('#arc-editor','[data-action]',{action:'clear-cell'});assert.equal(a.el('[data-total]').textContent,'¥7,800');
 const migrated=await mount({meta:{title:'旧作品'},inputs:['Titan 4本','センチ大 ×6','','','','']});assert.equal(migrated.el('[data-total]').textContent,'¥33,800');assert(migrated.el('[data-unplaced]').hidden);
 console.log('PASS: sheet click editing, printed-name quantities, live estimates, candidate selection, date/title editing, PDF blocking/export, prices excluded, clear, autosave and legacy migration');
})().catch(e=>{console.error(e);process.exitCode=1});
