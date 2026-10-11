const assert=require('node:assert/strict');require('../catalog-core.js');require('../sheet-model.js');
const layout=require('../sheet-layout.json'),data=require('../catalog.json'),engine=ArcCatalog.create(data.items);
const model=ArcSheet.create(layout,engine);
assert.equal(new Set(layout.fields.map(f=>f.id)).size,layout.fields.length);
for(const f of layout.fields){assert(f.x>=0&&f.y>=0&&f.x+f.w<=595&&f.y+f.h<=842);if(f.kind==='qty')assert(model.byId.get(f.nameId)?.kind==='name');}
for(let i=0;i<layout.fields.length;i++)for(const b of layout.fields.slice(i+1)){const a=layout.fields[i],ix=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),iy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);assert(!(ix>1&&iy>1),a.id+' overlaps '+b.id);}
assert.equal(model.rows().length,0,'Printed default names must not be charged');
const stand=layout.fields.find(f=>f.kind==='name'&&f.text.includes('ｾﾝﾁｭﾘｰ(大)'));
model.set(stand.qtyId,'6');assert.equal(model.rows()[0].price,7800);assert.equal(model.display(stand),"40'センチュリースタンド");
const empty=layout.fields.find(f=>f.kind==='name'&&!f.text&&f.cat===0);
model.set(empty.id,'600c');model.set(empty.qtyId,'2');assert.equal(model.resolve(model.byId.get(empty.qtyId)).price,null);
const pro2=engine.resolve('600c pro2',0)[0];model.pick(empty.qtyId,pro2);assert.equal(model.resolve(model.byId.get(empty.qtyId)).price,39000);
model.set(empty.id,'titan');model.units[empty.qtyId]='本';model.set(empty.qtyId,'4');assert.equal(model.resolve(model.byId.get(empty.qtyId)).price,26000);assert.equal(model.display(model.byId.get(empty.qtyId)),'2');
const matrix=layout.fields.find(f=>f.kind==='qty'&&f.variant==='LGC'&&ArcCatalog.normal(model.raw(f.nameId)).includes('6×6'));
model.set(matrix.id,'2');assert.equal(model.resolve(matrix).price,5000);
model.set('date','2026-10-11');assert.equal(model.display(model.byId.get('date')),'10');assert.equal(model.display(model.byId.get('day')),'11');model.clear('day');assert.equal(model.display(model.byId.get('date')),'');
model.clear(empty.id);assert.equal(model.raw(empty.qtyId),'');assert(!model.rows().some(r=>r.key===empty.qtyId));
const migrated=ArcSheet.create(layout,engine);migrated.migrate({meta:{title:'引き継ぎ',date:'2026-10-11'},groups:[[{name:'orbiter',qty:2,unit:'台'},{name:'titan',qty:4,unit:'本'}],[{name:'センチ大',qty:6,unit:'台'}]]});
assert.equal(migrated.rows().reduce((s,r)=>s+(r.price||0),0),63800);assert.equal(migrated.raw('title'),'引き継ぎ');assert.equal(migrated.unplaced.length,0);
const restored=ArcSheet.create(layout,engine,JSON.parse(JSON.stringify(migrated.snapshot())));assert.equal(restored.rows().reduce((s,r)=>s+(r.price||0),0),63800);
const old=ArcSheet.create(layout,engine);old.migrate({inputs:['G3 ×2','センチ大 ×6','','','','']});assert.equal(old.rows().reduce((s,r)=>s+(r.price||0),0),45800);
const crowded=ArcSheet.create(layout,engine);crowded.migrate({groups:[Array.from({length:300},()=>({name:'orbiter',qty:1}))]});assert.equal(crowded.rows().length+crowded.unplaced.length,300,'Migration lost user input');
console.log('PASS: all editable field bounds, no overlapping targets, blank default totals, printed-name matching, candidate selection, set quantities, matrix pricing, dates, deletion, migration and autosave restore');
