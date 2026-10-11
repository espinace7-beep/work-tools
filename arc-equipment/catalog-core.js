(function(global){
'use strict';
const normal=s=>String(s).normalize('NFKC').toLowerCase().replace(/(?:×|x)/g,'×').replace(/[\s\-ー・'’()（）]/g,'');
function create(items){
 const index=new Map(),byId=new Map();
 for(const item of items){byId.set(item.id,item);for(const a of [item.name,...item.aliases||[]]){const k=normal(a);if(!index.has(k))index.set(k,[]);if(!index.get(k).includes(item))index.get(k).push(item)}}
 function resolve(name){const k=normal(name);if(!k)return[];if(index.has(k))return index.get(k);if(k.length<2)return[];return items.filter(i=>[i.name,...i.aliases||[]].some(a=>normal(a).includes(k)))}
 function parse(line,choice,unitChoice){
  let raw=line.normalize('NFKC').trim().replace(/^[・•●\-]\s*/, '');if(!raw)return null;
  let name=raw,qty=1,unit='';
  // Prefer complete catalog names, including dimensions such as 6×6.
  if(!index.has(normal(raw))){
   const m=raw.match(/^(.*?)\s*(?:[×xX*]\s*(\d+(?:\.\d+)?)|\s+(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?))\s*(台|本|個|枚|セット|set|時間|km)?\s*$/i);
   if(m&&(m[2]||m[3]||m[5])){name=m[1].trim();qty=Number(m[2]||m[3]||m[4]);unit=m[5]||'';}
  }
  const candidates=resolve(name);let item=candidates.length===1?candidates[0]:byId.get(choice);
  if(item&&!candidates.includes(item))item=null;
  const explicitUnit=!!unit;if(unitChoice&&!unit)unit=unitChoice;
  const valid=qty>0&&Number.isInteger(qty)&&!!name;
  let units=qty,price=null,quantityNote='',unitPending=false;
  if(item&&valid){
   if(item.pack>1){
    if(!unit){unitPending=true;quantityNote=`${item.pack}${item.unit}1セット：数量の単位を選択`;}
    else if(/^(セット|set)$/i.test(unit)){quantityNote=`${qty}セット（${qty*item.pack}${item.unit}）`;}
    else if(unit===item.unit){units=Math.ceil(qty/item.pack);quantityNote=`${qty}${unit} → ${units}セット`+(qty%item.pack?'（セット単位に切り上げ）':'');}
    else{unitPending=true;quantityNote=`「${item.unit}」か「セット」で入力`;}
   }
   if(!unitPending&&item.price!==null)price=(item.price+(item.firstDayExtra||0))*units;
  }
  return{raw:name,name:item?item.name:name,qty,unit,explicitUnit,item,candidates,valid,known:!!item,price,units,quantityNote,unitPending};
 }
 return{parse,resolve,byId};
}
global.ArcCatalog={create,normal};
})(typeof window==='undefined'?globalThis:window);
