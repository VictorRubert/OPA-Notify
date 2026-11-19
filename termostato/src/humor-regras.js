/* =========================================================
   REGRAS DO TERMÔMETRO DE HUMOR
   ---------------------------------------------------------
   Este é o arquivo para "lapidar" o termômetro.

   Como escrever um termo:
   - sempre minúsculo e SEM acento ("nao", "pessimo", "agradeco")
   - "obrigad*" → o * casa qualquer final (obrigado, obrigada, obrigadão)
   - frases funcionam: "nao funcionou", "reclame aqui"
   - pontuação entre palavras é ignorada: "pronto fiz" casa "pronto, fiz"
   - termos mais longos têm prioridade: "nao funcionou" é contado
     e o "funcionou" de dentro dela NÃO conta como positivo

   Peso: negativo = estresse, positivo = satisfação, 0 = neutro
   (o neutro só serve para dizer "essa mensagem foi entendida",
   assim ela não cai no ❓).
   ========================================================= */

IXCOpa.HUMOR_REGRAS = {
  termos: [
    // ---------- 🔴 Estresse forte (-2) ----------
    ['procon', -2], ['reclame aqui', -2], ['anatel', -2], ['advogado', -2],
    ['vou processar', -2], ['processar voces', -2], ['processar a ixc', -2], ['processo judicial', -2], ['justica', -2],
    // "cancelar" sozinho NÃO é ameaça (provedor cancela contrato de cliente o tempo todo).
    // Só estas frases indicam ameaça de cancelar com a IXC:
    ['vou cancelar', -2], ['quero cancelar', -2], ['vamos cancelar', -2], ['cancelar o sistema', -2],
    ['cancelar com voces', -2], ['cancelar a ixc', -2], ['cancelar o ixc', -2], ['cancelamento do sistema', -2],
    ['cancelar o contrato com voces', -2], ['cancelar nosso contrato', -2],
    // "vou sair" sozinho NÃO é ameaça (almoço, sair do sistema): só com a IXC/vocês
    ['vou sair da ixc', -2], ['vamos sair da ixc', -2], ['sair de voces', -2], ['vou sair de voces', -2], ['trocar de sistema', -2], ['trocar de fornecedor', -2], ['outro sistema', -1],
    ['vou atras de outro', -2], ['vou atras de outra', -2], ['vou procurar outro', -2], ['vou procurar outra', -2],
    ['procurar outro sistema', -2], ['procurar outra empresa', -2], ['outra empresa', -1.5], ['outro fornecedor', -1.5], ['ir para a concorrencia', -2], ['concorrente', -1],
    ['absurdo', -2], ['palhacada', -2], ['ridiculo', -2], ['vergonha', -2],
    ['descaso', -2], ['falta de respeito', -2], ['desrespeito', -2],
    ['incompetente*', -2], ['incompetencia', -2], ['lixo', -2], ['porcaria', -2],
    ['pessimo', -2], ['horrivel', -2], ['nunca mais', -2], ['inadmissivel', -2],
    ['inaceitavel', -2],

    // ---------- 🔴 Palavrão (-1.5) ----------
    ['merda', -1.5], ['porra', -1.5], ['pqp', -1.5], ['caralho', -1.5],
    ['droga', -1.5], ['inferno', -1.5], ['saco', -1], ['puta que pariu', -1.5],

    // ---------- 🔴 Frustração (-1) ----------
    ['nao funciona', -0.7], ['nao funcionou', -0.6], ['nao funcionando', -0.6],
    ['nao resolve', -1.5], ['nao resolveu', -1.5], ['nao deu certo', -0.6],
    ['nao mudou', -0.6], ['naomudou', -0.6], ['nada resolvido', -1], ['nada feito', -1],
    ['continua igual', -0.6], ['continua o mesmo', -0.6], ['continua sem', -0.6],
    ['continua dando', -0.6], ['continua com', -0.6],
    ['de novo', -0.2], ['novamente', -0.2], ['mais uma vez', -0.5],
    ['ate agora', -1], ['ate hoje', -1], ['ainda nao', -0.4],
    ['ninguem resolve', -1.5], ['ninguem resolveu', -1.5], ['ninguem resolvia', -1.5], ['ninguem responde', -1.5], ['ninguem retorna', -1.5],
    ['sem retorno', -1], ['sem resposta', -1], ['algum retorno', -0.3], ['alguma novidade', -0.3], ['e ai', -0.3], ['alguma resposta', -0.3],
    // ---------- 🔴 Insistência / cobrança de prazo (insatisfação, mesmo em pergunta) ----------
    ['nenhum prazo', -1.5], ['nenhuma previsao', -1.5], ['sem previsao', -1.5], ['sem prazo', -1.5],
    ['ate quando', -1.5], ['nada ainda', -1.5], ['ainda nada', -1.5], ['ainda nao ha', -1], ['ainda nao tem', -1],
    ['nenhum retorno', -1.5], ['nenhuma resposta', -1.5], ['nenhuma novidade', -1.5], ['nenhuma posicao', -1.5],
    ['vai demorar muito', -1.5], ['quanto tempo mais', -1.5], ['qual o prazo', -0.5], ['tem previsao', -0.5],
    ['previsao', -0.3], ['prazo', -0.3], ['cade', -1], ['oi?', -0.3], ['alo', -0.5],
    ['demora', -1], ['demoram', -1], ['demoram muito', -1.2], ['demorando muito', -1.2], ['demorando', -1], ['demorado', -1], ['muito tempo', -1],
    ['esperando', -0.3], ['urgente', -1.2], ['urgencia', -1.2],
    ['parado', -0.6], ['prejuizo', -1.5], ['fora do ar', -0.8], ['sem sistema', -0.8],
    ['nao aguento', -1.5], ['cansad*', -1], ['impossivel', -1],
    // dificuldade/desabafo: "tá difícil", "tá complicado" (frustração, não relato técnico)
    ['ta dificil', -1.2], ['esta dificil', -1.2], ['ta foda', -1.5], ['ta complicado', -1], ['esta complicado', -1],
    ['muito dificil', -1], ['ta osso', -1.2], ['ta tenso', -1], ['po', -0.3], ['poh', -0.3],
    // pedir que chamem alguém = pedido de humano com impaciência
    ['chama alguem', -0.8], ['chame alguem', -0.8], ['chamar alguem', -0.8], ['alguem pra me ajudar', -0.8], ['alguem para me ajudar', -0.8],
    ['alguem me ajuda', -0.8], ['ninguem pra ajudar', -1.5],
    // "nem o desbloqueio (funciona) também": queixa de que mais nada funciona
    ['nem o', -0.5], ['nem a', -0.5], ['nem isso', -0.8], ['nem assim', -0.8],
    ['estressad*', -1.5], ['irritad*', -2], ['chatead*', -1.5], ['decepcionad*', -1.5],
    ['insatisfeit*', -2], ['complicado', -0.5],

    // ---------- 🔴 Incluídos da lista do time (nov/2026) ----------
    ['nao quero falar com robo', -2], ['nao com um robo', -2], ['falar com robo', -1.5],
    ['quero falar com atendente', -0.5], ['quero falar com humano', -0.5], ['quero falar com uma pessoa', -0.5],
    ['nao gostei', -2], ['estou esperando ha horas', -2], ['esperando ha horas', -2],
    ['esperando ha muito tempo', -2], ['faz tempo que espero', -2],
    ['de novo o problema', -0.6], ['problema novamente', -0.6], ['mesmo problema', -0.6],
    ['ja falei', -1], ['ja expliquei', -1], ['quantas vezes', -1], ['ja disse', -1],
    ['vou ter que repetir', -1], ['repetir de novo', -1.5], ['toda vez', -1], ['sempre a mesma coisa', -1.5],
    // espera longa
    ['ha horas', -1.5], ['ha dias', -1.5], ['faz horas', -1.5], ['faz dias', -1.5],
    ['desde ontem', -1], ['desde cedo', -1], ['desde manha', -1], ['o dia todo', -1],
    ['ninguem me ajuda', -1.5], ['ninguem me retorna', -1.5], ['ninguem me responde', -1.5],
    // Pedido de humano SOZINHO = neutro (-0.5): "atendimento humano", "me passa pra um atendente".
    // RECUSAR o robô/IA ("não quero robô", "não quero falar com IA", "não quero o Cadu") = -1.5 a -2;
    // os dois juntos ("não quero robô, quero um humano") somam e ficam vermelhos.
    ['atendente humano', -0.5], ['atendimento humano', -0.5], ['humano', -0.5], ['nao quero robo', -1.5], ['nao quero bot', -1.5], ['nao quero chatbot', -1.5], ['nao quero cadu', -1.5], ['nao quero o cadu', -1.5], ['nao quero ia', -1.5], ['nao quero a ia', -1.5],
    ['nao quero falar com ia', -1.5], ['nao quero falar com a ia', -1.5], ['nao quero falar com bot', -1.5], ['falar com ia', -1], ['falar com bot', -1],
    ['passar pra um atendente', -0.5], ['passar para um atendente', -0.5], ['passar pro atendente', -0.5], ['passar para o atendente', -0.5],
    ['passa pra um atendente', -0.5], ['me passar pra alguem', -0.5], ['transferir para um atendente', -0.5], ['transferir pra um atendente', -0.5], ['pessoa de verdade', -0.5], ['falar com alguem', -0.5], ['robo', -0.5],
    ['falar com algum atendente', -0.5], ['falar com um atendente', -0.5],
    ['falar com humano', -0.5], ['falar com um humano', -0.5], ['quero um humano', -0.5],
    ['me passe para um humano', -0.5], ['me passa pra um humano', -0.5], ['me passa para um humano', -0.5],
    ['passa pra um humano', -0.5], ['passe para um humano', -0.5], ['me transfere', -0.5], ['me transfira', -0.5],

    // ---------- 🔴 Agressividade / ultimato (revolta → vermelho, mesmo em pergunta) ----------
    ['pela ultima vez', -2], ['ultima vez que', -1.5], ['nao resolve nada', -2], ['nao resolvem nada', -2],
    ['nao resolveu nada', -2], ['nao serve pra nada', -2], ['nao serve para nada', -2],
    ['nao sabe nada', -2], ['nao sabem nada', -2], ['inutil', -2], ['nao adianta', -1],
    ['ja chega', -1.5], ['cansei', -1.5], ['ja deu', -1.5], ['nao aguento mais', -2],
    ['to perdendo a paciencia', -2], ['estou perdendo a paciencia', -2], ['perdendo a paciencia', -2],

    // falha técnica: o cliente está RELATANDO um problema → nota baixa, mas sozinho fica 😐
    // (também servem de "contexto negativo" para detectar sarcasmo)
    ['caiu', -0.6], ['caiu de novo', -1], ['parou', -0.6], ['parou de novo', -1], ['parou tudo', -1],
    ['travou', -0.6], ['travando', -0.6], ['travad*', -0.6], ['sem internet', -0.6], ['sem acesso', -0.6],
    ['dias pra', -0.8], ['dias para', -0.8], ['horas pra', -0.8], ['horas para', -0.8],

    // ---------- 🙃 Sarcasmo explícito (sempre irônico) ----------
    ['so que nao', -1.5], ['sqn', -1.5], ['aham sei', -1.5], ['aham', -0.5], ['sei sei', -1],
    ['ah claro', -1], ['ah claro vou', -1.5], ['claro ne', -1], ['esperar mais', -1], ['esperar ate', -1], ['ta bom ne', -1], ['ta bom entao ne', -1],
    ['ta de brincadeira', -1.5], ['so pode ser brincadeira', -2], ['so pode ser piada', -2],
    ['que piada', -2], ['piada', -1.5], ['de sacanagem', -1.5], ['me engana que eu gosto', -2],
    ['conta outra', -1.5], ['ajuda nenhuma', -2], ['obrigad* por nada', -2], ['valeu por nada', -2],
    ['muito obrigad* pela ajuda nenhuma', -2],

    // ---------- 🔴 Leve (-0.5) ----------
    ['aff', -0.5], ['affs', -0.5], ['afe', -0.5], ['poxa', -0.5], ['putz', -0.5],
    ['nao entendi', -0.3], ['como assim', -0.5], ['e agora', -0.5], ['serio', -0.3],

    // ---------- 🟢 Satisfação forte (+1.5) ----------
    ['muito obrigad*', 1.5], ['agradeco', 1.5], ['agradecid*', 1.5], ['excelente*', 1.5], ['voces sao demais', 1.5], ['voce e demais', 1.5], ['nota 10', 1.5], ['nota dez', 1.5],
    ['perfeito', 1.5], ['perfeita', 1.5], ['maravilha', 1.5], ['maravilhos*', 1.5],
    ['parabens', 1.5], ['sensacional', 1.5], ['salvou', 1.5], ['me salvou', 1.5],
    ['show de bola', 1.5], ['atendimento otimo', 1.5], ['otimo atendimento', 1.5],
    ['incrivel', 1.5], ['que incrivel', 1.5], ['fantastic*', 1.5], ['espetacular', 1.5], ['fenomenal', 1.5],
    ['excepcional', 1.5], ['extraordinari*', 1.5], ['que demais', 1.5], ['muito show', 1.5], ['show demais', 1.5],
    ['sucesso', 1], ['deu bom', 1], ['bacana', 1], ['joia', 0.7], ['uau', 1], ['nossa que bom', 1.5], ['muito legal', 1],

    // ---------- 🟢 Satisfação (+1) ----------
    ['obrigad*', 1], ['brigad*', 1], ['grat*', 1], ['valeu', 1], ['vlw', 1], ['obg', 1], ['obgd*', 1], ['por gentileza', 0.3], ['pfv', 0.3], ['pfvr', 0.3], ['muito gentil', 1], ['entendi agora', 0.7], ['ficou claro', 1], ['faz sentido', 0.5],
    ['otimo*', 1], ['otima*', 1], ['deu certo', 1], ['funcionou', 1], ['funcionando', 0.7], ['funciona', 0.7], ['ta funcionando', 1], ['esta funcionando', 1], ['voltou', 0.7], ['ja foi', 0.7], ['foi sim', 0.5], ['apareceu sim', 0.5],
    ['resolvid*', 1], ['resolveu', 1], ['top', 1], ['show', 1], ['muito bom', 1],
    ['tudo certo', 1], ['certinho', 1], ['ajudou', 1], ['massa', 0.7], ['legal', 0.7],
    ['combinado', 0.7], ['perfeitamente', 1], ['beleza', 0.5], ['blz', 0.5],
    ['tranquilo', 0.5], ['de boa', 0.5], ['bom saber', 0.5], ['bom', 0], ['boa', 0],  // "bom" sozinho não é satisfação ("Bom, vou testar")
    ['ah perfeito', 1.5], ['que bom', 1], ['que maravilha', 1.5], ['adorei', 1], ['amei', 1],
    ['agora foi', 1], ['agora sim', 1],
    // elogios de velocidade: sinceros sozinhos, mas muito usados com ironia
    ['que rapidez', 0.5], ['que agilidade', 0.5], ['que eficiencia', 0.5], ['super rapido', 0.5],
    ['muito rapido', 0.5], ['rapidinho', 0.5],

    // ---------- 🟢 Incluídos da lista do time (nov/2026) ----------
    // Satisfação
    ['ajudou bastante', 1.5], ['ajudou muito', 1.5], ['sem problemas', 1], ['pode deixar', 1],
    // Colaboração: o cliente FAZ o que o atendente pediu (manda print, testa, reinicia,
    // libera acesso). É aqui que a satisfação começa: +0.7 e dispara o gatilho positivo
    // (lista `colaboracao` abaixo). Relatar o problema, mesmo detalhado, é neutro.
    ['segue o', 0.7], ['segue a', 0.7], ['segue os', 0.7], ['segue as', 0.7], ['segue em anexo', 0.7], ['em anexo', 0.7],
    ['conforme solicitado', 0.7], ['conforme pediu', 0.7], ['conforme voce pediu', 0.7], ['como voce pediu', 0.7],
    ['ja fiz', 0.7], ['pronto fiz', 0.7], ['fiz o procedimento', 0.7], ['fiz o que voce pediu', 0.7], ['fiz o teste', 0.7],
    ['ja testei', 0.7], ['testei', 0.7], ['ja reiniciei', 0.7], ['reiniciei', 0.7], ['ja atualizei', 0.7], ['atualizei', 0.7],
    ['ja enviei', 0.7], ['enviei', 0.7], ['mandei', 0.7], ['ja mandei', 0.7], ['ja liberei', 0.7], ['liberei', 0.7],
    ['ja alterei', 0.7], ['alterei', 0.7], ['ja configurei', 0.7], ['configurei', 0.7], ['ja cadastrei', 0.7],
    ['vou testar agora', 0.5], ['vou fazer agora', 0.5], ['ja vou fazer', 0.5],
    ['claro vou', 0.4], ['com certeza', 0.4], ['vou realizar', 0.3],

    // ---------- 🟡 Neutro (0) – só marca como "entendida" ----------
    // encerramento educado: o cliente não precisa de mais nada
    // o cliente assumindo o próprio erro = cordialidade
    ['foi erro meu', 0.3], ['erro meu', 0.3], ['minha culpa', 0.3], ['culpa minha', 0.3], ['falha minha', 0.3],
    ['eu que errei', 0.3], ['fui eu', 0.2], ['me confundi', 0.2], ['me enganei', 0.2],
    ['era so isso', 0.7], ['e so isso', 0.5], ['so isso mesmo', 0.5], ['nao preciso de mais nada', 0.7],
    ['nao precisa mais', 0.5], ['tudo resolvido', 1], ['pode encerrar', 0.5], ['pode finalizar', 0.5],
    ['ok', 0], ['certo', 0], ['sim', 0], ['isso', 0], ['entendi', 0], ['entendido', 0],
    ['aguardo', 0], ['no aguardo', 0], ['bom dia', 0], ['boa tarde', 0], ['boa noite', 0],
    ['tudo bem', 0], ['oi', 0], ['ola', 0], ['nao', 0], ['pode ser', 0], ['vou fazer', 0],
    ['vou verificar', 0], ['vou testar', 0], ['irei', 0], ['podemos', 0], ['qual', 0],
    ['como', 0], ['onde', 0], ['quando', 0], ['por favor', 0.3],
  ],

  // ---------- OPERAÇÕES NO SISTEMA (neutro) ----------
  // "remover cadastros do cliente", "remoção de produtos", "cancelar o contrato do cliente",
  // "excluir a fatura", "processar os boletos"… são pedidos de operação, não estresse.
  // O trecho é neutralizado ANTES dos termos (então "cancelar" ali dentro não pesa).
  // ---------- DESCULPAS DO CLIENTE (cordialidade) ----------
  // "perdão pela demora", "desculpa o atraso", "foi mal a confusão": o cliente está se
  // desculpando pelo PRÓPRIO atraso/erro. A "demora" ali não é reclamação: o trecho todo
  // é neutralizado e conta como cordialidade (pesoDesculpa). Revolta no resto da frase
  // continua valendo ("desculpa, mas isso é um absurdo" segue vermelho), e um "mas"
  // depois da desculpa a interrompe ("desculpa, mas essa demora..." é reclamação).
  // ---------- CONTEXTO DA FRASE ----------
  // Antes de pesar as palavras, cada trecho da mensagem é classificado. Um termo dentro
  // de um trecho tem seu peso multiplicado (fatorNeg para negativos, fatorPos para positivos).
  // manterRevolta: termos de revolta (peso <= pesoRevolta) NÃO são reduzidos nesse trecho.
  contextos: [
    {
      // O provedor contando o que o CLIENTE DELE disse/sente: não é o humor de quem está no chat.
      // O trecho termina quando quem está no chat volta a falar por si ("e eu concordo", "pra mim").
      tipo: 'fala de terceiro', fatorNeg: 0.3, fatorPos: 0.5, manterRevolta: false, entende: true,
      re: /(^|[\s,.;!?])((o|a|os|as|meu|minha|meus|minhas|nosso|nossa|nossos|nossas|um|uma|esse|essa|este|esta)\s+)?(cliente|clientes|assinante|assinantes|usuario|usuarios|consumidor|consumidores|tecnico|tecnicos|chefe|gerente|diretor|dono|financeiro)(\s+final|\s+finais)?\s+((\S+\s+){0,2}?)(disse|diz|dizem|disseram|falou|fala|falam|falaram|reclam\w*|esta|estao|ficou|ficaram|achou|acha|acham|xing\w*|quer|querem|ligou|ligaram|mandou|mandaram|relat\w*|informou|alega\w*|abriu|abriram|ameac\w*)\b[^.;!?]*?(?=[.;!?]|\s(e\s+)?eu\s|\s(e\s+)?(nos|a gente)\s|\s(e\s+)?(concordo|tambem acho)\b|,?\s*(pra|para) mim\b|$)/g,
    },
    {
      // Hipótese/condição no início de uma oração: "se não funcionar, te aviso"
      tipo: 'hipótese', fatorNeg: 0.3, fatorPos: 0.6, manterRevolta: true,
      re: /(^|[,.;!?])\s*(se|caso|e se|para nao|pra nao|para evitar|pra evitar|senao|na hipotese de)\s[^,.;!?]*/g,
    },
    {
      // Texto citado de tela/erro: entre aspas, ou depois de "erro:", "mensagem:"
      tipo: 'citação de erro', fatorNeg: 0, fatorPos: 1, manterRevolta: false, entende: true,
      re: /["“”'‘’][^"“”'‘’]{2,80}["“”'‘’]|\b(erro|mensagem|aviso|alerta|retorno|log)\s*:\s*[^.;!?]*/g,
    },
  ],
  // Contraste: o que vem ANTES do último "mas/porém/só que" pesa menos (o que vale é o depois).
  // "não funcionou, mas obrigado pela ajuda" → o agradecimento prevalece.
  contraste: /\s(mas|porem|entretanto|contudo|no entanto|so que(?!\s+nao))\s/g,
  fatorAntesDoContraste: 0.6,

  padroesDesculpas: [
    /\b(perdao|perdoa|perdoe|me perdoe|desculp\w*|foi mal|sinto muito|lamento)[\s,]+((pela|pelo|pelas|pelos|por|a|o|as|os|essa|esse|minha|meu|toda|todo|tanta|tanto|qualquer)\s+){0,3}((?!(mas|porem|so que|entretanto|contudo|agora)\b)\S+\s+){0,2}?(demor\w*|atras\w*|delay|ausencia|sumi\w*|resposta|retorno|transtorno\w*|incomodo\w*|confus\w*|erro\w*|engano\w*|equivoco\w*|bagunca|falha\w*|esquecimento|vacilo|mensage\w*|insistencia|horario|hora)/g,
    /\b(desculp\w*|perdao|foi mal)[\s,]+(eu\s+)?(demorei|atrasei|sumi|esqueci|me enganei|errei|me confundi|nao vi|nao respondi|estava em reuniao|estava ocupad\w*|estava sem sinal)/g,
  ],
  pesoDesculpa: 0.4,

  padroesOperacionais: [
    /\b(cancel(ar|ei|ou|amento)|remov(er|i|eu)|remocao|exclu(ir|i|iu|sao)|apag(ar|uei)|delet(ar|ei)|desativ(ar|ei|acao)|bloque(ar|ei|io)|suspen(der|di|sao)|estorn(ar|ei|o)|inativ(ar|ei)|transferi(r|ncia)|alter(ar|acao)|trocar|migr(ar|acao)|process(ar|amento))\s+((de|do|da|dos|das|o|a|os|as|um|uma|esse|essa|esses|essas|este|esta|meu|minha|nosso|nossa|todos|todas)\s+){0,3}(\S+\s+){0,2}?(cadastr\w*|contrat\w*|client\w*|produt\w*|plan\w*|bolet\w*|titul\w*|fatur\w*|login\w*|tarefa\w*|ordem|ordens|os|servic\w*|registr\w*|usuari\w*|ite(m|ns)|nota\w*|cobranc\w*|parcela\w*|equipament\w*|onu\w*|conex\w*|lancament\w*|assinant\w*|pedido\w*|remessa\w*|retorno\w*|arquivo\w*|regra\w*|perfil\w*|carne\w*|pix|debito\w*|desconto\w*|venda\w*)/g,
  ],

  // ---------- PERGUNTAS ----------
  // Pergunta sem revolta (cliente perguntando e esperando resposta) não vai para o vermelho:
  // o negativo dela é multiplicado por este fator. "Revolta" = termo com peso <= pesoRevolta,
  // palavrão, CAPS, "!!", emoji negativo ou sarcasmo.
  fatorPerguntaSemRevolta: 0.3,
  pesoRevolta: -1.5,
  inicioPergunta: /^(como|qual|quais|quando|onde|quem|quanto|quantos|quantas|por que|porque|pq|sera que|consegue|conseguem|consegui|pode|podem|poderia|poderiam|voces podem|voce pode|tem como|teria como|e possivel|da pra|da para|existe|ha como|o que|oque|devo|preciso|posso|tem algum|tem alguem)\b/,

  // Palavras que invertem um termo POSITIVO logo depois (até 2 palavras):
  // "nao ficou bom", "nem funcionou" → vira negativo
  negadores: ['nao', 'nem', 'nunca', 'jamais', 'nada', 'nenhum', 'nenhuma', 'sem'],
  pesoNegacao: -0.8,
  // Neutros que, negados, viram negativos: "não ficou bom", "não está certo"
  neutrosNegaveis: ['bom', 'boa', 'certo'],
  // Agradecimentos NUNCA são negados: "não obrigado" (sem vírgula) = "não, obrigado",
  // recusa educada de quem não precisa de mais nada.
  naoNegaveis: ['obrigad*', 'muito obrigad*', 'brigad*', 'obg', 'obgd*', 'valeu', 'vlw', 'agradeco',
    'agradecid*', 'grat*', 'por gentileza', 'por favor'],
  // Negador antes de termo NEGATIVO: "nao estou irritado", "nao e urgente", "nao quero cancelar"
  // → o estresse é anulado e vira um leve positivo
  pesoNegativoNegado: 0.4,

  // ---------- 🙃 SARCASMO ----------
  // Elogios que podem ser irônicos. Viram NEGATIVOS quando aparecem com:
  //  a) reclamação na mesma mensagem (soma negativa <= sarcasmoNegativoMinimo)
  //     "Ótimo, caiu de novo" · "Parabéns, mais uma vez sem sistema"
  //  b) emoji de deboche (🙄 🙃 😒 🤡)          "Perfeito 🙄"
  //  c) entre aspas                              'Excelente "atendimento"'
  //  d) logo depois de uma reclamação do cliente, sem o atendente falar no meio,
  //     em mensagem curta só de elogio           "não funcionou de novo" → "ótimo"
  // "obrigado", "valeu", "deu certo", "funcionou", "beleza", "show", "top", "legal" NÃO estão aqui:
  // são confirmações curtas e quase sempre sinceras ("beleza, funciona").
  elogiosIronicos: [
    'otimo*', 'otima*', 'perfeito', 'perfeita', 'ah perfeito', 'maravilha', 'maravilhos*', 'que maravilha',
    'excelente*', 'parabens', 'sensacional', 'incrivel', 'que incrivel', 'fantastic*', 'espetacular', 'fenomenal',
    'excepcional', 'extraordinari*', 'que demais', 'show de bola', 'muito bom', 'adorei', 'amei', 'que rapidez', 'que agilidade', 'que eficiencia', 'super rapido',
    'muito rapido', 'rapidinho', 'otimo atendimento', 'atendimento otimo',
  ],
  // Frases sempre irônicas: anulam qualquer elogio da mesma mensagem
  frasesIronicas: [
    'so que nao', 'sqn', 'aham sei', 'sei sei', 'ah claro', 'ah claro vou', 'claro ne', 'ta bom ne',
    'ta bom entao ne', 'me engana que eu gosto', 'conta outra', 'ajuda nenhuma', 'obrigad* por nada',
    'valeu por nada', 'muito obrigad* pela ajuda nenhuma',
  ],
  emojisDeboche: ['🙄', '🙃', '😒', '🤡', '😑'],
  sarcasmoNegativoMinimo: -0.8, // reclamação mínima na mesma mensagem
  pesoSarcasmo: -1.5,           // o elogio é anulado e entra isso no lugar
  sarcasmoMaxPalavras: 4,       // regra (d): só mensagens curtas ("ótimo", "que maravilha hein")
  sarcasmoMensagemAnterior: -0.5, // regra (d): nota mínima da reclamação anterior
  // Se a mensagem tiver qualquer uma destas confirmações, NUNCA é sarcasmo (exceto frase irônica explícita)
  confirmacoes: ['obg', 'obgd*', 'brigad*', 'grat*', 'agradecid*', 'muito obrigad*', 'ficou claro', 'entendi agora', 'ajudou', 'ajudou muito', 'ajudou bastante',
    'funciona', 'funcionou', 'funcionando', 'ta funcionando', 'esta funcionando', 'deu certo',
    'resolvid*', 'resolveu', 'voltou', 'ja foi', 'obrigad*', 'agradeco', 'valeu', 'vlw', 'agora foi', 'agora sim',
    'tudo certo', 'certinho'],

  // Colaboração: também dispara o gatilho positivo (como agradecimento/confirmação)
  colaboracao: ['segue o', 'segue a', 'segue os', 'segue as', 'segue em anexo', 'em anexo', 'conforme solicitado',
    'conforme pediu', 'conforme voce pediu', 'como voce pediu', 'ja fiz', 'pronto fiz', 'fiz o procedimento',
    'fiz o que voce pediu', 'fiz o teste', 'ja testei', 'testei', 'ja reiniciei', 'reiniciei', 'ja atualizei', 'atualizei',
    'ja enviei', 'enviei', 'mandei', 'ja mandei', 'ja liberei', 'liberei', 'ja alterei', 'alterei', 'ja configurei',
    'configurei', 'ja cadastrei'],

  // ---------- CONTEXTO: insistência ----------
  // Mensagens de cobrança ("algum retorno?", "e aí?", "?", "previsão?"). A partir da 2ª
  // cobrança na janela, cada nova cobrança soma pesoInsistencia (cliente insistindo).
  cobrancas: /(algum retorno|alguma novidade|alguma resposta|e ai|previsao|prazo|ate quando|nada ainda|ainda nada|ainda nao|cade|^\?+$|^oi\?*$|^alo\?*$)/,
  pesoInsistencia: -1,

  // ---------- CONTEXTO: explicação ----------
  // Mensagem longa, sem revolta, ou narrando um cenário ("quando eu clico aparece erro",
  // "se o cliente não pagar ele fica bloqueado") é EXPLICAÇÃO: o negativo pesa menos.
  explicacaoMinPalavras: 12,
  marcadoresExplicacao: /(^|\s)(quando|se|caso|ao|apos|depois que|sempre que|toda vez que|por exemplo|exemplo|tipo assim|no caso|o cliente|os clientes|meu cliente|o assinante)[\s,]/,
  fatorExplicacao: 0.5,
  limiteExplicacao: -0.6,  // explicação nunca passa de "nota baixa" (😐)

  // ---------- CONTEXTO: relato detalhado (neutro) ----------
  // Cliente que DETALHA o problema (onde, quando, qual tela, qual erro) está relatando,
  // não reclamando: o negativo do relato é zerado (nota 0 → 😐). NÃO é satisfação.
  // Vale quando a mensagem não tem revolta, sarcasmo, cobrança nem frustração (termo <= -1):
  //  a) tem pelo menos informativaMinPalavras E traz detalhe (marcador de cenário,
  //     termo de detalhe ou número); ou
  //  b) responde a uma pergunta do atendente com pelo menos informativaMinPalavrasResposta
  //     E traz detalhe.
  informativaMinPalavras: 8,
  informativaMinPalavrasResposta: 4,
  // (genéricos demais como "sistema", "acessar", "linha" NÃO contam: "o sistema não funciona" é vago)
  termosDetalhe: /(^|\s)(tela|menu|aba|botao|campo|cadastr\w*|relatori\w*|modulo|erro|mensagem|aparece\w*|clic\w*|print|codigo|versao|configur\w*|integra\w*|bolet\w*|contrat\w*|fatur\w*|login|usuari\w*|pagina|link|filtro|rotina|processo|plano|onu|olt|radius|pix|nota fiscal|nfe|nfse|api|token|webhook|template|canal)(\s|$)/,
  pesoInformativa: 0, // relato detalhado não soma positivo (é neutro)
  frustracaoMax: -1, // termo com peso <= isso na mensagem = frustração → não conta como informativa

  // ---------- CONTEXTO: CAPS LOCK ----------
  // CAPS sozinho não é alerta (pode ser sem querer). Só pesa se a mensagem já tiver
  // reclamação. Se 2+ mensagens da janela estão em CAPS, é o jeito do cliente escrever → ignora.
  capsEstiloMinMsgs: 2,

  emojisPositivos: ['😊', '🙂', '😀', '😃', '😄', '😁', '🥰', '😍', '👍', '🙏', '❤', '👏', '✅', '🤝', '😉', '💙', '💚', '🥳'],
  emojisNegativos: ['😡', '😠', '🤬', '😤', '😒', '🙄', '🙃', '🤡', '😞', '😔', '😢', '😭', '👎', '💢', '😩', '😫', '😑'],
  pesoEmoji: 1,

  // Risada: pontua levemente positivo E suaviza o negativo da mesma
  // mensagem e das vizinhas ("voce vai me matar kkk" não é estresse)
  risada: /(^|[^a-z])(k{3,}|(ha){2,}h?|(he){2,}|(rs){2,}s?|hu(a){2,})([^a-z]|$)|😂|🤣|😅|😆/,
  pesoRisada: 0.5,
  fatorRisadaNoNegativo: 0.35,

  // Sinais de intensidade
  pesoInterrogacoes: -1.5,   // mensagem SÓ com "???" (3 ou mais): cobrança insistente → insatisfeito.
                             // "??"/"???" no fim de uma frase ("saberia me informar um prazo??") não pesa.
  pesoCapsLock: -0.8,        // mensagem quase toda em MAIÚSCULAS
  fatorIntensidade: 1.3,     // "!!" ou CAPS amplificam o negativo
  limiteMensagem: 2,         // score de cada mensagem fica entre -2 e +2
};
