'use strict';
// v1.5 parity stores shift statuses as OPEN/CLOSED while the legacy cash engine
// historically used open/closed. Keep the operational lookup tolerant so a
// running cash shift survives reloads and migrations without rewriting data.
currentShift = function currentShiftCompat(){
  return state.shifts.find(s=>String(s?.status||'').toLowerCase()==='open')||null;
};
