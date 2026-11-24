/* [FIX 2026.11.25] 作者点评使用GitHub核验身份，浏览器中不保存登录密钥。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FoodPublic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const repository = 'Rakka-r1a/XATUer_select_food';
  const author = { id:196425000, login:'Rakka-r1a', name:'Rakka', qq:'2767257613' };
  const issueBase = `https://github.com/${repository}/issues`;
  const counterScript = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  function reviewMarker(stallId) { return `<!-- xatuer-author-review:${stallId} -->`; }
  function newReviewURL(stall) {
    const query = new URLSearchParams({template:'author_review.md',title:`[作者点评] ${stall.name}`,body:`${reviewMarker(stall.id)}\n\n`});
    return `${issueBase}/new?${query}`;
  }
  function reviewSearchURL(stallId = '') {
    return `${issueBase}?q=${encodeURIComponent(`is:issue author:${author.login} ${stallId || 'xatuer-author-review'}`)}`;
  }
  function parseAuthorReviews(issues, stallIds) {
    const valid = new Set(stallIds);
    const latest = new Map();
    for (const issue of issues) {
      // 署名、头像和标题都不能证明身份，只信GitHub返回的稳定用户ID。
      if (!issue || issue.pull_request || issue.user?.id !== author.id || !['open','closed'].includes(issue.state)) continue;
      const match = String(issue.body || '').match(/^\s*<!--\s*xatuer-author-review:(stall-\d{3,})\s*-->\s*([\s\S]*)$/);
      if (!match || !valid.has(match[1])) continue;
      const time = Date.parse(issue.updated_at);
      if (!Number.isFinite(time) || !Number.isSafeInteger(issue.number) || issue.number < 1) continue;
      const review = { stallId:match[1], state:issue.state, text:match[2].trim().slice(0,6000), updatedAt:new Date(time).toISOString(), time, number:issue.number, url:`${issueBase}/${issue.number}` };
      const previous = latest.get(review.stallId);
      if (!previous || time > previous.time || (time === previous.time && review.number > previous.number)) latest.set(review.stallId,review);
    }
    // 关闭最新点评视为撤下，不让以前的开放记录意外重新出现。
    return [...latest.values()].filter(review=>review.state==='open' && review.text).sort((a,b)=>b.time-a.time || b.number-a.number);
  }
  function parseReviewSnapshot(snapshot, stallIds) {
    if (snapshot?.version!==1 || snapshot.authorId!==author.id || !Array.isArray(snapshot.reviews) || !Number.isFinite(Date.parse(snapshot.syncedAt))) throw new Error('作者点评资料格式异常');
    const issues=snapshot.reviews.map(review=>({number:review.number,state:'open',user:{id:snapshot.authorId},body:reviewMarker(review.stallId)+'\n\n'+String(review.text || ''),updated_at:review.updatedAt}));
    return { reviews:parseAuthorReviews(issues,stallIds),syncedAt:snapshot.syncedAt };
  }
  async function fetchAuthorReviews(fetcher, stallIds, signal) {
    // 访客读取本站同步文件，不受GitHub匿名API额度和校园网共享出口限制。
    const response=await fetcher('assets/author-reviews.json',{credentials:'omit',cache:'no-store',signal});
    if (!response.ok) throw new Error('作者点评暂时无法读取，请稍后刷新');
    return parseReviewSnapshot(await response.json(),stallIds);
  }
  function initPageViews(browser, doc) {
    const value = doc.getElementById('busuanzi_value_page_pv');
    const status = doc.getElementById('site-views-status');
    const container = doc.getElementById('busuanzi_container_page_pv');
    if (!value || !status || !container) return;
    // 本机调试、非官方镜像不计入正式站点访问。
    if (browser.location.hostname !== 'rakka-r1a.github.io' || !browser.location.pathname.startsWith('/XATUer_select_food/')) {
      value.textContent='本地预览不计数'; status.textContent='仅官方网页统计'; return;
    }
    if (browser.navigator.globalPrivacyControl || browser.navigator.doNotTrack==='1') {
      value.textContent='已停用'; status.textContent='遵循浏览器隐私偏好'; return;
    }
    if (doc.getElementById('xatuer-counter-script')) return;
    value.textContent='加载中';
    const failure = () => {
      if (/^\d+$/.test(value.textContent.trim())) return;
      container.style.display='inline'; value.textContent='暂不可用'; status.textContent='统计服务暂不可达，选餐功能不受影响';
    };
    const timer = browser.setTimeout(failure,10000);
    const observer = new browser.MutationObserver(() => {
      if (/^\d+$/.test(value.textContent.trim())) {
        browser.clearTimeout(timer); status.textContent='接入后累计PV，刷新会重复计数'; observer.disconnect();
      }
    });
    observer.observe(value,{childList:true,subtree:true,characterData:true});
    const script = doc.createElement('script');
    script.id='xatuer-counter-script'; script.async=true; script.src=counterScript; script.onerror=failure;
    doc.head.appendChild(script);
  }
  return { repository, author, reviewMarker, newReviewURL, reviewSearchURL, parseAuthorReviews, parseReviewSnapshot, fetchAuthorReviews, initPageViews };
});
