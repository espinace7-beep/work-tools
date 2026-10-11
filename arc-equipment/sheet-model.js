(function(global){
'use strict';
function create(layout,engine,saved={}){
 const fields=layout.fields,byId=new Map(fields.map(f=>[f.id,f]));
 const values={...(saved.values||{})},units={...(saved.units||{})},choices={...(saved.choices||{})},itemNames={...(saved.itemNames||{})},unplaced=[...(saved.unplaced||[])];
 const raw=id=>Object.hasOwn(values,id)?String(values[id]):byId.get(id)?.text||'';
 const quantityFields=fields.filter(f=>f.kind==='qty');
 function set(id,value){if(!byId.has(id))return;values[id]=String(value);const f=byId.get(id);if(f.kind==='name')for(const q of quantityFields.filter(q=>q.nameId===id)){delete choices[q.id];delete itemNames[q.id];}}
 function query(q){const n=raw(q.nameId);if(itemNames[q.id])return itemNames[q.id];const dim=n.normalize('NFKC').match(/(\d+)\s*[×x]\s*(\d+)/i);if(dim&&q.variant==='枠')return `バタフライフレーム ${dim[1]}F×${dim[2]}F`;if(dim&&q.variant)return `${dim[1]}×${dim[2]} ${q.variant}`;return n;}
 function resolve(q){const name=query(q),qty=Object.hasOwn(values,q.id)?values[q.id]:'';if(!String(qty).trim())return null;
  let r=engine.entry(name,qty,units[q.id]||'',choices[q.id],q.cat);
  if(r&&!r.known&&!r.candidates.length)r=engine.entry(name,qty,units[q.id]||'',choices[q.id]);
  if(!r)r={raw:'',name:'機材名未入力',qty:Number(qty),valid:false,known:false,price:null,candidates:[],unitPending:false};
  r.key=q.id;r.field=q;return r;
 }
 function rows(){return quantityFields.map(resolve).filter(Boolean);}
 function predictions(id,name){const f=byId.get(id),q=f?.kind==='qty'?f:byId.get(f?.qtyId);if(!q)return[];let matches=engine.suggest(name,q.cat);if(!matches.length)matches=engine.suggest(name);return matches;}
 function pick(qid,item){const q=byId.get(qid);if(!q||q.kind!=='qty')return;if(q.variant)itemNames[qid]=item.name;else values[q.nameId]=item.name;choices[qid]=item.id;}
 function display(f){if(f.format==='month'){const d=raw('date');return /^\d{4}-\d{2}-\d{2}$/.test(d)?String(Number(d.slice(5,7))):d;}
  if(f.format==='day'){const d=raw('date');return /^\d{4}-\d{2}-\d{2}$/.test(d)?String(Number(d.slice(8,10))):raw(f.id);}
  if(f.kind==='qty'){const r=resolve(f);return r?.valid&&!r.unitPending&&r.item?.pack>1?String(r.units):Object.hasOwn(values,f.id)?raw(f.id):f.text;}
  if(f.kind==='name'){
   const q=byId.get(f.qtyId),r=q&&resolve(q);if(r?.known&&!q.variant)return r.name;
   if(Object.hasOwn(values,f.id)){let m=engine.resolve(raw(f.id),f.cat);if(!m.length)m=engine.resolve(raw(f.id));if(m.length===1)return m[0].name;}
  }return raw(f.id);
 }
 function clear(id){const f=byId.get(id);if(!f)return;values[id]='';if(f.format){values.date='';values.day='';}if(f.kind==='name')for(const q of quantityFields.filter(q=>q.nameId===id)){values[q.id]='';delete units[q.id];delete choices[q.id];delete itemNames[q.id];}if(f.kind==='qty'){delete choices[id];delete itemNames[id];}}
 function place(record){
  let matches=engine.resolve(record.name);const cat=matches.length===1?matches[0].cat:record.cat;
  const empty=fields.filter(f=>f.kind==='name'&&!raw(f.id).trim()&&f.qtyId);
  const f=empty.find(f=>f.cat===cat)||empty[0];if(!f)return false;
  values[f.id]=record.name;values[f.qtyId]=String(record.qty??1);units[f.qtyId]=record.unit||'';if(record.choice)choices[f.qtyId]=record.choice;return true;
 }
 function migrate(old){
  for(const k of ['title','ld','move','date'])if(old.meta?.[k]!==undefined&&byId.has(k))values[k]=old.meta[k];
  if(Array.isArray(old.groups))old.groups.forEach((g,cat)=>g.forEach(r=>{if(r.name?.trim()){const record={...r,cat};if(!place(record))unplaced.push(record);}}));
  else if(old.inputs)old.inputs.forEach((text,cat)=>{for(const line of text.split('\n')){const key=cat+':'+line.trim(),r=engine.parse(line,old.choices?.[key],old.unitChoices?.[key]);if(r){const record={name:r.raw,qty:r.qty,unit:r.unit,choice:r.item?.id,cat};if(!place(record))unplaced.push(record);}}});
 }
 return{fields,byId,values,units,choices,itemNames,unplaced,raw,set,clear,rows,resolve,predictions,pick,display,place,migrate,snapshot:()=>({version:3,values,units,choices,itemNames,unplaced})};
}
global.ArcSheet={create};
})(typeof window==='undefined'?globalThis:window);
