'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  const TEMPLATE=Object.freeze([
    ['coca-cola','Coca-Cola','Boisson',10],['coca-cola-zero','Coca-Cola Zero','Boisson',10],['fanta-orange','Fanta Orange','Boisson',10],['sprite','Sprite','Boisson',10],['hawai-tropical','Hawaï Tropical','Boisson',10],['poms','Pom’s','Boisson',10],['schweppes-citron','Schweppes Citron','Boisson',12],['sidi-ali','Sidi Ali 50 cl','Boisson',6],['oulmes','Oulmès 50 cl','Boisson',7],['red-bull','Red Bull','Boisson',20],['red-bull-zero','Red Bull Sugarfree','Boisson',20],['monster','Monster Energy','Boisson',22],['power-horse','Power Horse','Boisson',18],
    ['twix','Twix','Snack',8],['snickers','Snickers','Snack',8],['mars','Mars','Snack',8],['kitkat','KitKat','Snack',8],['bounty','Bounty','Snack',8],['oreo','Oreo','Snack',7],['lays','Lay’s','Snack',8],['doritos','Doritos','Snack',10],['pringles','Pringles','Snack',18],['mms','M&M’s','Snack',10],['chewing-gum','Chewing-gum','Snack',3]
  ].map(x=>Object.freeze({key:x[0],name:x[1],category:x[2],suggestedPrice:x[3]})));
  const key=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
  function missing(){const s=X.safeState();if(!s)return TEMPLATE.slice();const existing=new Set((s.products||[]).map(p=>key(p.name)));return TEMPLATE.filter(t=>!existing.has(key(t.name)));}
  function seedMissing({onlyIfEmpty=true,stock=0}={}){
    const s=X.safeState();if(!s)throw new Error('État indisponible');s.products=Array.isArray(s.products)?s.products:[];
    if(onlyIfEmpty&&s.products.length)return {added:0,skipped:'CATALOG_NOT_EMPTY'};
    let added=0;for(const t of missing()){
      const p={id:typeof uid==='function'?uid('prod'):`prod_${Date.now()}_${added}`,name:t.name,category:t.category,price:t.suggestedPrice,cost:0,stock:Math.max(0,Number(stock)||0),alertStock:0,enabled:true,active:true,templateKeyV160:t.key,createdAt:Date.now(),updatedAt:Date.now()};
      s.products.push(p);added++;
    }
    if(added)X.persist('v160.catalog.seeded',null,{added,total:s.products.length});return {added,total:s.products.length};
  }
  X.catalog={TEMPLATE,missing,seedMissing};
  X.register('catalog-template-24',{mode:'OPT_IN',autoSeed:false,ui:'V1.6_PRODUCTS_PRESERVED',count:TEMPLATE.length});
})();
