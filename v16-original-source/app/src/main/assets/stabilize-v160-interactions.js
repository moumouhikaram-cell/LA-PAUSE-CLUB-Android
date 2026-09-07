'use strict';
/* LA PAUSE CLUB v1.6 stabilization — existing interaction contracts only.
 * No new UI/module/SaaS: repairs controls already rendered by the frozen v1.6 shell.
 */
(function(){
  const syncPill=document.getElementById('syncPill');
  if(syncPill&&!syncPill.__lp160Bound&&typeof syncNow==='function'){
    syncPill.onclick=()=>syncNow(true);
    syncPill.__lp160Bound=true;
  }
})();
