'use strict';
// Canonical contract inventory for the 2.3 release candidate.
const fs=require('fs'),path=require('path');
const A='app/src/main/assets';
for(const f of fs.readdirSync(A).filter(x=>x.endsWith('.js')).sort()){
 const s=fs.readFileSync(path.join(A,f),'utf8'), lines=s.split(/\r?\n/);
 const hits=[];
 lines.forEach((l,i)=>{if(/featureFlags/.test(l))hits.push(`${i+1}: ${l.trim().slice(0,500)}`)});
 if(hits.length){console.log(`\n### ${f}`);hits.forEach(x=>console.log(x));}
}
console.log('\nFEATURE_FLAG_CONTRACT_INVENTORY_OK');
