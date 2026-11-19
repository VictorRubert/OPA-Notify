const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H=IXCOpa.humor;
const casos = [
 // o print
 [['o email e senha que estou usando no site do suporte é o mesmo que uso no sistema e não está funcionando','Nesse link eu tive acesso mas o link de suporte eu não consigo entrar','Posso falar com algum atendente','Sim, por favor','Obrigado pela explicação'], 'satisfeito'],
 [['estamos sem acesso','podem verificar?','obrigado pela explicação','ok'], 'satisfeito'],
 [['o boleto não gera','deu certo agora, valeu'], 'satisfeito'],
 [['caiu de novo','ah entendi, ficou claro'], 'satisfeito'],
 [['obg'], 'satisfeito'],
 // agradeceu mas reclamou depois → não pode ficar verde
 [['obrigado','mas continua sem acesso, isso é um absurdo'], 'estressado'],
 [['valeu','ainda não funciona'], 'neutro'],
 // sarcasmo não ativa o gatilho
 [['não funcionou de novo','obrigado por nada'], 'estressado'],
 // cliente educado sem agradecer: segue neutro
 [['bom dia','preciso gerar um boleto','sim','ok'], 'neutro'],
];
let ok=0;
for (const [e,esp] of casos){ const r=H.analisarTextos(e); const pass=esp.split('|').includes(r.categoria); ok+=pass;
 console.log(pass?'✔':'✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e.slice(-2)).slice(0,70));}
console.log(`${ok}/${casos.length}`);
