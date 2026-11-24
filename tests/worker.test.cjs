const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

function worker() {
  const scope='https://example.test/XATUer_select_food/';
  const cachesData=new Map();
  const events={};
  let offline=false;
  const normalize=request=>new URL(typeof request==='string'?request:request.url,scope).href;
  const caches={
    async open(name) {
      if(!cachesData.has(name))cachesData.set(name,new Map());
      const data=cachesData.get(name);
      return {
        async addAll(urls){for(const url of urls)data.set(normalize(url),new Response(url));},
        async put(request,response){data.set(normalize(request),response);},
        async match(request){return data.get(normalize(request))?.clone();}
      };
    },
    async keys(){return [...cachesData.keys()];},
    async delete(name){return cachesData.delete(name);},
    async match(request){for(const data of cachesData.values()){const response=data.get(normalize(request));if(response)return response.clone();}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{
    self:{registration:{scope},location:{origin:'https://example.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>{events[name]=fn;}},
    caches,URL,Response,fetch:async request=>{if(offline)throw new Error('offline');return new Response(`network:${normalize(request)}`);}
  });
  async function lifecycle(name){let pending;events[name]({waitUntil:p=>{pending=p;}});await pending;}
  async function request(url,mode='cors',method='GET'){
    let pending;const writes=[];
    events.fetch({request:{url:new URL(url,scope).href,method,mode,destination:/\.jpg$/.test(url)?'image':''},respondWith:p=>{pending=p;},waitUntil:p=>writes.push(p)});
    const response=await pending;await Promise.all(writes);return response;
  }
  return {scope,caches,cachesData,lifecycle,request,setOffline:()=>{offline=true;}};
}

test('离线可回到应用，未缓存图片回退为本地图标，外域和其他项目不被拦截',async()=>{
  const w=worker();await w.lifecycle('install');
  w.setOffline();
  assert.equal(await (await w.request('./','navigate')).text(),'./index.html');
  assert.equal(await (await w.request('assets/stalls/not-cached.jpg')).text(),'./assets/icon.svg');
  assert.equal(await w.request('https://other.test/assets/test.jpg'),undefined);
  assert.equal(await w.request('https://example.test/another-project/assets/test.jpg'),undefined);
  assert.equal(await w.request('scripts/app.js','cors','POST'),undefined);
});

test('升级只清理同一项目的旧缓存，不影响同域其他应用',async()=>{
  const w=worker();
  await w.caches.open(`xatuer-${w.scope}-old`);
  await w.caches.open('another-app-v1');
  await w.caches.open('xatuer-https://example.test/other/-v1');
  await w.lifecycle('install');await w.lifecycle('activate');
  assert.ok(!w.cachesData.has(`xatuer-${w.scope}-old`));
  assert.ok(w.cachesData.has('another-app-v1'));
  assert.ok(w.cachesData.has('xatuer-https://example.test/other/-v1'));
});

test('作者点评优先联网更新，断网后才使用已读取快照',async()=>{
  const w=worker();await w.lifecycle('install');
  const name=(await w.caches.keys())[0],cache=await w.caches.open(name);
  await cache.put('assets/author-reviews.json',new Response('old-review'));
  const latest=await (await w.request('assets/author-reviews.json')).text();
  assert.match(latest,/network:/);assert.notEqual(latest,'old-review');
  w.setOffline();assert.equal(await (await w.request('assets/author-reviews.json')).text(),latest);
});
