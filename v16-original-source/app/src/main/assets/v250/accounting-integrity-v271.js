'use strict';
(function(){
  var A=window.LPOS;if(!A||!A.state)return;var S=A.state;
  function dayKey(ts){try{return new Date(ts||0).toLocaleDateString('sv-SE',{timeZone:(S.business&&S.business.timezone)||'Africa/Casablanca'});}catch(_){return new Date(ts||0).toISOString().slice(0,10);}}
  function today(){return dayKey(Date.now());}
  function postedPayment(p){var s=String((p&&p.status)||'').toUpperCase();return s==='PAID'||s==='REFUNDED';}
  function grossRevenueToday(){var d=today();return (S.payments||[]).filter(function(p){return postedPayment(p)&&dayKey(p.at||p.createdAt)===d;}).reduce(function(sum,p){return sum+A.num(p.amount,0);},0);}
  function refundsToday(){var d=today();return (S.refunds||[]).filter(function(x){return dayKey(x.at||x.createdAt)===d;}).reduce(function(sum,x){return sum+A.num(x.amount,0);},0);}
  function netRevenueToday(){return grossRevenueToday()-refundsToday();}
  A.grossRevenueToday=grossRevenueToday;
  A.refundsToday=refundsToday;
  A.revenueToday=netRevenueToday;
})();