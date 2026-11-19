// v2.19: elogios sinceros ("Incrível!", "Ótimo!", "Excelente!") = satisfação; sarcasmo continua pego
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
const C = (t, seq = false) => ({ texto: t, emSequencia: seq }); // seq=false: o atendente falou antes
const casos = [
  [[C('Incrível!')], 'satisfeito|encantado'],
  [[C('Ótimo!')], 'satisfeito|encantado'],
  [[C('Excelente!')], 'satisfeito|encantado'],
  [[C('Fantástico!')], 'satisfeito|encantado'],
  [[C('Que demais!')], 'satisfeito|encantado'],
  [[C('Que incrível, deu certo!')], 'satisfeito|encantado'],
  // atendente resolveu/respondeu no meio → elogio sincero
  [[C('não funciona'), C('Ótimo!')], 'satisfeito'],
  [[C('o boleto não aparece'), C('Incrível!')], 'satisfeito'],
  // sarcasmo continua pego
  [[C('não funcionou de novo'), C('incrível', true)], 'estressado'],
  [[C('Incrível, caiu de novo')], 'estressado'],
  [[C('Excelente "atendimento"')], 'estressado'],
  [[C('Ótimo 🙄')], 'estressado'],
  // demora "demais" não é elogio
  [[C('está demorando demais')], 'neutro|estressado'],
  // depois de estresse, elogio sozinho não pula para o verde
  [[C('isso é um absurdo'), C('Ótimo!')], 'neutro|estressado'],
];
let ok = 0;
for (const [e, esp] of casos) {
  const r = H.analisarTextos(e);
  const pass = esp.split('|').includes(r.categoria); ok += pass;
  console.log(pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e.map((x) => x.texto)).slice(0, 50).padEnd(50), r.detalhes.at(-1).sinais.join(' · ').slice(0, 100));
}
console.log(`\n${ok}/${casos.length}`);
