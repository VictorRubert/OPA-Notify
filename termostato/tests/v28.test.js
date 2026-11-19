const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H=IXCOpa.humor;
const grupos = {
 'Operações no sistema → neutro': [
  [['Preciso remover cadastros do cliente'], 'neutro'],
  [['Como faço a remoção de produtos?'], 'neutro'],
  [['Quero cancelar o contrato do cliente João'], 'neutro'],
  [['O cancelamento de contrato não aparece'], 'neutro'],
  [['Preciso processar os boletos de hoje'], 'neutro'],
  [['Como excluir a fatura duplicada?'], 'neutro'],
 ],
 'Ameaça real continua vermelha': [
  [['Vou cancelar o sistema'], 'estressado'],
  [['Se não resolver vamos cancelar com vocês'], 'estressado'],
  [['Vou processar vocês'], 'estressado'],
 ],
 'Pergunta / relato sem revolta → não vermelho': [
  [['Estamos sem acesso, podem verificar?'], 'neutro'],
  [['O sistema caiu, como faço para voltar?'], 'neutro'],
  [['Por que ainda não funciona?'], 'neutro'],
  [['Consegue ver com urgência?'], 'neutro'],
  [['Estamos sem acesso'], 'neutro'],
  [['Aconteceu de novo'], 'neutro'],
  [['O erro apareceu novamente'], 'neutro'],
  [['Caiu de novo, consegue verificar?'], 'neutro'],
 ],
 'Agressivo → vermelho (mesmo em pergunta)': [
  [['Pela última vez, falar com humano'], 'estressado'],
  [['Você não resolve nada, me passe para um humano'], 'estressado'],
  [['Vocês não resolvem nada?'], 'estressado'],
  [['QUANDO VÃO RESOLVER ISSO?'], 'neutro'],
  [['Isso é um absurdo, quando vão resolver?'], 'estressado'],
  [['Já chega, quero falar com um humano'], 'estressado'],
 ],
 'Foguete 🚀': [
  [['Funcionou!', 'Muito obrigada, vocês são excelentes!'], 'encantado'],
  [['Perfeito, deu certo', 'Agradeço demais, parabéns pelo atendimento 👏'], 'encantado'],
  [['Muito obrigada, deu certo!'], 'satisfeito'],
  [['ok', 'obrigado'], 'satisfeito'],
 ],
};
let ok=0,total=0;
for (const [g,casos] of Object.entries(grupos)) { console.log('\n'+g);
 for (const [e,esp] of casos){ const r=H.analisarTextos(e); total++; const pass=esp.split('|').includes(r.categoria); ok+=pass;
  const ult=r.detalhes[r.detalhes.length-1];
  console.log(' ',pass?'✔':'✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e).slice(0,62).padEnd(62), ult.sinais.join(' · ').slice(0,110));}}
console.log(`\n${ok}/${total}`);
