/* [FIX 2026.11.03] 缓存范围限定本项目；不删除同域其他项目的缓存。 */
const CACHE_PREFIX = `xatuer-${self.registration.scope}-`;
// const CACHE = `${CACHE_PREFIX}v2-20261103-1`; // old: 楼层未确认版本。
// const CACHE = `${CACHE_PREFIX}v2-20261103-floors-1`; // old: 含人物图片的缓存版本。
const CACHE = `${CACHE_PREFIX}v2-20261103-clean-1`; // [FIX 2026.11.03] 让去人物图片使用新的离线缓存。
// const CORE = ['./','./index.html','./styles.css','./scripts/data.js','./scripts/core.js','./scripts/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest']; // old: 未对资料文件指定版本。
// const CORE = ['./','./index.html','./styles.css','./scripts/data.js?v=20261103-floors-1','./scripts/core.js?v=20261103-floors-1','./scripts/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest']; // old: 原图片资料版本。
const CORE = ['./','./index.html','./styles.css','./scripts/data.js?v=20261103-clean-1','./scripts/core.js?v=20261103-floors-1','./scripts/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest']; // [FIX 2026.11.03] 与页面的去人物资料版本一致。
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const url = new URL(event.request.url);
  if (event.request.method!=='GET' || url.origin!==self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const relative = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (event.request.mode==='navigate') {
    event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./index.html',self.registration.scope).href)));
    return;
  }
  if (!/^(styles\.css|scripts\/(data|core|app)\.js|assets\/|manifest\.webmanifest)/.test(relative)) return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        // 把后台写缓存也纳入事件生命周期，避免移动端提前回收任务。
        event.waitUntil(cache.put(event.request,response.clone()));
      }
      return response;
    } catch (_) {
      if (event.request.destination==='image') return cache.match(new URL('./assets/icon.svg',self.registration.scope).href);
      return Response.error();
    }
  }));
});
