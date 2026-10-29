// Optional DOM integration checks: requires Playwright and a Chromium binary.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const EVENT='customer-services-ui:customer-service-queues:in-progress:list';
const personal='<button data-tutorial="customer-service-queue-in-progress" class="bg-gray-200 border-gray-400">Em andamento</button>';
const card=(id)=>`<li itemid="${id}"><button data-sidebar="menu-button"><div>Contato teste</div></button></li>`;
const modern=personal+`<div data-tutorial="customer-service-list"><div data-tutorial="customer-service-view-selector">Meus atendimentos</div><ul>${card('attendance-1')}${card('attendance-2')}</ul></div><div data-customer-service-id="attendance-1" data-protocol="OPA20261145"><div data-tutorial="chat-panel-reasons"><button polaris-label="btn-reason">Motivo do atendimento</button></div></div>`;
const legacy='<div class="item selected" data-id="chat"></div><div class="list"><button data-id="meus_atendimentos" class="selected_filtro_user_status"></button><div class="list_dados"><div class="chat" data-id="attendance-1"><div class="corpo"><span class="title">Empresa teste</span><span>OPA20261145</span></div></div></div></div>';
const item=(id,protocol,reasons=[])=>({_id:id,protocolo:protocol,id_cliente:null,id_user:{nome:'Contato teste'},motivos:reasons});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium',headless:true});
 try{
  for(const mode of ['legacy','modern']){
   const page=await browser.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://suporte.ixcsoft.com.br/**',route=>route.fulfill({contentType:'text/html',body:mode==='legacy'?legacy:modern}));
   await page.addInitScript({content:`
    window.clock = Date.now(); Date.now=()=>clock;
    window.timers=new Map(); let next=0;
    window.setTimeout=(fn,delay)=>{timers.set(++next,{fn,delay});return next;};window.clearTimeout=id=>timers.delete(id); window.setInterval=()=>0;window.clearInterval=()=>{};
    window.flushTimers=()=>{const callbacks=[...timers.values()];timers.clear();for(const {fn} of callbacks)fn();};
    window.sent=[];window.storage={motivoBlinkEnabled:false};
    window.chrome={storage:{local:{get:async()=>storage},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(fn){window.listener=fn;}},sendMessage:async msg=>{sent.push(msg);return {success:true};}}};
    window.scan=()=>new Promise(resolve=>listener({type:'BACKGROUND_ATTENDANCE_SCAN'},{},resolve));
    window.WebSocket=class {constructor(){window.socket=this;this.listeners={};}addEventListener(name,fn){this.listeners[name]=fn;}send(){} receive(data){this.listeners.message({data});}};
   `+fs.readFileSync(path.join(root,'content/queue-bridge.js'),'utf8')});
   await page.goto('https://suporte.ixcsoft.com.br/');
   if(mode==='modern'){
    // First list arrives before isolated content script: exercises replay.
    await page.evaluate(({EVENT,items})=>{new WebSocket('wss://suporte.ixcsoft.com.br/socket.io/');socket.receive('42'+JSON.stringify([EVENT,{items,page:1,hasMore:false}]));},{EVENT,items:[item('attendance-1','OPA20261145'),item('attendance-2','OPA20261146')]});
   }
   await page.addScriptTag({content:fs.readFileSync(path.join(root,'content/content.js'),'utf8')});
   await page.waitForTimeout(50);
   await page.evaluate(()=>scan());await page.evaluate(()=>{clock+=11000;});await page.evaluate(()=>scan());
   let scans=await page.evaluate(()=>sent.filter(m=>m.type==='ATTENDANCE_SCAN'));
   assert(scans.length>0,mode+': no snapshot');assert.equal(scans.at(-1).items.length,mode==='modern'?2:1);
   if(mode==='modern'){
    // Removing a virtualized row must not remove it from the queue snapshot.
    await page.locator('[itemid="attendance-2"]').evaluate(el=>el.remove());
    await page.evaluate(()=>{clock+=16000;});await page.evaluate(()=>scan());
    scans=await page.evaluate(()=>sent.filter(m=>m.type==='ATTENDANCE_SCAN'));assert.equal(scans.at(-1).items.length,2);
    // Both highlight and reason detection use metadata, not rendered protocols.
    await page.evaluate(()=>listener({type:'SET_HIGHLIGHTED_ATTENDANCE',protocol:'OPA20261145'},{},()=>{}));
    assert.equal(await page.locator('[itemid="attendance-1"].opa-notify-current-attendance').count(),1);
    await page.evaluate(()=>flushTimers());
    assert.equal(await page.locator('[polaris-label="btn-reason"].opa-notify-motivo-empty').count(),1);
    await page.locator('[data-tutorial="customer-service-list"] ul').evaluate((ul,markup)=>ul.insertAdjacentHTML('beforeend',markup),card('attendance-2'));
    await page.locator('[itemid="attendance-2"] > button').evaluate(el=>el.click());
    assert.equal(await page.locator('#opa-notify-motivo-switch-modal').count(),1);
    await page.locator('#opa-notify-motivo-switch-modal .back').evaluate(el=>el.click());
    // A reason update removes the empty-state highlight without changing the queue.
    await page.evaluate(()=>socket.receive('42'+JSON.stringify(['route-update',{_id:'attendance-1',motivos:['test-reason']}])));
    await page.waitForTimeout(30);await page.evaluate(()=>flushTimers());
    assert.equal(await page.locator('[polaris-label="btn-reason"].opa-notify-motivo-empty').count(),0);
    await page.locator('[itemid="attendance-2"] > button').evaluate(el=>el.click());
    assert.equal(await page.locator('#opa-notify-motivo-switch-modal').count(),0);
    // A partial response cannot be used as the whole queue.
    const count=scans.length;
    await page.evaluate(({EVENT,items})=>socket.receive('42'+JSON.stringify([EVENT,{items,page:1,hasMore:true}])),{EVENT,items:[item('attendance-1','OPA20261145')]});
    await page.waitForTimeout(30);await page.evaluate(()=>{clock+=16000;});await page.evaluate(()=>scan());
    assert.equal(await page.evaluate(()=>sent.filter(m=>m.type==='ATTENDANCE_SCAN').length),count);
    await page.evaluate(({EVENT,items})=>socket.receive('42'+JSON.stringify([EVENT,{items,page:2,hasMore:false}])),{EVENT,items:[item('attendance-2','OPA20261146',['reason'])]});
    await page.waitForTimeout(30);await page.evaluate(()=>scan());await page.evaluate(()=>{clock+=1000;});await page.evaluate(()=>scan());
    scans=await page.evaluate(()=>sent.filter(m=>m.type==='ATTENDANCE_SCAN'));assert.equal(scans.at(-1).items.length,2);
    // A different filter never produces a personal queue scan.
    await page.locator('[data-tutorial="customer-service-view-selector"]').evaluate(el=>el.textContent='Todos em andamento');
    const before=scans.length;await page.evaluate(()=>{clock+=16000;});await page.evaluate(()=>scan());
    assert.equal(await page.evaluate(()=>sent.filter(m=>m.type==='ATTENDANCE_SCAN').length),before);
   }
   assert.deepEqual(errors,[]);await page.close();console.log('PASS:',mode,'DOM integration');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
