/* [FIX 2026.11.04] 使用异步历史事件验证返回行为，不接管用户浏览器。 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const createNavigation = require('../scripts/dialog-navigation.js');

function fixture() {
  const browser = new EventTarget();
  const entries = [{state:{page:'discover'},url:'#discover'}];
  let index = 0;
  let focusCount = 0;
  const trigger = {isConnected:true,focus(){focusCount++;}};
  const doc = {activeElement:trigger,querySelectorAll:()=>dialogs};
  const dialogs = ['detail-dialog','draw-dialog','privacy-dialog','changelog-dialog'].map(id => {
    const dialog = new EventTarget();
    Object.assign(dialog,{id,open:false,showModal(){this.open=true;},close(){
      this.open=false;
      // 浏览器的 close 事件在关闭操作之后异步派发。
      setImmediate(()=>this.dispatchEvent(new Event('close')));
    }});
    return dialog;
  });
  const turn = () => new Promise(resolve=>setImmediate(resolve));
  browser.history = {
    get state(){return entries[index].state;},
    pushState(state,_title,url){entries.splice(index+1);entries.push({state,url:url??entries[index].url});index++;},
    replaceState(state,_title,url){entries[index]={state,url:url??entries[index].url};},
    back(){this.go(-1);},
    forward(){this.go(1);},
    go(delta){setImmediate(()=>{
      if(index+delta<0||index+delta>=entries.length)return;
      index+=delta;browser.dispatchEvent(new Event('popstate'));
    });}
  };
  const opened=[];
  const nav=createNavigation(browser,doc,dialog=>opened.push(dialog.id));
  return {nav,browser,dialogs,entries,opened,turn,get index(){return index;},get focusCount(){return focusCount;}};
}

test('手机返回先关详情，保留原页面和原历史状态，前进可恢复详情',async()=>{
  const f=fixture(),detail=f.dialogs[0];
  f.nav.open(detail);
  assert.equal(f.index,1);assert.equal(f.entries[1].url,'#discover');
  assert.equal(f.browser.history.state.page,'discover');
  f.browser.history.back();await f.turn();await f.turn();
  assert.equal(detail.open,false);assert.equal(f.index,0);
  assert.deepEqual(f.browser.history.state,{page:'discover'});assert.equal(f.focusCount,1);
  f.browser.history.forward();await f.turn();
  assert.equal(detail.open,true);assert.equal(f.opened.length,2);
});

test('关闭按钮与重复关闭只回退一次，关闭后可以安全跳转写手记',async()=>{
  const f=fixture(),detail=f.dialogs[0];f.nav.open(detail);
  const closed=f.nav.close(detail),again=f.nav.close(detail);
  assert.equal(closed,again);assert.equal(detail.open,false);
  await closed;
  assert.equal(f.focusCount,1);
  f.browser.history.pushState({page:'community'},'','#community');
  await f.turn();
  assert.equal(f.entries[f.index].url,'#community');assert.equal(f.browser.history.state.xatuerDialog,undefined);
});

test('随机结果切详情只占一条历史，关闭不会误退两页',async()=>{
  const f=fixture(),[detail,draw]=f.dialogs;
  f.nav.open(draw);f.nav.open(detail);await f.turn();
  assert.equal(draw.open,false);assert.equal(detail.open,true);assert.equal(f.index,1);assert.equal(f.entries.length,2);
  await f.nav.close(detail);await f.turn();assert.equal(f.index,0);
});

test('Esc、原生关闭和快速重开不会留下空白弹窗历史',async()=>{
  const f=fixture(),[detail,,privacy]=f.dialogs;
  f.nav.open(detail);
  const cancel=new Event('cancel',{cancelable:true});detail.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented,true);
  const reopened=f.nav.open(privacy);await reopened;await f.turn();
  assert.equal(detail.open,false);assert.equal(privacy.open,true);assert.equal(f.index,1);
  privacy.close();await f.turn();await f.turn();
  assert.equal(f.index,0);assert.equal(privacy.open,false);
});

test('已经导航到站内另一页时关闭弹窗不会额外返回',async()=>{
  const f=fixture(),detail=f.dialogs[0];f.nav.open(detail);
  f.browser.history.pushState({page:'me'},'','#me');
  await f.nav.close(detail);await f.turn();
  assert.equal(f.index,2);assert.equal(f.entries[f.index].url,'#me');
});
