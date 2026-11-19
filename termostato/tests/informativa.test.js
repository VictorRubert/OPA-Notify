// v2.16: relatar o problema (mesmo detalhado) = 😐; satisfação começa na COLABORAÇÃO
// (fazer o que o atendente pediu) ou no agradecimento/confirmação.
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'config.js')); require(path.join(__dirname, '..', 'src', 'humor-regras.js')); require(path.join(__dirname, '..', 'src', 'humor.js'));
const H = IXCOpa.humor;
const C = (t, extra = {}) => ({ texto: t, emSequencia: false, ...extra });
const R = (t) => C(t, { respondeuPergunta: true }); // respondeu a pergunta do atendente
const grupos = {
  'Relato vago → neutro': [
    [[C('meu sistema caiu')], 'neutro'],
    [[C('estamos sem acesso')], 'neutro'],
    [[C('não funciona')], 'neutro'],
    [[C('o boleto não aparece')], 'neutro'],
  ],
  'Relato detalhado → neutro (não é satisfação)': [
    [[C('meu sistema caiu'), R('quando eu tento acessar o cadastro do cliente, ele cai, tem como verificar?')], 'neutro'],
    [[C('quando eu tento acessar o cadastro do cliente, ele cai, tem como verificar?')], 'neutro'],
    [[C('não funciona'), R('ao clicar em salvar aparece erro 500')], 'neutro'],
    [[C('na tela de contratos, ao clicar em salvar aparece erro 500')], 'neutro'],
    [[C('estamos sem acesso'), R('no login do sistema')], 'neutro'],
  ],
  'Colaboração (fez o que foi pedido) → satisfeito': [
    [[C('meu sistema caiu'), R('segue o print')], 'satisfeito'],
    [[C('ao clicar aparece erro 500'), C('pronto, já reiniciei')], 'satisfeito'],
    [[C('não funciona'), C('já testei conforme você pediu')], 'satisfeito'],
    [[C('segue em anexo o arquivo de retorno')], 'satisfeito'],
    [[C('liberei o acesso remoto')], 'satisfeito'],
    [[C('estamos sem acesso'), C('mandei os dados no e-mail')], 'satisfeito'],
  ],
  'Colaborou mas o problema continua → não fica verde': [
    [[C('testei e continua sem funcionar')], 'neutro|estressado'],
    [[C('segue o print'), C('ninguém responde')], 'neutro|estressado'],
    [[C('já reiniciei 3 vezes e nada, isso é um absurdo')], 'estressado'],
  ],
  'Frustração / revolta continua': [
    [[C('já é a terceira vez que abro chamado sobre isso e até agora ninguém resolveu')], 'neutro|estressado'],
    [[C('quando eu acesso o cadastro do cliente cai, isso é um absurdo')], 'estressado'],
    [[C('ESTOU TENTANDO ACESSAR O CADASTRO DO CLIENTE E NÃO FUNCIONA!!')], 'estressado'],
  ],
  'Depois de estresse: colaborar ajuda, mas só agradecimento tira do vermelho': [
    [[C('Quero falar com integrações gerais, sobre mvno da tip com um atendente'), C('Humano, não quero cadu'), C('Atendimento humano'),
      C('Eu não quero falar com robô, passa pra um humano'), R('A linha não funciona, não consigo ativar')], 'estressado|neutro'],
    [[C('Eu não quero falar com robô, passa pra um humano'), C('segue o print')], 'neutro|estressado'],
    [[C('Eu não quero falar com robô, passa pra um humano'), C('segue o print'), C('agora deu certo, obrigado')], 'satisfeito'],
  ],
};
let ok = 0, total = 0;
for (const [g, casos] of Object.entries(grupos)) {
  console.log('\n' + g);
  for (const [e, esp] of casos) {
    const r = H.analisarTextos(e); total++;
    const pass = esp.split('|').includes(r.categoria); ok += pass;
    const ult = r.detalhes[r.detalhes.length - 1];
    console.log(' ', pass ? '✔' : '✘', r.emoji, r.categoria.padEnd(11), r.media.toFixed(2).padStart(5), JSON.stringify(e.map((x) => x.texto)).slice(0, 70).padEnd(70), ult.sinais.join(' · ').slice(0, 110));
  }
}
console.log(`\n${ok}/${total}`);
