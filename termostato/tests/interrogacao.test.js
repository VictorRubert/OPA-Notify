// v2.22: "vou sair" não é ameaça; "??"/"???" só pesam como mensagem separada (cobrança)
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
const casos = [
  [['vou sair para o almoço'], 'neutro|desconhecido'],
  [['vou sair do sistema e entrar de novo'], 'neutro|desconhecido'],
  [['vou sair agora, volto depois'], 'neutro|desconhecido'],
  [['se não resolver vou sair da IXC'], 'estressado'],
  [['vou cancelar com vocês'], 'estressado'],
  [['saberia me informar um prazo??'], 'neutro'],
  [['saberia me informar um prazo???'], 'neutro'],
  [['consegue verificar pra mim???'], 'neutro|desconhecido'],
  [['???'], 'estressado'],
  [['algum retorno?', '?'], 'estressado'],
  [['algum retorno?', '??'], 'estressado'],
  [['saberia me informar um prazo??', '???'], 'estressado'],
  [['isso é um absurdo???'], 'estressado'],
];
let ok = 0;
for (const [e, esp] of casos) {
  const r = H.analisarTextos(e.map((t) => ({ texto: t, emSequencia: true })));
  const pass = esp.split('|').includes(r.categoria); ok += pass;
  console.log(pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e).slice(0, 50).padEnd(50), r.detalhes.at(-1).sinais.join(' · ').slice(0, 100));
}
console.log(`\n${ok}/${casos.length}`);
