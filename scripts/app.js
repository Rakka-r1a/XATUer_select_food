/* [FIX 2026.11.03] 无外部依赖的本机体验；公开社区接入前，不上传用户记录。 */
(function () {
  'use strict';
  const C = window.FoodCore;
  const D = window.FoodData;
  const $ = id => document.getElementById(id);
  const icons = {
    bowl: '<path d="M3 11h18c-1 6-4 9-9 9s-8-3-9-9Z"/><path d="M8 22h8M8 3v4m4-6v6m4-4v4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chat: '<path d="M21 11a8.5 8.5 0 0 1-9 9 9 9 0 0 1-4-.9L3 21l1.9-5A9 9 0 1 1 21 11Z"/><path d="M8 10h8m-8 4h5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    shuffle: '<path d="m17 3 4 4-4 4M3 17h3c5 0 5-10 10-10h5M17 13l4 4-4 4M3 7h3c1.5 0 2.5 1 3.5 2.5M14.5 14.5C15.5 16 16 17 18 17h3"/>',
    search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  const svg = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  function hydrateIcons(scope = document) { scope.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = svg(el.dataset.icon); }); }
  const key = 'xatuer-food-v2';
  let state = C.emptyState();
  let storageWarning = '';
  try {
    const saved = localStorage.getItem(key);
    if (saved) state = C.sanitizeState(JSON.parse(saved), D.stalls.map(s => s.id));
  } catch (_) { storageWarning = '无法读取本机记录，本次先使用空白记录。原存储未被主动清除。'; }
  let stalls = C.mergeStalls(D.stalls, state.overrides);
  const filters = { floor:'all', category:'全部', query:'', favoritesOnly:false };
  let page = 'home';
  let currentDetail = '';
  let currentDraw = null;
  let drawPool = [];
  let drawScope = '';
  let seen = [];
  let drawTimer = null;
  let toastTimer = null;
  let installPrompt = null;
  // old: let dialogTrigger = null;
  // [FIX 2026.11.04] 弹窗历史与焦点统一管理，返回手势先关弹窗。
  const dialogNavigation = window.createFoodDialogNavigation(window, document, dialog => {
    document.body.classList.add('modal-open');
    if (dialog.id === 'detail-dialog') currentDetail = $('detail-content').dataset.stallId || '';
    if (dialog.id === 'draw-dialog' && !drawTimer) renderDraw();
  });

  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
  }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(state)); return true; }
    catch (_) { toast('浏览器未能保存，当前修改只在本次页面内保留。请导出备份。'); return false; }
  }
  function dateLabel(time) {
    return new Intl.DateTimeFormat('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(time));
  }
  function activeStall(id) { return stalls.find(s => s.id === id); }
  function favorite(id) {
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites,id];
    const saved = persist();
    renderFilters(); renderCards(); renderMe();
    if (currentDetail) renderDetail(currentDetail);
    if (currentDraw && !drawTimer) renderDraw();
    if (saved) toast(state.favorites.includes(id) ? '已加入本机收藏' : '已取消收藏');
  }
  function empty(title, description, icon = 'bowl', link = '') {
    return `<div class="empty-state"><span>${svg(icon)}</span><h3>${escape(title)}</h3><p>${escape(description)}</p>${link}</div>`;
  }
  function card(stall) {
    const saved = state.favorites.includes(stall.id);
    return `<article class="stall-card"><button class="stall-photo-link" data-action="detail" data-id="${stall.id}" aria-label="查看${escape(stall.name)}"><img loading="lazy" decoding="async" src="${stall.photos[0]}" alt="${escape(stall.name)}实拍招牌" width="640" height="388"></button><button class="favorite-button ${saved?'saved':''}" data-action="favorite" data-id="${stall.id}" aria-pressed="${saved}" aria-label="${saved?'取消收藏':'收藏'}${escape(stall.name)}">${svg('heart')}</button><div class="stall-card-body"><button class="stall-title" data-action="detail" data-id="${stall.id}">${escape(stall.name)}</button><p class="stall-meta">${svg('pin')}大食堂<span> / ${C.floorLabel(stall.floor)}</span></p><div class="stall-card-bottom"><span class="category-label">${escape(stall.category)}</span><span class="photo-label">${stall.needsReview?'招牌待核对':'实拍收录'}</span></div></div></article>`;
  }
  function renderFilters() {
    const floors = [['all','全食堂'],['1','一楼'],['2','二楼'],['3','三楼'],['unknown','待确认']];
    $('home-floors').innerHTML = floors.map(([id,label]) => `<button class="chip ${filters.floor===id?'selected':''}" data-action="floor" data-value="${id}" aria-pressed="${filters.floor===id}">${label}</button>`).join('');
    const categoryMarkup = C.categories.map(category => `<button class="chip ${filters.category===category?'selected':''}" data-action="category" data-value="${category}" aria-pressed="${filters.category===category}">${category}</button>`).join('');
    $('home-categories').innerHTML = categoryMarkup;
    $('discover-categories').innerHTML = categoryMarkup;
    $('home-favorites').checked = filters.favoritesOnly;
    $('discover-favorites').checked = filters.favoritesOnly;
    $('discover-floor').value = filters.floor;
    const pool = C.filterStalls(stalls, filters, state.favorites);
    $('pool-count').textContent = `${pool.length} 组档口可选`;
    const unknown = stalls.filter(s => !s.floor && s.status !== 'closed').length;
    // old: 筛选提示仅说明楼层，返回首页后可能看不到仍在生效的搜索词。
    const floorHint = unknown ? `${unknown} 组招牌尚未标注楼层；可在详情中核对。单层抽取仅使用已标注的档口。` : '楼层按本机核对信息筛选，已关闭档口不会参与抽取。';
    $('floor-hint').textContent = (filters.query ? `保留搜索“${filters.query}”。` : '') + floorHint; // [FIX 2026.11.03] 始终展示正在影响随机池的条件。
    document.querySelectorAll('[data-action="draw"]').forEach(button => { button.disabled = !pool.length; });
  }
  function renderCards() {
    const pool = C.filterStalls(stalls, filters, state.favorites);
    const noResults = empty('这次没找到合适的档口', '试着切换种类、取消“只看收藏”，或清空搜索。楼层待确认的档口只会出现在“全食堂”和“待确认”中。', 'search', '<button class="text-button" data-action="reset-filters">重置全部筛选</button>');
    $('home-stalls').innerHTML = pool.length ? pool.slice(0,6).map(card).join('') : noResults;
    $('discover-stalls').innerHTML = pool.length ? pool.map(card).join('') : noResults;
    $('search-count').textContent = `找到 ${pool.length} 组招牌`;
    $('catalog-count').textContent = `${D.photos.length} 张实拍 / ${stalls.length} 组招牌`;
  }
  function renderNotes() {
    $('composer-nickname').textContent = state.nickname;
    $('notes-count').textContent = `${state.notes.length} 份 · 仅自己可见`;
    $('notes-feed').innerHTML = state.notes.length ? state.notes.map(note => {
      const stall = activeStall(note.stallId);
      return `<article class="note-card"><div class="note-header"><span class="avatar">我</span><strong>${escape(state.nickname)}</strong><time datetime="${new Date(note.time).toISOString()}">${dateLabel(note.time)}</time></div><p class="note-text">${escape(note.text)}</p>${stall?`<button class="note-attachment" data-action="detail" data-id="${stall.id}"><img loading="lazy" src="${stall.photos[0]}" alt=""><span>${escape(stall.name)}<br><span class="quiet-label">大食堂 / ${C.floorLabel(stall.floor)}</span></span></button>`:''}<span class="note-topic"># ${escape(note.topic)}</span></article>`;
    }).join('') : empty('你的第一份手记，还留着空白', '记下今天吃了哪家、想再去的理由，或一次意外发现。保存后只有你能在这里看到。', 'chat');
  }
  function renderMe() {
    if (document.activeElement !== $('nickname')) $('nickname').value = state.nickname;
    $('personal-stats').innerHTML = [[state.favorites.length,'家收藏'],[state.history.length,'次觅食'],[state.notes.length,'份手记']].map(([n,label])=>`<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');
    const favorites = stalls.filter(s => state.favorites.includes(s.id));
    $('favorite-stalls').innerHTML = favorites.length ? favorites.map(card).join('') : empty('先收藏几家想吃的', '看到感兴趣的档口，点照片右上角的爱心。下次可以只在收藏里随机选。', 'heart');
    $('history-list').innerHTML = state.history.length ? state.history.map(row => {
      const stall = activeStall(row.stallId);
      return `<button class="history-item" data-action="detail" data-id="${stall.id}"><img loading="lazy" src="${stall.photos[0]}" alt=""><div><strong>${escape(stall.name)}</strong><span>大食堂 / ${C.floorLabel(stall.floor)}</span></div><time>${dateLabel(row.time)}</time></button>`;
    }).join('') : empty('还没有记下吃过哪家', '随机选中后点“就吃这家”，这顿饭就有了记录。');
  }
  function refresh() {
    stalls = C.mergeStalls(D.stalls, state.overrides);
    renderFilters(); renderCards(); renderNotes(); renderMe();
    const selection = $('note-stall').value;
    $('note-stall').innerHTML = '<option value="">关联一家档口（可选）</option>' + stalls.map(s=>`<option value="${s.id}">${escape(s.name)}</option>`).join('');
    if (activeStall(selection)) $('note-stall').value = selection;
  }
  function updateFilters() { renderFilters(); renderCards(); }
  function resetFilters() {
    Object.assign(filters, { floor:'all', category:'全部', query:'', favoritesOnly:false });
    $('search').value = '';
    updateFilters();
  }
  function route() {
    const requested = location.hash.slice(1);
    page = ['home','discover','community','me'].includes(requested) ? requested : 'home';
    document.querySelectorAll('.page').forEach(section => { section.hidden = section.id !== `page-${page}`; });
    document.querySelectorAll('[data-nav]').forEach(link => {
      const active = link.dataset.nav === page;
      link.classList.toggle('active',active);
      if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    if (page === 'home') {
      // 首页展示当前的同一份筛选；搜索词也保留，避免随机池悄悄变化。
      // old: 在路由中覆盖楼层提示，随后改筛选又丢失搜索说明。
      renderFilters(); // [FIX 2026.11.03] 使用统一的范围提示。
    }
    document.title = `${({home:'今天吃什么',discover:'逛逛食堂',community:'校园广场',me:'我的觅食日常'})[page]} · XATUer`;
  }
  // old: function showDialog(dialog) {
  // old: dialogTrigger = document.activeElement;
  // old: if (!dialog.open) dialog.showModal();
  // old: document.body.classList.add('modal-open');
  // old: }
  // old: function closeDialog(dialog) { if (dialog.open) dialog.close(); }
  // [FIX 2026.11.04] 打开、关闭共用同一条弹窗历史；关闭返回可等待的结果。
  function showDialog(dialog) { return dialogNavigation.open(dialog); }
  function closeDialog(dialog) { return dialogNavigation.close(dialog); }
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)) closeDialog(dialog);
    });
    dialog.addEventListener('close', () => {
      // old: if (dialog.id === 'draw-dialog') { clearTimeout(drawTimer); drawTimer = null; }
      if (dialog.id === 'draw-dialog' && !dialog.open) { clearTimeout(drawTimer); drawTimer = null; } // [FIX 2026.11.04] 只清理确已关闭的弹窗。
      // old: if (dialog.id === 'detail-dialog') currentDetail = '';
      if (dialog.id === 'detail-dialog' && !dialog.open) currentDetail = ''; // [FIX 2026.11.04] 不覆盖快速重开的详情状态。
      document.body.classList.toggle('modal-open', !!document.querySelector('dialog[open]'));
      // old: if (dialogTrigger?.isConnected) dialogTrigger.focus();
      // [FIX 2026.11.04] 由弹窗导航在历史返回结束后恢复焦点，切换弹窗时不抢焦点。
    });
  }
  function renderDetail(id) {
    const stall = activeStall(id);
    if (!stall) return;
    currentDetail = id;
    // [FIX 2026.11.04] 浏览器前进恢复详情时，重建当前条目标识。
    $('detail-content').dataset.stallId = id;
    const localNotes = state.notes.filter(note => note.stallId === id);
    const saved = state.favorites.includes(id);
    $('detail-content').innerHTML = `<img id="detail-photo" class="detail-image" src="${stall.photos[0]}" alt="${escape(stall.name)}实拍照片">${stall.photos.length>1?`<div class="detail-thumbs">${stall.photos.map((photo,index)=>`<button data-action="photo" data-photo="${photo}" aria-label="查看第${index+1}张实拍"><img src="${photo}" alt="第${index+1}个角度"></button>`).join('')}</div>`:''}<div class="detail-body"><div class="detail-heading"><h2 id="detail-title">${escape(stall.name)}</h2><button class="button secondary small" data-action="favorite" data-id="${id}" aria-pressed="${saved}">${svg('heart')}${saved?'已收藏':'收藏'}</button></div><p class="detail-location">大食堂 / ${C.floorLabel(stall.floor)} / ${escape(stall.category)}</p><div class="detail-signs">照片中的招牌：${escape(stall.signs)}</div><p class="inline-hint">${stall.status==='closed'?'本机已标记关闭，不参与随机。':'按照片收录，不代表此刻正在营业。'}${stall.needsReview?' 该组名称需要进一步核对。':''} 暂不提供未经确认的价格、评分与营业时间。</p><div class="button-row"><button class="button primary" data-action="choose-direct" data-id="${id}" ${stall.status==='closed'?'disabled':''}>就吃这家</button><button class="button secondary" data-action="write-note" data-id="${id}">记一笔</button></div><details><summary>帮这份资料补充信息（仅本机）</summary><form id="correction-form" class="correction-form"><input type="hidden" name="stallId" value="${id}"><label>招牌名称<input name="name" value="${escape(stall.name)}" maxlength="50" required></label><div class="correction-fields"><label>楼层<select name="floor"><option value="">待确认</option>${[1,2,3].map(n=>`<option value="${n}" ${stall.floor===n?'selected':''}>${n} 楼</option>`).join('')}</select></label><label>本机选择状态<select name="status"><option value="listed" ${stall.status!=='closed'?'selected':''}>保留在随机池</option><option value="closed" ${stall.status==='closed'?'selected':''}>已关闭 / 不再抽取</option></select></label></div><p class="inline-hint">资料修正只影响本浏览器。可在“我的”导出备份，之后用于核对公共档口表。</p><button class="button secondary" type="submit">保存本机修正</button></form></details><section class="detail-notes"><h3>我对这家的手记</h3>${localNotes.length?localNotes.map(note=>`<p class="detail-note">${escape(note.text)}</p>`).join(''):'<p class="inline-hint">还没有相关手记，吃完回来记一笔吧。</p>'}</section></div>`;
  }
  function openDetail(id) { renderDetail(id); showDialog($('detail-dialog')); }
  function beginDraw() {
    const pool = C.filterStalls(stalls, filters, state.favorites);
    if (!pool.length) { toast('当前筛选没有档口，换个条件再试试。'); return; }
    const scope = pool.map(s=>s.id).join(',');
    if (scope !== drawScope) { seen = []; drawScope = scope; }
    drawPool = pool;
    showDialog($('draw-dialog'));
    redraw();
  }
  function redraw() {
    if (drawTimer) return;
    // 抽取范围在打开结果时固定，“换一家”沿用它，不跳回全食堂。
    const result = C.drawStall(drawPool, seen);
    if (!result) { toast('没有可选档口，请重新筛选。'); return; }
    if (result.reset) seen = [];
    seen.push(result.stall.id);
    currentDraw = result.stall;
    $('draw-content').innerHTML = `<div class="draw-loading"><span>${svg('shuffle')}</span><h2 id="draw-title">正在帮你挑一家…</h2><p>这次从 ${drawPool.length} 组招牌中选</p></div>`;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    drawTimer = setTimeout(() => { drawTimer = null; if ($('draw-dialog').open) renderDraw(); }, reduced?0:650);
  }
  function renderDraw() {
    if (!currentDraw) return;
    const stall = activeStall(currentDraw.id);
    const saved = state.favorites.includes(stall.id);
    $('draw-content').innerHTML = `<img class="draw-image" src="${stall.photos[0]}" alt="${escape(stall.name)}的实拍招牌"><div class="draw-body"><p class="draw-eyebrow">今日觅食提案</p><h2 id="draw-title">${escape(stall.name)}</h2><p class="draw-location">大食堂 / ${C.floorLabel(stall.floor)} / ${escape(stall.category)}</p><div class="draw-actions"><button class="button primary" data-action="choose-draw">${svg('check')}就吃这家</button><button class="button secondary" data-action="redraw">${svg('shuffle')}换一家</button></div><div class="draw-secondary"><button class="text-button" data-action="favorite" data-id="${stall.id}">${saved?'已加入收藏':'先收藏起来'}</button><button class="text-button" data-action="draw-detail" data-id="${stall.id}">查看招牌与详情</button></div><p class="draw-foot">当前范围 ${drawPool.length} 组 · 本轮已看 ${seen.length} 组<br>实拍收录，营业情况以到店为准。</p></div>`;
  }
  function choose(id) {
    const stall = activeStall(id);
    if (!stall || stall.status === 'closed') { toast('这家已不在随机池中，请换一家。'); return; }
    state.history.unshift({ stallId:id, time:Date.now() });
    state.history = state.history.slice(0,100);
    const saved = persist();
    closeDialog($('draw-dialog')); closeDialog($('detail-dialog'));
    renderMe();
    if (saved) toast(`记下了，就吃${stall.name}。好好吃饭！`);
  }
  // old: document.addEventListener('click', event => {
  // [FIX 2026.11.04] 先等待弹窗历史关闭，再执行页面跳转。
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const { action, id, value } = button.dataset;
    switch (action) {
      case 'floor': filters.floor = value; updateFilters(); break;
      case 'category': filters.category = value; updateFilters(); break;
      case 'reset-filters': resetFilters(); break;
      case 'draw': beginDraw(); break;
      case 'redraw': redraw(); break;
      case 'detail': openDetail(id); break;
      case 'favorite': favorite(id); break;
      case 'close-detail': closeDialog($('detail-dialog')); break;
      case 'close-draw': closeDialog($('draw-dialog')); break;
      case 'close-privacy': closeDialog($('privacy-dialog')); break;
      case 'photo': $('detail-photo').src = button.dataset.photo; break;
      case 'choose-direct': choose(id); break;
      case 'choose-draw': if (currentDraw) choose(currentDraw.id); break;
      // old: case 'draw-detail': closeDialog($('draw-dialog')); openDetail(id); break;
      case 'draw-detail': openDetail(id); break; // [FIX 2026.11.04] 切换弹窗复用同一条历史。
      case 'changelog': showDialog($('changelog-dialog')); break;
      case 'close-changelog': closeDialog($('changelog-dialog')); break;
      // [FIX 2026.11.10] 版权说明复用已有弹窗返回逻辑。
      case 'copyright': showDialog($('copyright-dialog')); break;
      case 'close-copyright': closeDialog($('copyright-dialog')); break;
      // old: 在 hashchange 触发前向隐藏页面设置焦点，浏览器可能忽略。
      // old: case 'write-note': closeDialog($('detail-dialog')); location.hash = 'community'; route(); $('note-stall').value = id; $('note-text').focus(); break;
      case 'write-note': await closeDialog($('detail-dialog')); location.hash = 'community'; route(); $('note-stall').value = id; $('note-text').focus(); break; // [FIX 2026.11.04] 历史回退完成后才跳转，避免写手记被退回。
    }
  });
  $('search').addEventListener('input', event => { filters.query = event.target.value; updateFilters(); });
  $('discover-floor').addEventListener('change', event => { filters.floor = event.target.value; updateFilters(); });
  for (const id of ['home-favorites','discover-favorites']) $(id).addEventListener('change', event => { filters.favoritesOnly = event.target.checked; updateFilters(); });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'correction-form') return;
    event.preventDefault();
    const form = new FormData(event.target);
    const id = form.get('stallId');
    if (!activeStall(id)) return;
    const name = String(form.get('name')).trim();
    if (!name) { toast('请填写招牌名称。'); return; }
    state.overrides[id] = { name:name.slice(0,50), floor:form.get('floor')?Number(form.get('floor')):null, status:form.get('status') };
    const saved = persist();
    refresh(); renderDetail(id);
    if (saved) toast('本机资料已更新。导出备份可保留核对结果。');
  });
  $('note-text').value = state.draft;
  $('note-text').addEventListener('input', event => {
    state.draft = event.target.value.slice(0,600);
    const saved = persist();
    $('draft-status').textContent = saved ? `${state.draft.length}/600 · 草稿已存本机` : '未能保存，请导出备份';
  });
  $('note-form').addEventListener('submit', event => {
    event.preventDefault();
    const text = $('note-text').value.trim();
    if (!text) { toast('先写点内容再保存。'); $('note-text').focus(); return; }
    state.notes.unshift({ id:window.crypto?.randomUUID?.() || `note-${Date.now()}`, text:text.slice(0,600), time:Date.now(), stallId:$('note-stall').value, topic:$('note-topic').value });
    state.notes = state.notes.slice(0,100);
    state.draft = '';
    const saved = persist();
    $('note-text').value = '';
    $('draft-status').textContent = saved ? '手记已保存到本机，没有公开发布' : '未能持久保存，请导出备份';
    renderNotes(); renderMe();
    if (saved) toast('手记已保存，仅自己可见。');
  });
  $('nickname-form').addEventListener('submit', event => {
    event.preventDefault();
    const nickname = $('nickname').value.trim();
    if (!nickname) return;
    state.nickname = nickname.slice(0,20);
    const saved = persist(); renderNotes(); renderMe();
    if (saved) toast('本机昵称已保存。');
  });
  $('export-button').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`xatuer-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2*1024*1024) throw new Error('文件过大，请使用 2 MB 以内的 JSON 备份');
      const imported = C.sanitizeState(JSON.parse(await file.text()),D.stalls.map(s=>s.id));
      if (!window.confirm(`备份包含 ${imported.favorites.length} 家收藏、${imported.notes.length} 份手记。导入会替换本机现有记录，继续吗？`)) return;
      state = imported;
      const saved = persist(); refresh();
      $('note-text').value = state.draft;
      if (saved) toast('本机备份已恢复。');
    } catch (error) { toast(`无法导入：${error.message || '备份格式不正确'}`); }
    finally { event.target.value = ''; }
  });
  $('privacy-button').addEventListener('click',()=>showDialog($('privacy-dialog')));
  window.addEventListener('hashchange',()=>{ route(); window.scrollTo(0,0); });
  document.addEventListener('keydown',event=>{
    if (event.key==='/' && !document.querySelector('dialog[open]') && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      // old: location.hash='discover' 后直接 focus，页面仍处于隐藏状态。
      event.preventDefault(); location.hash='discover'; route(); $('search').focus(); // [FIX 2026.11.03] 先显示搜索页。
    }
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event; $('install-button').hidden = false;
  });
  $('install-button').addEventListener('click',async()=>{
    if (!installPrompt) return;
    await installPrompt.prompt(); await installPrompt.userChoice;
    installPrompt=null; $('install-button').hidden=true;
  });
  window.addEventListener('appinstalled',()=>{ $('install-button').hidden=true; });
  function updateConnection() { $('connection-status').textContent = navigator.onLine ? '本机体验版' : '离线模式'; }
  window.addEventListener('online',updateConnection); window.addEventListener('offline',updateConnection);
  const hour = new Date().getHours();
  $('greeting').textContent = hour<10?'早上好，吃点好的再出发':hour<14?'到饭点了，今天想吃什么':hour<18?'下午好，给晚饭留点期待':'忙了一天，好好吃顿饭吧';
  // [FIX 2026.11.04] 页脚随资料日期更新，避免仍显示旧日期。
  $('data-updated').textContent = `资料更新于 ${D.updatedAt.replaceAll('-','.')}`;
  hydrateIcons(); refresh(); route(); updateConnection();
  if (storageWarning) toast(storageWarning);
  if ('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol)) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{
      toast('离线缓存未能启用，联网时仍可正常使用。');
    }));
  }
})();
