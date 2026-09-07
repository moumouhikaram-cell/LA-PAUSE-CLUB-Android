'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const assets=path.join(root,'app','src','main','assets');
const index=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const v13=fs.readFileSync(path.join(assets,'v13.js'),'utf8');
function ok(c,m){if(!c){console.error('V160_DESIGN_FROZEN_FAIL',m);process.exit(1)}}
for(const f of ['app.css','v13.css','v14.css','v15.css'])ok(fs.existsSync(path.join(assets,f)),`historic css missing ${f}`);
for(const f of ['media/ps5-available.png','media/sim-vip.png','media/football-dynamic.png','media/racing-dynamic.png','media/combat-dynamic.png','media/tactical-dynamic.png','media/esport-dynamic.png'])ok(fs.existsSync(path.join(assets,f)),`dynamic media missing ${f}`);
for(const f of ['media/products/cocacola.jpg','media/products/redbull.jpg','media/products/fanta.jpg','media/products/sprite.jpg','media/products/twix.jpg','media/products/snickers.jpg','media/products/lays.jpg','media/products/oreo.jpg'])ok(fs.existsSync(path.join(assets,f)),`product media missing ${f}`);
ok(v13.includes('function stationMedia('),'dynamic station media renderer missing');
ok(v13.includes('mediaImgV132('),'dynamic image renderer missing');
ok(v13.includes('v13-floor'),'historic v1.6 floor cards missing');
ok(v13.includes("V13_MEDIA_DEFAULTS ="),'historic media defaults missing');
ok(!index.includes('operator-v170.js')&&!index.includes('operator-v170.css'),'v1.7 redesign must never load in v1.6');
ok(!index.includes('CONTROL CENTER · OPÉRATEUR'),'operator redesign marker must not exist');
console.log('V160_DESIGN_FROZEN_OK cards=historic dynamic-media=present v170=absent');
