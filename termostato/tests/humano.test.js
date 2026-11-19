// v2.17.1: pedir humano sozinho = 😐; recusar o robô/IA (sozinho ou junto) = 😡
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
const casos = [
  [['Atendimento humano'], 'neutro'],
  [['quero falar com um atendente'], 'neutro'],
  [['pode me passar pra um atendente?'], 'neutro'],
  [['me passa pra um humano por favor'], 'neutro'],
  [['atendente humano'], 'neutro'],
  [['não quero robô, quero um humano'], 'estressado'],
  [['Não quero falar com ia, pode me passar pra um atendente pfv'], 'estressado'],
  [['Humano, não quero cadu'], 'estressado'],
  [['não quero falar com robô'], 'estressado'],
  [['Pela última vez, falar com humano'], 'estressado'],
  [['Já chega, quero falar com um humano'], 'estressado'],
];
let ok = 0;
for (const [e, esp] of casos) {
  const r = H.analisarTextos(e);
  const pass = esp.split('|').includes(r.categoria); ok += pass;
  console.log(pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e).slice(0, 62).padEnd(62), r.detalhes.map((d) => d.sinais.join(',')).join(' | ').slice(0, 100));
}
console.log(`\n${ok}/${casos.length}`);
