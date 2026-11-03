const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/core.js');
const D = require('../scripts/data.js');

test('真实招牌资料覆盖全部照片，标识唯一，关闭的小食堂不进入随机池',()=>{
  assert.equal(new Set(D.stalls.map(s=>s.id)).size,D.stalls.length);
  assert.equal(new Set(D.stalls.flatMap(s=>s.photos)).size,46);
  assert.equal(D.canteens.find(c=>c.id==='small').status,'closed');
  // assert.ok(D.stalls.every(s=>s.canteen==='big' && s.floor===null)); // old: 楼层全部待确认。
  assert.ok(D.stalls.every(s=>s.canteen==='big' && [1,2,3].includes(s.floor))); // [FIX 2026.11.03] 已按用户标注补全楼层。
});

test('用户彩框标注完整覆盖三层，合并照片无楼层冲突，真实楼层筛选互斥',()=>{
  assert.equal(Object.keys(D.photoFloors).length,46);
  const floorCounts = [1,2,3].map(floor=>C.filterStalls(D.stalls,{floor:String(floor)}).length);
  assert.deepEqual(floorCounts,[14,18,11]);
  assert.equal(C.filterStalls(D.stalls,{floor:'unknown'}).length,0);
  for (const stall of D.stalls) {
    for (const photo of stall.photos) {
      const name=photo.split('/').pop().replace(/\.jpg$/,'');
      assert.equal(D.photoFloors[name],stall.floor,`${stall.name} 的不同角度必须属于同层`);
    }
  }
  for (const [name,floor] of [['骨汤方便面',1],['上海生煎',1],['汉堡工厂',1],['兰州牛肉面',2],['烘焙档口',2],['四季轻食',2],['鲜榨果汁',3],['陕西面 · 拉条子',3],['集市自助小火锅',3]]) {
    assert.equal(D.stalls.find(stall=>stall.name===name).floor,floor,name);
  }
});

test('连续重抽保持楼层与口味，并且同轮不重复、不抽关闭档口',()=>{
  const fixtures = [
    {id:'a',floor:1,category:'面食',status:'listed'},
    {id:'b',floor:1,category:'面食',status:'listed'},
    {id:'c',floor:2,category:'面食',status:'listed'},
    {id:'d',floor:1,category:'米饭',status:'listed'},
    {id:'e',floor:1,category:'面食',status:'closed'}
  ];
  const pool = C.filterStalls(fixtures,{floor:'1',category:'面食'});
  assert.deepEqual(pool.map(s=>s.id),['a','b']);
  const seen=[];
  for(let n=0;n<2;n++) {const result=C.drawStall(pool,seen,()=>0);assert.equal(result.reset,false);assert.ok(!seen.includes(result.stall.id));seen.push(result.stall.id);}
  assert.equal(C.drawStall(pool,seen).reset,true);
});

test('楼层未知的数据不会假装属于某一层，空收藏不扩大范围',()=>{
  const fixtures=[{id:'a',floor:null,category:'面食'},{id:'b',floor:2,category:'米饭'}];
  assert.equal(C.filterStalls(fixtures,{floor:'1'}).length,0);
  assert.deepEqual(C.filterStalls(fixtures,{floor:'unknown'}).map(s=>s.id),['a']);
  assert.equal(C.filterStalls(fixtures,{favoritesOnly:true},[]).length,0);
  assert.equal(C.drawStall([]),null);
});

test('候选店按条目等权抽取，不先按楼层抽取',()=>{
  const pool=[{id:'a'},{id:'b'},{id:'c'}];
  for(let n=0;n<3;n++) assert.equal(C.drawStall(pool,[],()=>n/3).stall.id,pool[n].id);
  assert.equal(C.drawStall(pool,[],()=>1).stall.id,'c');
});

test('备份导入清理陌生档口、重复收藏、非法状态与无效记录',()=>{
  const input={version:2,favorites:['a','a','unknown'],history:[{stallId:'a',time:1},{stallId:'unknown',time:2},{stallId:'a',time:'bad'}],notes:[{text:'  记录  ',time:10,stallId:'unknown',topic:'invalid'}],overrides:{a:{name:' 修正 ',floor:99,status:'hacked'},unknown:{floor:1}},nickname:'  我  '};
  const state=C.sanitizeState(input,['a']);
  assert.deepEqual(state.favorites,['a']); assert.equal(state.history.length,1);assert.equal(state.notes[0].stallId,'');assert.equal(state.notes[0].topic,'觅食日常');
  assert.deepEqual(state.overrides.a,{name:'修正',floor:null,status:'listed'});assert.equal(state.nickname,'我');assert.equal(state.overrides.unknown,undefined);
  assert.throws(()=>C.sanitizeState({version:1},['a']));
});

test('本机修正不污染公共原始资料，关闭修正立即退出候选池',()=>{
  const source=[{id:'a',name:'原名',floor:null,status:'listed'}];
  const merged=C.mergeStalls(source,{a:{name:'新名',floor:3,status:'closed'}});
  assert.equal(source[0].name,'原名');assert.equal(merged[0].floor,3);assert.equal(C.filterStalls(merged).length,0);
  // [FIX 2026.11.03] 上个版本保存的空楼层不能遮住新补全的真实楼层。
  assert.equal(C.mergeStalls([{id:'a',floor:2}],{a:{name:'本机名字',floor:null}})[0].floor,2);
});

test('备份里的恶意日期不会使页面渲染崩溃',()=>{
  const state=C.sanitizeState({version:2,notes:[{text:'bad',time:1e100},{text:'bad',time:-1e100}],history:[{stallId:'a',time:1e100}]},['a']);
  assert.deepEqual(state.notes,[]);assert.deepEqual(state.history,[]);
});
