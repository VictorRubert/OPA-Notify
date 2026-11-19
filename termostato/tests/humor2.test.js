const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const casos = [
 ['ESTOU SEM SISTEMA DESDE ONTEM!!', 'estressado'],
 ['ainda não funcionou, de novo o mesmo erro', 'estressado'],
 ['muito obrigada, deu certo!', 'satisfeito'],
 ['não ficou bom', 'estressado'],
 ['ok', 'neutro'],
 ['gostaria de saber o valor do plano', 'desconhecido'],
 ['vou cancelar essa porcaria', 'estressado'],
 // novos termos
 ['não quero falar com robô', 'estressado'],
 ['já falei isso, quantas vezes vou ter que repetir', 'estressado'],
 ['estou esperando há horas', 'estressado'],
 ['não gostei do atendimento', 'estressado'],
 ['é urgente', 'estressado'],
 ['pode deixar, sem problemas', 'satisfeito'],
 ['ajudou bastante', 'satisfeito'],
 ['segue o print', 'satisfeito'], // v2.16: colaboração = 😊
 ['pronto, fiz', 'satisfeito'], // v2.16
 ['a solicitação foi resolvida', 'satisfeito'],
 // negação de negativo
 ['não estou irritado, só preciso entender', 'neutro'],
 ['não é urgente', 'neutro'],
 ['não quero cancelar', 'neutro'],
 ['não, é um absurdo', 'estressado'],
 ['não funciona', 'neutro'], // v2.13: relato vago = 😐,
];
let ok=0;
for (const [t,esp] of casos){ const r=IXCOpa.humor.analisarTextos([t]); const pass=esp.split('|').includes(r.categoria); ok+=pass;
 console.log(pass?'✔':'✘', r.categoria.padEnd(12), r.media.toFixed(2).padStart(5), JSON.stringify(t).padEnd(52), r.detalhes[0].sinais.join(' · '));}
console.log(`${ok}/${casos.length}`);
