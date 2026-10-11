const assert=require('node:assert/strict');const fs=require('node:fs');require('../catalog-core.js');
const data=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../catalog.json'),'utf8'));const engine=ArcCatalog.create(data.items);
function price(input,expected){const r=engine.parse(input);assert(r?.known,input);assert.equal(r.price,expected,input);return r;}
price('G3 ×2',38000);price('オービター ×2',30000);price('HIVE 200c ×2',8000);
price('600c Pro II ×1',19500);price('600c Pro ×1',16500);
const ambiguous=engine.parse('600c ×2');assert(!ambiguous.known);assert.equal(ambiguous.candidates.length,2);assert.equal(ambiguous.price,null);
assert.equal(engine.parse('600c ×2',ambiguous.candidates.find(i=>i.name.endsWith(' II')).id).price,39000);
price('Titan 4本',26000);const odd=price('Titan 3本',26000);assert.equal(odd.units,2);assert.match(odd.quantityNote,/切り上げ/);
price('Titan 2セット',26000);assert(engine.parse('Titan ×4').unitPending);assert.equal(engine.parse('Titan ×4',null,'本').price,26000);
assert.equal(engine.parse('Titan 4台').price,null);assert(engine.parse('Titan 4台').unitPending);
price('センチュリー大 ×6',7800);price('6×6 LGC ×1',2500);
price('白シルク6×6',2200);price('Aputure LS 600c Pro II ×１',19500);
assert(!engine.parse('G3 ×0').valid);assert(!engine.parse('G3 ×1.5').valid);assert(!engine.parse('ほげほげ ×2').known);
price('DF-50 水性 ×1',23300);price('フォグマシンVIPER ×2',47960);
const nullItem=data.items.find(i=>i.price===null);assert.equal(engine.parse(nullItem.name).price,null);assert(engine.parse(nullItem.name).known);
assert.equal(new Set(data.items.map(i=>i.id)).size,data.items.length);
for(const item of data.items){assert(!/[◇�]/.test(item.name),item.name);assert(item.price===null||Number.isInteger(item.price)&&item.price>0);assert(item.pages.every(p=>p>=1&&p<=136));}
console.log('PASS: catalog integrity, aliases, ambiguous choices, set units, odd quantity rounding, first-day juice, unknown prices');

for(const item of data.items){assert(engine.resolve(item.name.toLowerCase(),item.cat).some(i=>i.id===item.id),item.name);}
assert.equal(engine.entry('600c pro2',2,'台',null,0).price,39000);
assert.equal(engine.entry('６００Ｃ ＰＲＯ２',2,'台',null,0).price,39000);
assert.equal(engine.entry('600x',1,'台',null,0).qty,1);
assert.equal(engine.entry('skypanel s60c',1,'台',null,0).item.name,'LED SKYPANEL S60C');
assert.equal(engine.entry('s60c',1,'台',null,0).item.name,'LED SKYPANEL S60C');
assert.equal(engine.entry('すかいぱねる s60c',1,'台',null,0).item.name,'LED SKYPANEL S60C');
assert.equal(engine.entry('road runner',1,'台',null,1).item.name,'ロードランナー');
assert.equal(engine.entry('センチ大',6,'台',null,1).price,7800);
assert(!engine.entry('センチ大',6,'台',null,0).known);
assert(engine.suggest('titan',0).every(i=>i.cat===0));
assert.equal(engine.entry('6×6 LGC',1,'枚',null,4).price,2500);
assert(!engine.entry('g3','', '台',null,0).valid);
assert.equal(engine.entry('titan',4,'本',null,0).price,26000);
assert(!engine.entry('600c',2,'台',null,0).known);
const candidate=engine.suggest('roadrunnet',1)[0];assert.equal(candidate.name,'ロードランナー');
assert.equal(engine.entry('roadrunnet',1,'台',candidate.id,1).name,'ロードランナー');
console.log('PASS: case-insensitive lookup for all 1989 catalog rows, separate quantities, category filtering, hiragana, shorthand, fuzzy selection');
