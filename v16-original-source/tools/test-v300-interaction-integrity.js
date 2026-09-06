'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(ok,msg)=>{if(!ok){console.error('V300_INTERACTION_INTEGRITY_FAIL',msg);process.exit(1);}};

const html=read('app/src/main/assets/v250/index.html');
const jsPath=path.join(root,'app/src/main/assets/v250/interaction-integrity-v300.js');
const js=read('app/src/main/assets/v250/interaction-integrity-v300.js');
const css=read('app/src/main/assets/v250/interaction-integrity-v300.css');
const v298=read('app/src/main/assets/v250/mobile-phone-shell-v298.js');
const v291=read('app/src/main/assets/v250/canonical-batch-01-10-v291.js');
const safety=read('app/src/main/assets/v250/screens-99-runtime-safety-v271.js');
const activity=read('app/src/main/java/com/lapauseclub/manager/NewAppActivity.java');
const canonical=read('app/src/main/assets/v250/canonical-app.js');
cp.execFileSync(process.execPath,['--check',jsPath],{stdio:'inherit'});

must(html.includes('interaction-integrity-v300.css'),'v300 CSS missing from entry');
must(html.includes('interaction-integrity-v300.js'),'v300 JS missing from entry');
must(html.indexOf('interaction-integrity-v300.css')>html.indexOf('mobile-foundation-v299.css'),'v300 CSS must load after mobile foundation');
must(html.indexOf('interaction-integrity-v300.js')>html.indexOf('mobile-foundation-v299.js'),'v300 JS must load last');

for(const t of [
  "FORM='input,textarea,select,[contenteditable=\"true\"]'",
  'if(focusFromTarget(ev.target))return;',
  'requestKeyboard',
  'el.focus',
  'touchstart',
  'touchend',
  'window.__LPOS_V300',
  'function audit(root)',
  'v300InteractionUnbound',
  'v300InteractionDisabled'
])must(js.includes(t),'global interaction token missing '+t);

must(js.includes('function nativeToggle(el)')&&js.includes("type==='checkbox'||type==='radio'")&&js.includes('if(nativeToggle(form))return false')&&js.includes('if(nativeToggle(f))return false'),'checkbox/radio labels must retain native toggle semantics instead of keyboard-focus routing');

must(!v298.includes("[data-v298-go],[data-v298-action],[data-go],[data-action],[data-v291],[data-v296]"),'v298 must not intercept the whole application');
must(v298.includes("closest('[data-v298-go],[data-v298-action]')"),'v298 landing-only touch selector missing');

for(const t of [
  'setFocusableInTouchMode(true)',
  'requestFocus(View.FOCUS_DOWN)',
  'SOFT_INPUT_ADJUST_RESIZE',
  'InputMethodManager',
  '@JavascriptInterface public void requestKeyboard()',
  'showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT)'
])must(activity.includes(t),'Samsung WebView focus/keyboard guarantee missing '+t);

for(const t of ['newName','newEmail','newPassword','data-action="create-account"'])must(v291.includes(t),'Create Account renderer missing '+t);
must(!/id=\"new(Name|Email|Password)\"[^>]*disabled/.test(v291),'Create Account fields must not be disabled');
must(safety.includes("if(kind==='create-account')")&&safety.includes('createLocalCredential'),'secure Create Account handler missing');
must(canonical.includes("querySelectorAll('[data-go]')")&&canonical.includes("querySelectorAll('[data-action]')"),'canonical click binding missing');

for(const t of [
  'pointer-events:auto!important',
  '-webkit-user-select:text!important',
  'caret-color:#45ddff!important',
  'font-size:16px!important',
  ':disabled'
])must(css.includes(t),'form/control CSS integrity token missing '+t);

console.log('V300_NATIVE_FORM_FOCUS_OK');
console.log('V300_GLOBAL_TOUCH_ROUTING_OK');
console.log('V300_CLICKABLE_AUDIT_OK');
console.log('V300_ACCOUNT_FLOW_WIRING_OK');
console.log('V300_SAMSUNG_WEBVIEW_KEYBOARD_OK');
console.log('V314_NATIVE_CHECKBOX_LABEL_DEFAULT_OK');
