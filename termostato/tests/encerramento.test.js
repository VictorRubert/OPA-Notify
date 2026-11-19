const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
// "não obrigado" escrito sem vírgula = recusa educada, não irritação
const casos = [
  [['não obrigado'], 'satisfeito'],
  [['nao obrigada'], 'satisfeito'],
  [['não, obrigado'], 'satisfeito'],
  [['não valeu'], 'satisfeito'],
  [['não obg'], 'satisfeito'],
  [['não precisa, obrigado'], 'satisfeito'],
  [['era só isso, obrigada'], 'satisfeito|encantado'],
  [['não preciso de mais nada'], 'satisfeito|neutro'],
  [['pode encerrar'], 'neutro|satisfeito'],
  // o que continua negativo
  [['não ficou bom'], 'estressado'],
  [['não funcionou'], 'neutro|estressado'],
  [['obrigado por nada'], 'estressado'],
];
let ok = 0;
for (const [e, esp] of casos) {
  const r = H.analisarTextos(e); const pass = esp.split('|').includes(r.categoria); ok += pass;
  console.log(pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), JSON.stringify(e).padEnd(32), r.detalhes[0].sinais.join(' · '));
}
console.log(`${ok}/${casos.length}`);
