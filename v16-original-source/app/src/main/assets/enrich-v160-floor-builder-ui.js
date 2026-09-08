'use strict';
/* LA PAUSE CLUB v1.6 — Floor Builder operator bridge.
 * Uses only the historical v1.6 Settings components/classes. No CSS, no new shell,
 * no automatic persistence. Geometry changes are committed only by explicit operator action.
 */
(function(){
  const X=window.LP160;if(!X||!X.floorBuilder)return;
  const F=X.floorBuilder;
  let draft=null;
  const escHtml=v=>{try{return typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}catch(_){return String(v??'')}};
  const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const byId=id=>document.getElementById(id);
  function S(){return X.safeState()||{};}
  function station(id){return (S().stations||[]).find(s=>String(s.id)===String(id))||null;}
  function currentDraft(){if(!draft)draft=F.current()||F.draftFromLegacy();return F.normalize(draft);}
  function setDraft(next){draft=F.normalize(next);return draft;}
  function stats(){return F.stats(currentDraft());}
  function rerender(){try{if(typeof window.renderSettings==='function')window.renderSettings();else if(typeof renderSettings==='function')renderSettings()}catch(e){console.error('[LP160 floor-ui] rerender',e)}}
  function syncInputs(){
    let p=currentDraft();
    document.querySelectorAll('[data-floor-station]').forEach(row=>{
      const id=row.dataset.floorStation;if(!id||!p.placements[id])return;
      const q=p.placements[id];
      const val=key=>{const e=row.querySelector(`[data-floor-${key}]`);return e?num(e.value,q[key]):q[key]};
      p=F.moveStation(p,id,val('x'),val('y'));
      p=F.resizeStation(p,id,val('w'),val('h'));
      const z=row.querySelector('[data-floor-zone]');if(z)p=F.assignZone(p,id,z.value||null);
    });
    draft=p;return p;
  }
  function validateDraft(){return F.validate(syncInputs(),{requireAllStations:true});}
  function commitDraft(){
    const check=validateDraft();
    if(!check.ok){try{toast(`Plan invalide · ${check.errors.join(', ')}`)}catch(_){}return {ok:false,errors:check.errors};}
    const saved=F.commit(check.plan,{operatorExplicit:true,requireAllStations:true});draft=saved;
    try{toast('Plan de salle enregistré')}catch(_){}
    rerender();return {ok:true,plan:saved};
  }
  function resetProjection(){draft=F.draftFromLegacy();rerender();return draft;}
  function reloadSaved(){draft=F.current()||F.draftFromLegacy();rerender();return draft;}
  function rollback(snapshotId){const restored=F.rollback(snapshotId,{operatorExplicit:true});draft=restored;try{toast('Plan restauré')}catch(_){}rerender();return restored;}
  function addZone(name,rect={}){draft=F.addZone(syncInputs(),name,rect);rerender();return draft;}
  function addWall(a,b){draft=F.addWall(syncInputs(),a,b);rerender();return draft;}
  function removeWall(id){draft=F.removeWall(syncInputs(),id);rerender();return draft;}
  function planHtml(){
    const p=currentDraft(),st=stats(),zones=Object.values(p.zones||{}),snaps=F.snapshots().slice().reverse().slice(0,5);
    const rows=Object.values(p.placements||{}).map(q=>{
      const s=station(q.stationId),zoneOptions=[`<option value="">Sans zone</option>`].concat(zones.map(z=>`<option value="${escHtml(z.id)}" ${q.zoneId===z.id?'selected':''}>${escHtml(z.name)}</option>`)).join('');
      return `<div class="card" data-floor-station="${escHtml(q.stationId)}"><div class="card-head"><div><div class="card-title">${escHtml(s?.name||q.stationId)}</div><div class="card-sub">Placement · ${escHtml(q.stationId)}</div></div></div><div class="grid-2"><div class="field"><label>X · %</label><input data-floor-x type="number" min="0" max="100" step="0.5" value="${num(q.x).toFixed(1)}"></div><div class="field"><label>Y · %</label><input data-floor-y type="number" min="0" max="100" step="0.5" value="${num(q.y).toFixed(1)}"></div></div><div class="grid-2"><div class="field"><label>Largeur · %</label><input data-floor-w type="number" min="2" max="100" step="0.5" value="${num(q.w).toFixed(1)}"></div><div class="field"><label>Hauteur · %</label><input data-floor-h type="number" min="2" max="100" step="0.5" value="${num(q.h).toFixed(1)}"></div></div><div class="field"><label>Zone</label><select data-floor-zone>${zoneOptions}</select></div></div>`;
    }).join('');
    const zoneRows=zones.map(z=>`<div class="row-card"><div class="row-main"><div class="row-title">${escHtml(z.name)}</div><div class="row-meta">X ${num(z.x).toFixed(1)} · Y ${num(z.y).toFixed(1)} · ${num(z.w).toFixed(1)} × ${num(z.h).toFixed(1)} %</div></div></div>`).join('');
    const wallRows=(p.walls||[]).map(w=>`<div class="row-card"><div class="row-main"><div class="row-title">Mur</div><div class="row-meta">${num(w.x1).toFixed(1)},${num(w.y1).toFixed(1)} → ${num(w.x2).toFixed(1)},${num(w.y2).toFixed(1)}</div></div><button class="ghost compact-btn" data-floor-remove-wall="${escHtml(w.id)}">Supprimer</button></div>`).join('');
    const snapRows=snaps.map(s=>`<div class="row-card"><div class="row-main"><div class="row-title">Révision ${num(s.revision)}</div><div class="row-meta">Snapshot de sécurité</div></div><button class="secondary compact-btn" data-floor-rollback="${escHtml(s.id)}">Restaurer</button></div>`).join('');
    return `<div id="v160FloorBuilder"><div class="section-title"><h2>PLAN DE SALLE</h2><span>Révision ${st.revision}</span></div><div class="info-card"><b>Configuration locale de la salle</b><br>Les postes ci-dessus restent l’autorité. Le plan ne change jamais une session ou un poste automatiquement. Enregistrement explicite uniquement.</div><div class="section-title"><h2>PLACEMENT DES POSTES</h2><span>${st.stations}</span></div><div class="list">${rows}</div><div class="section-title"><h2>ZONES</h2><span>${st.zones}</span></div><div class="list">${zoneRows||'<div class="empty-v12">Aucune zone.</div>'}</div><button class="secondary full" id="v160FloorAddZone">＋ Ajouter une zone</button><div class="section-title"><h2>MURS / REPÈRES</h2><span>${st.walls}</span></div><div class="list">${wallRows||'<div class="empty-v12">Aucun mur enregistré.</div>'}</div><button class="secondary full" id="v160FloorAddWall">＋ Ajouter un mur</button><div class="section-title"><h2>SAUVEGARDES DU PLAN</h2><span>${st.snapshots}</span></div><div class="list">${snapRows||'<div class="empty-v12">Aucun snapshot pour le moment.</div>'}</div><div class="card"><div class="grid-2"><button class="ghost full" id="v160FloorReload">Recharger le plan enregistré</button><button class="ghost full" id="v160FloorReset">Recalculer depuis les postes</button></div><button class="primary full" id="v160FloorSave">Enregistrer le plan de salle</button></div></div>`;
  }
  function promptZone(){
    syncInputs();
    if(typeof showModal!=='function')return;
    showModal(`<h3>Ajouter une zone</h3><div class="field"><label>Nom</label><input id="v160FloorZoneName" value="Nouvelle zone"></div><div class="grid-2"><div class="field"><label>X · %</label><input id="v160FloorZoneX" type="number" value="5"></div><div class="field"><label>Y · %</label><input id="v160FloorZoneY" type="number" value="5"></div></div><div class="grid-2"><div class="field"><label>Largeur · %</label><input id="v160FloorZoneW" type="number" value="35"></div><div class="field"><label>Hauteur · %</label><input id="v160FloorZoneH" type="number" value="25"></div></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Ajouter</button></div>`);
    const cancel=byId('modalCancel'),ok=byId('modalOk');if(cancel)cancel.onclick=closeModal;if(ok)ok.onclick=()=>{const name=byId('v160FloorZoneName')?.value?.trim()||'Zone';draft=F.addZone(draft,name,{x:num(byId('v160FloorZoneX')?.value,5),y:num(byId('v160FloorZoneY')?.value,5),w:num(byId('v160FloorZoneW')?.value,35),h:num(byId('v160FloorZoneH')?.value,25)});closeModal();rerender()};
  }
  function promptWall(){
    syncInputs();
    if(typeof showModal!=='function')return;
    showModal(`<h3>Ajouter un mur / repère</h3><div class="grid-2"><div class="field"><label>X départ · %</label><input id="v160WallX1" type="number" value="0"></div><div class="field"><label>Y départ · %</label><input id="v160WallY1" type="number" value="0"></div></div><div class="grid-2"><div class="field"><label>X fin · %</label><input id="v160WallX2" type="number" value="100"></div><div class="field"><label>Y fin · %</label><input id="v160WallY2" type="number" value="0"></div></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Ajouter</button></div>`);
    const cancel=byId('modalCancel'),ok=byId('modalOk');if(cancel)cancel.onclick=closeModal;if(ok)ok.onclick=()=>{try{draft=F.addWall(draft,{x:num(byId('v160WallX1')?.value),y:num(byId('v160WallY1')?.value)},{x:num(byId('v160WallX2')?.value,100),y:num(byId('v160WallY2')?.value)});closeModal();rerender()}catch(e){try{toast(e.message)}catch(_){}}};
  }
  function bind(){
    const save=byId('v160FloorSave'),reload=byId('v160FloorReload'),reset=byId('v160FloorReset'),zone=byId('v160FloorAddZone'),wall=byId('v160FloorAddWall');
    if(save)save.onclick=commitDraft;if(reload)reload.onclick=reloadSaved;if(reset)reset.onclick=resetProjection;if(zone)zone.onclick=promptZone;if(wall)wall.onclick=promptWall;
    document.querySelectorAll('[data-floor-remove-wall]').forEach(b=>b.onclick=()=>removeWall(b.dataset.floorRemoveWall));
    document.querySelectorAll('[data-floor-rollback]').forEach(b=>b.onclick=()=>rollback(b.dataset.floorRollback));
  }
  function mount(){
    let section=null;try{section=typeof settingsSection==='string'?settingsSection:null}catch(_){}
    if(section!=='stations')return false;
    const view=byId('view');if(!view||byId('v160FloorBuilder'))return false;
    view.insertAdjacentHTML('beforeend',planHtml());bind();return true;
  }
  function wrapRenderSettings(){
    const original=window.renderSettings;if(typeof original!=='function'||original.__lp160FloorUiWrapped)return false;
    const wrapped=function(){const out=original.apply(this,arguments);mount();return out;};
    wrapped.__lp160FloorUiWrapped=true;wrapped.__lp160Original=original;window.renderSettings=wrapped;try{renderSettings=wrapped}catch(_){}return true;
  }
  wrapRenderSettings();
  X.floorBuilderUI={currentDraft,setDraft,validateDraft,commitDraft,resetProjection,reloadSaved,rollback,addZone,addWall,removeWall,mount,planHtml};
  X.register('floor-builder-ui',{mode:'CLASSIC_SETTINGS_STATIONS',ui:'V1.6_COMPONENTS_ONLY',cssAdded:false,autoPersist:false,explicitCommit:true});
})();
