'use strict';
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const files=['index.html','app.js','v13.js','v14.js','v15.js'];
const src=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
const all=files.map(f=>src[f]).join('\n');
const failures=[];
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

// Inventory every historical button, including the static shell in index.html.
const buttons=[];
for(const [file,s] of Object.entries(src)){
  for(const m of s.matchAll(/<button\b([^>]*)>/g)){
    const attrs=m[1]||'';
    const id=(attrs.match(/\bid="([A-Za-z][A-Za-z0-9_:-]*)"/)||[])[1]||null;
    const data=[...attrs.matchAll(/\bdata-([a-zA-Z0-9-]+)=/g)].map(x=>x[1]);
    const inline=/\bon(?:click|change|input|submit|keydown|keyup)\s*=/.test(attrs);
    buttons.push({file,id,data,inline,markup:m[0],offset:m.index});
  }
}

// A button ID is considered proven only when the exact element lookup is tied to an
// event property/listener, directly or through a nearby local variable assignment.
function hasConcreteIdBinding(id){
  const q=escRe(id);
  const lookup=String.raw`(?:\$\(\s*['"]${q}['"]\s*\)|document\.getElementById\(\s*['"]${q}['"]\s*\)|document\.querySelector\(\s*['"]#${q}['"]\s*\))`;
  const event=String.raw`(?:onclick|onchange|oninput|onsubmit|onkeydown|onkeyup|onblur|onfocus)`;
  if(new RegExp(`${lookup}\\s*(?:\\?\\.)?\\s*\\.?${event}\\s*=`).test(all))return true;
  if(new RegExp(`${lookup}\\s*(?:\\?\\.)?\\s*\\.?addEventListener\\s*\\(`).test(all))return true;

  // Handle: const btn=$('id'); ... btn.onclick=... inside the same local block.
  const assignRe=new RegExp(String.raw`(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*${lookup}`,'g');
  let m;
  while((m=assignRe.exec(all))){
    const name=escRe(m[1]),window=all.slice(m.index,Math.min(all.length,m.index+900));
    if(new RegExp(`\\b${name}\\s*(?:\\?\\.)?\\s*\\.?(?:${event})\\s*=`).test(window))return true;
    if(new RegExp(`\\b${name}\\s*(?:\\?\\.)?\\s*\\.?addEventListener\\s*\\(`).test(window))return true;
  }
  return false;
}

const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
function hasDataConsumer(a){
  const q=escRe(a),c=escRe(camel(a));
  return new RegExp(`\\[data-${q}(?:[=\\]])`).test(all) ||
    new RegExp(`dataset\\.${c}\\b`).test(all) ||
    new RegExp(`dataset\\[['"]${c}['"]\\]`).test(all) ||
    new RegExp(`getAttribute\\(\\s*['"]data-${q}['"]\\s*\\)`).test(all);
}

// Historical floor renders the visible start CTA without its own id/data attribute.
// It is intentionally nested in the data-station card; click bubbles to that card's
// exact handler, which calls openStation with the card's station id.
function hasStationStartBubblingContract(b){
  if(!/\bstation-start-btn\b/.test(b.markup))return false;
  const s=src[b.file]||'';
  const rendersButton=/foot\s*=\s*`<button\s+class=["']station-start-btn["']>/.test(s);
  const rendersStation=/data-station=["']\$\{st\.id\}["']/.test(s);
  const bindsStation=/document\.querySelectorAll\(\s*["']\[data-station\]["']\s*\)\s*\.forEach\(\s*el\s*=>\s*el\.onclick\s*=/.test(s);
  const opensStation=/openStation\(\s*el\.dataset\.station\s*\)/.test(s);
  return rendersButton&&rendersStation&&bindsStation&&opensStation;
}

let idButtons=0,dataButtons=0,inlineButtons=0,disabledButtons=0,bubbledButtons=0;
const uniqueIds=new Set();
for(const b of buttons){
  if(b.inline){inlineButtons++;continue;}
  // A deliberately disabled control is explicitly non-interactive, so no JS binding is expected.
  if(/\sdisabled(?:\s|>|=)/.test(b.markup)){disabledButtons++;continue;}
  let proven=false;
  if(b.id){
    uniqueIds.add(b.id);idButtons++;
    if(hasConcreteIdBinding(b.id))proven=true;
  }
  if(b.data.length){
    dataButtons++;
    if(b.data.some(hasDataConsumer))proven=true;
  }
  if(hasStationStartBubblingContract(b)){bubbledButtons++;proven=true;}
  // Pure submit/reset buttons are native form controls and do not need a JS listener.
  if(/\btype="(?:submit|reset)"/.test(b.markup))proven=true;
  if(!proven){
    const markup=b.markup.replace(/\s+/g,' ').slice(0,220);
    const around=src[b.file].slice(Math.max(0,b.offset-260),Math.min(src[b.file].length,b.offset+620)).replace(/\s+/g,' ').slice(0,880);
    failures.push(`UNPROVEN_BUTTON_BINDING:${b.file}:${b.id||'(no-id)'}:${b.data.join(',')||'(no-data)'}:${markup}\nCONTEXT:${around}`);
  }
}

// Every data-* interaction contract rendered on a button must have a selector/dataset consumer.
const attrs=new Set(buttons.flatMap(b=>b.data));
for(const a of [...attrs].sort()) if(!hasDataConsumer(a)) failures.push(`DATA_ACTION_WITHOUT_CONSUMER:${a}`);

// Critical global surfaces must each have an exact concrete binding, not merely another string occurrence.
const critical=['menuBtn','drawerClose','quickStartBtn','openShiftBtn','closeShiftBtn','startSessionBtn'];
for(const id of critical) if(!hasConcreteIdBinding(id)) failures.push(`CRITICAL_CONTROL_WITHOUT_BINDING:${id}`);

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`V160_STABILIZATION_INTERACTION_AUDIT_OK buttons=${buttons.length} uniqueIds=${uniqueIds.size} idButtons=${idButtons} dataButtons=${dataButtons} inlineButtons=${inlineButtons} disabledButtons=${disabledButtons} bubbledButtons=${bubbledButtons} dataContracts=${attrs.size}`);

// Dynamic v1.5 tabs also need persistent route state, otherwise a re-render can jump to a wrong screen.
require('./test-v160-stabilization-tabs.js');
// Settings written by v1.6 must survive the v1.5 parity initializer on process restart.
require('./test-v160-stabilization-settings-persistence.js');
// Keep the physical Android journey runnable after pm clear: runtime permissions must be resolved before MainActivity foreground assertions.
require('./test-v160-native-harness-first-launch.js');
