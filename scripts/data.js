/* [FIX 2026.11.03] 仅依据用户实拍招牌整理；不编造价格、评分、营业时间或楼层。 */
(function (root) {
  'use strict';
  const photos = [
    '042adca18a0c97f8d28fefd90ac03f2e','0693b6c033ce5b860ddab7a978dd9491','0e98ec6512447e2d41187907f473d4bf','13300690d098ac06573237462631af89',
    '17cf56a45474910620518f8fefb1d5f0','1c5070dfc539a7a9cb6fb17130198a9a','1f65a5678788831c2528e0ed5a278941','24e14113f126afacf8ed81d843209ecc',
    '2622d1f8697f73f6a782f9c658fafd25','2c811b4d8acdbd6a00a6e65cc931fa5d','3eb489394a7af77058fbcff7743ba291','3eb4f7c64d112eee4f6fc27f35e95ba0',
    '41a75ee173084006d06cb42452a049c4','4c3854a7c35ae5b91e40ca98daa880f0','4f928a17a503dc68d2c602821e264bbd','528183f35191ca26b0b7731b38ae924f',
    '567407a6040f4d01a3a69719cb3ba443','5d06868a96ca66c261b847f51e926234','5edfcd34d4a181fb4a2d0f60248528fc','6432cdc600b7e9e2d313ec234b405dde',
    '68f4e9873e5bcd17d12eda714a9e26cf','6ceaae11fe91b423fe86cc82f81bbafe','7846525be3a9280ea4c895c9fb037bf2','7df93d2d496efc3f51a4927eca671c5a',
    '90dab65f432ca87990ad7b1020418dd2','957b6e38028ab0e81188305bf0fe7c26','97ccff4c524a6a37b035be9ce4490d8c','982fd409d235bea4b97a83cbff74cbec',
    '99cee8163b9184f4866238c85b04e614','9d3588451b293968a9ac5e66f5e67669','a26c61f4481e05ebaecf638507bf8c20','aec08a5831cf8236c9fd298b83d41f5e',
    'b08312863de9416b1b22a348b73bd039','b189cde41de26f1688d525398506c0cb','c2d2e1ba7babddc03ec50fe8d9ef5053','cc42297af4fd0fac3346a1ca0e68898f',
    'd562b0faffe7d9e3e3a4e8b409888a65','e48572779a85add1760e23faccbe4893','e8dddfbc825749bdcab1f345b7ffb19e','ee80808ec322e786b36a5ad74f00c5d6',
    'f067aabda06ec6509ac85e45c68bd161','f6e28bd23d0fdcef0c285d49da1aae80','f755702c498318f34f2010369e7bd85c','f7b9ffb87f33bbca4594607af5e4277e',
    'fcf480c612eafffece2ab94b0e6b38fe','fd4a050d58fbe476de01c1551f53c7fd'
  ];
  // [FIX 2026.11.03] 依据主人在本聊天提供的两张彩框图：绿框一楼、橙框二楼、红框三楼。
  // 数字对应上方原始照片顺序；不同角度使用同一楼层，不把拼图中的私人聊天内容收录到项目。
  const floorPhotos = {
    1: [2,3,8,11,14,16,21,24,26,27,30,32,33,36,46],
    2: [1,4,5,7,10,12,15,17,18,22,23,31,35,37,39,42,43,44,45],
    3: [6,9,13,19,20,25,28,29,34,38,40,41]
  };
  const photoFloors = Object.fromEntries(Object.entries(floorPhotos).flatMap(([floor,indexes]) => indexes.map(n => [photos[n-1],Number(floor)])));
  // 同一店面的不同角度放入同一组；相邻招牌暂按照片区域整理，不能视作精确档口编号。
  const rows = [
    ['烘焙档口','烘焙',[1],'面包 / 糕点',true],
    ['江西面与现炒浇头','面食',[2],'江西面 / 现炒浇头',false],
    ['江西小炒','米饭',[3],'江西小炒 / 自选快餐',false],
    ['滑肉面 · 粗粮面','面食',[4],'滑肉面 / 粗粮面',false],
    ['多味面庄','面食',[5],'面食',false],
    ['集市自助小火锅','火锅',[6],'双程记 / 集市自助小火锅',false],
    ['四季轻食','轻食',[7],'沙拉 / 自选称重 / 低脂',false],
    ['小厨与面食档口','米饭',[8],'照片含多个招牌，名称待进一步核对',true],
    ['陕西面 · 拉条子','面食',[9,13],'陕西面 / 拉条子 / 土豆泥拌饭',false],
    ['文火现卤面','面食',[10],'现卤面',false],
    ['骨汤方便面','面食',[11],'骨汤方便面 / 炸串',false],
    ['木桶里·干锅饭','米饭',[12],'木桶里 / 干锅饭',false],
    ['天下好面','面食',[14],'天下好面 / 财宝饭品 / 巴蜀米线',false],
    ['铁板饭与煎饼','米饭',[15],'铁板饭 / 煎饼',false],
    ['五谷营养粥','小吃',[16],'五谷营养粥 / 笼蒸小面 / 炒粉',false],
    ['兰州牛肉面','面食',[17],'兰州牛肉面 / 手工拉面',false],
    ['大碗拌面','面食',[18],'大碗拌面 / 大碗吃肉',false],
    ['鲜榨果汁','轻食',[19],'鲜榨果汁 / 鲜果',false],
    ['重庆面庄','面食',[20],'重庆面庄 / 鸡汤刀削面 / 现炒盖饭',false],
    ['魅力佳现炒鸡','米饭',[21,46],'魅力佳现炒鸡',false],
    ['特色鸡腿饭','米饭',[22],'特色鸡腿饭',false],
    ['骨汤面','面食',[23,43],'骨汤面 / 清汤面',false],
    ['食尚快餐','米饭',[24],'食尚快餐 / 精美小炒',false],
    ['铁锅炖','米饭',[25],'铁锅炖 / 桂英嫂生烫牛肉米线',false],
    ['烩菜面','面食',[26],'烩菜面 / 肉夹馍',false],
    ['手工水饺','面食',[27],'手工水饺 / 猪蹄米饭',false],
    ['麻辣干拌','小吃',[28],'麻辣干拌 / 王婆锅盔',false],
    ['原味手工面','面食',[29],'原味手工面 / 炒饭',false],
    ['大脸哥','米饭',[30],'大脸哥 / 招牌餐品待核对',true],
    ['烤盘饭','米饭',[31],'烤盘饭',false],
    ['汉堡工厂','小吃',[32],'汉堡 / 炸鸡 / 薯条',false],
    ['上海生煎','小吃',[33],'上海生煎 / 现包现煎',false],
    ['炙烤五花肉','米饭',[34],'炙烤五花肉 / 健食鲜炒',false],
    ['金渚轩','米饭',[35],'招牌名称暂读为金渚轩，待核对',true],
    ['南方小碗蒸肉','米饭',[36],'南方小碗蒸肉 / 重庆鱼粉',false],
    ['小碗菜与鸡排','米饭',[37],'小碗菜 / 鸡排',false],
    ['干锅学霸鸭','米饭',[38],'干锅学霸鸭 / 大盘鸡拌面',false],
    ['香锅档口','米饭',[39],'香锅 / 拌饭，具体店名待核对',true],
    ['糖醋脆皮瘦肉片','米饭',[40],'糖醋脆皮瘦肉片 / 特色砂锅',false],
    ['肉儿溜滑蛋饭','米饭',[41],'食堂哥 / 肉儿溜滑蛋饭',false],
    ['秦记糊涂辣烫','小吃',[42],'秦记糊涂辣烫',false],
    ['大肉米线','面食',[44],'大肉米线',false],
    ['哆哆黏糊麻辣烫','小吃',[45],'哆哆黏糊麻辣烫',false]
  ];
  const data = {
    updatedAt: '2026-11-03',
    canteens: [{ id: 'big', name: '大食堂', status: 'listed' }, { id: 'small', name: '小食堂', status: 'closed' }],
    photos: photos.map(name => `assets/stalls/${name}.jpg`),
    photoFloors,
    stalls: rows.map(([name,category,indexes,signs,needsReview], index) => ({
      id: `stall-${String(index+1).padStart(3,'0')}`, name, category, signs, needsReview,
      // canteen: 'big', floor: null, status: 'listed', tags: signs.split(' / '), // old: 尚未收到楼层标注。
      canteen: 'big', floor: photoFloors[photos[indexes[0]-1]], status: 'listed', tags: signs.split(' / '), // [FIX 2026.11.03] 使用用户确认的楼层。
      photos: indexes.map(n => `assets/stalls/${photos[n-1]}.jpg`)
    }))
  };
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.FoodData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
