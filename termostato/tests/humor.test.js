const path = require('path');
global.window = global; 
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const casos = [
 ['ESTOU SEM SISTEMA DESDE ONTEM!!', 'estressado'],
 ['isso é um absurdo, vou abrir reclame aqui', 'estressado'],
 ['ainda não funcionou, de novo o mesmo erro', 'estressado'],
 ['muito obrigada, deu certo!', 'satisfeito'],
 ['perfeito, valeu 👍', 'satisfeito'],
 ['não ficou bom', 'estressado'],
 ['ok', 'neutro'],
 ['voce vai me matar kkk', 'neutro|satisfeito'],
 ['gostaria de saber o valor do plano', 'desconhecido'],
 ['vou cancelar essa porcaria', 'estressado'],
 ['obrigado de nada resolveu', 'satisfeito'],
];
let ok=0;
for (const [t,esp] of casos){ const r=IXCOpa.humor.analisarTextos([t]); const pass=esp.split('|').includes(r.categoria); ok+=pass;
 console.log(pass?'✔':'✘', r.categoria.padEnd(12), r.media.toFixed(2).padStart(5), JSON.stringify(t), r.detalhes[0].sinais.join(' · '));}
console.log(`${ok}/${casos.length}`);
