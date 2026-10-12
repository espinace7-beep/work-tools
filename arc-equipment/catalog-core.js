(function(global){
'use strict';
const normal=s=>String(s).normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+96)).replace(/[×x]/g,'×').replace(/[\s\-ー・'’()（）_]/g,'');
const extraAliases=item=>{
 const n=item.name,a=[];
 const code=n.match(/^(60|38|22)Sコード 20m$/);if(code)a.push(code[1]+'Sコード');
 const extension=n.match(/^C(30|60)A延長コード 8m$/);if(extension)a.push(extension[1]+'A延長コード C型');
 if(/SKYPANEL/i.test(n)){a.push(n.replace(/LED\s*/i,'').replace(/SKYPANEL/i,'スカイパネル'));const m=n.match(/S\d+C/i);if(m)a.push(m[0]);}
 if(/600c Pro II/i.test(n))a.push('600c pro2','600c2','600c ii','600cプロ2');
 if(/600c Pro$/i.test(n))a.push('600cプロ');
 if(/ロードランナー/.test(n))a.push('road runner','roadrunner');
 if(/センチュリースタンド/.test(n)){a.push(n.replace('センチュリースタンド','cスタンド'));if(n.includes("40'"))a.push('センチュリー(大) New黒');if(n.includes("20'"))a.push('センチュリー(小) New黒');}
 return a;
};
function create(items){
 const index=new Map(),byId=new Map(),records=[];
 for(const item of items){
  byId.set(item.id,item);const keys=[...new Set([item.name,...item.aliases||[],...extraAliases(item)].map(normal))];records.push({item,keys});
  for(const k of keys){if(!index.has(k))index.set(k,[]);if(!index.get(k).includes(item))index.get(k).push(item);}
 }
 const inCategory=(item,cat)=>cat===undefined||cat===null||item.cat===Number(cat);
 function resolve(name,cat){
  const k=normal(name);if(!k)return[];
  const exact=(index.get(k)||[]).filter(i=>inCategory(i,cat));if(exact.length)return exact;
  if(k.length<2)return[];
  const tokens=String(name).normalize('NFKC').trim().split(/[\s・]+/).map(normal).filter(Boolean);
  return records.filter(r=>inCategory(r.item,cat)&&r.keys.some(a=>a.includes(k)||(tokens.length>1&&tokens.every(t=>a.includes(t))))).sort((a,b)=>Math.min(...a.keys.map(k=>k.length))-Math.min(...b.keys.map(k=>k.length))).map(r=>r.item);
 }
 function distance(a,b){if(Math.abs(a.length-b.length)>2)return 99;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next;}return prev[b.length];}
 function suggest(name,cat){const matches=resolve(name,cat);if(matches.length)return matches;const k=normal(name);if(k.length<4)return[];return records.filter(r=>inCategory(r.item,cat)).map(r=>({item:r.item,d:Math.min(...r.keys.map(a=>distance(k,a)))})).filter(r=>r.d<=(k.length>=8?2:1)).sort((a,b)=>a.d-b.d).map(r=>r.item);}
 function entry(name,qty=1,unit='',choice,cat){
  name=String(name).normalize('NFKC').trim();if(!name)return null;
  qty=Number(qty);const candidates=resolve(name,cat);let item=candidates.length===1?candidates[0]:candidates.find(i=>i.id===choice);
  // Explicitly selected predictions may include spelling suggestions.
  if(choice&&suggest(name,cat).some(i=>i.id===choice))item=byId.get(choice);
  if(item&&!inCategory(item,cat))item=null;
  const valid=qty>0&&Number.isInteger(qty),explicitUnit=!!unit;
  let units=qty,price=null,quantityNote='',unitPending=false;
  if(item&&valid){if(item.pack>1){
   if(!unit){unitPending=true;quantityNote=`${item.pack}${item.unit}1セット：単位を選択`;}
   else if(/^(セット|set)$/i.test(unit)){quantityNote=`${qty}セット（${qty*item.pack}${item.unit}）`;}
   else if(unit===item.unit){units=Math.ceil(qty/item.pack);quantityNote=`${qty}${unit} → ${units}セット`+(qty%item.pack?'（セット単位に切り上げ）':'');}
   else{unitPending=true;quantityNote=`「${item.unit}」か「セット」を選択`;}
  }if(!unitPending&&item.price!==null)price=(item.price+(item.firstDayExtra||0))*units;}
  return{raw:name,name:item?item.name:name,qty,unit,explicitUnit,item,candidates,valid,known:!!item,price,units,quantityNote,unitPending};
 }
 function parse(line,choice,unitChoice){
  let raw=String(line).normalize('NFKC').trim().replace(/^[・•●\-]\s*/,'');if(!raw)return null;let name=raw,qty=1,unit='';
  if(!index.has(normal(raw))){const m=raw.match(/^(.*?)\s*(?:[×xX*]\s*(\d+(?:\.\d+)?)|\s+(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?))\s*(台|本|個|枚|セット|set|時間|km)?\s*$/i);if(m&&(m[2]||m[3]||m[5])){name=m[1].trim();qty=Number(m[2]||m[3]||m[4]);unit=m[5]||'';}}
  const r=entry(name,qty,unit||unitChoice||'',choice);if(r)r.explicitUnit=!!unit;return r;
 }
 return{parse,entry,resolve,suggest,byId};
}
global.ArcCatalog={create,normal};
})(typeof window==='undefined'?globalThis:window);
