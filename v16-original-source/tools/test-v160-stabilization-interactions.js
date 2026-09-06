'use strict';
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const files=['app.js','v13.js','v14.js','v15.js'];
const src=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
const all=files.map(f=>src[f]).join('\n');
const failures=[];

// Every static button id rendered by existing v1.6 must be referenced again by JS binding/lookup code.
const ids=new Set();
for(const s of Object.values(src)) for(const m of s.matchAll(/<button\b[^>]*\bid="([A-Za-z][A-Za-z0-9_:-]*)"/g)) ids.add(m[1]);
for(const id of [...ids].sort()){
  const quoted=new RegExp(`['"]${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}['"]`,'g');
  const count=(all.match(quoted)||[]).length;
  if(count<2) failures.push(`BUTTON_WITHOUT_BINDING:${id}`);
}

// Every data-* interaction contract rendered on a button must have a selector/dataset consumer.
const attrs=new Set();
for(const s of Object.values(src)) for(const m of s.matchAll(/<button\b[^>]*\bdata-([a-zA-Z0-9-]+)=/g)) attrs.add(m[1]);
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
for(const a of [...attrs].sort()){
  const token=`data-${a}`,count=all.split(token).length-1;
  const consumed=count>1||all.includes(`[${token}]`)||all.includes(`dataset.${camel(a)}`)||all.includes(`dataset['${camel(a)}']`)||all.includes(`dataset["${camel(a)}"]`);
  if(!consumed) failures.push(`DATA_ACTION_WITHOUT_CONSUMER:${a}`);
}

// Critical global interactive surfaces must each have a concrete binding.
const critical=['menuBtn','drawerClose','quickStartBtn','openShiftBtn','closeShiftBtn','startSessionBtn'];
for(const id of critical){
  if(!all.includes(`'${id}'`)&&!all.includes(`"${id}"`)) failures.push(`CRITICAL_CONTROL_MISSING:${id}`);
}

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`V160_STABILIZATION_INTERACTION_AUDIT_OK buttons=${ids.size} dataContracts=${attrs.size}`);
