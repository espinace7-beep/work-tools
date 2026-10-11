(function(){
'use strict';
const $=s=>document.querySelector(s),root=$('#arc-app'),dialog=$('#arc-editor');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+n.toLocaleString('ja-JP');
const canvas=$('#arc-canvas'),ctx=canvas.getContext('2d'),template=new Image();
canvas.width=1785;canvas.height=2526;template.src='./arc-template.webp';
let engine,model,layout,active=null,saveTimer,drawFrame,tooLong=[],ready=false,legacyState,zoomWidth;
const storageKey='arc-equipment-sheet-v3',legacyKey='arc-equipment-v1';
function wrapText(text,maxWidth,size){ctx.font=size+'px sans-serif';const lines=[];for(const line of String(text).split('\n')){let current='';for(const ch of line){if(current&&ctx.measureText(current+ch).width>maxWidth){lines.push(current);current=ch;}else current+=ch;}lines.push(current);}return lines;}
function drawSheet(){
 if(!model||!template.naturalWidth)return;
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(template,0,0,canvas.width,canvas.height);
 ctx.setTransform(canvas.width/595,0,0,canvas.height/842,0,0);ctx.textBaseline='middle';tooLong=[];
 for(const f of model.fields){
  const text=model.display(f),changed=Object.hasOwn(model.values,f.id)||text!==f.text;
  if(!changed)continue;
  ctx.save();ctx.beginPath();ctx.rect(f.x+.6,f.y+.6,f.w-1.2,f.h-1.2);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(f.x+.6,f.y+.6,f.w-1.2,f.h-1.2);
  if(text){const width=f.w-3,height=f.h-2;let size=Math.min(8,height*.75),lines;
   for(;size>=2.5;size-=.25){lines=wrapText(text,width,size);if(lines.length*size*1.12<=height)break;}
   if(size<2.5){size=2.5;lines=wrapText(text,width,size);tooLong.push(f.id);}
   ctx.font=size+'px sans-serif';ctx.fillStyle='#111';const offset=(f.h-lines.length*size*1.12)/2+size*.56;
   lines.forEach((line,i)=>ctx.fillText(line,f.x+1.5,f.y+offset+i*size*1.12));
  }ctx.restore();
 }
 $('[data-overflow]').textContent=tooLong.length?'文字が長すぎる欄が'+tooLong.length+'件あります。該当欄の内容を調整してください。':'';
}
function render(){if(drawFrame)cancelAnimationFrame(drawFrame);drawFrame=requestAnimationFrame(()=>{drawFrame=null;drawSheet();});}
function paintCells(){
 $('[data-cells]').innerHTML=model.fields.map(f=>'<button type="button" class="cell" data-cell="'+f.id+'" aria-label="'+escape(f.label||((f.kind==='qty'?'数量：':'')+(f.text||'空欄')))+'" style="left:'+f.x/595*100+'%;top:'+f.y/842*100+'%;width:'+f.w/595*100+'%;height:'+f.h/842*100+'%"></button>').join('');
}
function update(){
 if(!model)return;
 const rows=model.rows();let sum=0,unknown=0,pending=0,invalid=0;
 for(const r of rows){if(!r.valid)invalid++;else if(r.unitPending||r.candidates.length>1&&!r.known)pending++;else if(r.price===null)unknown++;else sum+=r.price;}
 $('[data-total]').textContent=yen(sum);$('[data-status]').textContent=rows.length?rows.length+'項目'+(unknown?' · 要見積 '+unknown+'件':'')+(pending?' · 候補・単位確認 '+pending+'件':'')+(invalid?' · 入力確認 '+invalid+'件':''):'数量を入力すると更新されます';
 $('[data-prices]').innerHTML=rows.map(r=>'<div class="price-row"><div class="price-line"><button type="button" data-cell="'+r.key+'">'+escape(r.name)+' ×'+(r.item?.pack>1&&!r.unitPending?r.units+'セット':escape(r.qty+(r.unit||'')))+'</button><span>'+(r.price===null||!r.valid?(r.unitPending?'単位確認':r.candidates.length>1&&!r.known?'候補選択':'要見積'):yen(r.price))+'</span></div>'+(r.item?'<small>p.'+r.item.pages.join('・')+(r.quantityNote?' · '+escape(r.quantityNote):'')+(r.item.note?' · '+escape(r.item.note):'')+(r.item.firstDayExtra?' · 初日ジュース '+yen(r.item.firstDayExtra)+'を加算':'')+'</small>':'')+'</div>').join('');
 const issues=new Set(rows.filter(r=>!r.valid||r.unitPending||r.candidates.length>1&&!r.known).map(r=>r.key));
 document.querySelectorAll('.cell').forEach(b=>{b.classList.toggle('edited',Object.hasOwn(model.values,b.dataset.cell));b.classList.toggle('bad',issues.has(b.dataset.cell));b.classList.toggle('selected',active?.id===b.dataset.cell);});
 render();clearTimeout(saveTimer);$('[data-save]').textContent='保存中…';saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(model.snapshot()));$('[data-save]').textContent='この端末に自動保存済み';}catch(e){$('[data-save]').textContent='保存できませんでした。ブラウザの空き容量を確認してください。';}},200);
}
function editorRow(){const f=active;if(!f)return null;return f.kind==='qty'?f:model.byId.get(f.qtyId);}
function refreshEditor(){
 if(!active)return;const q=editorRow(),hint=$('[data-editor-hint]'),pred=$('[data-predictions]');
 if(!q){hint.textContent='';pred.innerHTML='';return;}
 const name=$('[data-edit-name]').value,r=model.resolve(q),suggestions=model.predictions(q.id,name);
 hint.textContent=r?.known?'正式名称：'+r.name+(r.quantityNote?' · '+r.quantityNote:''):suggestions.length?'候補をタップして確定してください':'カタログに一致する候補はありません。入力名はそのまま使えます。';
 if(r&&!r.valid)hint.textContent='機材名と、1以上の整数の数量を入力してください。';
 pred.innerHTML=suggestions.slice(0,15).map(i=>'<button type="button" data-pick="'+i.id+'">'+escape(i.name)+'<small>'+(i.price===null?'単体価格記載なし':yen(i.price))+' · p.'+i.pages[0]+'</small></button>').join('')+(suggestions.length>15?'<p class="sub">'+suggestions.length+'候補：型番やサイズを加えると絞れます</p>':'');
}
function openEditor(id){
 if(!ready)return;active=model.byId.get(id);if(!active)return;
 const q=editorRow(),equipment=!!q; $('[data-equipment]').hidden=!equipment;$('[data-general]').hidden=equipment;$('[data-editor-title]').textContent=equipment?(q.variant?'フレーム・'+q.variant:'機材を編集'):(active.label||'項目を編集');
 if(equipment){
  $('[data-edit-name]').value=q.variant?(model.itemNames[q.id]||model.raw(q.nameId)+' '+q.variant):model.raw(q.nameId);
  $('[data-edit-qty]').value=Object.hasOwn(model.values,q.id)?model.raw(q.id):'';
  $('[data-edit-unit]').value=model.units[q.id]||'';
  const nf=model.byId.get(q.nameId);$('[data-note-label]').hidden=!nf.noteId;$('[data-edit-note]').value=nf.noteId?model.raw(nf.noteId):'';
 }else{
  const date=active.format==='month'||active.format==='day';$('[data-edit-text]').hidden=date;$('[data-edit-date]').hidden=!date;
  $('[data-edit-text]').value=model.raw(id);$('[data-edit-date]').value=model.raw('date');
 }
 if(!dialog.open)dialog.showModal();refreshEditor();update();
 const focus=equipment?(active.kind==='qty'?$('[data-edit-qty]'):$('[data-edit-name]')):(active.format?$('[data-edit-date]'):$('[data-edit-text]'));focus.focus();
}
function closeEditor(){dialog.close();active=null;update();}
function zoom(width){const viewport=$('[data-viewport]');zoomWidth=Math.max(viewport.clientWidth,Math.min(2400,width));$('[data-paper]').style.width=zoomWidth+'px';$('[data-zoom]').textContent=Math.round(zoomWidth/viewport.clientWidth*100)+'%';}
root.addEventListener('click',e=>{
 const cell=e.target.closest('[data-cell]');if(cell){openEditor(cell.dataset.cell);return;}
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='fit')zoom($('[data-viewport]').clientWidth);
 if(action==='zoom-in')zoom((zoomWidth||$('[data-viewport]').clientWidth)*1.4);
 if(action==='zoom-out')zoom((zoomWidth||$('[data-viewport]').clientWidth)/1.4);
});
dialog.addEventListener('input',e=>{
 if(!active)return;const q=editorRow();
 if(q){if(e.target.matches('[data-edit-name]')){if(q.variant){model.itemNames[q.id]=e.target.value;delete model.choices[q.id];}else model.set(q.nameId,e.target.value);}
  if(e.target.matches('[data-edit-qty]'))model.set(q.id,e.target.value);
  if(e.target.matches('[data-edit-unit]'))model.units[q.id]=e.target.value;
  if(e.target.matches('[data-edit-note]'))model.set(model.byId.get(q.nameId).noteId,e.target.value);
 }else model.set(active.format?'date':active.id,e.target.value);
 refreshEditor();update();
});
dialog.addEventListener('change',e=>{if(e.target.matches('[data-edit-unit]')){const q=editorRow();if(q){model.units[q.id]=e.target.value;refreshEditor();update();}}});
dialog.addEventListener('click',e=>{
 const pick=e.target.closest('[data-pick]');if(pick){const q=editorRow(),item=engine.byId.get(pick.dataset.pick);if(q&&item){model.pick(q.id,item);$('[data-edit-name]').value=item.name;if(!$('[data-edit-qty]').value){model.set(q.id,'1');$('[data-edit-qty]').value='1';}refreshEditor();update();}return;}
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='close-editor')closeEditor();
 if(action==='clear-cell'){model.clear(active.id);closeEditor();}
});
dialog.addEventListener('cancel',()=>{active=null;update();});dialog.addEventListener('close',()=>{if(active){active=null;update();}});
$('[data-jump]').addEventListener('change',e=>{if(!model)return;const ids={header:'title',notes:'notes'},targets={light:[0,140],stand:[1,540],grip:[2,140],power:[3,140],frame:[4,140]};let id=ids[e.target.value];if(!id){const target=targets[e.target.value];id=model.fields.find(f=>f.kind==='name'&&f.cat===target?.[0]&&f.y>=target[1])?.id;}const b=id&&document.querySelector('.cell[data-cell="'+id+'"]');if(b){if(zoomWidth<$('[data-viewport]').clientWidth*1.5)zoom(Math.max(850,$('[data-viewport]').clientWidth));b.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});b.focus();}e.target.value='';});
let searchTimer;
$('[data-search]').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(!ready)return;const q=$('[data-search]').value.trim();const matches=q?engine.suggest(q):[];$('[data-catalog-status]').textContent=q?matches.length+'候補（タップで空欄に追加）':'';$('[data-catalog-list]').innerHTML=matches.slice(0,30).map(i=>'<button data-add-item="'+i.id+'">'+escape(i.name)+'<small>'+(i.price===null?'記載なし':yen(i.price))+' · p.'+i.pages[0]+'</small></button>').join('');},100);});
root.addEventListener('click',e=>{const b=e.target.closest('[data-add-item]');if(!b||!model)return;const item=engine.byId.get(b.dataset.addItem);if(!model.place({name:item.name,qty:1,choice:item.id,cat:item.cat})){alert('空欄がありません。不要な機材の欄を空にしてください。');return;}update();const f=model.fields.find(f=>f.kind==='name'&&model.raw(f.id)===item.name&&model.raw(f.qtyId)==='1');if(f)openEditor(f.id);});
function makePdf(jpeg,w,h){
const enc=new TextEncoder();const chunks=[];let length=0;const offsets=[0];
const add=b=>{if(typeof b==='string')b=enc.encode(b);chunks.push(b);length+=b.length;};
add('%PDF-1.4\n');
const obj=(i,text)=>{offsets[i]=length;add(i+' 0 obj\n'+text+'\nendobj\n');};
obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
offsets[4]=length;add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n');add(jpeg);add('\nendstream\nendobj\n');
const content='q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n';obj(5,'<< /Length '+enc.encode(content).length+' >>\nstream\n'+content+'endstream');
const xref=length;add('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<6;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');add('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');return new Blob(chunks,{type:'application/pdf'});
}
$('[data-action="pdf"]').addEventListener('click',()=>{
 if(!ready||!template.naturalWidth){alert('原本とカタログの読み込み後に保存してください。');return;}
 if(model.unplaced.length){alert('未配置の機材があります。表に配置してから保存してください。');return;}
 if(model.rows().some(r=>!r.valid||r.unitPending||r.candidates.length>1&&!r.known)){alert('色の付いた数量欄をタップし、機材候補・数量・セット単位を確認してください。');return;}
 drawSheet();if(tooLong.length){alert('文字が長すぎる欄があります。内容を調整してください。');return;}
 const encoded=canvas.toDataURL('image/jpeg',.95).split(',')[1],bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 const pdf=makePdf(bytes,canvas.width,canvas.height),url=URL.createObjectURL(pdf),a=document.createElement('a');a.href=url;
 const date=model.raw('date').replaceAll('-','')||'日付未入力',title=(model.raw('title')||'作品名未入力').replace(/[\\/:*?"<>|]/g,'_');a.download=date+'_'+title+'_照明機材表.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
function showUnplaced(){const box=$('[data-unplaced]');box.hidden=!model.unplaced.length;box.innerHTML='<p>以前の入力で、まだ表に配置できていない機材があります。</p>'+model.unplaced.map((r,i)=>'<div class="unplaced"><span>'+escape(r.name)+' ×'+escape(r.qty)+'</span><button data-place="'+i+'">空欄に配置</button></div>').join('');}
root.addEventListener('click',e=>{const b=e.target.closest('[data-place]');if(!b)return;const i=Number(b.dataset.place);if(model.place(model.unplaced[i])){model.unplaced.splice(i,1);showUnplaced();update();}else alert('空欄がありません。不要な欄を空にしてから配置してください。');});
template.onload=render;template.onerror=()=>{$('[data-save]').textContent='原本の画像を読み込めませんでした。再読み込みしてください。';};
Promise.all([fetch('./catalog.json?v=eea8ceddafcd').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}),fetch('./sheet-layout.json?v=9891f5f42484').then(r=>{if(!r.ok)throw Error('layout');return r.json();})]).then(([catalog,schema])=>{
 engine=ArcCatalog.create(catalog.items);layout=schema;let saved,old;
 try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');old=JSON.parse(localStorage.getItem(legacyKey)||'null');}catch(e){}
 model=ArcSheet.create(layout,engine,saved||{});if(!saved&&old)model.migrate(old);
 ready=true;paintCells();showUnplaced();update();zoom($('[data-viewport]').clientWidth);$('[data-action="pdf"]').disabled=false;
}).catch(()=>{$('[data-save]').textContent='読み込めませんでした。ページを再読み込みしてください。';});
})();
