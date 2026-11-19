// v2.20: desabafo ("tá difícil") e estresse recente que persiste sem nada positivo depois
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
const real = ['Olá bom-dia', 'Sim', 'Po chama alguém ai pra me ajudar tá dificil', 'Nem o desbloqueio de confiança tb', 'Cara não tem a informações do boleto'];
const casos = [
  [real, 'estressado'],
  [['Po chama alguém ai pra me ajudar tá dificil'], 'estressado'],
  [['tá complicado'], 'estressado'],
  [[...real, 'ah agora foi, obrigada'], 'satisfeito'],
  [['isso é um absurdo', 'ok'], 'estressado'],
  [['isso é um absurdo', 'ok', 'ok'], 'estressado'],
  [['isso é um absurdo', 'ok', 'ok', 'ok'], 'neutro'],      // saiu das 3 últimas
  [['isso é um absurdo', 'deu certo, obrigado'], 'satisfeito'],
  [['alguém me ajuda a configurar o boleto?'], 'neutro'],
];
let ok = 0;
for (const [e, esp] of casos) {
  const r = H.analisarTextos(e.map((t) => ({ texto: t, emSequencia: true })));
  const pass = esp.split('|').includes(r.categoria); ok += pass;
  console.log(pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e).slice(0, 60).padEnd(60), r.detalhes.map((d) => d.score.toFixed(1)).join(' '));
}
console.log(`\n${ok}/${casos.length}`);
