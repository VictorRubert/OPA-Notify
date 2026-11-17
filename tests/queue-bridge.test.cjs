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
 const raw={_id:'attendance-1',protocolo:'OPA20261145',id_cliente:null,id_user:{nome:'Contato teste',whatsapp:'private'},motivos:[],token:'secret',lastMessage:{mensagem:'private'}};
 s.socket.receive('42'+JSON.stringify([EVENT,{items:[raw],page:1,hasMore:false}]));
 assert.deepEqual(s.messages.filter(m=>m.kind==='page'),[{source:'opa-notify-queue-v1',kind:'page',page:1,hasMore:false,view:'Meus atendimentos',items:[{id:'attendance-1',protocol:'OPA20261145',company:'Contato teste',reasons:0}]}]);
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
