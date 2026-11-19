const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
// O cliente pedindo desculpas pela PRÓPRIA demora/erro não é estresse.
const casos = [
  [['perdão pela demora'], 'neutro|satisfeito'],
  [['desculpa a demora'], 'neutro|satisfeito'],
  [['desculpe pela demora em responder'], 'neutro|satisfeito'],
  [['foi mal a demora'], 'neutro|satisfeito'],
  [['Perdão pela demora, estava em reunião. Vou testar agora'], 'neutro|satisfeito'],
  [['desculpa, demorei'], 'neutro|satisfeito'],
  [['me desculpe pelo atraso no retorno'], 'neutro|satisfeito'],
  [['desculpa a confusão, errei o contrato'], 'neutro|satisfeito'],
  [['desculpe o transtorno'], 'neutro|satisfeito'],
  [['desculpa a insistência, mas tem novidade?'], 'neutro|satisfeito'],
  // demora DE VOCÊS continua sendo reclamação
  [['que demora!'], 'estressado|neutro'],
  [['essa demora é um absurdo'], 'estressado'],
  [['vocês demoram muito para responder'], 'estressado|neutro'],
  [['desculpa, mas essa demora é um absurdo'], 'estressado'],
  [['perdão pela demora, mas vocês não resolvem nada'], 'estressado'],
  [['desculpa, mas que demora'], 'estressado|neutro'],
];
let ok = 0;
for (const [e, esp] of casos) {
  const r = H.analisarTextos(e); const pass = esp.split('|').includes(r.categoria); ok += pass;
  console.log(pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), JSON.stringify(e).slice(0, 60).padEnd(60), r.detalhes[0].sinais.join(' · ').slice(0, 90));
}
console.log(`${ok}/${casos.length}`);
