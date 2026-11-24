/* [FIX 2026.11.25] 仅在维护端或GitHub Actions核验和同步点评，令牌不进入网页。 */
const fs=require('node:fs');
const path=require('node:path');
const P=require('./public-features.js');
const D=require('./data.js');

async function fetchReviewIssues(fetcher,token,signal) {
  if (!token) throw new Error('缺少GitHub Actions的临时令牌');
  const issues=[];
  for(let page=1;page<=100;page++) {
    const url=`https://api.github.com/repos/${P.repository}/issues?creator=${P.author.login}&state=all&sort=updated&direction=desc&per_page=100&page=${page}`;
    const response=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','User-Agent':'XATUer-author-reviews'},signal});
    if(!response.ok)throw new Error(`GitHub点评同步失败：HTTP ${response.status}`);
    const rows=await response.json();if(!Array.isArray(rows))throw new Error('GitHub返回的点评资料无效');
    issues.push(...rows);if(rows.length<100)return issues;
  }
  throw new Error('点评列表超出同步上限，未覆盖现有已发布资料');
}
async function syncReviews(token,fetcher=fetch) {
  const issues=await fetchReviewIssues(fetcher,token,AbortSignal.timeout(120000));
  const snapshot={version:1,authorId:P.author.id,syncedAt:new Date().toISOString(),reviews:P.parseAuthorReviews(issues,D.stalls.map(stall=>stall.id))};
  P.parseReviewSnapshot(snapshot,D.stalls.map(stall=>stall.id));
  fs.writeFileSync(path.join(__dirname,'../assets/author-reviews.json'),JSON.stringify(snapshot,null,2)+'\n');
  console.log(`[OK] 已核验作者身份并同步 ${snapshot.reviews.length} 家档口点评`);
  return snapshot;
}
async function requestBuild(token,fetcher=fetch) {
  if(!token)throw new Error('缺少构建权限令牌');
  const response=await fetcher(`https://api.github.com/repos/${P.repository}/pages/builds`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','User-Agent':'XATUer-author-reviews'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Pages构建请求失败：HTTP ${response.status}`);
  console.log('[OK] 已请求发布最新作者点评');
}
if(require.main===module) {
  if(process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY!==P.repository) throw new Error('同步目标不是本项目');
  const task=process.argv.includes('--request-build')?requestBuild(process.env.GITHUB_TOKEN):syncReviews(process.env.GITHUB_TOKEN);
  task.catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={fetchReviewIssues,syncReviews,requestBuild};
