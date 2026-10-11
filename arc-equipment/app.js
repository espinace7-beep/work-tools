(function(){
'use strict';
const root=document.getElementById('arc-input-prototype');
const categories=['灯体','スタンド','グリップ・フラッグ','ケーブル・電源','フレーム・クロス','その他'];
let master=[],engine=ArcCatalog.create([]),ready=false,loadFailed=false,choices={},unitChoices={};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+n.toLocaleString('ja-JP');
const inputs=root.querySelector('[data-slot="inputs"]');
const hints=['例：オービター ×2\n600c Pro II ×1\nTitan 4本','例：センチュリー大 ×6\nロードランナー ×2','例：黒フラッグ 大 ×4','例：C30A延長コード 8m ×5','例：6×6 LGC ×1','例：ウエイト ×10'];
inputs.innerHTML=categories.map((c,i)=>'<div class="ai-group"><label for="arc-group-'+i+'">'+c+'</label><textarea id="arc-group-'+i+'" data-category="'+i+'" placeholder="'+hints[i]+'"></textarea><div class="ai-conversion" data-conversion="'+i+'"></div></div>').join('');
function update(){
 let all=[],sum=0,unknown=0,pending=0,invalid=0,extras=0;
 root.querySelectorAll('textarea[data-category]').forEach(t=>{
  const cat=Number(t.dataset.category);let rows=[];
  for(const line of t.value.split('\n')){
   const key=cat+':'+line.trim();const r=engine.parse(line,choices[key],unitChoices[key]);if(r){r.key=key;r.cat=cat;rows.push(r);}
  }
  all.push(...rows);
  root.querySelector('[data-conversion="'+cat+'"]').innerHTML=rows.map(r=>{
   let s='<div class="'+(!r.known||!r.valid||r.unitPending?'ai-warn':'')+'">'+escape(r.raw)+(r.known?' → '+escape(r.name):ready?' · 名称は未照合':' · カタログ読み込み中')+' ×'+r.qty;
   if(r.candidates.length>1){s+='<label class="ai-sub">候補を選択<select aria-label="'+escape(r.raw)+'の機材候補" data-choice="'+escape(r.key)+'"><option value="">選択してください（'+r.candidates.length+'候補）</option>'+r.candidates.slice(0,100).map(i=>'<option value="'+i.id+'"'+(r.item?.id===i.id?' selected':'')+'>'+escape(i.name)+' · '+(i.price===null?'価格記載なし':yen(i.price))+' · p.'+i.pages[0]+'</option>').join('')+'</select></label>';}
   if(r.item?.pack>1&&!r.explicitUnit){s+='<label class="ai-sub">数量の単位<select data-unit-choice="'+escape(r.key)+'" aria-label="数量の単位"><option value="">選択してください</option><option value="セット"'+(r.unit==='セット'?' selected':'')+'>セット</option><option value="'+r.item.unit+'"'+(r.unit===r.item.unit?' selected':'')+'>'+r.item.unit+'</option></select></label>';}
   if(r.quantityNote)s+=' · '+escape(r.quantityNote);
   if(!r.valid)s+=' · 数量は1以上の整数で入力';
   return s+'</div>';
  }).join('');
 });
 for(const r of all){if(!r.valid){invalid++;continue;}if(r.unitPending||r.candidates.length>1&&!r.known){pending++;continue;}if(r.price!==null)sum+=r.price;else unknown++;if(r.item?.note&&/点灯料別|燃料費別|ランプ別|別発注|構成品単価/.test(r.item.note))extras++;}
 root.querySelector('[data-slot="total"]').textContent=ready?yen(sum):'—';
 root.querySelector('[data-slot="status"]').textContent=!ready?(loadFailed?'カタログを読み込めませんでした。再読み込みしてください。':'カタログ読み込み中'):all.length===0?'機材を入力すると更新されます':unknown||pending||invalid||extras?'算出できた分の小計'+(unknown?' · 要見積 '+unknown+'件':'')+(pending?' · 選択待ち '+pending+'件':'')+(invalid?' · 入力確認 '+invalid+'件':'')+(extras?' · 別料金条件 '+extras+'件':''):'照合済み '+all.length+'件';
 root.querySelector('[data-slot="prices"]').innerHTML=all.filter(r=>r.valid).map(r=>'<div class="ai-price-row"><span>'+escape(r.name)+' ×'+(r.item?.pack>1&&!r.unitPending?r.units+'セット':r.qty+r.unit)+(r.item?'<small>p.'+r.item.pages.join('・')+' · '+(r.item.price===null?'単体価格記載なし':yen(r.item.price)+' / '+(r.item.pack>1?'セット':'掲載単位'))+(r.item.firstDayExtra?' · 初日ジュース '+yen(r.item.firstDayExtra)+'を加算':'')+(r.item.note?' · '+escape(r.item.note):'')+'</small>':'')+'</span><span>'+(r.price===null?(r.unitPending?'単位確認':r.candidates.length>1&&!r.known?'候補選択':'要見積'):yen(r.price))+'</span></div>').join('');
 const meta={};root.querySelectorAll('[data-meta]').forEach(x=>meta[x.dataset.meta]=x.value);
 renderSheet(all,meta);
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('arc-equipment-v1',JSON.stringify({meta,inputs:[...root.querySelectorAll('textarea[data-category]')].map(t=>t.value),choices,unitChoices}));}catch(e){}},200);
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

root.addEventListener('input',e=>{if(!e.target.matches('[data-catalog-search]'))update();});
root.addEventListener('change',e=>{if(e.target.matches('[data-choice]')){choices[e.target.dataset.choice]=e.target.value;update();}if(e.target.matches('[data-unit-choice]')){unitChoices[e.target.dataset.unitChoice]=e.target.value;update();}});
root.querySelector('[data-action="sample"]').addEventListener('click',()=>{
 const samples=['オービター ×2\nG3 ×1\n600c Pro II ×1\nTitan 4本','センチュリー大 ×6\nロードランナー ×2','黒フラッグ 大 ×4','C30A延長コード 8m ×5','6×6 LGC ×1',''];
 root.querySelectorAll('textarea[data-category]').forEach((t,i)=>{if(!t.value.trim())t.value=samples[i]});update();
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

try{const state=JSON.parse(localStorage.getItem('arc-equipment-v1')||'null');if(state){choices=state.choices||{};unitChoices=state.unitChoices||{};root.querySelectorAll('[data-meta]').forEach(x=>{if(state.meta&&state.meta[x.dataset.meta]!==undefined)x.value=state.meta[x.dataset.meta]});root.querySelectorAll('textarea[data-category]').forEach((t,i)=>{t.value=state.inputs?.[i]||''});}}catch(e){}
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
fetch('./catalog.json').then(r=>{if(!r.ok)throw Error('catalog');return r.json()}).then(data=>{
 master=data.items;engine=ArcCatalog.create(master);ready=true;
 root.querySelector('[data-catalog-meta]').textContent=data.meta.edition+' · '+data.meta.pages+'ページ · 登録'+master.length+'項目（単体価格記載なし '+data.meta.unpriced+'項目）';
 update();showCatalog();
}).catch(()=>{loadFailed=true;update()});
update();
})();
