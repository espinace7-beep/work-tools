(function(){
'use strict';
const $=s=>document.querySelector(s),root=$('#arc-app'),dialog=$('#arc-editor');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const columnLabels=['一列目：ライト・灯体用アクセサリー','二列目：スタンド・グリップ','三列目：ケーブル・電源・制御','四列目：フレーム・クロス・その他'];
const yen=n=>'¥'+n.toLocaleString('ja-JP'),canvas=$('#arc-canvas'),ctx=canvas.getContext('2d'),template=new Image();
canvas.width=1785;canvas.height=2526;template.src='./arc-template.webp';
let engine,orders,model,result,active=null,ready=false,saveTimer,drawFrame,searchTimer,toastTimer,lastRemoval,filter=null,searchLimit=20,tooLong=[];
const storageKey='arc-order-list-v1';
function wrapText(text,maxWidth,size){ctx.font=size+'px sans-serif';const lines=[];for(const line of String(text).split('\n')){let current='';for(const ch of line){if(current&&ctx.measureText(current+ch).width>maxWidth){lines.push(current);current=ch;}else current+=ch;}lines.push(current);}return lines;}
function drawSheet(){
 if(!model||!template.naturalWidth)return;
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(template,0,0,canvas.width,canvas.height);
 ctx.setTransform(canvas.width/595,0,0,canvas.height/842,0,0);ctx.textBaseline='middle';tooLong=[];
 for(const f of model.fields){
  const text=model.display(f),changed=text!==f.text;
  if(!changed)continue;
  ctx.save();ctx.beginPath();ctx.rect(f.x+.8,f.y+.15,f.w-1.6,f.h-.3);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(f.x+.8,f.y+.15,f.w-1.6,f.h-.3);
  if(text){const width=f.w-3,height=f.h-2;let size=Math.min(8,height*.75),lines;
   for(;size>=2.5;size-=.25){lines=wrapText(text,width,size);if(lines.length*size*1.12<=height)break;}
   if(size<2.5){size=2.5;lines=wrapText(text,width,size);tooLong.push(f.id);}
   ctx.font=size+'px sans-serif';ctx.fillStyle='#111';const offset=(f.h-lines.length*size*1.12)/2+size*.56;
   lines.forEach((line,i)=>ctx.fillText(line,f.x+1.5,f.y+offset+i*size*1.12));
  }ctx.restore();
 }
 $('[data-overflow]').textContent=tooLong.length?'文字が長すぎる欄が'+tooLong.length+'件あります。該当欄の内容を調整してください。':'';
}
function render(){if(!$('[data-preview]').open)return;if(drawFrame)cancelAnimationFrame(drawFrame);drawFrame=requestAnimationFrame(()=>{drawFrame=null;drawSheet();});}
function persist(){if(!orders)return;try{localStorage.setItem(storageKey,JSON.stringify(orders.snapshot()));$('[data-save]').textContent='この端末に自動保存済み';}catch(e){$('[data-save]').textContent='保存できませんでした。ブラウザの空き容量を確認してください。';}}
function toast(text,undo=false){clearTimeout(toastTimer);$('[data-toast-text]').textContent=text;$('[data-action="undo"]').hidden=!undo;$('[data-toast]').hidden=false;toastTimer=setTimeout(()=>{$('[data-toast]').hidden=true;},5000);}
function loadMeta(){document.querySelectorAll('[data-meta]').forEach(el=>el.value=orders.current().meta[el.dataset.meta]||'');}
function jobs(){const job=orders.current();$('[data-jobs]').innerHTML=orders.state.jobs.map((j,i)=>'<option value="'+j.id+'"'+(j.id===job.id?' selected':'')+'>'+escape(j.meta.title||'案件 '+(i+1))+'</option>').join('');$('[data-meta-summary]').textContent=(job.meta.title||'作品名・日付を入力')+(job.meta.date?' · '+job.meta.date:'');}
function paintList(){const records=orders.current().records;$('[data-list]').innerHTML=!records.length?'<div class="empty">検索して機材を追加してください。<br>必要な機材だけがここに並びます。</div>':orders.cats.map((cat,i)=>{const items=records.filter(r=>orders.category(orders.entry(r)?.item,r)===i);if(!items.length)return'';return'<section class="group"><h3>'+cat+' · '+items.length+'項目</h3>'+items.map(r=>{const e=orders.entry(r);return'<article class="item"><div class="item-top"><button class="item-name" data-edit="'+r.id+'">'+escape(e?.known?e.name:r.name||'機材名を入力')+'</button><button class="remove" data-remove="'+r.id+'" aria-label="'+escape(r.name)+'を削除">×</button></div><div class="item-bottom"><div class="stepper"><button data-step="-1" data-for="'+r.id+'" aria-label="数量を減らす">−</button><input data-qty="'+r.id+'" type="number" min="1" step="1" inputmode="numeric" value="'+escape(r.qty)+'" aria-label="'+escape(r.name)+'の数量"><button data-step="1" data-for="'+r.id+'" aria-label="数量を増やす">＋</button><select data-unit="'+r.id+'" aria-label="数量の単位">'+(e?.item?.pack>1?[''+e.item.unit,'セット']:['台','本','個','枚','セット','時間','km','']).map(u=>'<option value="'+u+'"'+(u===r.unit?' selected':'')+'>'+(u||'単位')+'</option>').join('')+'</select></div><span class="row-price" data-row-price="'+r.id+'"></span></div><p class="warning" data-row-warning="'+r.id+'"></p><small data-row-detail="'+r.id+'"></small>'+(r.note?'<small>備考：'+escape(r.note)+'</small>':'')+'</article>';}).join('')+'</section>';}).join('');}
function update(paint=true){if(!orders)return;result=orders.build();model=result.sheet;if(paint)paintList();jobs();$('[data-count]').textContent=orders.current().records.length+'項目';$('[data-total]').textContent=yen(result.total);$('[data-status]').textContent=(result.pending?'候補・単位確認 '+result.pending+'件 · ':'')+(result.invalid?'数量確認 '+result.invalid+'件 · ':'')+(result.unknown?'要見積 '+result.unknown+'件':'掲載料金の小計');
 for(const r of result.rows){const id=r.record.id,p=$('[data-row-price="'+id+'"]'),w=$('[data-row-warning="'+id+'"]'),d=$('[data-row-detail="'+id+'"]');if(!p)continue;p.textContent=r.price===null||!r.valid?'要確認':yen(r.price);w.textContent=!r.valid?'数量は1以上の整数で入力':r.unitPending?'本数・個数かセット数か、単位を選択':r.candidates.length>1&&!r.known?'機材名をタップして候補を確定':!r.known||r.item?.price===null?'要見積：料金を算出できません':'';const placement=result.placements[id];if(placement?.reason==='classification')w.textContent+=' · 機材名をタップして配置先を選択';if(placement?.reason==='capacity')w.textContent+=' · 対応する列に空欄がありません';d.textContent=(r.quantityNote||'')+(r.item?' · カタログ p.'+r.item.pages[0]:'')+(placement?.qid?' · '+(placement.preset?'プリセット行に数量を記入':columnLabels[placement.column]):'');}
 $('[data-layout-warning]').hidden=!result.unplaced.length;$('[data-layout-warning]').textContent='配置先の確認、または対応する列の空欄不足の項目が'+result.unplaced.length+'件あります。入力は保存されています。PDF保存前に項目を調整してください。';
 render();clearTimeout(saveTimer);$('[data-save]').textContent='保存中…';saveTimer=setTimeout(persist,200);
}
function showSearch(){if(!ready)return;const q=$('[data-search]').value.trim();$('[data-filters]').innerHTML=['すべて',...orders.cats].map((c,i)=>'<button data-filter="'+(i-1)+'" aria-pressed="'+((i===0&&filter===null)||filter===i-1)+'">'+c+'</button>').join('');
 if(!q){const recent=orders.state.recent.length?orders.state.recent.map(id=>engine.byId.get(id)).filter(Boolean):['600c pro2','g3','orbiter','titan','センチ大','road runner','6×6 LGC'].map(n=>engine.resolve(n)[0]).filter(Boolean);$('[data-quick]').innerHTML='<p class="sub">'+(orders.state.recent.length?'最近追加した機材':'すぐに追加')+'</p><div class="quick">'+recent.filter(i=>filter===null||orders.category(i)===filter).slice(0,8).map(i=>'<button data-add="'+i.id+'">＋ '+escape(i.name)+'</button>').join('')+'</div>';$('[data-results]').innerHTML='';$('[data-search-status]').textContent='';return;}
 $('[data-quick]').innerHTML='';const matches=engine.suggest(q).filter(i=>filter===null||orders.category(i)===filter);$('[data-search-status]').textContent=matches.length+'候補';$('[data-results]').innerHTML=matches.slice(0,searchLimit).map(i=>'<div class="result"><div><p class="result-name">'+escape(i.name)+'</p><small>'+(i.price===null?'単体価格記載なし':yen(i.price)+' / '+(i.pack?'セット':'掲載単位'))+' · '+orders.cats[orders.category(i)]+'</small></div><button data-add="'+i.id+'">＋追加</button></div>').join('')+(matches.length>searchLimit?'<button data-action="more">候補をもっと表示</button>':'')+'<button data-action="custom">「'+escape(q)+'」を入力名のまま追加</button>';
}
function getRecord(id){return orders.current().records.find(r=>r.id===id);}
function edit(id){active=id;const r=getRecord(id);$('[data-edit-name]').value=r.name;$('[data-edit-note]').value=r.note||'';if(!dialog.open)dialog.showModal();predictions();}
function predictions(){const r=getRecord(active);if(!r)return;$('[data-edit-column]').value=Number.isInteger(r.column)?String(r.column):'';const e=orders.entry(r),matches=engine.suggest(r.name);$('[data-placement-label]').hidden=!!e?.known;$('[data-edit-status]').textContent=e?.known?'正式名称：'+e.name:'候補を選んで確定できます';$('[data-predictions]').innerHTML=e?.known?'':matches.slice(0,15).map(i=>'<button data-pick="'+i.id+'">'+escape(i.name)+'</button>').join('');}
function preview(){const panel=$('[data-preview]');panel.open=true;drawSheet();panel.scrollIntoView({block:'start',behavior:'smooth'});}
root.addEventListener('input',e=>{if(!ready)return;
 if(e.target.matches('[data-search]')){clearTimeout(searchTimer);searchTimer=setTimeout(()=>{searchLimit=20;showSearch();},90);return;}
 if(e.target.matches('[data-meta]')){orders.current().meta[e.target.dataset.meta]=e.target.value;update(false);return;}
 if(e.target.matches('[data-qty]')){const r=getRecord(e.target.dataset.qty);r.qty=e.target.value;update(false);}
});
root.addEventListener('change',e=>{if(!ready)return;if(e.target.matches('[data-unit]')){getRecord(e.target.dataset.unit).unit=e.target.value;update(false);}if(e.target.matches('[data-jobs]')){persist();orders.state.active=e.target.value;loadMeta();update();showSearch();}});
root.addEventListener('click',e=>{if(!ready)return;const add=e.target.closest('[data-add]');if(add){const item=engine.byId.get(add.dataset.add);orders.add(item);update();showSearch();toast('追加しました：'+item.name);return;}
 const step=e.target.closest('[data-step]');if(step){const r=getRecord(step.dataset.for);r.qty=String(Math.max(1,(Number(r.qty)||0)+Number(step.dataset.step)));update();return;}
 const rem=e.target.closest('[data-remove]');if(rem){lastRemoval=orders.remove(rem.dataset.remove);update();toast('リストから削除しました',true);return;}
 const ed=e.target.closest('[data-edit]');if(ed){edit(ed.dataset.edit);return;}
 const fil=e.target.closest('[data-filter]');if(fil){filter=Number(fil.dataset.filter)<0?null:Number(fil.dataset.filter);searchLimit=20;showSearch();return;}
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='custom'){orders.add(null,$('[data-search]').value.trim());update();edit(orders.current().records.at(-1).id);}
 if(action==='clear-search'){$('[data-search]').value='';showSearch();$('[data-search]').focus();}
 if(action==='more'){searchLimit+=20;showSearch();}
 if(action==='preview')preview();
 if(action==='new-job'||action==='copy-job'){persist();orders.project(action==='copy-job');loadMeta();update();$('[data-meta-panel]').open=true;toast(action==='copy-job'?'機材リストを複製しました':'新しい案件を作りました');}
});
dialog.addEventListener('input',e=>{const r=getRecord(active);if(!r)return;if(e.target.matches('[data-edit-name]')){r.name=e.target.value;r.choice='';predictions();}if(e.target.matches('[data-edit-note]'))r.note=e.target.value;if(e.target.matches('[data-edit-column]')){if(e.target.value==='')delete r.column;else r.column=Number(e.target.value);}update(false);});
dialog.addEventListener('change',e=>{if(e.target.matches('[data-edit-column]')){const r=getRecord(active);if(!r)return;if(e.target.value==='')delete r.column;else r.column=Number(e.target.value);update(false);}});
dialog.addEventListener('click',e=>{const p=e.target.closest('[data-pick]');if(p){const item=engine.byId.get(p.dataset.pick),r=getRecord(active);r.name=item.name;r.choice=item.id;r.cat=item.cat;if(item.pack>1&&!r.unit)r.unit=item.unit;$('[data-edit-name]').value=r.name;predictions();update(false);}if(e.target.closest('[data-action]')?.dataset.action==='close-editor')dialog.close();});
dialog.addEventListener('close',()=>{active=null;update();});dialog.addEventListener('cancel',()=>{active=null;update();});
$('[data-action="undo"]').addEventListener('click',()=>{if(lastRemoval){orders.undo(lastRemoval);lastRemoval=null;update();$('[data-toast]').hidden=true;}});
$('[data-preview]').addEventListener('toggle',render);template.onload=render;template.onerror=()=>{$('[data-overflow]').textContent='原本画像を読み込めませんでした。再読み込みしてください。';};
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
$('[data-action="pdf"]').addEventListener('click',()=>{if(!ready||!template.naturalWidth){alert('原本とカタログの読み込み後に保存してください。');return;}update(false);if(result.unplaced.length){preview();alert('配置先が未確定、または対応する列に空欄がない項目があります。リストの表示を確認してください。');return;}if(result.invalid||result.pending){alert('リストの数量・機材候補・セット単位を確認してください。');return;}drawSheet();if(tooLong.length){preview();alert('文字が長すぎる欄があります。備考などを調整してください。');return;}
 const jpeg=canvas.toDataURL('image/jpeg',.95).split(',')[1],bytes=Uint8Array.from(atob(jpeg),c=>c.charCodeAt(0)),pdf=makePdf(bytes,canvas.width,canvas.height),url=URL.createObjectURL(pdf),a=document.createElement('a');a.href=url;const meta=orders.current().meta;a.download=(meta.date?.replaceAll('-','')||'日付未入力')+'_'+(meta.title||'作品名未入力').replace(/[\\/:*?"<>|]/g,'_')+'_照明機材表.pdf';a.click();persist();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
Promise.all([fetch('./catalog.json?v=3aeb272265f4').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}),fetch('./sheet-layout.json?v=e1164dd464cf').then(r=>{if(!r.ok)throw Error('layout');return r.json();})]).then(([catalog,layout])=>{engine=ArcCatalog.create(catalog.items);let saved,old,legacy;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');old=JSON.parse(localStorage.getItem('arc-equipment-sheet-v3')||'null');legacy=JSON.parse(localStorage.getItem('arc-equipment-v1')||'null');}catch(e){}
 orders=ArcOrder.create(layout,engine,saved,old,legacy);ready=true;loadMeta();update();showSearch();$('[data-action="pdf"]').disabled=false;
}).catch(()=>{$('[data-save]').textContent='読み込めませんでした。再読み込みしてください。';});
if(typeof window!=='undefined')window.addEventListener('pagehide',persist);
})();
