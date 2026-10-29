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
  let clicked, alarmListener;
  const alarms = {};
  const chrome = {
    alarms: { get: async name => alarms[name], create: async (name, options) => { alarms[name] = options; }, onAlarm: { addListener(fn) { alarmListener = fn; } } },
    storage: {local: area(local), session: area(session)},
    runtime: {onInstalled:{addListener(){}},onStartup:{addListener(){}},onMessage:{addListener(){}}},
    tabs: {
      onUpdated: {addListener(){}},
      query: async () => tabs,
      get: async id => { const tab = tabs.find(t => t.id === id); if (!tab) throw Error('Tab closed'); return tab; },
      update: async (...args) => actions.push(['tab', ...args]),
      sendMessage: async (id, message) => {
        if (id === 4) throw Error('Protected page');
        messages.push({id, ...message}); return {ready:true,success:true,version:'1.5.4'};
      }
    },
    scripting: {executeScript:async args => {injections.push(args); throw Error('Protected page');}},
    windows: {update:async (...args) => actions.push(['window', ...args])},
    notifications: {
      create:async (id, options) => notifications.push({id,...options}), clear:async()=>{},
      onClicked:{addListener(fn){clicked=fn;}},onClosed:{addListener(){}}
    }
  };
  const ctx = vm.createContext({chrome, console, setTimeout, clearTimeout, URL});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),ctx);
  const attendance = {protocol:'OPA2026123123',company:'Telecom south america'};
  return {alarms, alarm: name => alarmListener({name}),ctx,local,session,messages,notifications,injections,actions,chrome,attendance, click:id=>clicked(id),
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
  assert.equal(Object.keys(s.session).filter(key=>key.startsWith('notification:')).length,0);
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

test('Background alarm is created once and scans tabs without requiring an active tab', async()=>{
  const s=setup();
  await vm.runInContext('ensureBackgroundAlarm()',s.ctx);
  assert.equal(s.alarms['opa-background-scan'].periodInMinutes,1);
  let requested;
  s.chrome.tabs.query=async filter=>{ requested=filter; return [{id:1,active:false}, {id:5,discarded:true}]; };
  await vm.runInContext('scanOpenSupportTabs()',s.ctx);
  assert.deepEqual(Array.from(requested.url),['https://suporte.ixcsoft.com.br/*','https://opasuiteapi.ixcsoft.com.br/*']);
  assert.equal(requested.active,undefined);
  assert(s.messages.some(m=>m.id===1 && m.type==='BACKGROUND_ATTENDANCE_SCAN'));
  assert(!s.messages.some(m=>m.id===5));
});
test('Background scanning respects the master toggle', async()=>{
  const s=setup(); s.local.enabled=false;
  await vm.runInContext('scanOpenSupportTabs()',s.ctx);
  assert.equal(s.messages.length,0);
});
test('Duration and corner reach both Opa and other tabs', async()=>{
  const s=setup();
  await s.announce({toastDuration:30000,toastPosition:'bottom-right'});
  const cards=s.messages.filter(m=>m.type==='SHOW_ATTENDANCE_EVENT');
  assert.deepEqual(cards.map(m=>m.id),[1,2]);
  for(const card of cards){
    assert.equal(card.duration,30000);
    assert.equal(card.position,'bottom-right');
  }
});

test('Both exact Opa origins are accepted, lookalike and unrelated URLs rejected',()=>{
 const s=setup();
 for(const url of ['https://suporte.ixcsoft.com.br/', 'https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress']){
  s.ctx.url=url; assert.equal(vm.runInContext('isSupportUrl(url)',s.ctx),true);
 }
 for(const url of ['https://opasuiteapi.ixcsoft.com.br.evil.example/', 'http://opasuiteapi.ixcsoft.com.br/', 'https://example.com/', 'invalid']){
  s.ctx.url=url; assert.equal(vm.runInContext('isSupportUrl(url)',s.ctx),false);
 }
});
test('Notification click opens the new-domain source tab',async()=>{
 const s=setup(); s.chrome.tabs.get=async()=>({id:1,windowId:3,url:'https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress'});
 s.ctx.target=s.attendance;
 await vm.runInContext('openSourceAttendance(1,target)',s.ctx);
 assert(s.messages.some(m=>m.type==='FOCUS_ATTENDANCE'));
});

test('Visual simulations report delivery failures instead of claiming success',async()=>{
 const s=setup();
 s.chrome.tabs.sendMessage=async(id,message)=>message.type==='OPA_NOTIFY_CONTENT_PING'?{ready:true,version:'1.5.4'}:{success:false,error:'Card render failed'};
 s.ctx.args=[s.attendance,{tab:{id:1}},{visualEnabled:true,soundEnabled:false},'received',true];
 await assert.rejects(vm.runInContext('announceAttendance(...args)',s.ctx),/Card render failed/);
});
test('An outdated page monitor produces an explicit reload instruction',async()=>{
 const s=setup();s.chrome.tabs.sendMessage=async()=>({ready:true});
 await assert.rejects(vm.runInContext('ensureContentScript(1)',s.ctx),/Recarregue a aba/);
});

test('Simulation chooses the active new-domain tab without relying on the native URL filter',async()=>{
 const s=setup();
 s.chrome.tabs.query=async filter=>filter.active?[{id:7,url:'https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress'}]:[];
 s.local.soundEnabled=false;s.local.systemNotificationsEnabled=false;s.local.otherTabsEnabled=false;
 await vm.runInContext('testAlert("received")',s.ctx);
 assert(s.messages.some(m=>m.id===7 && m.type==='SHOW_ATTENDANCE_EVENT'));
});
test('Missing Opa tab diagnostic includes running version and host, without URL parameters',async()=>{
 const s=setup();s.chrome.tabs.query=async filter=>filter.active?[{id:9,url:'https://other.example/path?secret=private'}]:[];
 const result=await vm.runInContext('testAlert("received")',s.ctx);
 assert.equal(result.success,false);assert.match(result.error,/1.5.4/);assert.match(result.error,/other.example/);assert(!result.error.includes('private'));
});
function queueScenario(){
 const s=setup();let time=1000000;
 s.ctx.Date=class extends Date {static now(){return time;}};
 s.local.soundEnabled=false;s.local.otherTabsEnabled=false;
 return {...s,advance:ms=>{time+=ms;},scan:async (items, options = {})=>{s.ctx.scanItems=items;s.ctx.scanOptions=options;return vm.runInContext('processAttendanceScan(scanItems,{tab:{id:1}},scanOptions)',s.ctx);}};
}
test('Last attendance leaving an empty queue is confirmed after one confirmation interval',async()=>{
 const s=queueScenario();await s.scan([s.attendance]);s.advance(11000);
 const first=await s.scan([]);assert.equal(first.finishedCount,0);
 assert.equal(first.nextScanIn,8000);
 s.advance(8000);
 const confirmed=await s.scan([]);assert.equal(confirmed.finishedCount,1);
 assert.equal(s.notifications.filter(n=>n.id.includes(':finished:')).length,1);
 s.advance(16000);assert.equal((await s.scan([])).finishedCount,0);
});
test('A confirmed departure can be notified again if that protocol reenters and leaves',async()=>{
 const s=queueScenario();await s.scan([s.attendance]);s.advance(11000);await s.scan([]);s.advance(8000);await s.scan([]);
 s.advance(1000);await s.scan([s.attendance]);s.advance(1000);await s.scan([]);s.advance(8000);
 assert.equal((await s.scan([])).finishedCount,1);
 assert.equal(s.notifications.filter(n=>n.id.includes(':finished:')).length,2);
});
test('A transient disappearance cancels its pending departure',async()=>{
 const s=queueScenario();await s.scan([s.attendance]);s.advance(11000);await s.scan([]);s.advance(4000);
 const restored=await s.scan([s.attendance]);assert.equal(restored.finishedCount,0);
 s.advance(10000);assert.equal((await s.scan([s.attendance])).finishedCount,0);
 assert.equal(s.notifications.filter(n=>n.id.includes(':finished:')).length,0);
});

test('Reload creates a silent baseline even when the stored queue was empty',async()=>{
 const s=queueScenario();await s.scan([]);s.advance(20000);
 const result=await s.scan([s.attendance],{initialRead:true});
 assert.equal(result.newCount,0);assert.equal(result.baselineCreated,true);
 assert.equal(s.notifications.length,0);
 s.advance(11000);assert.equal((await s.scan([s.attendance])).newCount,0);
});
test('Reload does not reannounce a protocol previously marked as departed',async()=>{
 const s=queueScenario();await s.scan([s.attendance]);s.advance(11000);await s.scan([]);s.advance(8000);await s.scan([]);
 const before=s.notifications.length;
 const result=await s.scan([s.attendance],{initialRead:true});
 assert.equal(result.newCount,0);assert.equal(s.notifications.length,before);
 s.advance(11000);assert.equal((await s.scan([s.attendance])).newCount,0);
});

test('Departure cards are delivered to other Opa tabs as well as ordinary sites',async()=>{
 const s=setup();s.chrome.tabs.query=async()=>[{id:1,url:'https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress'},{id:8,url:'https://suporte.ixcsoft.com.br/'}];
 await s.announce({},'finished');
 assert(s.messages.some(m=>m.id===8 && m.type==='SHOW_ATTENDANCE_EVENT' && m.eventType==='finished'));
 assert.equal(s.session['lastDelivery:finished'].sourceVisual,'delivered');
 assert.equal(s.session['lastDelivery:finished'].otherTabs.delivered,1);
 assert.equal(s.session['lastDelivery:finished'].system,'delivered');
});
test('Delivery diagnostics distinguish visual failure from successful system notification',async()=>{
 const s=setup();s.chrome.tabs.sendMessage=async(id,message)=>message.type==='OPA_NOTIFY_CONTENT_PING'?{ready:true,version:'1.5.4'}:{success:false,error:'Render failed'};
 s.ctx.console={...console,warn(){}};
 await s.announce({otherTabsEnabled:false},'finished');
 const delivery=s.session['lastDelivery:finished'];assert.equal(delivery.sourceVisual,'failed');assert.equal(delivery.system,'delivered');
 assert(!JSON.stringify(delivery).includes(s.attendance.protocol));assert(!JSON.stringify(delivery).includes(s.attendance.company));
});

test('Previously opened destination tabs can still receive cards after an extension update',async()=>{
 const s=setup();const originalSend=s.chrome.tabs.sendMessage;
 s.chrome.tabs.sendMessage=async(id,message)=>{
  if(id===2 && message.type==='OPA_NOTIFY_CONTENT_PING')return {ready:true,version:'1.5.3'};
  return originalSend(id,message);
 };
 await s.announce({},'finished');
 assert(s.messages.some(m=>m.id===2 && m.type==='SHOW_ATTENDANCE_EVENT' && m.eventType==='finished'));
 assert.equal(s.session['lastDelivery:finished'].otherTabs.delivered,1);
});
test('Copied diagnostics expose counts and delivery results without queue/customer data',async()=>{
 const s=setup();s.local.pendingRemovals={[s.attendance.protocol]:{attendance:s.attendance}};
 s.local.lastDetectedCount=1;
 await s.announce({otherTabsEnabled:false},'finished');
 const diagnostic=await vm.runInContext('getDiagnostics()',s.ctx);
 assert.equal(diagnostic.pendingRemovalCount,1);assert.equal(diagnostic.deliveries.finished.system,'delivered');
 const text=JSON.stringify(diagnostic);assert(!text.includes(s.attendance.protocol));assert(!text.includes(s.attendance.company));
});
