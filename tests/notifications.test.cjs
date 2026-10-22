const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup() {
  const local = {}, session = {}, messages = [], notifications = [], injections = [], actions = [];
  const area = data => ({
    get: async keys => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).filter(k => k in data).map(k => [k, data[k]])),
    set: async values => Object.assign(data, values),
    remove: async keys => { for (const k of typeof keys === 'string' ? [keys] : keys) delete data[k]; }
  });
  const tabs = [{id: 1, windowId: 3, url: 'https://suporte.ixcsoft.com.br/'}, {id: 2, url: 'https://example.com/'}, {id: 4, url: 'https://blocked.example/'}];
  let clicked;
  const chrome = {
    storage: {local: area(local), session: area(session)},
    runtime: {onInstalled:{addListener(){}},onStartup:{addListener(){}},onMessage:{addListener(){}}},
    tabs: {
      query: async () => tabs,
      get: async id => { const tab = tabs.find(t => t.id === id); if (!tab) throw Error('Tab closed'); return tab; },
      update: async (...args) => actions.push(['tab', ...args]),
      sendMessage: async (id, message) => {
        if (id === 4) throw Error('Protected page');
        messages.push({id, ...message}); return {ready:true};
      }
    },
    scripting: {executeScript:async args => {injections.push(args); throw Error('Protected page');}},
    windows: {update:async (...args) => actions.push(['window', ...args])},
    notifications: {
      create:async (id, options) => notifications.push({id,...options}), clear:async()=>{},
      onClicked:{addListener(fn){clicked=fn;}},onClosed:{addListener(){}}
    }
  };
  const ctx = vm.createContext({chrome, console, setTimeout, clearTimeout});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),ctx);
  const attendance = {protocol:'OPA2026123123',company:'Telecom south america'};
  return {ctx,local,session,messages,notifications,injections,actions,chrome,attendance, click:id=>clicked(id),
    announce:async (flags={},event='received')=>{ ctx.args=[attendance,{tab:tabs[0]},{visualEnabled:true,otherTabsEnabled:true,systemNotificationsEnabled:true,soundEnabled:false,toastDuration:6000,...flags},event]; await vm.runInContext('announceAttendance(...args)',ctx); }
  };
}
test('Both events reach source and other tabs and system; protected tab does not block delivery', async()=>{
  for (const event of ['received','finished']) {
    const s=setup(); await s.announce({},event);
    assert(s.messages.some(m=>m.id===1 && m.type==='SHOW_ATTENDANCE_EVENT'));
    assert(s.messages.some(m=>m.id===2 && m.sourceTabId===1 && m.eventType===event));
    assert.equal(s.notifications.length,1);
    assert.equal(s.notifications[0].title,event==='received'?'Um atendimento novo foi recebido!':'Um atendimento acabou de sair da sua fila!');
    assert.equal(s.notifications[0].message,'OPA2026123123 - Telecom south america');
  }
});
test('Independent switches preserve the Opa visual channel', async()=>{
  const s=setup(); await s.announce({otherTabsEnabled:false,systemNotificationsEnabled:false});
  assert.equal(s.notifications.length,0); assert.equal(s.injections.length,0);
  assert.deepEqual(s.messages.filter(m=>m.type==='SHOW_ATTENDANCE_EVENT').map(m=>m.id),[1]);
  const t=setup(); await t.announce({visualEnabled:false,otherTabsEnabled:false});
  assert.equal(t.notifications.length,1); assert.equal(t.messages.length,0);
});
test('Notification click restores Opa tab and window and opens the attendance',async()=>{
  const s=setup(); await s.announce(); await s.click(s.notifications[0].id);
  assert.equal(s.actions[0][0],'tab'); assert.equal(s.actions[0][1],1);
  assert.equal(s.actions[1][0],'window'); assert.equal(s.actions[1][1],3);
  assert(s.messages.some(m=>m.type==='FOCUS_ATTENDANCE' && m.attendance.protocol===s.attendance.protocol));
  assert.equal(Object.keys(s.session).length,0);
});
test('Opening a source rejects non-Opa tabs',async()=>{
  const s=setup(); s.ctx.target=s.attendance;
  await assert.rejects(vm.runInContext('openSourceAttendance(2,target)',s.ctx));
  assert.equal(s.actions.length,0);
});
test('New settings defaults preserve existing disabled choices',async()=>{
  const s=setup(); s.local.otherTabsEnabled=false;
  await vm.runInContext('initializeDefaults()',s.ctx);
  assert.equal(s.local.otherTabsEnabled,false); assert.equal(s.local.systemNotificationsEnabled,true);
});
