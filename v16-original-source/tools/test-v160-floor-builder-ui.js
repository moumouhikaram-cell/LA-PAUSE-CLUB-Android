'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'app/src/main/assets/enrich-v160-floor-builder-ui.js'),'utf8');
const engine=fs.readFileSync(path.join(root,'app/src/main/assets/enrich-v160-floor-builder.js'),'utf8');
const index=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
function ok(v,m){if(!v)throw new Error(m)}

ok(index.includes('<script src="enrich-v160-floor-builder.js"></script>'),'Floor Builder engine not loaded');
ok(index.includes('<script src="enrich-v160-floor-builder-ui.js"></script>'),'Floor Builder classic UI bridge not loaded');
ok(index.indexOf('enrich-v160-floor-builder.js')<index.indexOf('enrich-v160-floor-builder-ui.js'),'Floor UI loads before its engine');
ok(index.indexOf('enrich-v160-floor-builder-ui.js')<index.indexOf('enrich-v160-control-center.js'),'Floor UI bridge load order is unstable');

ok(ui.includes("section!=='stations'"),'Floor Builder is not restricted to classic Settings > Stations');
ok(ui.includes('id="v160FloorBuilder"'),'Floor Builder is not reachable as a real settings surface');
ok(ui.includes('wrapRenderSettings'),'Floor Builder is not mounted after historical settings renderer');
ok(ui.includes("F.commit(check.plan,{operatorExplicit:true,requireAllStations:true})"),'plan save is not explicit/fail-closed');
ok(ui.includes("F.rollback(snapshotId,{operatorExplicit:true})"),'snapshot rollback is not explicit');
ok(ui.includes('F.addZone(')&&ui.includes('F.addWall(')&&ui.includes('F.moveStation(')&&ui.includes('F.resizeStation('),'required geometry operations are not reachable');
ok(ui.includes('data-floor-rollback')&&ui.includes('data-floor-remove-wall'),'rollback/wall removal controls are missing');
ok(ui.includes('Recharger le plan enregistré')&&ui.includes('Recalculer depuis les postes')&&ui.includes('Enregistrer le plan de salle'),'operator recovery/save controls missing');

ok(!/<style\b/i.test(ui)&&!/["'].*\.css["']/.test(ui),'Floor Builder UI introduced CSS/redesign assets');
ok(!/renderFloor\s*=|window\.renderFloor\s*=/.test(ui),'Floor Builder UI replaces historical Gaming Floor renderer');
ok(!/location\.reload/.test(ui),'Floor Builder UI uses destructive reload navigation');
ok(ui.includes("ui:'V1.6_COMPONENTS_ONLY'")&&ui.includes('cssAdded:false')&&ui.includes('autoPersist:false'),'classic/no-redesign/no-autopersist contract not declared');
ok(engine.includes("mode:'GEOMETRY_ONLY_V1.6_ADAPTER'")&&engine.includes('autoPersist:false'),'geometry engine no-autopersist contract lost');
ok(engine.includes('MAX_SNAPSHOTS=10')&&engine.includes('function validate(')&&engine.includes('function rollback('),'Floor Builder safety engine incomplete');

for(const cls of ['card','field','grid-2','section-title','primary','secondary'])ok(ui.includes(`class=\"${cls}`)||ui.includes(` ${cls}`),`historical component ${cls} not reused`);
console.log('V160_FLOOR_BUILDER_CLASSIC_SETTINGS_REACHABLE_OK');
console.log('V160_FLOOR_BUILDER_EXPLICIT_COMMIT_ROLLBACK_OK');
console.log('V160_FLOOR_BUILDER_NO_REDESIGN_OK');
