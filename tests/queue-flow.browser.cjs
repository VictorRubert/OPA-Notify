// Complete browser -> background -> channel flow, with synthetic Socket.IO
// packets and Chrome APIs. Requires Playwright and Chromium, not an Opa login.
const {chromium}=require('playwright');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
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
   clock=message.scannedAt;context.items=message.items;context.options={initialRead:message.initialRead===true};
   return vm.runInContext('processAttendanceScan(items,{tab:{id:1}},options)',context);
  });
  await page.addInitScript({content:`
   window.clock=1000000;Date.now=()=>clock;
   window.timers=new Map();let id=0;window.setTimeout=(fn,delay)=>{timers.set(++id,fn);return id;};window.clearTimeout=id=>timers.delete(id);window.setInterval=()=>0;window.clearInterval=()=>{};
   window.flush=()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());};
   window.chrome={storage:{local:{get:keys=>readStorage(keys)},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(fn){window.listener=fn;}},sendMessage:message=>backgroundMessage(message)}};
   window.WebSocket=class{constructor(){window.socket=this;this.listeners={};}send(){}addEventListener(name,fn){this.listeners[name]=fn;}receive(data){this.listeners.message({data});}};
   window.scan=()=>new Promise(resolve=>listener({type:'BACKGROUND_ATTENDANCE_SCAN'},{},resolve));
  `+fs.readFileSync(path.join(root,'content/queue-bridge.js'),'utf8')});
  const open=async()=>{
   await page.goto('https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress');
   await page.evaluate(time=>{window.clock=time;new WebSocket('wss://opasuiteapi.ixcsoft.com.br/socket.io/');},clock);
   await page.addScriptTag({content:fs.readFileSync(path.join(root,'content/content.js'),'utf8')});
   await page.waitForTimeout(30);
  };
  const packet=async items=>{
   await page.evaluate(({event,items})=>socket.receive('42'+JSON.stringify([event,{items,page:1,hasMore:false}])),{event,items});
   await page.waitForTimeout(30);await page.evaluate(()=>scan());await page.evaluate(()=>{clock+=1000;});await page.evaluate(()=>scan());
  };
  await open();await packet([item(1)]);assert.deepEqual(system,[]);assert.deepEqual(cards,[]);
  await page.evaluate(()=>{clock+=11000;});await packet([]);
  await page.evaluate(()=>{clock+=8000;flush();});await page.waitForTimeout(100);
  assert.deepEqual(system,['finished']);assert.deepEqual(cards,['finished']);
  // The same pre-existing attendance reappears in the initial server snapshot
  // after reload. It must silently become the baseline, not a new receipt.
  await open();await packet([item(1)]);
  assert.deepEqual(system,['finished']);assert.deepEqual(cards,['finished']);
  await page.evaluate(()=>{clock+=11000;});await packet([item(1),item(2)]);
  assert.deepEqual(system,['finished','received']);assert.deepEqual(cards,['finished','received']);
  assert.deepEqual(errors,[]);
  console.log('PASS: integrated initial baseline -> empty queue -> visual + system departure -> reload without false receipt -> real new receipt.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
