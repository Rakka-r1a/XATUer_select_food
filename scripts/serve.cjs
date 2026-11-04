/* [FIX 2026.11.03] 仅提供项目静态文件，默认只监听本机，拒绝目录穿越和私人原图目录。 */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json' };
function createServer() {
  return http.createServer(async(req,res)=>{
    try {
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{Allow:'GET, HEAD'}); res.end(); return; }
      let pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      // 子路径便于在本机验证 GitHub Pages 项目路径。
      if (pathname.startsWith('/XATUer_select_food/')) pathname = pathname.slice('/XATUer_select_food'.length);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filename = path.resolve(root,`.${pathname}`);
      const relative = path.relative(root,filename);
      // old: if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part=>part.startsWith('.')) || !/^(index\.html|styles\.css|sw\.js|manifest\.webmanifest|assets[\\/]|scripts[\\/](app|core|data)\.js$)/.test(relative)) {
      // [FIX 2026.11.04] 仅增加公开弹窗导航模块的本机访问许可。
      if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part=>part.startsWith('.')) || !/^(index\.html|styles\.css|sw\.js|manifest\.webmanifest|assets[\\/]|scripts[\\/](app|core|data|dialog-navigation)\.js$)/.test(relative)) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const content = await fs.readFile(filename);
      res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:content);
    } catch (_) { res.writeHead(404); res.end('Not found'); }
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT)||4173;
  const host = process.env.HOST||'127.0.0.1';
  const server = createServer();
  server.on('error',error=>{ console.error(`启动失败：${error.message}`); process.exitCode=1; });
  server.listen(port,host,()=>console.log(`XATUer 本机预览：http://${host}:${port}\n停止服务：Ctrl+C`));
}
module.exports = { createServer };
