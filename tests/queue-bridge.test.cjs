const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const EVENT='customer-services-ui:customer-service-queues:in-progress:list';
function setup(){
 const messages=[],handlers=new Map();let time=1000000,view='Meus atendimentos';
 class Socket {
  static OPEN=1;
  constructor(url){this.url=url;this.listeners=new Map();this.sent=[];this.readyState=1;}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  send(value){this.sent.push(value);}
  receive(value){this.listeners.get('message')({data:value});}
 }
 const window={postMessage:data=>messages.push(structuredClone(data)),addEventListener:(name,fn)=>handlers.set(name,fn)};
 const context=vm.createContext({window,document:{querySelector:selector=>selector.includes('view-selector')?{textContent:view}:selector.includes('queue-in-progress')?{getAttribute:()=>"true",classList:{contains:()=>true}}:null},Date:class extends Date{static now(){return time;}},location:{origin:'https://suporte.ixcsoft.com.br'},WebSocket:Socket});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../content/queue-bridge.js'),'utf8'),context);
 const socket=vm.runInContext("new WebSocket('wss://suporte.ixcsoft.com.br/socket.io/')",context);
 return {socket,messages,window,handlers,context,advance:ms=>{time+=ms;},setView:value=>{view=value;},refresh:(confirm=false)=>handlers.get('message')({source:window,origin:'https://suporte.ixcsoft.com.br',data:{source:'opa-notify-refresh-queue-v1',confirm}})};
}
test('Bridge observes list packets and only forwards minimal attendance metadata',()=>{
 const s=setup();
 const raw={_id:'attendance-1',protocolo:'OPA20261145',id_cliente:null,id_user:{nome:'Contato teste',whatsapp:'private'},token:'secret',lastMessage:{mensagem:'private'}};
 s.socket.receive('42'+JSON.stringify([EVENT,{items:[raw],page:1,hasMore:false}]));
 assert.deepEqual(s.messages.filter(m=>m.kind==='page'),[{source:'opa-notify-queue-v1',kind:'page',page:1,hasMore:false,view:'Meus atendimentos',items:[{id:'attendance-1',protocol:'OPA20261145',company:'Contato teste',tags:[],pinned:false,unread:false,cursor:null,activity:null}]}]);
 assert(s.socket instanceof vm.runInContext('WebSocket',s.context));
 assert.equal(vm.runInContext('WebSocket.OPEN',s.context),1);
});
test('Bridge preserves original sends, ignores unrelated/history packets and malformed data',()=>{
 const s=setup();
 for(const data of ['2','43[]','not json','42["other",{"token":"private"}]','42["'+EVENT+'",{}]'])s.socket.receive(data);
 assert.equal(s.messages.filter(m=>m.kind!=='diagnostic').length,0);
 const request='42'+JSON.stringify([EVENT,{preferences:{},page:1}]);
 s.socket.send(request);
 assert.deepEqual(s.socket.sent,[request]);
 assert(s.messages.some(m=>m.kind==='reset'));
});
test('Bridge replays sanitized initial pages when the isolated content script becomes ready',()=>{
 const s=setup();
 s.socket.receive('42'+JSON.stringify([EVENT,{items:[],page:1,hasMore:false}]));
 s.messages.length=0;
 s.handlers.get('message')({source:s.window,origin:'https://suporte.ixcsoft.com.br',data:{source:'opa-notify-content-ready-v1'}});
 assert.equal(s.messages.filter(m=>m.kind==='page').length,1);
 assert.equal(s.messages.filter(m=>m.kind==='diagnostic').length,1);
});

test('Queue diagnostics include only event names and counts, never payload content',()=>{
 const s=setup();
 s.socket.receive('42'+JSON.stringify(['customer-services-ui:customer-service-queues:in-progress:load-customer-services',[{_id:'private-id',token:'private-token',mensagem:'private-text'}]]));
 const diagnostic=s.messages.find(m=>m.kind==='diagnostic');assert.equal(diagnostic.count,1);
 assert(!JSON.stringify(diagnostic).includes('private-'));
});

const LOAD='customer-services-ui:customer-service-queues:in-progress:load-customer-services';
function prime(s){
 const load='42'+JSON.stringify([LOAD,{preferences:{owner:'private-filter'}}]);
 const list='42'+JSON.stringify([EVENT,{preferences:{owner:'private-filter'},page:1}]);
 s.socket.send(load);s.socket.send(list);
 s.socket.receive('42'+JSON.stringify([EVENT,{items:[],page:1,hasMore:false}]));
 return {load,list};
}
test('Refresh repeats the observed read pair without changing its parameters or switching views',()=>{
 const s=setup();const {load,list}=prime(s);s.advance(15000);s.refresh();
 assert.deepEqual(s.socket.sent,[load,list,load,list]);
 assert.equal(s.messages.filter(m=>m.kind==='diagnostic' && m.automatic).length,2);
 assert(!JSON.stringify(s.messages).includes('private-filter'));
});
test('Automatic queries are rate limited and disabled outside the personal queue',()=>{
 const s=setup();prime(s);s.refresh();assert.equal(s.socket.sent.length,2);
 s.advance(15000);s.setView('Todos em andamento');s.refresh();assert.equal(s.socket.sent.length,2);
 s.setView('Meus atendimentos');s.refresh();assert.equal(s.socket.sent.length,4);
 s.refresh();assert.equal(s.socket.sent.length,4);
});
test('No query is invented before capturing a complete personal query or after socket close',()=>{
 const s=setup();s.advance(15000);s.refresh();assert.equal(s.socket.sent.length,0);
 prime(s);s.socket.listeners.get('close')();s.advance(15000);s.refresh();assert.equal(s.socket.sent.length,2);
});
test('Requests with acknowledgement callbacks are not replayed',()=>{
 const s=setup();s.socket.send('420'+JSON.stringify([LOAD,{preferences:{}}]));s.socket.send('421'+JSON.stringify([EVENT,{page:1}]));
 s.socket.receive('42'+JSON.stringify([EVENT,{items:[],page:1,hasMore:false}]));s.advance(15000);s.refresh();assert.equal(s.socket.sent.length,2);
});

