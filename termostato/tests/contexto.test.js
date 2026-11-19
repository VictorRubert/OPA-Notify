const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H=IXCOpa.humor; const S=(t,seq=true)=>({texto:t,emSequencia:seq});
const grupos = {
 'Confirmações curtas (o caso relatado)': [
  [['beleza, funciona'], 'satisfeito|neutro'],
  [[S('ainda não funciona',false), S('beleza, funciona')], 'satisfeito|neutro'],
  [[S('o boleto não aparece',false), S('show, apareceu sim')], 'satisfeito|neutro'],
  [[S('caiu de novo',false), S('top, voltou')], 'satisfeito|neutro'],
  [[S('não funcionou',false), S('ok, funcionando')], 'satisfeito|neutro'],
 ],
 'Explicação de cenário = relato, neutro (v2.16)': [
  [['Quando eu clico em gerar boleto aparece erro de conexão'], 'neutro'],
  [['Se o cliente não pagar ele fica bloqueado e sem acesso, certo?'], 'neutro'],
  [['O cliente ligou dizendo que a internet caiu e que ficou sem acesso desde ontem, queria entender o que aconteceu'], 'neutro'],
  [['Por exemplo, o contrato fica parado e não funciona a cobrança'], 'neutro'],
 ],
 'CAPS sem contexto não é alerta': [
  [['QUANDO VÃO RESOLVER ISSO?'], 'neutro'],
  [['OK, OBRIGADO PELA AJUDA'], 'satisfeito'],
  [['BOM DIA, PRECISO GERAR UM BOLETO'], 'neutro|desconhecido'],
  [[S('BOM DIA',false), S('ESTAMOS SEM ACESSO'), S('PODEM VERIFICAR?')], 'neutro'],
 ],
 'CAPS com reclamação continua alerta': [
  [['ESTOU SEM SISTEMA DESDE ONTEM!!'], 'estressado'],
  [['ISSO É UM ABSURDO'], 'estressado'],
  [['NÃO FUNCIONA DE NOVO, ESTOU COM PREJUÍZO'], 'estressado'],
 ],
 'Sarcasmo de verdade continua sendo pego': [
  [['Ótimo, caiu de novo'], 'estressado'],
  [[S('não funcionou de novo',false), S('ótimo')], 'estressado'],
  [['Perfeito 🙄'], 'estressado'],
  [['Resolveu sim, só que não'], 'estressado'],
 ],
};
let ok=0,total=0;
for (const [g,casos] of Object.entries(grupos)) { console.log('\n'+g);
 for (const [e,esp] of casos){ const r=H.analisarTextos(e); total++; const pass=esp.split('|').includes(r.categoria); ok+=pass;
  const ult=r.detalhes[r.detalhes.length-1];
  console.log(' ',pass?'✔':'✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e.map(x=>x.texto||x)).slice(0,66).padEnd(66), ult.sinais.join(' · ').slice(0,100));}}
console.log(`\n${ok}/${total}`);
