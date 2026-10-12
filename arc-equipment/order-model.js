(function(global){
'use strict';
function create(layout,engine,saved,oldSheet,legacy){
 let serial=0;const cats=['ライト','スタンド','グリップ・フラッグ','ケーブル・電源','フレーム・クロス','その他'];
 const blank=()=>({id:'job'+(++serial),meta:{title:'',date:'',ld:'藤田陽介',move:'',notes:''},base:{},records:[]});
 const state=saved&&Array.isArray(saved.jobs)&&saved.jobs.length?JSON.parse(JSON.stringify(saved)):{version:1,active:'',jobs:[],recent:[]};
 serial=Math.max(state.jobs.length,...state.jobs.map(j=>Number(j.id.replace('job',''))||0));
 if(!state.jobs.length){const j=blank();if(oldSheet||legacy){const sheet=ArcSheet.create(layout,engine,oldSheet||{});if(!oldSheet&&legacy)sheet.migrate(legacy);sheet.reconcile();
  for(const id of ['title','date','ld','move','notes','pd','pm','al','st','in','out','spare','moveMonth','moveDay','moveHour'])j.meta[id]=sheet.raw(id);
  const snapshot=sheet.snapshot();j.base=JSON.parse(JSON.stringify(snapshot));
  for(const row of sheet.rows()){const nameField=sheet.byId.get(row.field.nameId);j.records.push({id:'item'+j.records.length,name:row.known?row.name:row.raw,qty:String(row.qty),unit:row.unit||'',choice:row.item?.id||sheet.choices[row.key]||'',cat:row.item?.cat??row.field.cat,note:nameField.noteId?sheet.raw(nameField.noteId):''});delete j.base.values[row.key];delete j.base.units[row.key];delete j.base.choices[row.key];delete j.base.itemNames[row.key];if(!row.field.variant)delete j.base.values[row.field.nameId];if(nameField.noteId)delete j.base.values[nameField.noteId];}
  for(const r of sheet.unplaced)j.records.push({...r,id:'item'+j.records.length,note:r.note||''});j.base.unplaced=[];
 }state.jobs.push(j);state.active=j.id;}
 if(!state.jobs.some(j=>j.id===state.active))state.active=state.jobs[0].id;
 state.recent??=[];
 const current=()=>state.jobs.find(j=>j.id===state.active);
 let recordSerial=Math.max(0,...state.jobs.flatMap(j=>j.records.map(r=>Number(String(r.id).replace('item',''))||0)));
 function entry(record){return engine.entry(record.name,record.qty,record.unit||'',record.choice);}
 function add(item,name){const job=current(),unit=item?.pack>1?item.unit:/クロス|布|フラッグ|フロッピー/.test(item?.name||'')?'枚':item?.cat===3&&/コード/.test(item.name)?'本':item?.cat===0||item?.cat===1?'台':'個',amount=item?.pack>1?item.pack:1;
  const existing=item&&job.records.find(r=>entry(r)?.item?.id===item.id&&entry(r).valid&&!entry(r).unitPending);
  if(existing){const factor=/^(セット|set)$/i.test(existing.unit)?item.pack||1:1;existing.qty=String(Number(existing.qty)+amount/factor);}
  else job.records.push({id:'item'+(++recordSerial),name:item?.name||name,qty:String(amount),unit,choice:item?.id||'',cat:item?.cat??5,note:''});
  if(item){state.recent=[item.id,...state.recent.filter(id=>id!==item.id)].slice(0,10);}
  return existing||job.records.at(-1);
 }
 function remove(id){const list=current().records,index=list.findIndex(r=>r.id===id);if(index<0)return null;return{record:list.splice(index,1)[0],index,jobId:state.active};}
 function undo(removal){const job=state.jobs.find(j=>j.id===removal.jobId);if(job&&!job.records.some(r=>r.id===removal.record.id))job.records.splice(removal.index,0,removal.record);}
 function project(copy=false){const j=blank();if(copy){const source=current();j.meta={...source.meta,title:source.meta.title?source.meta.title+'（コピー）':'',date:''};j.base=JSON.parse(JSON.stringify(source.base));j.records=source.records.map(r=>({...r,id:'item'+(++recordSerial)}));}state.jobs.push(j);state.active=j.id;return j;}
 function build(){const job=current(),sheet=ArcSheet.create(layout,engine,job.base||{}),unplaced=[],rows=[];
  for(const [id,value] of Object.entries(job.meta))sheet.set(id,value);
  for(const record of job.records){const r=entry(record);if(!r){rows.push({record,valid:false,price:null,name:'機材名未入力',candidates:[]});continue;}r.record=record;rows.push(r);
   const qid=sheet.place({name:r.known?r.name:record.name,qty:record.qty,unit:record.unit,choice:r.item?.id||record.choice,cat:r.item?.cat??record.cat});
   if(!qid){unplaced.push(record.id);continue;}
   if(record.note){const f=sheet.byId.get(sheet.byId.get(qid).nameId);if(f.noteId)sheet.set(f.noteId,[sheet.raw(f.noteId),record.note].filter(Boolean).join(' / '));else sheet.set('notes',[sheet.raw('notes'),r.name+'：'+record.note].filter(Boolean).join('\n'));}
  }
  let total=0,pending=0,unknown=0,invalid=0;
  for(const r of rows){if(!r.valid)invalid++;else if(r.unitPending||r.candidates.length>1&&!r.known)pending++;else if(r.price===null)unknown++;else total+=r.price;}
  return{sheet,rows,total,pending,unknown,invalid,unplaced};
 }
 return{state,current,entry,add,remove,undo,project,build,cats,snapshot:()=>state};
}
global.ArcOrder={create};
})(typeof window==='undefined'?globalThis:window);
