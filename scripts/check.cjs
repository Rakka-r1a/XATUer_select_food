/* [FIX 2026.11.03] 校验交付文件、照片关联、编码与页面选择器，不代替浏览器试玩。 */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const D=require('./data.js');
// old: const files=['index.html','styles.css','scripts/data.js','scripts/core.js','scripts/app.js','sw.js','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png'];
// [FIX 2026.11.04] 把弹窗导航模块纳入交付与UTF-8检查。
const files=['index.html','styles.css','scripts/data.js','scripts/core.js','scripts/dialog-navigation.js','scripts/app.js','sw.js','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png'];
for(const file of files) {
  assert.ok(fs.existsSync(path.join(root,file)),`缺少文件：${file}`);
  if(!file.endsWith('.png')) {
    const text=fs.readFileSync(path.join(root,file),'utf8');
    assert.ok(!text.includes('\ufffd'),`编码异常：${file}`);
    if(file.endsWith('.js')) new vm.Script(text,{filename:file});
  }
}
// for(const photo of D.photos) assert.ok(fs.existsSync(path.join(root,photo)),`缺少照片：${photo}`); // old: 查询参数误作文件名。
for(const photo of D.photos) assert.ok(fs.existsSync(path.join(root,photo.split(/[?#]/)[0])),`缺少照片：${photo}`); // [FIX 2026.11.03] 校验带版本的图片路径。
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,'');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'页面存在重复标识');
const dynamic=new Set(['detail-photo','detail-content','draw-title','correction-form']);
const script=fs.readFileSync(path.join(root,'scripts/app.js'),'utf8');
for(const m of script.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(m[1])||dynamic.has(m[1]),`脚本引用不存在的节点：${m[1]}`);
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if(/^(https?:|mailto:)/.test(m[1])) continue;
  // assert.ok(fs.existsSync(path.join(root,m[1])),`页面路径无效：${m[1]}`); // old: 没有区分资源路径和缓存版本参数。
  assert.ok(fs.existsSync(path.join(root,m[1].split(/[?#]/)[0])),`页面路径无效：${m[1]}`); // [FIX 2026.11.03] 查询参数不属于磁盘文件名。
}
JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
// const imageBytes=D.photos.reduce((n,file)=>n+fs.statSync(path.join(root,file)).size,0); // old: 图片路径没有版本。
const imageBytes=D.photos.reduce((n,file)=>n+fs.statSync(path.join(root,file.split(/[?#]/)[0])).size,0); // [FIX 2026.11.03] 按实际文件统计体积。
console.log(`[OK] 语法、UTF-8、页面节点、相对路径、清单与 ${D.photos.length} 张图片通过检查`);
console.log(`[OK] ${D.stalls.length} 组实拍招牌，网页图片 ${(imageBytes/1024/1024).toFixed(2)} MB`);
