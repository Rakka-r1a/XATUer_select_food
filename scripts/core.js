/* [FIX 2026.11.03] 将筛选、抽签与本地数据校验独立，供页面与命令行共同验证。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FoodCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const categories = ['全部', '米饭', '面食', '小吃', '轻食', '火锅', '烘焙'];
  const floorLabel = floor => floor ? `${floor} 楼` : '楼层待确认';
  function filterStalls(stalls, filters = {}, favorites = []) {
    const query = String(filters.query || '').trim().toLowerCase();
    return stalls.filter(stall => stall.status !== 'closed'
      && (filters.floor === 'all' || !filters.floor || String(stall.floor || 'unknown') === String(filters.floor))
      && (!filters.category || filters.category === '全部' || stall.category === filters.category)
      && (!filters.favoritesOnly || favorites.includes(stall.id))
      && (!query || [stall.name, stall.category, stall.signs, ...(stall.tags || [])].join(' ').toLowerCase().includes(query)));
  }
  function drawStall(pool, excluded = [], random = Math.random) {
    if (!pool.length) return null;
    // 一轮中每家只出现一次；抽完一轮才重新开始。
    let choices = pool.filter(stall => !excluded.includes(stall.id));
    const reset = choices.length === 0;
    if (reset) choices = pool;
    const value = Math.min(0.999999999999, Math.max(0, Number(random()) || 0));
    return { stall: choices[Math.floor(value * choices.length)], reset };
  }
  function emptyState() {
    return { version: 2, favorites: [], history: [], notes: [], overrides: {}, nickname: '校园食客', draft: '' };
  }
  function sanitizeState(input, ids) {
    if (!input || input.version !== 2 || typeof input !== 'object') throw new Error('不是有效的 XATUer V2 备份');
    const valid = new Set(ids);
    // [FIX 2026.11.03] 有限数不一定是合法日期，超界时间会使详情与动态渲染失败。
    const validTime = time => Number.isFinite(time) && time > 0 && time <= 8640000000000000;
    const state = emptyState();
    state.favorites = [...new Set((Array.isArray(input.favorites) ? input.favorites : []).filter(id => valid.has(id)))];
    // old: 只检查 Number.isFinite(row.time)，未排除日期上界之外的数字。
    state.history = (Array.isArray(input.history) ? input.history : []).filter(row => row && valid.has(row.stallId) && validTime(row.time)).slice(0, 100).map(row => ({ stallId: row.stallId, time: row.time }));
    state.notes = (Array.isArray(input.notes) ? input.notes : []).filter(row => row && typeof row.text === 'string' && row.text.trim() && validTime(row.time)).slice(0, 100).map((row, index) => ({
      id: typeof row.id === 'string' ? row.id.slice(0, 100) : `import-${index}`,
      text: row.text.trim().slice(0, 600), time: row.time,
      stallId: valid.has(row.stallId) ? row.stallId : '',
      topic: ['觅食日常', '档口情报', '周边探索'].includes(row.topic) ? row.topic : '觅食日常'
    }));
    if (input.overrides && typeof input.overrides === 'object') {
      for (const id of valid) {
        const row = Object.hasOwn(input.overrides, id) ? input.overrides[id] : null;
        if (!row || typeof row !== 'object') continue;
        state.overrides[id] = {
          name: typeof row.name === 'string' ? row.name.trim().slice(0, 50) : '',
          floor: [1, 2, 3].includes(Number(row.floor)) ? Number(row.floor) : null,
          status: ['closed', 'listed'].includes(row.status) ? row.status : 'listed'
        };
      }
    }
    if (typeof input.nickname === 'string' && input.nickname.trim()) state.nickname = input.nickname.trim().slice(0, 20);
    if (typeof input.draft === 'string') state.draft = input.draft.slice(0, 600);
    return state;
  }
  function mergeStalls(stalls, overrides = {}) {
    return stalls.map(stall => {
      const override = Object.hasOwn(overrides, stall.id) ? overrides[stall.id] : null;
      // return override ? { ...stall, ...override, name: override.name || stall.name } : { ...stall }; // old: 旧的空楼层修正会覆盖新确认的楼层。
      return override ? { ...stall, ...override, name: override.name || stall.name, floor: override.floor ?? stall.floor } : { ...stall }; // [FIX 2026.11.03] 沿用公共已确认楼层，保留有效的本机修正。
    });
  }
  return { categories, floorLabel, filterStalls, drawStall, emptyState, sanitizeState, mergeStalls };
});
