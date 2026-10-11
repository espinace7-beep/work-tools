(function(){
'use strict';
const root=document.getElementById('arc-input-prototype');
const categories=['ライト','スタンド','グリップ・フラッグ','ケーブル・電源','フレーム・クロス','その他'];
let master=[],engine=ArcCatalog.create([]),ready=false,loadFailed=false;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+n.toLocaleString('ja-JP');
const inputs=root.querySelector('[data-slot="inputs"]');
let serial=0,activeTab=0,groups=categories.map(()=>[]),legacy=null;
const newRow=(name='',qty=1,unit='',choice='')=>({id:'r'+(++serial),name,qty,unit,choice});
try{const state=JSON.parse(localStorage.getItem('arc-equipment-v1')||'null');if(state){
 root.querySelectorAll('[data-meta]').forEach(x=>{if(state.meta?.[x.dataset.meta]!==undefined)x.value=state.meta[x.dataset.meta]});
 if(Array.isArray(state.groups)){groups=categories.map((_,i)=>(state.groups[i]||[]).map(r=>newRow(r.name||'',r.qty??1,r.unit||'',r.choice||'')));}else legacy=state;
}}catch(e){}
function paintInputs(){
 inputs.innerHTML='<div class="ai-tabs" role="tablist" aria-label="機材ジャンル">'+categories.map((c,i)=>'<button type="button" role="tab" id="arc-tab-'+i+'" aria-controls="arc-panel-'+i+'" aria-selected="'+(i===activeTab)+'" tabindex="'+(i===activeTab?0:-1)+'" data-tab="'+i+'">'+c+'<span data-count="'+i+'"></span></button>').join('')+'</div>'+categories.map((c,i)=>{
 if(!groups[i].length)groups[i].push(newRow());
 return '<div role="tabpanel" aria-labelledby="arc-tab-'+i+'" id="arc-panel-'+i+'"'+(i===activeTab?'':' hidden')+'><p class="ai-sub ai-tab-label">'+c+'を入力</p>'+groups[i].map(r=>'<div class="ai-entry" data-row="'+r.id+'"><div class="ai-entry-fields"><label>機材名<input data-name autocomplete="off" value="'+escape(r.name)+'" placeholder="'+(['例：600c pro2、skypanel s60c','例：センチ大、road runner','例：黒フラッグ 大','例：C30A延長コード 8m','例：6×6 LGC','例：DMX'][i])+'"></label><label>数量<input data-qty type="number" min="1" step="1" inputmode="numeric" value="'+escape(r.qty)+'"></label><label>単位<select data-unit><option value="">選択</option>'+['台','本','個','枚','セット','時間','km'].map(u=>'<option'+(r.unit===u?' selected':'')+'>'+u+'</option>').join('')+'</select></label><button type="button" class="ai-remove" data-remove="'+r.id+'" aria-label="この機材を削除">×</button></div><div class="ai-conversion" data-hint="'+r.id+'" aria-live="polite"></div></div>').join('')+'<button type="button" data-add="'+i+'">＋ '+c+'を追加</button></div>';
 }).join('');
}
function findRow(id){for(let cat=0;cat<groups.length;cat++){const row=groups[cat].find(r=>r.id===id);if(row)return{row,cat};}}
paintInputs();
function update(){
 let all=[],sum=0,unknown=0,pending=0,invalid=0,extras=0;
 groups.forEach((group,cat)=>{
  for(const source of group){
   const r=engine.entry(source.name,source.qty,source.unit,source.choice,cat);
   const hint=root.querySelector('[data-hint="'+source.id+'"]');
   if(!r){hint.innerHTML='';continue;}r.cat=cat;r.key=source.id;all.push(r);
   let html=ready?(r.known?'<div>→ '+escape(r.name)+(r.quantityNote?' · '+escape(r.quantityNote):'')+'</div>':'<div class="ai-warn">'+(r.candidates.length?'候補を選んで正式名称を確定':'未照合：入力名を保持')+'</div>'):'カタログ読み込み中';
   if(!r.valid)html+='<div class="ai-warn">数量は1以上の整数で入力してください</div>';
   if(ready&&!source.choice){const candidates=engine.suggest(source.name,cat);if(candidates.length>1||!r.known){html+='<div class="ai-suggestions" aria-label="機材候補">'+candidates.slice(0,12).map(i=>'<button type="button" data-pick="'+i.id+'" data-for="'+source.id+'">'+escape(i.name)+'</button>').join('')+'</div>'+(candidates.length>12?'<small>候補 '+candidates.length+'件：型番・サイズを追加すると絞れます</small>':'');}}
   if(ready&&!r.known&&!r.candidates.length){const other=engine.resolve(source.name).filter(i=>i.cat!==cat);if(other.length===1)html+='<button type="button" data-pick="'+other[0].id+'" data-for="'+source.id+'">'+escape(categories[other[0].cat])+'へ移動：'+escape(other[0].name)+'</button>';}
   hint.innerHTML=html;
  }
  root.querySelector('[data-count="'+cat+'"]').textContent=group.filter(r=>r.name.trim()).length||'';
 });
 for(const r of all){if(!r.valid){invalid++;continue;}if(r.unitPending||r.candidates.length>1&&!r.known){pending++;continue;}if(r.price!==null)sum+=r.price;else unknown++;if(r.item?.note&&/点灯料別|燃料費別|ランプ別|別発注|構成品単価/.test(r.item.note))extras++;}
 root.querySelector('[data-slot="total"]').textContent=ready?yen(sum):'—';
 root.querySelector('[data-slot="status"]').textContent=!ready?(loadFailed?'カタログを読み込めませんでした。再読み込みしてください。':'カタログ読み込み中'):all.length===0?'機材を入力すると更新されます':unknown||pending||invalid||extras?'算出できた分の小計'+(unknown?' · 要見積 '+unknown+'件':'')+(pending?' · 選択待ち '+pending+'件':'')+(invalid?' · 入力確認 '+invalid+'件':'')+(extras?' · 別料金条件 '+extras+'件':''):'照合済み '+all.length+'件';
 root.querySelector('[data-slot="prices"]').innerHTML=all.filter(r=>r.valid).map(r=>'<div class="ai-price-row"><span>'+escape(r.name)+' ×'+(r.item?.pack>1&&!r.unitPending?r.units+'セット':r.qty+r.unit)+(r.item?'<small>p.'+r.item.pages.join('・')+' · '+(r.item.price===null?'単体価格記載なし':yen(r.item.price)+' / '+(r.item.pack>1?'セット':'掲載単位'))+(r.item.firstDayExtra?' · 初日ジュース '+yen(r.item.firstDayExtra)+'を加算':'')+(r.item.note?' · '+escape(r.item.note):'')+'</small>':'')+'</span><span>'+(r.price===null?(r.unitPending?'単位確認':r.candidates.length>1&&!r.known?'候補選択':'要見積'):yen(r.price))+'</span></div>').join('');
 const meta={};root.querySelectorAll('[data-meta]').forEach(x=>meta[x.dataset.meta]=x.value);
 renderSheet(all,meta);
 clearTimeout(saveTimer);if(!legacy)saveTimer=setTimeout(()=>{try{localStorage.setItem('arc-equipment-v1',JSON.stringify({version:2,meta,groups:groups.map(g=>g.filter(r=>r.name.trim()))}));}catch(e){}},200);
}
let currentRows=[],currentMeta={},overflow=false,saveTimer,renderFrame;
const canvas=root.querySelector('#arc-canvas'),ctx=canvas.getContext('2d');
canvas.width=893;canvas.height=1263;
const template=new Image();template.src='./arc-template.webp';template.onload=()=>renderSheet(currentRows,currentMeta);
template.onerror=()=>{root.querySelector('[data-slot="overflow"]').textContent='原本画像の読み込みに失敗しました。再読み込みしてください。';};
function renderSheet(rows,meta){
currentRows=rows;currentMeta=meta;
if(renderFrame)cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(()=>{renderFrame=null;drawSheet(currentRows,currentMeta);});
}
function drawSheet(rows,meta){
if(!template.complete||!template.naturalWidth)return;
ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(template,0,0,canvas.width,canvas.height);
ctx.setTransform(canvas.width/595,0,0,canvas.height/842,0,0);ctx.fillStyle='#111';ctx.textBaseline='middle';
ctx.font='8px sans-serif';ctx.fillText(meta.title||'',35,100,210);
ctx.fillText(meta.move||'',418,60,65);
if(meta.date){const parts=meta.date.split('-');ctx.fillText(String(Number(parts[1])),456,81,15);ctx.fillText(String(Number(parts[2])),497,81,15);}
// 原本のLD欄を差し替える。罫線と敬称は保持。
ctx.fillStyle='#fff';ctx.fillRect(349,77,52,9);ctx.fillStyle='#111';ctx.font='8px sans-serif';ctx.fillText(meta.ld||'',353,82,45);
let row=0;
const slots=45;
for(const r of rows.filter(r=>r.valid)){
const prefix=''; const name=prefix+r.name;
ctx.font='6.5px sans-serif';
let lines=[''];for(const ch of name){let last=lines.length-1;if(ctx.measureText(lines[last]+ch).width>85){lines.push(ch);}else lines[last]+=ch;}
if(row+lines.length>slots)break;
for(const line of lines){ctx.fillText(line,35,230+row*11.23);row++;}
ctx.font='8px sans-serif';ctx.fillText(String(r.item?.pack>1&&!r.unitPending?r.units:r.qty),125,230+(row-lines.length)*11.23,10);
}
const used=rows.filter(r=>r.valid).reduce((count,r)=>{ctx.font='6.5px sans-serif';let w=0,n=1;for(const c of r.name){let x=ctx.measureText(c).width;if(w+x>85){n++;w=x;}else w+=x;}return count+n;},0);
overflow=used>slots;
root.querySelector('[data-slot="overflow"]').textContent=overflow?'1枚の記入欄を超えています。PDF保存前に機材数を減らしてください。':'';
}

root.addEventListener('input',e=>{
 if(e.target.matches('[data-catalog-search]'))return;
 const container=e.target.closest('[data-row]');
 if(container){const found=findRow(container.dataset.row);if(!found)return;
  if(e.target.matches('[data-name]')){found.row.name=e.target.value;found.row.choice='';}
  if(e.target.matches('[data-qty]'))found.row.qty=e.target.value;
  if(e.target.matches('[data-unit]'))found.row.unit=e.target.value;
 }update();
});
root.addEventListener('change',e=>{if(e.target.matches('[data-unit]')){const found=findRow(e.target.closest('[data-row]').dataset.row);found.row.unit=e.target.value;update();}});
root.addEventListener('click',e=>{
 const tab=e.target.closest('[data-tab]');if(tab){activeTab=Number(tab.dataset.tab);root.querySelectorAll('[data-tab]').forEach(t=>{const active=Number(t.dataset.tab)===activeTab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});categories.forEach((_,i)=>root.querySelector('#arc-panel-'+i).hidden=i!==activeTab);return;}
 const add=e.target.closest('[data-add]');if(add){const cat=Number(add.dataset.add);groups[cat].push(newRow());paintInputs();update();root.querySelector('[data-row="'+groups[cat].at(-1).id+'"] [data-name]').focus();return;}
 const remove=e.target.closest('[data-remove]');if(remove){const found=findRow(remove.dataset.remove);groups[found.cat]=groups[found.cat].filter(r=>r.id!==found.row.id);paintInputs();update();return;}
 const pick=e.target.closest('[data-pick]');if(pick){const found=findRow(pick.dataset.for),item=engine.byId.get(pick.dataset.pick);if(!found||!item)return;found.row.name=item.name;found.row.choice=item.id;
  if(item.cat!==found.cat){groups[found.cat]=groups[found.cat].filter(r=>r.id!==found.row.id);groups[item.cat].push(found.row);activeTab=item.cat;}
  paintInputs();update();return;
 }
});
root.addEventListener('keydown',e=>{const t=e.target.closest('[data-tab]');if(t&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();let next=e.key==='Home'?0:e.key==='End'?categories.length-1:(Number(t.dataset.tab)+(e.key==='ArrowRight'?1:-1)+categories.length)%categories.length;const target=root.querySelector('[data-tab="'+next+'"]');target.click();target.focus();}});
root.querySelector('[data-action="sample"]').addEventListener('click',()=>{
 const samples=[[['orbiter',2,'台'],['g3',1,'台'],['600c pro2',1,'台'],['titan',4,'本']],[['センチ大',6,'台'],['road runner',2,'台']],[['黒フラッグ 大',4,'枚']],[['C30A延長コード 8m',5,'本']],[['6×6 LGC',1,'枚']],[]];
 groups=groups.map((g,i)=>g.some(r=>r.name.trim())?g:samples[i].map(r=>newRow(...r)));paintInputs();update();
});
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
root.querySelector('[data-action="pdf"]').addEventListener('click',()=>{
if(!ready){alert('カタログ読み込み後にPDFを保存してください。');return;}
if(!template.naturalWidth){alert('原本の読み込みが終わるまでお待ちください。');return;}
if(currentRows.some(r=>!r.valid||r.unitPending||r.candidates.length>1&&!r.known)){alert('数量・機材候補・セット単位の確認を完了してください。');return;}
drawSheet(currentRows,currentMeta);
if(overflow){alert('記入欄を超えています。PDFは保存できません。');return;}
canvas.width=1785;canvas.height=2526;drawSheet(currentRows,currentMeta);
const encoded=canvas.toDataURL('image/jpeg',0.95).split(',')[1];const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
const pdf=makePdf(bytes,canvas.width,canvas.height);canvas.width=893;canvas.height=1263;drawSheet(currentRows,currentMeta);
const url=URL.createObjectURL(pdf);const a=document.createElement('a');a.href=url;
const safe=s=>(s||'作品名未入力').replace(/[\\/:*?"<>|]/g,'_');a.download=(currentMeta.date?currentMeta.date.replaceAll('-',''):'日付未入力')+'_'+safe(currentMeta.title)+'_照明機材表.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});

let catalogPage=0,searchTimer;
const details=root.querySelector('[data-catalog]'),search=root.querySelector('[data-catalog-search]');
function showCatalog(){
 if(!details.open||!ready)return;
 const query=ArcCatalog.normal(search.value),matches=master.filter(i=>!query||[i.name,...i.aliases||[]].some(a=>ArcCatalog.normal(a).includes(query)));
 const pages=Math.max(1,Math.ceil(matches.length/50));catalogPage=Math.min(catalogPage,pages-1);
 root.querySelector('[data-catalog-status]').textContent=matches.length+'項目 · '+(catalogPage+1)+' / '+pages+'ページ';
 root.querySelector('[data-catalog-rows]').innerHTML=matches.slice(catalogPage*50,catalogPage*50+50).map(i=>'<tr><td>'+escape(i.name)+(i.note?'<small>'+escape(i.note)+'</small>':'')+'</td><td>'+(i.price===null?'記載なし':yen(i.price))+(i.pack?'<small>'+i.pack+i.unit+' / セット</small>':'')+'</td><td>'+i.pages.join('・')+'</td></tr>').join('');
 root.querySelector('[data-catalog-prev]').disabled=catalogPage===0;root.querySelector('[data-catalog-next]').disabled=catalogPage>=pages-1;
}
details.addEventListener('toggle',showCatalog);search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{catalogPage=0;showCatalog()},100)});
root.querySelector('[data-catalog-prev]').addEventListener('click',()=>{catalogPage--;showCatalog()});root.querySelector('[data-catalog-next]').addEventListener('click',()=>{catalogPage++;showCatalog()});
fetch('./catalog.json?v=eea8ceddafcd').then(r=>{if(!r.ok)throw Error('catalog');return r.json()}).then(data=>{
 master=data.items;engine=ArcCatalog.create(master);ready=true;
 if(legacy){const recent=groups.map(g=>g.filter(r=>r.name.trim()));groups=categories.map(()=>[]);for(let cat=0;cat<categories.length;cat++)for(const line of (legacy.inputs?.[cat]||'').split('\n')){const key=cat+':'+line.trim(),r=engine.parse(line,legacy.choices?.[key],legacy.unitChoices?.[key]);if(r)groups[r.item?.cat??cat].push(newRow(r.raw,r.qty,r.unit,r.item?.id||''));}recent.forEach((g,i)=>groups[i].push(...g));legacy=null;paintInputs();}

 root.querySelector('[data-catalog-meta]').textContent=data.meta.edition+' · '+data.meta.pages+'ページ · 登録'+master.length+'項目（単体価格記載なし '+data.meta.unpriced+'項目）';
 update();showCatalog();
}).catch(()=>{loadFailed=true;update()});
update();
})();
