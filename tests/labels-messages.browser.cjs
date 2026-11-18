// Synthetic Opa pages. Exercises real DOM controls and the extension's script entry points.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const origin = 'https://suporte.ixcsoft.com.br';
const queueEvent = 'customer-services-ui:customer-service-queues:in-progress:list';
const company = 'Empresa de teste';
const item = (n, tags = []) => ({
  _id: 'chat-' + n, protocolo: 'OPA10000' + n, id_cliente: { nome: company + n },
  tags: tags.map(nome => ({ nome })), motivos: [], lastMessage: { _id: 'old' + n }
});
const legacyChat = (i, tags) => '<div><div class="chat" data-id="chat-' + i + '"><div class="corpo"><span class="title">' + company + i + '</span><span>OPA10000' + i + '</span><div class="tags">' + tags.map(t => '<span class="tag">' + t + '</span>').join('') + '</div></div></div></div>';
const card = i => '<li itemid="chat-' + i + '"><button><p class="font-medium">' + company + i + '</p></button></li>';
const rows = [item(1, ['A', 'VIP']), item(2, ['B'])];
const legacy = '<div class="item selected" data-id="chat"></div><div class="list"><button data-id="meus_atendimentos" class="selected_filtro_user_status"></button><div class="list_dados">' + legacyChat(1, ['A','VIP']) + legacyChat(2, ['B']) + '</div></div>';
const modern = '<button data-tutorial="customer-service-queue-in-progress" data-active="true"></button><section data-tutorial="customer-service-list"><button data-tutorial="customer-service-view-selector">Meus atendimentos</button><div style="height:400px"><div class="sidebar-scroll" style="height:100%;overflow:auto"><ul>' + card(1) + card(2) + '</ul></div></div></section>';

async function queue(page, items) {
  await page.evaluate(({ event, items }) => socket.receive('42' + JSON.stringify([event, { items, page: 1, hasMore: false }])), { event: queueEvent, items });
  await page.waitForTimeout(80);
}

