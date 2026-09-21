/* MY SUCCESS PLANNER - Service Worker（通知専用・キャッシュなし） */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});

self.addEventListener('push',e=>{
  let d={};
  try{d=e.data?e.data.json():{};}catch(_){d={body:e.data?e.data.text():''};}
  const jobs=[self.registration.showNotification(d.title||'MY SUCCESS PLANNER',{
    body:d.body||'',
    icon:'sp-icon-192.png',
    badge:'sp-icon-192.png',
    tag:d.tag||'sp',
    renotify:true,
    data:{url:d.url||'success_planner.html'}
  })];
  if(self.navigator&&self.navigator.setAppBadge&&d.badge!==0){jobs.push(self.navigator.setAppBadge(d.badge||1).catch(()=>{}));}
  e.waitUntil(Promise.all(jobs));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||'success_planner.html',self.registration.scope).href;
  const hash=new URL(url).hash;
  e.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of list){
      if(c.url.indexOf('success_planner.html')>=0){
        await c.focus();
        c.postMessage({type:'sp-open',hash});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
