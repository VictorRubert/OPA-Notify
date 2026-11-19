const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H=IXCOpa.humor;
const casos = [
 // sarcásticos → estressado
 [['Ótimo, caiu de novo'], 'estressado'],
 [['Que maravilha, parou tudo de novo'], 'estressado'],
 [['Parabéns, mais uma vez sem sistema'], 'estressado'],
 [['Nossa, que rapidez, 3 dias pra responder'], 'estressado'],
 [['Perfeito 🙄'], 'estressado'],
 [['Excelente "atendimento"'], 'estressado'],
 [['Muito obrigado pela ajuda nenhuma'], 'estressado'],
 [['Resolveu sim, só que não'], 'estressado'],
 [['Ah claro, vou esperar mais 3 dias'], 'estressado'],
 [['Só pode ser piada'], 'estressado'],
 [[{texto:'não funcionou de novo',emSequencia:false},{texto:'ótimo',emSequencia:true}], 'estressado'],
 [[{texto:'continua sem acesso',emSequencia:false},{texto:'que maravilha hein',emSequencia:true}], 'estressado'],
 // sinceros → não podem virar estresse
 [['Ótimo, obrigada!'], 'satisfeito'],
 [['Perfeito, deu certo'], 'satisfeito'],
 [['Excelente atendimento, parabéns'], 'satisfeito'],
 [['Show, funcionou de novo'], 'satisfeito'],
 [['Que rapidez, obrigado!'], 'satisfeito'],
 [['Ótimo, então vou aguardar'], 'satisfeito'],
 // reclamação → atendente resolve → "ótimo" (atendente falou no meio) = sincero
 [[{texto:'não funcionou',emSequencia:false},{texto:'ótimo, agora foi',emSequencia:false}], 'satisfeito|neutro'],
 // "ótimo" longo depois de reclamação sem atendente: regra d não se aplica (frase longa)
 [[{texto:'caiu',emSequencia:false},{texto:'ótimo, vou reiniciar o equipamento então e te aviso',emSequencia:true}], 'neutro|satisfeito|estressado'],
];
let ok=0;
for (const [e,esp] of casos){ const r=H.analisarTextos(e); const pass=esp.split('|').includes(r.categoria); ok+=pass;
 const ult=r.detalhes[r.detalhes.length-1];
 console.log(pass?'✔':'✘', r.emoji, r.categoria.padEnd(11), JSON.stringify(e.map(x=>x.texto||x)).slice(0,70).padEnd(70), ult.sinais.filter(s=>s.includes('🙃')).join(' ')||'');}
console.log(`${ok}/${casos.length}`);
// extras de regressão
for (const [t,esp] of [['Ótimo "suporte" esse','estressado'],['Perfeito, o erro diz "falha de conexão"','satisfeito|neutro|estressado']]){
 const r=H.analisarTextos([t]); console.log(esp.split('|').includes(r.categoria)?'✔':'✘', r.emoji, r.categoria, t);}