async function inactivityBadge(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(origin + '/**', route => route.fulfill({contentType:'text/html',body:modern}));
  await page.addInitScript(() => {
    window.chrome = {
      storage:{local:{get:async()=>({enabled:true,groupByTag:false,notifyClientMessages:false})},onChanged:{addListener(){}}},
      runtime:{onMessage:{addListener(){}},sendMessage:async()=>({success:true})}
    };
    window.WebSocket = class {
      constructor(){this.handlers={};}
      send(){}
      addEventListener(name,handler){this.handlers[name]=handler;}
      receive(data){this.handlers.message({data});}
    };
  });
  await page.goto(origin);
  for (const file of ['queue-bridge','tag-settings','groups','content']) await page.addScriptTag({path:path.join(root,'content',file+'.js')});
  await page.evaluate(() => {window.socket = new WebSocket();});
  const timestamp = minutes => new Date(Date.now()-minutes*60000).toISOString();
  await queue(page,[{...rows[0],lastMessage:{_id:'sent',tipoDestinatario:'clientes_users',data:timestamp(90)}},rows[1]]);
  const badge = page.locator('[itemid="chat-1"] .opa-notify-inactivity-tag');
  await badge.waitFor();
  assert.equal(await badge.innerText(),'Aguardando cliente há 1h 30min');
  assert.equal(await badge.getAttribute('data-state'),'customer');
  assert.equal(await badge.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(180, 83, 9)');
  await page.evaluate(data => socket.receive('42'+JSON.stringify(['message-update',data])),
    {_id:'received',id_rota:'chat-1',tipoDestinatario:'usuarios',data:timestamp(58)});
  await page.waitForFunction(() => document.querySelector('[itemid="chat-1"] .opa-notify-inactivity-tag')?.dataset.state === 'agent');
  assert.equal(await badge.innerText(),'Sem resposta há 58min');
  assert.equal(await badge.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(185, 28, 28)');
  await queue(page,[{...rows[0],lastMessage:{_id:'system',tipoDestinatario:'clientes_users',data:timestamp(2),systemMessage:true}},rows[1]]);
  assert.equal(await badge.count(),0);
  assert.equal(await page.locator('[itemid="chat-2"] .opa-notify-inactivity-tag').count(),0);
  assert.deepEqual(errors,[]);
  await page.close();
}

async function run(browser, modernUI) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.route(origin + '/**', r => r.fulfill({ contentType:'text/html', body: modernUI ? modern : legacy }));
  await page.addInitScript(() => {
    window.settings = { groupByTag: true, priorityTags: ['VIP'], tagMode:'exclude', groupTags: ['B'] };
    window.sent = [];
    window.chrome = {
      storage: { local: { get: async () => settings }, onChanged: { addListener(fn) { window.changed = fn; } } },
      runtime: { onMessage: { addListener(fn) { window.listener = fn; } }, sendMessage: async m => { sent.push(m); return {success:true}; } }
    };
    window.call = m => new Promise(resolve => listener(m, {}, resolve));
    window.WebSocket = class {
      constructor() { this.handlers = {}; }
      send() {}
      addEventListener(k, fn) { this.handlers[k] = fn; }
      receive(data) { this.handlers.message({data}); }
    };
  });
  await page.goto(origin);
  for (const file of ['queue-bridge','tag-settings','groups','content']) await page.addScriptTag({path:path.join(root,'content',file+'.js')});
  if (modernUI) {
    await page.evaluate(() => { window.socket = new WebSocket(); });
    await queue(page, rows);
  }
  await page.evaluate(() => call({type:'BACKGROUND_ATTENDANCE_SCAN'}));
  const head = page.getByRole('button', {name: /VIP \(1\)/});
  await head.waitFor();
  if (modernUI) {
    await queue(page,[{...rows[0],lastMessage:{_id:'old1',tipoDestinatario:'clientes_users',data:new Date(Date.now()-20*60000).toISOString()}},rows[1]]);
    assert.equal(await page.locator('[itemid="chat-1"] .opa-notify-inactivity-tag').getAttribute('data-state'),'customer');
  }
  assert((await page.locator('.opa-groups-head').allTextContents()).some(x => x.includes('Sem grupo')));
  assert.equal(await page.getByRole('button', { name:'A (1)', exact:true }).locator('.opa-groups-count').innerText(),'1');
  await head.click();
  assert.equal(await head.getAttribute('aria-expanded'), 'false');
  const count = () => page.evaluate(() => sent.filter(m => m.type === 'CLIENT_MESSAGE').length);
  assert.equal(await count(), 0);

  if (modernUI) {
    const incoming = { _id:'customer-1', mensagem:'Olá, preciso de ajuda', tipoDestinatario:'usuarios', statusEnvio:{status:'sent'} };
    await page.locator('[data-tutorial=customer-service-list]').evaluate(el => el.insertAdjacentHTML('afterend', '<div data-customer-service-id=chat-1 data-protocol=OPA100001></div>'));
    const changed = [{ ...rows[0], lastMessage: incoming }, rows[1]];
    await queue(page, changed);
    assert.equal(await count(), 0);
    await page.locator('[data-customer-service-id=chat-1]').evaluate(el=>el.remove());
    const next = [{ ...rows[0], lastMessage: { ...incoming, _id:'customer-next' } }, rows[1]];
    await queue(page, next);
    assert.equal(await count(), 1);
    await queue(page, next);
    assert.equal(await page.evaluate(()=>sent.find(m=>m.type==='CLIENT_MESSAGE').text),'Olá, preciso de ajuda');
    await page.evaluate(data => socket.receive('42' + JSON.stringify(['message-update', data])), { ...incoming, _id:'customer-2', id_rota:'chat-1' });
    await page.waitForTimeout(60);
    assert.equal(await count(), 2);
    await queue(page, [{...rows[0],lastMessage:{...incoming,_id:'note',systemNoteMessage:true}},rows[1]]);
    assert.equal(await count(), 2);
    await queue(page, [{...rows[0],lastMessage:{...incoming,_id:'media',tipo:'audio',mensagem:'arquivo-privado.ogg'}},rows[1]]);
    assert.equal(await count(), 3);
    assert.equal(await page.evaluate(() => sent.filter(m=>m.type==='CLIENT_MESSAGE').at(-1).text),'Enviou um áudio');
    // A visible company missing from repeated complete snapshots emits exactly one positive signal.
    await page.locator('ul').evaluate((node, row) => node.insertAdjacentHTML('beforeend',row),card(3));
    await page.waitForFunction(() => sent.some(m => m.type === 'VISIBLE_ARRIVAL'));
    assert.equal(await page.evaluate(() => sent.find(m => m.type === 'VISIBLE_ARRIVAL').attendance.company),company+3);
    await queue(page,rows);
    assert.equal(await page.evaluate(() => sent.filter(m => m.type === 'VISIBLE_ARRIVAL').length),1);
    await queue(page,[...rows,item(3)]);
    assert.equal(await page.getByRole('button',{name:'Voltar à lista do Opa'}).count(),0);
  } else {
    await page.locator('.chat').first().evaluate(el=>{el.classList.add('selected');const b=document.createElement('b');b.className='notifica piscar';b.textContent='1';el.append(b);});
    await page.evaluate(()=>call({type:'BACKGROUND_ATTENDANCE_SCAN'}));
    assert.equal(await count(),0);
    await page.locator('.chat').first().evaluate(el=>{el.classList.remove('selected');el.querySelector('.notifica').textContent='2';});
    await page.evaluate(()=>call({type:'BACKGROUND_ATTENDANCE_SCAN'}));
    await page.waitForFunction(()=> sent.some(m=>m.type==='CLIENT_MESSAGE'));
    assert.equal(await count(),1);
    assert((await head.textContent()).includes('●'));
    assert.equal(await page.locator('.chat').first().isVisible(),false);
  }
  const target = modernUI ? '[itemid="chat-1"] button' : '.chat[data-id="chat-1"] .corpo';
  await page.locator(target).evaluate(el => el.onclick = () => window.opened = 'chat-1');
  const alert = { type:'SHOW_ATTENDANCE_EVENT', eventType:'message', attendance:{id:'chat-1',company,protocol:'OPA100001',messageText:'Olá, preciso de ajuda'} };
  await page.evaluate(m => call(m),alert);
  const messageCard = page.locator('.toast.message').first();
  assert.equal(await messageCard.locator('.heading').innerText(),company);
  assert.equal(await messageCard.locator('.company').count(),0);
  assert.equal(await messageCard.locator('.protocol').count(),0);
  assert.equal(await messageCard.locator('.message-text').innerText(),'Olá, preciso de ajuda');
  assert.equal(await messageCard.locator('.message-text').evaluate(el=>getComputedStyle(el).fontSize),'11px');
  assert.equal(await messageCard.evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb(69, 155, 245)');
  await messageCard.click();
  assert.equal(await page.evaluate(()=>window.opened),'chat-1');
  assert.equal(await head.getAttribute('aria-expanded'),'true');
  await page.evaluate(m=>call(m),{...alert,sourceTabId:42});
  await page.locator('.toast').first().click();
  assert(await page.evaluate(()=>sent.some(m=>m.type==='OPEN_SOURCE_ATTENDANCE' && m.sourceTabId===42 && m.attendance.id==='chat-1')));
  await page.evaluate(()=>changed({groupByTag:{newValue:false},notifyClientMessages:{newValue:false}},'local'));
  assert.equal(await page.locator('.opa-groups-head').count(),0);
  if (modernUI) await queue(page,[{...rows[0],lastMessage:{_id:'off',tipoDestinatario:'usuarios'}},rows[1]]);
  assert.equal(await count(),modernUI?3:1);
  if (modernUI) {
    await page.evaluate(()=>changed({notifyClientMessages:{newValue:true}},'local'));
    await queue(page,[{...rows[0],lastMessage:{_id:'first-after-enable',tipoDestinatario:'usuarios'}},rows[1]]);
    assert.equal(await count(),4);
  }
  assert.equal(await page.locator(target).isVisible(),true);
  assert.deepEqual(errors,[]);
  await page.close();
}

async function virtualCards(browser) {
  const page = await browser.newPage({viewport:{width:390,height:540}});
  await page.setContent(`
    <style>
      *{box-sizing:border-box} body{margin:0;background:#1f2430;color:#edf2fa;font:13px Arial,sans-serif}
      section{height:500px;width:370px;display:flex;flex-direction:column}.column{flex:1;min-height:0}
      .frame,.sidebar-scroll{height:100%}.sidebar-scroll{overflow:auto}ul{position:relative;margin:0;padding:0}
      .sidebar-scroll::-webkit-scrollbar{width:6px}
      .sidebar-scroll::-webkit-scrollbar-track{background:transparent}
      .sidebar-scroll::-webkit-scrollbar-thumb{background:#424858;border-radius:6px}
      [data-index]{position:absolute;left:0;top:0;width:100%}[itemid]{display:flex;align-items:center;gap:10px;height:72px;padding:8px;border-bottom:1px solid #49505b;background:#293243}
      [itemid] button{font:inherit;background:none;border:none;color:inherit}small{color:#95a5bd}
    </style>
    <section><p>Meus atendimentos</p><div class="column"><div class="frame"><div class="sidebar-scroll"><ul style="height:1728px"></ul></div></div></div></section>
  `);
  await page.addScriptTag({path:path.join(root,'content/tag-settings.js')});
  await page.addScriptTag({path:path.join(root,'content','groups.js')});
  await page.evaluate(() => {
    const ul = document.querySelector('ul');
    const scroller = document.querySelector('.sidebar-scroll');
    window.groups = new OpaNotifyGroups();
    window.grouping = false;
    window.renderNative = () => {
      const start = Math.floor(scroller.scrollTop / 72);
      const end = Math.min(24, Math.ceil((scroller.scrollTop + scroller.clientHeight) / 72));
      for (const row of ul.querySelectorAll('[data-index]')) {
        if (+row.dataset.index < start || +row.dataset.index >= end) row.remove();
      }
      for (let i = start; i < end; i++) {
        if (ul.querySelector('[data-index="' + i + '"]')) continue;
        const row = document.createElement('div');
        row.dataset.index = i;
        row.style.transform = 'translateY(' + i * 72 + 'px)';
        const card = document.createElement('li');
        card.setAttribute('itemid','service-'+i);
        card.innerHTML = '<b>TS</b><div><strong>Telecom '+(i+1)+'</strong><br><small>Você: mensagem de teste</small></div><button>Menu</button>';
        card.onclick = () => window.opened = i;
        card.querySelector('button').onclick = event => { event.stopPropagation(); window.menu = i; };
        row.append(card);
        ul.append(row);
      }
      if (grouping) {
        const rows = [...ul.querySelectorAll('[data-index]')].map(node => {
          const i = Number(node.dataset.index);
          const tags = i % 3 ? ['Assumido'] : ['Ajudando', 'Assumido', 'Outras'];
          return {id:'service-'+i,node,tags};
        });
        groups.update(document.querySelector('section'),rows,{priorityTags:['Ajudando','Assumido'],groupTags:[],tagMode:'exclude'},true);
      }
    };
    renderNative();
    new ResizeObserver(renderNative).observe(scroller);
    scroller.addEventListener('scroll',renderNative);
    window.originalCard = ul.querySelector('[itemid]');
  });
  const scrollbar = locator => locator.evaluate(el => ({
    width: getComputedStyle(el,'::-webkit-scrollbar').width,
    track: getComputedStyle(el,'::-webkit-scrollbar-track').backgroundColor,
    thumb: getComputedStyle(el,'::-webkit-scrollbar-thumb').backgroundColor,
    radius: getComputedStyle(el,'::-webkit-scrollbar-thumb').borderRadius
  }));
  const nativeScrollbar = await scrollbar(page.locator('.frame > .sidebar-scroll'));
  assert.equal(nativeScrollbar.width,'6px');
  assert(await page.locator('[itemid]').count() < 24);
  await page.evaluate(()=>{grouping=true;renderNative();});
  const parent = page.getByRole('button',{name:'Ajudando (8)',exact:true});
  await parent.waitFor();
  assert.deepEqual(await scrollbar(page.locator('.opa-groups-viewport')),nativeScrollbar);
  assert.equal(await page.locator('[itemid]').count(),24);
  assert.equal(await page.evaluate(()=>originalCard === document.querySelector('[itemid="service-0"]')),true);
  const nested = page.getByRole('button',{name:'Assumido (8)',exact:true});
  const other = page.getByRole('button',{name:'Assumido (16)',exact:true});
  const geometry = locator => locator.boundingBox();
  assert((await geometry(parent)).y < (await geometry(nested)).y);
  assert((await geometry(nested)).y < (await geometry(page.locator('[itemid="service-0"]'))).y);
  assert((await geometry(page.locator('[itemid="service-21"]'))).y < (await geometry(other)).y);
  await parent.click();
  assert.equal(await page.locator('[itemid="service-0"]').isVisible(),false);
  assert.equal(await page.locator('[itemid="service-0"]').evaluate(el=>el.offsetHeight),72);
  // Some native previews opt into visibility on a descendant. They must not
  // paint over the following header even while the virtualizer measures them.
  const before = await page.locator('.column').screenshot();
  await page.addStyleTag({content:'.opa-groups-hidden small {visibility:visible!important;background:magenta!important;color:white!important}'});
  assert((await page.locator('.column').screenshot()).equals(before));
  assert.equal(await page.locator('.opa-groups-hidden:not([inert])').count(),0);
  await other.click();
  await page.waitForFunction(()=>document.querySelector('.column').scrollHeight <= document.querySelector('.column').clientHeight + 1);
  await page.evaluate(()=>groups.reveal('service-21'));
  await page.locator('[itemid="service-21"] button').click();
  assert.equal(await page.evaluate(()=>window.menu),21);
  await page.locator('[itemid="service-21"] strong').click();
  assert.equal(await page.evaluate(()=>window.opened),21);
  await page.evaluate(()=>{grouping=false;groups.clear();});
  await page.waitForFunction(()=>document.querySelectorAll('[itemid]').length<24);
  assert.equal(await page.locator('.opa-groups-head').count(),0);
  assert.equal(await page.locator('.column.sidebar-scroll').count(),0);
  assert.deepEqual(await scrollbar(page.locator('.frame > .sidebar-scroll')),nativeScrollbar);
  assert.equal(await page.locator('ul').evaluate(el=>el.style.height),'1728px');
  assert.equal(await page.locator('[class*="opa-groups-"]').count(),0);
  await page.close();
}

async function statusOrder(browser) {
  const page = await browser.newPage();
  await page.setContent('<main></main>');
  for (const file of ['tag-settings','groups']) await page.addScriptTag({path:path.join(root,'content',file+'.js')});
  const order = await page.evaluate(() => {
    const list = document.querySelector('main');
    const rows = [['VIP'], ['ASSUMIDO AGENTE SMITH'], ['PAUSA AGENTE SMITH'], ['ajudando Agente Smith','ASSUMIDO AGENTE SMITH'],
      ['FINALIZADO AGENTE SMITH'], ['AJUDA AGENTE SMITH'], ['AJUDA OUTRO AGENTE']].map((tags,i) => {
      const node = list.appendChild(document.createElement('div'));
      node.textContent = 'Atendimento ' + i;
      return {id:String(i),node,tags,pinned:i===1};
    });
    new OpaNotifyGroups().update(list, rows, OpaTagSettings.defaults, false);
    return [...list.querySelectorAll('.opa-groups-head:not([data-subgroup])')].sort((a,b)=>a.offsetTop-b.offsetTop)
      .map(head=>head.querySelector('.opa-groups-name').textContent);
  });
  assert.deepEqual(order,['AJUDA AGENTE SMITH','FINALIZADO AGENTE SMITH','ajudando Agente Smith','PAUSA AGENTE SMITH','ASSUMIDO AGENTE SMITH','Sem grupo']);
  await page.close();
}

async function popup(browser) {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.chrome = {
      storage: {local: {
        get: async () => JSON.parse(localStorage.settings || '{}'),
        set: async values => { localStorage.settings = JSON.stringify({...JSON.parse(localStorage.settings || '{}'), ...values}); }
      }},
      runtime: {sendMessage:async () => ({success:true,history:[]})}
    };
  });
  await page.route('https://popup.example/**', route => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (name === 'content/tag-settings.js') return route.fulfill({path:path.join(root,name)});
    if (!['popup.html','popup.css','popup.js'].includes(name)) return route.abort();
    return route.fulfill({path:path.join(root,'popup',name)});
  });
  await page.goto('https://popup.example/popup.html');
  const preset = ['AJUDA','FINALIZADO','AJUDANDO','PAUSA','ASSUMIDO'].map(status => status+' AGENTE SMITH');
  const selected = ['ASSUMIDO','AJUDA','PAUSA','FINALIZADO','AJUDANDO'].map(status => status+' AGENTE SMITH');
  assert.equal(await page.locator('#groupByTag').isChecked(),false);
  assert.equal(await page.locator('#groupOptions').isVisible(),false);
  await page.getByText('Agrupar por etiqueta',{exact:true}).click();
  assert.deepEqual(await page.locator('#priorityTags li span').allTextContents(),preset);
  assert.deepEqual(await page.locator('#groupTags li span').allTextContents(),selected);
  assert.equal(await page.locator('#tagMode').inputValue(),'include');
  assert.equal(await page.locator('#notifyClientMessages').isChecked(),true);
  assert.equal(await page.locator('#messageScope').inputValue(),'all');
  await page.selectOption('#messageScope','priority');
  assert(await page.locator('#priorityArea').isVisible());
  for (const tag of ['A','VIP']) {
    await page.fill('#priorityTagName',tag);
    await page.locator('#priorityTagForm button').click();
  }
  await page.getByRole('button',{name:'Subir VIP'}).click();
  await page.selectOption('#tagMode','include');
  await page.fill('#groupTagName','VIP');
  await page.locator('#groupTagForm button').click();
  await page.reload();
  assert.deepEqual(await page.locator('#priorityTags li span').allTextContents(),[...preset,'VIP','A']);
  assert.deepEqual(await page.locator('#groupTags li span').allTextContents(),[...selected,'VIP']);
  assert.equal(await page.locator('#tagMode').inputValue(),'include');
  await page.getByRole('button',{name:'Remover A',exact:true}).click();
  await page.getByText('Agrupar por etiqueta',{exact:true}).click();
  assert(await page.locator('#priorityArea').isVisible());
  await page.getByText('Avisar novas mensagens do cliente',{exact:true}).click();
  assert.equal(await page.locator('#priorityArea').isVisible(),false);
  assert.equal(await page.locator('#groupOptions').isVisible(),false);
  await page.reload();
  assert.equal(await page.locator('#notifyClientMessages').isChecked(),false);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium',headless:true});
  try {
    await inactivityBadge(browser);
    await virtualCards(browser);
    await statusOrder(browser);
    await popup(browser);
    await run(browser,false);
    await run(browser,true);
    console.log('PASS: legacy and modern grouping, unread transitions, click navigation, independent switches and visible arrival.');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode=1; });
