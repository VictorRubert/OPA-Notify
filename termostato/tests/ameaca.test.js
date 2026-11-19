// v2.16.1: ameaça de trocar de fornecedor e recusa de IA (caso real 17/11)
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
const casos = [
  [['Nao quero falar com ia, pode me passar pra um atendente pfv', 'Senão eu vou cancelar com vcs esse progarama', 'E vou atrás de outro com urgência', 'Utilizo crm', 'Sim por gentileza'], 'estressado'],
  [['Nao quero falar com ia, pode me passar pra um atendente pfv'], 'estressado|neutro'],
  [['vou atrás de outro sistema'], 'estressado'],
  [['vou procurar outra empresa'], 'estressado'],
  [['vc pode verificar?'], 'neutro|desconhecido'],
  [['obrigado, vcs são demais'], 'satisfeito|encantado'],
];
let ok = 0;
for (const [e, esp] of casos) {
  const r = H.analisarTextos(e);
  const pass = esp.split('|').includes(r.categoria); ok += pass;
  console.log(pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e).slice(0, 60).padEnd(60), r.detalhes.map((d) => d.sinais.join(',')).join(' | ').slice(0, 120));
}
console.log(`\n${ok}/${casos.length}`);
