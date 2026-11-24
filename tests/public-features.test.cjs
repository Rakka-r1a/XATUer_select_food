/* [FIX 2026.11.25] 核验作者身份、撤下、分页与统计失败的真实边界。 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../scripts/public-features.js');
const D=require('../scripts/data.js');
const C=require('../scripts/core.js');
const Sync=require('../scripts/sync-author-reviews.cjs');
const issue=(overrides={})=>({number:10,state:'open',user:{id:P.author.id},body:P.reviewMarker('stall-061')+'\n\n串串口味记录',updated_at:'2026-11-25T10:00:00Z',...overrides});

test('其他账号即使冒用名字、标题和档口标记，也不能成为作者点评',()=>{
  const reviews=P.parseAuthorReviews([issue(),issue({number:11,user:{id:1,login:P.author.login},body:P.reviewMarker('stall-061')+'\n假冒作者'}),issue({number:12,pull_request:{}})],['stall-061']);
  assert.equal(reviews.length,1);assert.equal(reviews[0].number,10);
});

test('关闭、空白、缺失标记、无效档口和异常日期均不公开为作者点评',()=>{
  const bad=[issue({state:'closed'}),issue({body:P.reviewMarker('stall-061')}),issue({body:'未绑定的普通反馈'}),issue({body:P.reviewMarker('stall-999')+'\n未知窗口'}),issue({updated_at:'bad'}),issue({number:NaN})];
  assert.deepEqual(P.parseAuthorReviews(bad,['stall-061']),[]);
});

test('同一家展示最新点评，输出链接不能被Issue内容注入为外域地址',()=>{
  const rows=P.parseAuthorReviews([issue(),issue({number:12,updated_at:'2026-11-25T12:00:00Z',html_url:'javascript:alert(1)'})],['stall-061']);
  assert.equal(rows[0].number,12);assert.equal(rows[0].url,'https://github.com/Rakka-r1a/XATUer_select_food/issues/12');
  const url=new URL(P.newReviewURL({id:'stall-061',name:'螺味烫串 & 29号'}));
  assert.equal(url.origin,'https://github.com');assert.equal(url.searchParams.get('body'),P.reviewMarker('stall-061')+'\n\n');
});

test('作者关闭或清空最新点评后撤下，不会复活更早的开放记录',()=>{
  const latest=issue({number:12,state:'closed',updated_at:'2026-11-25T12:00:00Z'});
  assert.deepEqual(P.parseAuthorReviews([issue(),latest],['stall-061']),[]);
  assert.deepEqual(P.parseAuthorReviews([issue(),{...latest,state:'open',body:P.reviewMarker('stall-061')}],['stall-061']),[]);
});

test('发布端处理GitHub分页与身份核验，临时令牌不进入访客请求',async()=>{
  const calls=[];
  const rows=await Sync.fetchReviewIssues(async(url,options)=>{
    calls.push({url,options});return {ok:true,json:async()=>calls.length===1?Array.from({length:100},(_,i)=>issue({number:i+1})):[]};
  },'fixture-token');
  assert.equal(calls.length,2);assert.ok(calls[1].url.includes('page=2'));assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-token');
  assert.equal(P.parseAuthorReviews(rows,['stall-061'])[0].number,100);
  const snapshot={version:1,authorId:P.author.id,syncedAt:'2026-11-25T12:00:00Z',reviews:P.parseAuthorReviews(rows,['stall-061'])};
  let visitorRequest;
  const published=await P.fetchAuthorReviews(async(url,options)=>{visitorRequest={url,options};return {ok:true,json:async()=>snapshot};},['stall-061']);
  assert.equal(visitorRequest.url,'assets/author-reviews.json');assert.equal(visitorRequest.options.credentials,'omit');assert.equal(visitorRequest.options.headers,undefined);assert.equal(published.reviews[0].number,100);
  await assert.rejects(Sync.fetchReviewIssues(async()=>({ok:false,status:403}),'fixture-token'),/HTTP 403/);
  await assert.rejects(P.fetchAuthorReviews(async()=>({ok:false,status:503}),['stall-061']),/无法读取/);
});

test('公开同步文件必须带有正确作者ID和版本，不接受冒名或损坏快照',()=>{
  const snapshot={version:1,authorId:P.author.id,syncedAt:'2026-11-25T12:00:00Z',reviews:[]};
  assert.deepEqual(P.parseReviewSnapshot(snapshot,['stall-061']).reviews,[]);
  assert.throws(()=>P.parseReviewSnapshot({...snapshot,authorId:1},['stall-061']));
  assert.throws(()=>P.parseReviewSnapshot({...snapshot,syncedAt:'bad'},['stall-061']));
});

test('自动同步会显式请求Pages发布，不能依赖机器人提交自动触发部署',async()=>{
  let request;
  await Sync.requestBuild('fixture-token',async(url,options)=>{request={url,options};return {ok:true};});
  assert.equal(request.url,'https://api.github.com/repos/Rakka-r1a/XATUer_select_food/pages/builds');assert.equal(request.options.method,'POST');
});

test('新照片保持一楼归属，螺味烫串独立可选，时辰包子退出当前检索',()=>{
  const found=C.filterStalls(D.stalls,{floor:'1',query:'螺味烫串'});
  assert.equal(found.length,1);assert.equal(found[0].id,'stall-061');assert.equal(found[0].photos[0],D.photos[1]);
  assert.equal(C.filterStalls(D.stalls,{query:'时辰包子'}).length,0);
  assert.notEqual(found[0].id,D.stalls.find(s=>s.name==='汇通面').id);
});

function counterFixture(hostname='rakka-r1a.github.io') {
  const value={textContent:'',style:{}},status={textContent:''},container={style:{}};
  const nodes={busuanzi_value_page_pv:value,'site-views-status':status,busuanzi_container_page_pv:container};
  let appended=0,timeout,mutated;
  const browser={location:{hostname,pathname:'/XATUer_select_food/'},navigator:{},setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){},MutationObserver:class{constructor(fn){mutated=fn;}observe(){}disconnect(){}}};
  const doc={getElementById:id=>nodes[id],createElement:()=>({}),head:{appendChild(script){nodes[script.id]=script;appended++;}}};
  return {browser,doc,value,status,get appended(){return appended;},fail:()=>timeout(),success:()=>{value.textContent='12';mutated();}};
}

test('真实浏览量只在正式站加载一次，服务异常不伪造为0',()=>{
  const f=counterFixture();P.initPageViews(f.browser,f.doc);P.initPageViews(f.browser,f.doc);assert.equal(f.appended,1);
  f.fail();assert.equal(f.value.textContent,'暂不可用');f.success();assert.match(f.status.textContent,/累计PV/);
  const local=counterFixture('127.0.0.1');P.initPageViews(local.browser,local.doc);assert.equal(local.appended,0);
  const privateVisit=counterFixture();privateVisit.browser.navigator.globalPrivacyControl=true;P.initPageViews(privateVisit.browser,privateVisit.doc);assert.equal(privateVisit.appended,0);assert.equal(privateVisit.value.textContent,'已停用');
});
