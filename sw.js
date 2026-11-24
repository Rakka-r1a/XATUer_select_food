/* [FIX 2026.11.03] 缓存范围限定本项目；不删除同域其他项目的缓存。 */
const CACHE_PREFIX = `xatuer-${self.registration.scope}-`;
// const CACHE = `${CACHE_PREFIX}v2-20261103-1`; // old: 楼层未确认版本。
// const CACHE = `${CACHE_PREFIX}v2-20261103-floors-1`; // old: 含人物图片的缓存版本。
// const CACHE = `${CACHE_PREFIX}v2-20261103-clean-1`; // old: 旧署名页面的离线版本。
// const CACHE = `${CACHE_PREFIX}v2-20261104-rakka-1`; // old: 含错误小笼包招牌的资料版本。
// old: const CACHE = `${CACHE_PREFIX}v2-20261104-xiaolongbao-1`;
// old: const CACHE = `${CACHE_PREFIX}v2-20261104-sign-audit-1`; // [FIX 2026.11.04] 更新全量招牌复核版本的离线缓存。
// [FIX 2026.11.04] 刷新返回体验、日志和饺子搜索的小更新资源。
// old: const CACHE = `${CACHE_PREFIX}v2-20261104-patch-1`;
// old: const CACHE = `${CACHE_PREFIX}v2-20261110-rights-1`; // [FIX 2026.11.10] 刷新版权声明页面与协议入口。
const CACHE = `${CACHE_PREFIX}v2-20261125-public-1`; // [FIX 2026.11.25] 更新店铺、作者点评、QQ及统计入口。
// const CORE = ['./','./index.html','./styles.css','./scripts/data.js','./scripts/core.js','./scripts/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest']; // old: 未对资料文件指定版本。
// const CORE = ['./','./index.html','./styles.css','./scripts/data.js?v=20261103-floors-1','./scripts/core.js?v=20261103-floors-1','./scripts/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest']; // old: 原图片资料版本。
// const CORE = ['./','./index.html','./styles.css','./scripts/data.js?v=20261103-clean-1','./scripts/core.js?v=20261103-floors-1','./scripts/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest']; // old: 旧版档口资料入口。
// old: const CORE = ['./','./index.html','./styles.css','./scripts/data.js?v=20261104-xiaolongbao-1','./scripts/core.js?v=20261103-floors-1','./scripts/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest']; // [FIX 2026.11.04] 与页面使用相同的纠错资料版本。
// old: const CORE = ['./','./index.html','./styles.css','./scripts/data.js?v=20261104-sign-audit-1','./scripts/core.js?v=20261103-floors-1','./scripts/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest']; // [FIX 2026.11.04] 与页面使用相同的纠错资料版本。
// [FIX 2026.11.04] 预缓存清单与页面使用同一套版本。
// old: const CORE = ['./','./index.html','./styles.css?v=20261104-patch-1','./scripts/data.js?v=20261104-patch-1','./scripts/core.js?v=20261103-floors-1','./scripts/dialog-navigation.js?v=20261104-patch-1','./scripts/app.js?v=20261104-patch-1','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest'];
// [FIX 2026.11.10] 缓存新增协议入口对应的应用脚本。
// old: const CORE = ['./','./index.html','./styles.css?v=20261104-patch-1','./scripts/data.js?v=20261104-patch-1','./scripts/core.js?v=20261103-floors-1','./scripts/dialog-navigation.js?v=20261104-patch-1','./scripts/app.js?v=20261110-rights-1','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest'];
// [FIX 2026.11.25] 公共点评和统计脚本只预缓存本站模块，不缓存第三方响应。
const CORE = ['./','./index.html','./styles.css?v=20261125-public-1','./scripts/data.js?v=20261125-public-1','./scripts/core.js?v=20261103-floors-1','./scripts/dialog-navigation.js?v=20261104-patch-1','./scripts/public-features.js?v=20261125-public-1','./scripts/app.js?v=20261125-public-1','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest'];
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
  // old: if (!/^(styles\.css|scripts\/(data|core|app)\.js|assets\/|manifest\.webmanifest)/.test(relative)) return;
  // [FIX 2026.11.04] 离线也缓存弹窗导航模块。
  // old: if (!/^(styles\.css|scripts\/(data|core|app|dialog-navigation)\.js|assets\/|manifest\.webmanifest)/.test(relative)) return;
  // [FIX 2026.11.25] 新增本站公开功能模块，外域统计与点评请求继续不拦截。
  // [FIX 2026.11.25] 点评优先取网络最新资料，离线时才使用曾读取的副本。
  if (relative==='assets/author-reviews.json') {
    event.respondWith(caches.open(CACHE).then(async cache=>{
      try {
        const response=await fetch(event.request);
        if(response.ok){event.waitUntil(cache.put(event.request,response.clone()));return response;}
        return (await cache.match(event.request)) || response;
      } catch (_) { return (await cache.match(event.request)) || Response.error(); }
    }));
    return;
  }
  if (!/^(styles\.css|scripts\/(data|core|app|dialog-navigation|public-features)\.js|assets\/|manifest\.webmanifest)/.test(relative)) return;
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
