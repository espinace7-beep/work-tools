const assert=require('node:assert/strict');require('../catalog-core');require('../sheet-model');require('../order-model');const data=require('../catalog.json'),layout=require('../sheet-layout.json'),engine=ArcCatalog.create(data.items);
for(const item of data.items){assert(Number.isInteger(item.column)&&item.column>=0&&item.column<4,item.name);if(item.column===0)assert(/ライト|灯体アクセサリー/.test(item.role),item.name);}
const sheet=ArcSheet.create(layout,engine);
function place(name,expected){const item=engine.resolve(name)[0];assert(item,name);const qid=sheet.place({name:item.name,qty:1,unit:item.pack>1?item.unit:'台',choice:item.id});assert(qid,name);const f=sheet.byId.get(sheet.byId.get(qid).nameId);assert.equal(sheet.fieldColumn(f),expected,name);return f;}
place('Aputure LS 600c Pro II',0);place('Aputure LS 600c Pro II用 ライトドーム2',0);place('Aputure MOTORIZED YOKE',0);
place('Aputure INFINIBAR PB12用 DMXケーブル2本入り',2);place('Free Style LEDチューブ用 スタンドセット 2本入り',1);
const road=place('ロードランナー',1);assert.equal(road.text,'ﾛｰﾄﾞﾗﾝﾅｰ');
const century=place("40'センチュリースタンド",1);assert(century.text.includes('ｾﾝﾁｭﾘｰ(大)'));
const flag=place('黒フラッグ 大',1);assert.equal(flag.text,'黒フラッグ（大）');
const cable=place('C30A延長コード 8m',2);assert(cable.text.includes('30A延長'));
const cargo=place('センチュリーカーゴ フルサイズ',1);assert(cargo.text.includes('ｾﾝﾁｭﾘｰｶｰｺﾞ'));
const frame=place('バタフライフレーム 6F×6F',3);assert(frame.text.includes('バタフライ'));
place('サイレントライトグリッドクロス 20F×20F',3);place('PORTABLE POWER Jackery 5000Plus',2);
assert.equal(sheet.place({name:'完全に未照合の機材',qty:1,cat:0}),false,'Unknown equipment went into first column automatically');
const manual=sheet.place({name:'未照合の灯体',qty:1,column:0});assert(manual);assert.equal(sheet.fieldColumn(sheet.byId.get(sheet.byId.get(manual).nameId)),0);
const crowded=ArcSheet.create(layout,engine);while(crowded.place({name:'スタンド用未登録品',qty:1,column:1})){}
const stand=engine.resolve('スーパークランク')[0];assert(stand);assert.equal(crowded.place({name:stand.name,choice:stand.id,qty:1}),false,'Stand spilled into first column');
assert(crowded.fields.some(f=>f.kind==='name'&&f.x<120&&!crowded.raw(f.id)),'First column should remain available');
assert(crowded.place({name:'ロードランナー',qty:2,choice:engine.resolve('ロードランナー')[0].id}),'Preset not used when empty slots were full');
const order=ArcOrder.create(layout,engine);const unknown=order.add(null,'未照合の撮影用品');assert.equal(order.build().placements[unknown.id].reason,'classification');unknown.column=3;assert.equal(order.build().unplaced.length,0);
const acc=order.add(engine.resolve('Aputure LS 600c Pro II用 ライトドーム2')[0]);const placement=order.build().placements[acc.id];assert.equal(placement.column,0);assert.equal(placement.preset,false);
console.log('PASS: catalog column coverage, light/accessory-only first column, dedicated stand/power exceptions, preset priority, frame matrix, unknown confirmation and no overflow to unrelated columns');
