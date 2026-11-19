const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H=IXCOpa.humor; const S=(t,seq=true)=>({texto:t,emSequencia:seq});
const casos = [
 // "bom" não é satisfação
 [['bom'], 'neutro'],
 [['Bom, vou testar aqui'], 'neutro'],
 [['bom dia'], 'neutro'],
 [['muito bom, obrigado'], 'satisfeito|encantado'],
 // insistência / prazo
 [['ainda não há nenhum prazo?'], 'estressado'],
 [['Nenhuma previsão ainda?'], 'estressado'],
 [['até quando vou ter que esperar?'], 'estressado'],
 [['e aí, nada ainda?'], 'estressado'],
 [['qual o prazo para a correção?'], 'neutro'],
 // vários "?"
 [['????????'], 'estressado'],
 [['???'], 'estressado'],
 [['Conseguiu ver???'], 'neutro|desconhecido'], // v2.22: "???" no fim da frase não pesa sozinho
 [['?'], 'neutro'],
 // cobrança repetida (o atendente não respondeu no meio)
 [[S('algum retorno?',false), S('?'), S('alguma novidade?')], 'estressado'],
 [[S('preciso gerar o boleto',false), S('algum retorno?')], 'neutro'],
];
let ok=0;
for (const [e,esp] of casos){ const r=H.analisarTextos(e); const pass=esp.split('|').includes(r.categoria); ok+=pass;
 const u=r.detalhes[r.detalhes.length-1];
 console.log(pass?'✔':'✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e.map(x=>x.texto||x)).slice(0,58).padEnd(58), u.sinais.join(' · ').slice(0,90));}
console.log(`${ok}/${casos.length}`);
