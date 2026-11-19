const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
// Contexto da frase: a mesma palavra muda de sentido conforme o trecho em que aparece.
const grupos = {
  'Fala de terceiro (o cliente DO provedor)': [
    [['O cliente disse que está um absurdo ficar sem internet'], 'neutro'],
    [['meu cliente está reclamando que a internet caiu de novo'], 'neutro'],
    [['os assinantes estão irritados com a demora no boleto'], 'neutro'],
    [['o cliente ameaçou cancelar o plano dele'], 'neutro'],
    [['o técnico falou que está tudo travado'], 'neutro'],
  ],
  'Hipótese / condição': [
    [['Se não funcionar, te aviso'], 'neutro|satisfeito'],
    [['Caso dê erro de novo, eu mando print'], 'neutro|satisfeito'],
    [['Vou testar. Se continuar sem acesso, retorno aqui'], 'neutro|satisfeito'],
    [['Se continuar assim vou cancelar o sistema'], 'estressado'],
  ],
  'Citação de erro / texto da tela': [
    [['Aparece "acesso negado" quando entro'], 'neutro'],
    [['Está mostrando a mensagem: falha na conexão com o servidor'], 'neutro'],
    [['erro: não foi possível processar'], 'neutro'],
    [['Excelente "atendimento"'], 'estressado'],
  ],
  'Contraste ("mas")': [
    [['Não funcionou, mas obrigado pela ajuda'], 'satisfeito|neutro'],
    [['Obrigado, mas continua sem acesso'], 'neutro|estressado'],
    [['Desculpa, mas que demora'], 'estressado|neutro'],
    [['Funcionou, mas isso é um absurdo de demorado'], 'estressado'],
  ],
  'Autoculpa': [
    [['foi erro meu, digitei o CPF errado'], 'neutro|satisfeito'],
    [['minha culpa, esqueci de salvar'], 'neutro|satisfeito'],
  ],
  'Revolta do próprio cliente continua vermelha': [
    [['Isso é um absurdo'], 'estressado'],
    [['Vocês não resolvem nada'], 'estressado'],
    [['O cliente disse que vocês não resolvem nada e eu concordo, isso é um absurdo'], 'estressado'],
  ],
};
let ok = 0, total = 0;
for (const [g, casos] of Object.entries(grupos)) {
  console.log('\n' + g);
  for (const [e, esp] of casos) {
    const r = H.analisarTextos(e); total++; const pass = esp.split('|').includes(r.categoria); ok += pass;
    console.log(' ', pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), JSON.stringify(e).slice(0, 62).padEnd(62), r.detalhes[0].sinais.join(' · ').slice(0, 110));
  }
}
console.log(`\n${ok}/${total}`);
