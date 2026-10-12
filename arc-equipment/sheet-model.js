(function(global){
'use strict';
function create(layout,engine,saved={}){
 const fields=layout.fields,byId=new Map(fields.map(f=>[f.id,f]));
 const values={...(saved.values||{})},units={...(saved.units||{})},choices={...(saved.choices||{})},itemNames={...(saved.itemNames||{})},unplaced=[...(saved.unplaced||[])];
 const raw=id=>Object.hasOwn(values,id)?String(values[id]):byId.get(id)?.text||'';
 const quantityFields=fields.filter(f=>f.kind==='qty');
 function set(id,value){if(!byId.has(id))return;values[id]=String(value);const f=byId.get(id);if(f.kind==='name')for(const q of quantityFields.filter(q=>q.nameId===id)){delete choices[q.id];delete itemNames[q.id];}}
 function query(q,n=raw(q.nameId),selected=true){if(selected&&itemNames[q.id])return itemNames[q.id];const dim=n.normalize('NFKC').match(/(\d+)\s*[×x]\s*(\d+)/i);if(dim&&q.variant==='枠')return `バタフライフレーム ${dim[1]}F×${dim[2]}F`;if(dim&&q.variant)return `${dim[1]}×${dim[2]} ${q.variant}`;return n;}
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
 function identify(name,choice,cat){
  const matches=engine.resolve(name,cat);const chosen=choice&&matches.find(i=>i.id===choice);
  if(chosen)return chosen;if(matches.length===1)return matches[0];
  if(cat!==undefined){const global=engine.resolve(name);if(global.length===1)return global[0];}return null;
 }
 let printedIndex;
 function printedTarget(item){
  if(!item)return null;
  if(!printedIndex){
   printedIndex=new Map();
   for(const q of quantityFields){const f=byId.get(q.nameId);if(!f.text.trim())continue;
    const original=q.variant?query(q,f.text,false):f.text,originalItem=identify(original,null,q.cat);if(!originalItem)continue;
    const exact=[originalItem.name,...originalItem.aliases||[]].some(n=>ArcCatalog.normal(n)===ArcCatalog.normal(original));
    if(!printedIndex.has(originalItem.id))printedIndex.set(originalItem.id,[]);printedIndex.get(originalItem.id).push({q,score:exact?0:1});
   }
   for(const entries of printedIndex.values())entries.sort((a,b)=>a.score-b.score||a.q.y-b.q.y||a.q.x-b.q.x);
  }
  for(const {q} of printedIndex.get(item.id)||[]){const f=byId.get(q.nameId);if(raw(f.id).trim()&&identify(query(q),choices[q.id],q.cat)?.id===item.id)return q;}
  return null;
 }
 function writeQuantity(q,record,item){
  const existing=Object.hasOwn(values,q.id)?values[q.id]:'';let qty=record.qty??1,unit=record.unit||'';
  if(String(existing).trim()){
   if(!Number.isInteger(Number(existing))||Number(existing)<=0||!Number.isInteger(Number(qty))||Number(qty)<=0)return false;
   const oldUnit=units[q.id]||'';
   if(item?.pack>1){
    const factor=u=>/^(セット|set)$/i.test(u)?item.pack:u===item.unit?1:null;
    const oldFactor=factor(oldUnit),newFactor=factor(unit);if(!oldFactor||!newFactor)return false;
    const physical=Number(existing)*oldFactor+Number(qty)*newFactor;
    // Preserve physical quantities if whole sets cannot represent them.
    if(physical%oldFactor){qty=physical;unit=item.unit;}else{qty=physical/oldFactor;unit=oldUnit;}
   }else{qty=Number(existing)+Number(qty);unit=oldUnit||unit;}
  }
  values[q.id]=String(qty);units[q.id]=unit;if(item)pick(q.id,item);else if(record.choice)choices[q.id]=record.choice;
  return true;
 }
 function place(record){
  const item=identify(record.name,record.choice),printed=printedTarget(item);
  if(printed&&writeQuantity(printed,record,item))return printed.id;
  const cat=item?.cat??record.cat,empty=fields.filter(f=>f.kind==='name'&&!raw(f.id).trim()&&f.qtyId);
  const f=empty.find(f=>f.cat===cat)||empty[0];if(!f)return false;
  values[f.id]=record.name;values[f.qtyId]=String(record.qty??1);units[f.qtyId]=record.unit||'';if(record.choice)choices[f.qtyId]=record.choice;return f.qtyId;
 }
 function route(qid){
  const q=byId.get(qid),r=q&&resolve(q);if(!r?.known||!r.valid)return qid;const sourceName=byId.get(q.nameId);if(sourceName.text.trim()&&!Object.hasOwn(values,q.nameId)&&!itemNames[qid])return qid;
  const target=printedTarget(r.item);if(!target||target.id===qid)return qid;
  if(!writeQuantity(target,{qty:values[qid],unit:units[qid]||'',choice:r.item.id},r.item))return qid;
  const source=byId.get(q.nameId),dest=byId.get(target.nameId);
  if(!q.variant){delete values[q.nameId];if(source.noteId&&Object.hasOwn(values,source.noteId)&&raw(source.noteId).trim()){
   const note=raw(source.noteId);if(dest.noteId)values[dest.noteId]=[raw(dest.noteId),note].filter(Boolean).join(' / ');
   else values.notes=[raw('notes'),r.name+'：'+note].filter(Boolean).join('\n');delete values[source.noteId];
  }}
  delete values[qid];delete units[qid];delete choices[qid];delete itemNames[qid];return target.id;
 }
 function reconcile(){for(const q of quantityFields)if(Object.hasOwn(values,q.id))route(q.id);}
 function migrate(old){
  for(const k of ['title','ld','move','date'])if(old.meta?.[k]!==undefined&&byId.has(k))values[k]=old.meta[k];
  if(Array.isArray(old.groups))old.groups.forEach((g,cat)=>g.forEach(r=>{if(r.name?.trim()){const record={...r,cat};if(!place(record))unplaced.push(record);}}));
  else if(old.inputs)old.inputs.forEach((text,cat)=>{for(const line of text.split('\n')){const key=cat+':'+line.trim(),r=engine.parse(line,old.choices?.[key],old.unitChoices?.[key]);if(r){const record={name:r.raw,qty:r.qty,unit:r.unit,choice:r.item?.id,cat};if(!place(record))unplaced.push(record);}}});
 }
 return{fields,byId,values,units,choices,itemNames,unplaced,raw,set,clear,rows,resolve,predictions,pick,display,place,route,reconcile,migrate,snapshot:()=>({version:3,values,units,choices,itemNames,unplaced})};
}
global.ArcSheet={create};
})(typeof window==='undefined'?globalThis:window);