test('The observed load request may have no payload and is replayed unchanged',()=>{
 const s=setup();const load='42'+JSON.stringify([LOAD]);const list='42'+JSON.stringify([EVENT,{page:1}]);
 s.socket.send(load);s.socket.send(list);s.socket.receive('42'+JSON.stringify([EVENT,{items:[],page:1,hasMore:false}]));
 s.advance(15000);s.refresh();assert.deepEqual(s.socket.sent,[load,list,load,list]);
});

test('Departure confirmation may request a fresh snapshot before the regular poll interval',()=>{
 const s=setup();prime(s);s.advance(1000);s.refresh(true);assert.equal(s.socket.sent.length,2);
 s.advance(7000);s.refresh(true);assert.equal(s.socket.sent.length,4);
});

test('Client direction and distinct IDs survive the bridge without chat text or tag metadata', () => {
  const s = setup();
  const base = { _id: 'route', protocolo: 'OPA123456', tags: [{nome:'VIP',project:'secret'}] };
  for (const [i, extra] of [{}, { id_atend: {nome:'Agent'} }, {systemNoteMessage:true}, {systemMessage:true}].entries()) {
    const lastMessage = { _id:'msg'+i, tipoDestinatario:'usuarios', mensagem:'secret', ...extra };
    s.socket.receive('42'+JSON.stringify([EVENT,{page:1,hasMore:false,items:[{...base,lastMessage}]}]));
    const item = s.messages.filter(m=>m.kind==='page').at(-1).items[0];
    assert.deepEqual(item.tags,['VIP']);
    assert.deepEqual(item.cursor,{id:'msg'+i,text:i===0?'secret':'',incoming:i===0});
    assert(!JSON.stringify(item).includes('private-token'));
    assert(!JSON.stringify(item).includes('project'));
  }
});

test('Media previews replace file names in queue snapshots and direct message updates', () => {
  const s = setup();
  const cases = [
    [{tipo:'imagem', mensagem:'foto-pessoal.jpg'}, 'Enviou uma foto'],
    [{tipo:'áudio', mensagem:'voz-cliente.ogg'}, 'Enviou um áudio'],
    [{tipo:'video', mensagem:'video-cliente.mp4'}, 'Enviou um vídeo'],
    [{tipo:'arquivo', objeto:{mimetype:'image/png'}, mensagem:'documento-privado.png'}, 'Enviou uma foto'],
    [{tipo:'arquivo', mensagem:'https://example.com/segredo.m4a?token=private'}, 'Enviou um áudio'],
    [{tipo:'texto', mensagem:'Preciso abrir a foto.jpg'}, 'Preciso abrir a foto.jpg']
  ];
  for (const [index, [media, expected]] of cases.entries()) {
    const lastMessage = {_id:'media-'+index, tipoDestinatario:'usuarios', ...media};
    s.socket.receive('42'+JSON.stringify([EVENT,{page:1,hasMore:false,items:[{_id:'chat',lastMessage}]}]));
    const page = s.messages.filter(message => message.kind === 'page').at(-1);
    assert.equal(page.items[0].cursor.text, expected);
    s.socket.receive('42'+JSON.stringify(['message-update',{...lastMessage,id_rota:'chat'}]));
    const update = s.messages.filter(message => message.kind === 'message').at(-1);
    assert.equal(update.cursor.text, expected);
    if (index < 5) assert(!JSON.stringify(s.messages.slice(-3)).includes(media.mensagem));
  }
});

test('Bridge forwards only a dated real message and its response direction for inactivity', () => {
  const s = setup();
  const at = new Date(880000).toISOString();
  const base = { _id:'message-1', data:at, mensagem:'private conversation', token:'private token' };
  const cases = [
    [{...base,tipoDestinatario:'usuarios'}, {at:880000,waitingForCustomer:false}],
    [{...base,tipoDestinatario:'clientes_users',id_atend:{_id:'agent-private'}}, {at:880000,waitingForCustomer:true}],
    [{...base,tipoDestinatario:'usuarios',systemMessage:true}, null],
    [{...base,tipoDestinatario:'usuarios',data:'invalid'}, null]
  ];
  for (const [message, expected] of cases) {
    s.socket.receive('42'+JSON.stringify([EVENT,{page:1,hasMore:false,items:[{_id:'chat',lastMessage:message}]}]));
    const activity = s.messages.filter(m=>m.kind==='page').at(-1).items[0].activity;
    assert.deepEqual(activity,expected);
    assert(!JSON.stringify(activity).includes('private'));
  }
  s.socket.receive('42'+JSON.stringify([EVENT,{page:1,hasMore:false,items:[{_id:'chat',update:at,lastMessage:{_id:'no-date',tipoDestinatario:'usuarios'}}]}]));
  assert.deepEqual(s.messages.filter(m=>m.kind==='page').at(-1).items[0].activity,{at:880000,waitingForCustomer:false});
  s.socket.receive('42'+JSON.stringify(['message-update',{...base,tipoDestinatario:'usuarios',id_rota:'chat'}]));
  assert.deepEqual(s.messages.filter(m=>m.kind==='message').at(-1).activity,{at:880000,waitingForCustomer:false});
});
