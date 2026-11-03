const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('../scripts/serve.cjs');

test('根目录和 GitHub Pages 子目录均可取到页面与中文资料，私人目录不可访问',async()=>{
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const prefix of ['/','/XATUer_select_food/']) {
      const response=await fetch(base+prefix);
      assert.equal(response.status,200);assert.match(await response.text(),/校园广场/);
      assert.equal((await fetch(base+prefix+'scripts/data.js')).status,200);
      const manifest=await (await fetch(base+prefix+'manifest.webmanifest')).json();
      assert.equal(manifest.scope,'./');
      assert.equal((await fetch(base+prefix+'assets/icon-192.png')).status,200);
    }
    for(const url of ['/.git/config','/图片/042adca18a0c97f8d28fefd90ac03f2e.jpg','/package.json','/scripts/serve.cjs','/%2e%2e%5cpackage.json','/missing']) assert.equal((await fetch(base+url)).status,404,url);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
