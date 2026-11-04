/* [FIX 2026.11.04] 弹窗占用一条站内历史，手机返回先关闭弹窗。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createFoodDialogNavigation = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (browser, doc, onOpen) {
  'use strict';
  const key = 'xatuerDialog';
  const owner = `${Date.now()}-${Math.random()}`;
  const dialogs = new Map([...doc.querySelectorAll('dialog')].map(dialog => [dialog.id, dialog]));
  let active = null;
  let trigger = null;
  let pending = null;
  const marker = () => browser.history.state?.[key];
  const ownsEntry = () => marker()?.owner === owner;
  const entry = dialog => ({ ...browser.history.state, [key]: { owner, id: dialog.id } });
  function restoreFocus() { if (trigger?.isConnected) trigger.focus({preventScroll:true}); }
  function hide() {
    const dialog = active;
    active = null;
    if (dialog?.open) dialog.close();
  }
  function reveal(dialog) {
    active = dialog;
    if (!dialog.open) dialog.showModal();
    onOpen?.(dialog);
  }
  function open(dialog) {
    // 关闭按钮的历史回退尚未结束时，等它完成再打开下一张招牌。
    if (pending) return pending.promise.then(() => open(dialog));
    if (active === dialog && dialog.open) return;
    if (!active) trigger = doc.activeElement;
    if (ownsEntry()) browser.history.replaceState(entry(dialog), '');
    else browser.history.pushState(entry(dialog), '');
    hide();
    reveal(dialog);
  }
  function close(dialog) {
    if (pending) return pending.promise;
    if (active !== dialog) return Promise.resolve();
    hide();
    if (!ownsEntry()) { restoreFocus(); return Promise.resolve(); }
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    pending = { promise, resolve };
    browser.history.back();
    return promise;
  }
  browser.addEventListener('popstate', () => {
    const next = ownsEntry() ? dialogs.get(marker().id) : null;
    const wasOpen = !!active;
    if (active !== next) {
      hide();
      if (next) reveal(next);
    }
    if (!next && (wasOpen || pending)) restoreFocus();
    const completed = pending;
    pending = null;
    completed?.resolve();
  });
  for (const dialog of dialogs.values()) {
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close(dialog);
    });
    // 原生关闭（例如表单 method=dialog）也应消费这条弹窗历史。
    dialog.addEventListener('close', () => { if (active === dialog && !dialog.open) close(dialog); });
  }
  return { open, close };
});
