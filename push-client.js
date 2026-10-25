(() => {
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const cfg = window.MWAHH_PUSH_CONFIG || {};
  const control = document.getElementById('pushReminderControl');
  const button = document.getElementById('enableKissPush');
  const status = document.getElementById('kissPushStatus');
  const say = (s) => { if (status) status.textContent = s; };
  const decodeKey = (s) => { const pad = '='.repeat((4-s.length%4)%4); return Uint8Array.from(atob((s+pad).replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)); };
  async function setup() {
    if (!installed()) return;
    if (control) control.hidden = false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { if(button)button.disabled=true; say('Push is not supported in this installation.'); return; }
    if (!cfg.functionUrl || cfg.functionUrl.includes('YOUR_PROJECT_REF') || !cfg.vapidPublicKey || cfg.vapidPublicKey.includes('PASTE_')) { say('One-time push server setup is still required.'); return; }
    try { const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'}); const sub=await reg.pushManager.getSubscription(); if(sub){button.textContent='Push notifications enabled';say('This device is subscribed to daily kiss and new-content updates.');} }
    catch(e){console.error(e);say('Could not prepare push notifications.');}
  }
  if(button)button.addEventListener('click',async()=>{
    button.disabled=true;
    try {
      if(!installed()) throw Error('Open MWAHH from its Home Screen icon first.');
      if(!cfg.functionUrl || cfg.functionUrl.includes('YOUR_PROJECT_REF') || !cfg.vapidPublicKey || cfg.vapidPublicKey.includes('PASTE_')) throw Error('Finish the one-time push server setup first.');
      const permission=await Notification.requestPermission(); if(permission!=='granted')throw Error('Notification permission was not granted.');
      const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(cfg.vapidPublicKey)});
      const response=await fetch(cfg.functionUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'subscribe',subscription:sub.toJSON(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'})});
      const result=await response.json().catch(()=>({})); if(!response.ok)throw Error(result.error||'Subscription could not be saved.');
      button.textContent='Push notifications enabled';say('Enabled. Daily kiss reminders and new journal, music, and note updates are on.');
    } catch(e){say(e.message||'Could not enable push notifications.');button.disabled=false;}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();