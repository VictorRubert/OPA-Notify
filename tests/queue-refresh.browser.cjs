// Complete browser -> background -> channel flow, with synthetic Socket.IO
// packets and Chrome APIs. Requires Playwright and Chromium, not an Opa login.
const {chromium}=require('playwright');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const loadEvent='customer-services-ui:customer-service-queues:in-progress:load-customer-services';
const event='customer-services-ui:customer-service-queues:in-progress:list';
const item=n=>({_id:`attendance-${n}`,protocolo:`OPA2026114${n}`,id_user:{nome:`Contato ${n}`},motivos:[]});
const html='<button data-tutorial="customer-service-queue-in-progress" class="bg-gray-200 border-gray-400"></button><div data-tutorial="customer-service-list"><div data-tutorial="customer-service-view-selector">Meus atendimentos</div><ul><li itemid="attendance-1"><button data-sidebar="menu-button"><div>Contato 1</div></button></li></ul></div>';
(async()=>{
 let clock=1000000;
 const local={soundEnabled:false,otherTabsEnabled:false}, session={}, cards=[], system=[];
 const area=data=>({get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).filter(k=>k in data).map(k=>[k,data[k]])),set:async value=>Object.assign(data,value),remove:async keys=>{for(const k of typeof keys==='string'?[keys]:keys)delete data[k];}});
 const chrome={storage:{local:area(local),session:area(session)},
  alarms:{get:async()=>({}),onAlarm:{addListener(){}}},runtime:{onInstalled:{addListener(){}},onStartup:{addListener(){}},onMessage:{addListener(){}}},
  tabs:{onUpdated:{addListener(){}},query:async()=>[{id:1,url:'https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress'}],sendMessage:async(id,msg)=>{if(msg.type==='SHOW_ATTENDANCE_EVENT')cards.push(msg.eventType);return {ready:true,success:true,version};}},
  notifications:{create:async(id,options)=>system.push(id.includes(':finished:')?'finished':'received'),onClicked:{addListener(){}},onClosed:{addListener(){}}}
 };
 const context=vm.createContext({chrome,URL,console,setTimeout,clearTimeout,Date:class extends Date{static now(){return clock;}}});
 vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),context);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://opasuiteapi.ixcsoft.com.br/**',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.exposeFunction('readStorage',keys=>chrome.storage.local.get(keys));
  await page.exposeFunction('backgroundMessage',async message=>{
   if(message.type!=='ATTENDANCE_SCAN')return {success:true};
   clock=message.scannedAt;context.items=message.items;context.options={initialRead:message.initialRead===true,completeSnapshot:message.completeSnapshot===true};
   return vm.runInContext('processAttendanceScan(items,{tab:{id:1}},options)',context);
  });
  await page.addInitScript({content:`
   window.clock=1000000;Date.now=()=>clock;
   window.timers=new Map();let id=0;window.setTimeout=(fn,delay)=>{timers.set(++id,fn);return id;};window.clearTimeout=id=>timers.delete(id);window.setInterval=()=>0;window.clearInterval=()=>{};
   window.flush=()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());};
   window.chrome={storage:{local:{get:keys=>readStorage(keys)},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(fn){window.listener=fn;}},sendMessage:message=>backgroundMessage(message)}};
   window.WebSocket=class{static OPEN=1;constructor(){window.socket=this;this.listeners={};this.readyState=1;this.sent=[];}send(frame){this.sent.push(frame);const packet=JSON.parse(frame.slice(2));if(packet[0]==='customer-services-ui:customer-service-queues:in-progress:list' && window.serverItems)queueMicrotask(()=>this.receive('42'+JSON.stringify([packet[0],{items:serverItems,page:1,hasMore:false}])));}addEventListener(name,fn){this.listeners[name]=fn;}receive(data){this.listeners.message({data});}};
   window.scan=()=>new Promise(resolve=>listener({type:'BACKGROUND_ATTENDANCE_SCAN'},{},resolve));
  `+fs.readFileSync(path.join(root,'content/queue-bridge.js'),'utf8')});
  const open=async()=>{
   await page.goto('https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress');
   await page.evaluate(({time,event,loadEvent})=>{window.clock=time;new WebSocket('wss://opasuiteapi.ixcsoft.com.br/socket.io/');socket.send('42'+JSON.stringify([loadEvent,{preferences:{owner:'me'}}]));socket.send('42'+JSON.stringify([event,{preferences:{owner:'me'},page:1}]));},{time:clock,event,loadEvent});
   await page.addScriptTag({content:fs.readFileSync(path.join(root,'content/content.js'),'utf8')});
   await page.waitForTimeout(30);
  };
  const packet=async items=>{
   await page.evaluate(({event,items})=>socket.receive('42'+JSON.stringify([event,{items,page:1,hasMore:false}])),{event,items});
   await page.waitForTimeout(30);await page.evaluate(()=>scan());await page.evaluate(()=>{clock+=1000;});await page.evaluate(()=>scan());
  };
  await open();await packet([item(1)]);assert.deepEqual(system,[]);assert.deepEqual(cards,[]);
  // The app renders a new attendance but emits no full-list event. Only the
  // repeated captured read query can return the current server membership.
  await page.evaluate(items=>{serverItems=items;document.querySelector('ul').insertAdjacentHTML('beforeend','<li itemid="attendance-2"><button>Contato 2</button></li>');clock+=16000;},[item(1),item(2)]);
  await page.evaluate(()=>scan());await page.waitForTimeout(60);await page.evaluate(()=>scan());await page.evaluate(()=>{clock+=1000;});await page.evaluate(()=>scan());
  assert.deepEqual(system,['received']);assert.deepEqual(cards,['received']);
  assert.equal(await page.evaluate(()=>socket.sent.length),4);
  assert.equal(await page.locator('[data-tutorial="customer-service-view-selector"]').innerText(),'Meus atendimentos');
  // A subsequent departure is also discovered without toggling any view.
  await page.evaluate(items=>{serverItems=items;document.querySelector('[itemid="attendance-2"]').remove();clock+=16000;},[item(1)]);
  await page.evaluate(()=>scan());await page.waitForTimeout(60);await page.evaluate(()=>scan());await page.evaluate(()=>{clock+=1000;});await page.evaluate(()=>scan());
  // A quick return within the confirmation window must not become a false
  // departure merely because the cached list still lacks this attendance.
  await page.evaluate(items=>{serverItems=items;document.querySelector('ul').insertAdjacentHTML('beforeend','<li itemid="attendance-2"><button>Contato 2</button></li>');clock+=8000;flush();},[item(1),item(2)]);
  await page.waitForTimeout(50);await page.evaluate(()=>flush());await page.waitForTimeout(30);
  await page.evaluate(()=>{clock+=1000;});await page.evaluate(()=>scan());
  assert.deepEqual(system,['received']);assert.deepEqual(cards,['received']);
  // Now it really leaves and a second fresh server read confirms the absence.
  await page.evaluate(items=>{serverItems=items;document.querySelector('[itemid="attendance-2"]').remove();clock+=16000;},[item(1)]);
  await page.evaluate(()=>scan());await page.waitForTimeout(60);await page.evaluate(()=>scan());await page.evaluate(()=>{clock+=1000;});await page.evaluate(()=>scan());
  await page.evaluate(()=>{clock+=8000;flush();});await page.waitForTimeout(50);await page.evaluate(()=>flush());await page.waitForTimeout(100);
  assert.deepEqual(system,['received','finished']);assert.deepEqual(cards,['received','finished']);
  await open();await packet([item(1)]);
  assert.deepEqual(system,['received','finished']);assert.deepEqual(cards,['received','finished']);
  assert.deepEqual(errors,[]);
  console.log('PASS: stale cached queue -> automatic captured query -> new arrival -> automatic departure -> reload without duplicate; no view navigation.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
