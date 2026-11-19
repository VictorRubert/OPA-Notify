// Runs the installed content-script order against a synthetic Opa page.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const manifest = require('../manifest.json');
const html = `<main style="background:#f7f8fa">
<button data-tutorial="customer-service-queue-in-progress" data-active="true"></button>
<section data-tutorial="customer-service-list"><button data-tutorial="customer-service-view-selector">Meus atendimentos</button>
<div class="sidebar-scroll" style="height:300px;overflow:auto"><ul>
<li itemid="chat1" data-tag-names="AJUDA AGENTE SMITH"><button><div class="flex-col"><p class="font-medium">Empresa teste</p><div class="flex-wrap">AJUDA AGENTE SMITH</div></div></button></li>
</ul></div></section>
<div data-customer-service-id="chat1" data-protocol="OPA123" data-tag-names="AJUDA AGENTE SMITH">
<div data-tutorial="chat-panel-information"><div><p>Nesta fila</p><p>6 minutos</p></div></div>
<div data-message-id="m1" data-sender-type="contact" data-message-date="2026-11-19T12:00:00Z"><span class="whitespace-pre-wrap">Muito obrigado, deu certo!</span></div>
</div></main>`;
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium',headless:true});
 try {
  for (const origin of ['https://suporte.ixcsoft.com.br','https://opasuiteapi.ixcsoft.com.br']) {
   const page = await browser.newPage();
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route(origin+'/**', r=>r.fulfill({contentType:'text/html',body:html}));
   await page.addInitScript(() => {
    window.saved = {termostatoPendingEnabled:false,groupByTag:true};
    window.changes=[];window.runtimeListeners=[];
    window.chrome={runtime:{id:'notify-test',getManifest:()=>({version:'2.0.5'}),onMessage:{addListener:f=>runtimeListeners.push(f)},sendMessage:async()=>({success:true})},storage:{local:{
     get:(keys,cb)=>{const result=typeof keys==='string'?{[keys]:saved[keys]}:{...saved};if(cb){cb(result);return;}return Promise.resolve(result);},
     set:async values=>{const delta={};for(const [k,v] of Object.entries(values)){delta[k]={newValue:v};saved[k]=v;}changes.forEach(f=>f(delta,'local'));}
    },onChanged:{addListener:f=>changes.push(f)}}};
    window.menuOpens=0;window.markClicks=0;
    document.addEventListener('contextmenu',e=>{
     e.preventDefault();menuOpens++;
     if(window.disableDuringMenu) chrome.storage.local.set({termostatoPendingEnabled:false});
     const menu=document.createElement('div');menu.setAttribute('role','menu');menu.dataset.state='open';
     const button=document.createElement('button');button.setAttribute('role','menuitem');button.textContent='Pendência externa';
     button.onclick=()=>{markClicks++;menu.remove();const msg=document.createElement('div');msg.dataset.messageId='pending';msg.dataset.senderType='system';msg.dataset.messageDate=new Date().toISOString();msg.textContent='Atendente marcou pendência externa';document.querySelector('[data-customer-service-id]').append(msg);};
     menu.append(button);document.body.append(menu);
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('[role="menu"]')?.remove();});
   });
   await page.goto(origin+'/customer-service/in-progress');
   for(const entry of manifest.content_scripts.filter(e=>e.run_at==='document_idle')) {
    for(const css of entry.css||[]) await page.addStyleTag({path:path.join(root,css)});
    for(const js of entry.js) await page.addScriptTag({path:path.join(root,js)});
   }
   await page.waitForSelector('.ixc-selo');
   await page.evaluate(()=>window.postMessage({source:'opa-notify-queue-v1',kind:'page',view:'Meus atendimentos',page:1,hasMore:false,items:[{id:'chat1',protocol:'OPA123456',company:'Empresa teste',tags:['AJUDA AGENTE SMITH'],activity:{at:Date.now()-14*60000,waitingForCustomer:true}}]},location.origin));
   await page.waitForSelector('.opa-notify-client-status .opa-notify-inactivity-tag');
   const moodBox = await page.locator('.ixc-selo').boundingBox();
   const inactivityBox = await page.locator('.opa-notify-inactivity-tag').boundingBox();
   assert(inactivityBox.x >= moodBox.x + moodBox.width, 'inactivity must be to the right of emoji');
   assert(Math.abs((inactivityBox.y+inactivityBox.height/2)-(moodBox.y+moodBox.height/2)) < 2, 'same row');
   assert.equal(await page.evaluate(()=>IXCOpa.VERSAO),'2.22.0');
   const status = value => page.evaluate(value => new Promise(resolve => runtimeListeners.find(fn => fn({type:'TERMOFY_STATUS_COMMAND',value},{},resolve) === true)),value);
   for(const [level,category] of [[0,'desconhecido'],[1,'furioso'],[2,'bravo'],[3,'neutro'],[4,'satisfeito'],[5,'encantado']]) {
    assert.equal((await status(String(level))).success,true);
    assert.equal(await page.locator('[itemid="chat1"] .ixc-selo').getAttribute('data-categoria'),category);
    assert.equal(await page.evaluate(()=>Object.keys(saved.termofyMoodOverrides).join(',')),'chat1');
   }
   // A different open conversation must receive its own override only.
   await page.evaluate(()=>{
    document.querySelector('[data-customer-service-id]').dataset.customerServiceId='chat2';
    const card=document.querySelector('[itemid="chat1"]').cloneNode(true);
    card.setAttribute('itemid','chat2');card.querySelector('.ixc-selo')?.remove();
    document.querySelector('[data-tutorial="customer-service-list"] ul').append(card);
   });
   assert.equal((await status('1')).success,true);
   assert.equal(await page.locator('[itemid="chat2"] .ixc-selo').getAttribute('data-categoria'),'furioso');
   assert.equal(await page.locator('[itemid="chat1"] .ixc-selo').getAttribute('data-categoria'),'encantado');
   assert.equal((await status('read')).success,true);
   assert.equal(await page.evaluate(()=>Object.keys(saved.termofyMoodOverrides).join(',')),'chat1');
   assert.equal(await page.locator('[itemid="chat1"] .ixc-selo').getAttribute('data-categoria'),'encantado');
   await page.evaluate(()=>{document.querySelector('[data-customer-service-id]').dataset.customerServiceId='chat1';document.querySelector('[itemid="chat2"]').remove();});
   assert.equal((await status('read')).success,true);
   assert.equal(await page.locator('[itemid="chat1"] .ixc-selo').getAttribute('data-categoria'),'satisfeito');

   assert.equal(await page.evaluate(()=>menuOpens),0,'saved pending=false must prevent startup action');
   assert.equal(await page.locator('.ixc-selo').getAttribute('data-categoria'),'satisfeito');
   await page.waitForSelector('.opa-groups-head');
   await page.locator('.opa-groups-head').first().click();
   await page.locator('.opa-groups-head').first().click();
   assert.equal(await page.locator('.ixc-selo').count(),1,'folding must preserve one original badge');
   await page.evaluate(()=>document.querySelector('main').style.background='#202536');
   await page.waitForFunction(()=>document.querySelector('[data-opa-groups-theme="dark"]'));
   await page.locator('.ixc-selo').hover();
   assert.match(await page.locator('.ixc-selo__tooltip').innerText(),/2\.22\.0/);
   await page.evaluate(()=>chrome.storage.local.set({termostatoHumorEnabled:false}));
   assert.equal(await page.locator('.ixc-selo').count(),0);
   assert.equal(await page.locator('.opa-notify-inactivity-tag').count(),1);
   await page.evaluate(()=>chrome.storage.local.set({termostatoHumorEnabled:true}));
   await page.waitForSelector('.ixc-selo');
   await page.evaluate(()=>chrome.storage.local.set({termostatoPendingEnabled:true}));
   await page.waitForFunction(()=>markClicks===1);
   await page.waitForTimeout(2000);
   assert.equal(await page.evaluate(()=>markClicks),1,'never toggle an already marked attendance');
   await page.evaluate(()=>chrome.storage.local.set({enabled:false}));
   assert.equal(await page.locator('.ixc-selo').count(),0);
   assert.equal(await page.evaluate(()=>IXCOpa.CONFIG.PENDENCIA_ATIVA),false);
   await page.evaluate(()=>chrome.storage.local.set({enabled:true,termostatoEnabled:false}));
   assert.equal(await page.locator('.ixc-selo').count(),0);
   await page.evaluate(()=>chrome.storage.local.set({termostatoEnabled:true}));
   await page.waitForSelector('.ixc-selo');
   // Disable while the original async menu lookup is in flight.
   await page.evaluate(()=>{
    window.disableDuringMenu=true;
    document.querySelector('[data-message-id="pending"]').remove();
    document.querySelector('[data-customer-service-id]').dataset.customerServiceId='chat2';
    document.querySelector('[itemid]').setAttribute('itemid','chat2');
    IXCOpa.pendencia.check('test-disable-during-menu');
   });
   await page.waitForFunction(()=>menuOpens===2);
   await page.waitForTimeout(500);
   assert.equal(await page.evaluate(()=>markClicks),1,'disable must prevent pending menu click');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('Termostato: startup preferences, independent controls, native groups/themes, automatic mark and master disable passed on both hosts.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
