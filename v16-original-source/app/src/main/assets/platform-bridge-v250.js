'use strict';
/* LA PAUSE OS 2.5 — platform-neutral client bridge. */
(function(){
  const root=window;
  const noop=()=>{};
  const parseJson=(v,fallback={})=>{try{return typeof v==='string'?JSON.parse(v):v||fallback}catch(_){return fallback}};
  const platform=(()=>{
    if(root.Android||root.ClientAndroid)return 'ANDROID';
    if(root.__LA_PAUSE_DESKTOP__)return 'DESKTOP';
    if(root.webkit?.messageHandlers?.laPause)return 'APPLE';
    return 'WEB';
  })();
  const callApple=(action,payload={})=>new Promise((resolve,reject)=>{
    const id='pb-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    root.__lpAppleReplies=root.__lpAppleReplies||{};
    root.__lpAppleReplies[id]={resolve,reject};
    try{root.webkit.messageHandlers.laPause.postMessage({id,action,payload})}catch(e){delete root.__lpAppleReplies[id];reject(e)}
    setTimeout(()=>{const p=root.__lpAppleReplies[id];if(p){delete root.__lpAppleReplies[id];reject(new Error('Platform bridge timeout'))}},15000);
  });
  root.__lpPlatformReply=(id,ok,payload)=>{const p=root.__lpAppleReplies?.[id];if(!p)return;delete root.__lpAppleReplies[id];ok?p.resolve(payload):p.reject(new Error(String(payload||'Platform error')))};
  const desktop=()=>root.__LA_PAUSE_DESKTOP__||{};
  const android=()=>root.Android||root.ClientAndroid||{};
  const bridge={
    version:'2.5.0',platform,
    capabilities(){
      const a=android(),d=desktop();
      return {
        secureStore:platform==='ANDROID'?!!a.getSecureValue:platform==='DESKTOP'?!!d.secureGet:platform==='APPLE':!!root.webkit?.messageHandlers?.laPause,
        nativeHttp:platform==='ANDROID'?!!a.httpRequest:platform==='DESKTOP'?!!d.http:platform==='APPLE':!!root.webkit?.messageHandlers?.laPause,
        haptics:['ANDROID','APPLE'].includes(platform),
        notifications:platform!=='WEB'||('Notification'in root),
        localDiscovery:platform==='ANDROID'?!!(root.ClientAndroid?.discoverLaPauseAgents):platform==='DESKTOP'?!!d.discoverAgents:false,
        fileSave:platform==='ANDROID'?!!a.saveText:platform==='DESKTOP'?!!d.saveFile:platform==='APPLE':!!root.webkit?.messageHandlers?.laPause,
        integrity:platform!=='WEB'
      }
    },
    async secureGet(key){
      try{if(platform==='ANDROID')return String(android().getSecureValue?.(key)||'');if(platform==='DESKTOP')return String(await desktop().secureGet?.(key)||'');if(platform==='APPLE')return String(await callApple('secureGet',{key})||'');return ''}catch(_){return ''}
    },
    async secureSet(key,value){
      try{if(platform==='ANDROID')return !!android().setSecureValue?.(key,String(value??''));if(platform==='DESKTOP')return !!(await desktop().secureSet?.(key,String(value??'')));if(platform==='APPLE')return !!(await callApple('secureSet',{key,value:String(value??'')}));return false}catch(_){return false}
    },
    async secureDelete(key){
      try{if(platform==='ANDROID')return !!android().deleteSecureValue?.(key);if(platform==='DESKTOP')return !!(await desktop().secureDelete?.(key));if(platform==='APPLE')return !!(await callApple('secureDelete',{key}));return false}catch(_){return false}
    },
    async http(method,url,token='',body=null){
      if(root.nativeRequest&&platform==='ANDROID')return root.nativeRequest(method,url,token,body);
      if(platform==='DESKTOP'&&desktop().http)return desktop().http({method,url,token,body});
      if(platform==='APPLE')return callApple('http',{method,url,token,body});
      const headers={'Accept':'application/json','Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
      const r=await fetch(url,{method:String(method||'GET').toUpperCase(),headers,body:body==null?undefined:JSON.stringify(body),credentials:'omit'});
      const text=await r.text();const parsed=parseJson(text,text);if(!r.ok)throw new Error(parsed?.message||`HTTP ${r.status}`);return {status:r.status,body:parsed};
    },
    async notify(title,text,opts={}){
      try{if(platform==='ANDROID'){android().showTestNotification?.(title,text);return true}if(platform==='DESKTOP'&&desktop().notify){await desktop().notify({title,text,...opts});return true}if(platform==='APPLE'){await callApple('notify',{title,text,opts});return true}if('Notification'in root){if(Notification.permission==='default')await Notification.requestPermission();if(Notification.permission==='granted'){new Notification(title,{body:text});return true}}}catch(_){}return false
    },
    async haptic(ms=70){
      try{if(platform==='ANDROID'){android().vibrate?.(ms);return true}if(platform==='APPLE'){await callApple('haptic',{ms});return true}if(navigator.vibrate){navigator.vibrate(ms);return true}}catch(_){}return false
    },
    async keepAwake(enabled){
      try{if(platform==='ANDROID'){android().keepScreenOn?.(!!enabled);return true}if(platform==='DESKTOP'&&desktop().keepAwake){await desktop().keepAwake(!!enabled);return true}if(platform==='APPLE'){await callApple('keepAwake',{enabled:!!enabled});return true}}catch(_){}return false
    },
    async saveFile(name,mime,content){
      try{if(platform==='ANDROID'){android().saveText?.(name,mime,content);return true}if(platform==='DESKTOP'&&desktop().saveFile){await desktop().saveFile({name,mime,content});return true}if(platform==='APPLE'){await callApple('saveFile',{name,mime,content});return true}const blob=new Blob([content],{type:mime||'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name||'export.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true}catch(_){return false}
    },
    async qr(text,size=320){
      try{if(platform==='ANDROID'&&android().generateQrDataUrl)return android().generateQrDataUrl(text,size);if(platform==='DESKTOP'&&desktop().qr)return desktop().qr({text,size});if(platform==='APPLE')return await callApple('qr',{text,size})}catch(_){}return ''
    },
    async deviceInfo(){
      try{if(platform==='ANDROID')return parseJson(android().getDeviceInfo?.(),{});if(platform==='DESKTOP'&&desktop().deviceInfo)return await desktop().deviceInfo();if(platform==='APPLE')return await callApple('deviceInfo',{});return {platform:'WEB',userAgent:navigator.userAgent,language:navigator.language}}catch(_){return {platform}}
    },
    async integrityStatus(){
      try{if(platform==='ANDROID'&&android().getIntegrityStatus)return parseJson(android().getIntegrityStatus(),{trusted:false});if(platform==='DESKTOP'&&desktop().integrityStatus)return await desktop().integrityStatus();if(platform==='APPLE')return await callApple('integrityStatus',{});return {trusted:true,platform:'WEB',trustSource:'SERVER_SESSION'}}catch(e){return {trusted:false,platform,reason:String(e?.message||e)}}
    },
    async discoverAgents(){
      if(platform==='ANDROID'&&root.ClientAndroid?.discoverLaPauseAgents){return new Promise((resolve,reject)=>{const id='discover-'+Date.now().toString(36);const prev=root.onLaPauseLanDiscovery;const timeout=setTimeout(()=>{root.onLaPauseLanDiscovery=prev;reject(new Error('Discovery timeout'))},18000);root.onLaPauseLanDiscovery=(rid,payload)=>{if(rid!==id){if(typeof prev==='function')prev(rid,payload);return}clearTimeout(timeout);root.onLaPauseLanDiscovery=prev;const p=parseJson(payload,{ok:false});p.ok===false?reject(new Error(p.error||'Discovery failed')):resolve(p)};root.ClientAndroid.discoverLaPauseAgents(id)})}
      if(platform==='DESKTOP'&&desktop().discoverAgents)return desktop().discoverAgents();
      return {ok:false,agents:[],unsupported:true,platform};
    }
  };
  root.LPPlatform=bridge;
  if(root.LPClient){root.LPClient.platform=bridge;root.LPClient.platformName=platform;}
})();
