# 🌡️ Termostato (v2.22.0)

Mede o humor do cliente e marca a pendência externa automaticamente no Opa.

## Instalar
1. `chrome://extensions` → ativar **Modo do desenvolvedor**
2. **Carregar sem compactação** → selecionar esta pasta
3. Remover a extensão antiga "Pendência Externa Automática" (as duas juntas brigariam pelo checkbox)

## Pendência externa (obrigatória; a extensão só MARCA, nunca desmarca)
O tempo conta pela **fila do atendente** (campo "Nesta fila" na aba **Detalhes** do painel lateral):

| Tempo na sua fila | O que acontece |
|---|---|
| menos de 5 min | o cronômetro corre e marca no segundo em que completar 5 min |
| de 5 min até 8 h | marca assim que o atendimento é aberto |
| mais de 8 h | não marca |

Também não marca quando: tem **só** a etiqueta verde **ASSUMIDO AGENTE SMITH** (com a amarela
**AJUDANDO AGENTE SMITH** junto, marca), ou o atendente já desmarcou manualmente esse atendimento.
Resposta do cliente não importa. Se o atendente marcar de novo na mão, o automático volta a valer.

O Opa mostra o tempo arredondado ("há 5 minutos" pode ser 4 min 30 s); a extensão usa sempre o
mínimo possível e espera o restante, para nunca marcar antes da hora.

**Como marca no Opa novo:** a pendência é o item **"Pendência externa"** do menu de ações do
card (botão direito no card / setinha ⌄). Esse item **alterna** (marca/desmarca), então a
extensão decide pelo histórico da conversa:

| Última mensagem de sistema sobre pendência | O que a extensão faz |
|---|---|
| "Fulano **marcou** pendência externa" | nada (já está marcada) |
| "Fulano **desmarcou** pendência externa" | nada, nunca remarca (desmarcado na mão) |
| nenhuma | abre um menu com "Pendência externa", clica e confirma, se pedir |

Menu usado: botão direito no card da lista; se o card não estiver desenhado na lista, o menu ⋮ do
topo da conversa. **O menu também mostra o estado real**: "Desmarcar pendência externa" (card) ou
"Pendência externa ✓" (⋮) = já marcada → a extensão fecha o menu sem clicar e lembra disso, sem
reabrir menus nesse atendimento. O menu abre **invisível** (menos de 1 s) e o cursor volta para
onde estava (ex.: campo de mensagem). Isso cobre atendimentos longos em que a mensagem "marcou…" não está
carregada na tela. Se não achar o menu, diz o motivo no console e tenta de novo em 5 min.

Depois de clicar, ela espera a mensagem "marcou pendência externa" e não clica de novo nesse
atendimento por 3 min (um 2º clique desmarcaria). O menu pisca aberto por um instante.
Se alguém marcar de novo na mão depois de desmarcar, a última mensagem vira "marcou" e está tudo certo.

**Diagnóstico rápido (console da página, sem trocar de contexto):**
`JSON.parse(document.documentElement.dataset.termostato)` → versão, motivo, tempo na fila, estado
da pendência, etiquetas e se o card foi achado na lista.

**Diagnóstico:** no console (F12) aparece `[Termostato] Pendência: …` com o motivo de ter marcado ou não.
Configuração em `src/config.js` (`TIMEOUT_MINUTES`, `IDADE_MAX_HORAS`, `TIMER_REFERENCIA`).

## Termômetro de humor
Selo no canto inferior esquerdo de cada card da lista, abaixo das etiquetas: emoji + barrinha vertical.

| | Categoria | Barra |
|---|---|---|
| 😡 | Estressado | vermelha |
| 😐 | Neutro | amarela |
| 😊 | Satisfeito | verde |
| 🚀 | Muito satisfeito | colorida (arco-íris), brilhando |
| ? (cinza) | Não mapeado | cinza listrada |

🚀 aparece quando a média passa de +1,3 com pelo menos 2 mensagens positivas na janela.

**Gatilhos (valem mais que a média):**
- 😡 na hora: a última mensagem entendida é muito negativa (nota ≤ -1,5).
- 😊 na hora: o cliente **agradeceu ou confirmou** ("obrigado pela explicação", "deu certo",
  "funciona", "ficou claro") em uma das 2 últimas mensagens entendidas e **não reclamou depois**.
  Relatos de problema anteriores não seguram mais o cliente no 😐.

- Analisa as **5 últimas mensagens do cliente no atendimento atual** (a partir do "Aberto em"): texto + transcrição de áudio; ignora citações, prévias de link e anexos.
- Mensagens recentes pesam mais. Se a última for muito negativa, vira 😡 na hora.
- Atendimento aberto: atualiza ao vivo. Os outros mostram o último humor medido (salvo por 7 dias).
- Atendimento nunca aberto → ? cinza.
- **Passe o mouse no selo** para ver a nota de cada mensagem e quais termos pesaram.

### Relatar o problema = 😐 · Colaborar = 😊
Relatar o problema, mesmo com detalhes, é neutro: o cliente está descrevendo, não reclamando
(o negativo do relato é zerado). A **satisfação começa na colaboração**: o cliente faz o que o
atendente pediu.

| Mensagem | Humor |
|---|---|
| "meu sistema caiu" | 😐 (relato vago, nota baixa) |
| "quando eu tento acessar o cadastro do cliente, ele cai, tem como verificar?" | 😐 (relato detalhado, nota 0) |
| "ao clicar em salvar aparece erro 500" | 😐 (relato detalhado, nota 0) |
| "segue o print", "pronto, já reiniciei", "já testei conforme você pediu", "liberei o acesso" | 😊 (colaboração, +0,7) |
| "testei e continua sem funcionar" | 😐 (colaborou, mas o problema segue) |

Colaboração dispara o gatilho positivo como o agradecimento. **Depois de estresse** (mensagem com
nota -1,5 ou pior na janela), colaborar ajuda a média, mas só agradecimento/confirmação
("deu certo", "obrigado") tira do vermelho.

### O que NÃO é estresse
- **Operações no sistema** ("remover cadastros do cliente", "remoção de produtos", "cancelar o contrato
  do cliente", "processar os boletos") → neutras. Ameaça só conta em frases como "vou cancelar o sistema",
  "cancelar com vocês", "vou processar vocês".
- **Relato de problema** ("sem acesso", "caiu", "não funciona") → nota baixa, mas sozinho fica 😐.
- **"de novo" / "novamente" avulsos** → quase não pesam (só informam que repetiu).
- **Pergunta sem revolta** ("Estamos sem acesso, podem verificar?") → o negativo cai para 30%.

- **Confirmações curtas** ("beleza, funciona", "show, voltou", "ok, funcionando") → positivas e
  nunca tratadas como sarcasmo.
- **Explicação de cenário** (mensagem longa, ou com "quando", "se", "caso", "por exemplo", "o cliente…")
  → o negativo cai pela metade e nunca passa de nota baixa (😐).
- **CAPS LOCK sozinho** → ignorado (pode ter sido sem querer). Só pesa junto com reclamação, e se o
  cliente escreve sempre em maiúsculas (2+ mensagens), é tratado como estilo e ignorado.

- **"Bom" sozinho** → neutro ("Bom, vou testar"). "Não ficou bom" continua negativo.

### Insistência = insatisfação
- Cobrança de prazo: "ainda não há nenhum prazo?", "nenhuma previsão?", "até quando?", "nada ainda?", "cadê?"
- Mensagem só com interrogações ("?", "??", "???") = cobrança. "??"/"???" no fim de uma frase ("saberia me informar um prazo??") não pesa.
- Cobranças repetidas sem o atendente responder ("algum retorno?" → "?" → "alguma novidade?"):
  a partir da 2ª, cada cobrança pesa mais.
- Uma cobrança isolada e educada ("algum retorno?", "qual o prazo?") continua neutra.

### O que É estresse (vermelho, mesmo em pergunta)
Ameaça, palavrão, CAPS junto com reclamação, "!!", emoji de raiva, sarcasmo e frases agressivas:
"pela última vez", "você não resolve nada", "me passe para um humano", "já chega", "cansei",
"não serve pra nada", "perdendo a paciência".

### Áudio
O texto da transcrição do Opa ("Transcrição: …") entra na análise como se o cliente tivesse digitado.

### Sarcasmo 🙃
Elogios que costumam ser irônicos (ótimo, perfeito, maravilha, parabéns, que rapidez…) viram
**negativos** quando aparecem:
- junto com reclamação: "Ótimo, caiu de novo", "Parabéns, mais uma vez sem sistema"
- com emoji de deboche 🙄 🙃 😒 🤡: "Perfeito 🙄"
- com aspas: 'Excelente "atendimento"'
- sozinhos, logo depois de uma reclamação do cliente, sem o atendente falar no meio:
  "não funcionou de novo" → "ótimo"

Também há frases sempre irônicas: "só que não", "aham sei", "ah claro", "só pode ser piada",
"ajuda nenhuma", "obrigado por nada". "Obrigado", "deu certo" e "funcionou" nunca são tratados como ironia.

## Ajustar as regras
Tudo em **`src/humor-regras.js`**: termos sem acento e minúsculos, com peso
(negativo = estresse, positivo = satisfação, 0 = neutro). `obrigad*` casa qualquer final.
Limiares e janela ficam em `src/config.js`. Para ver a análise no console: `DEBUG: true`.

## Arquivos
```
src/config.js        configurações
src/storage.js       humor salvo + atendimentos bloqueados (chrome.storage)
src/opa-dom.js       seletores do Opa (se o Opa mudar o HTML, mexer aqui)
src/pendencia.js     regra da pendência
src/humor-regras.js  dicionário de termos  ← lapidar aqui
src/humor.js         motor de pontuação
src/lista.js         selo na lista de atendimentos
src/termometro.js    termômetro grande no cabeçalho (desligado: HUMOR_NO_CABECALHO)
src/main.js          observer + inicialização
```

## Desenvolvimento
### Receber atualizações
1. No VS Code: aba **Source Control** → **⋯** → **Pull** (ou `git pull` no terminal)
2. `chrome://extensions` → **↻** no Termostato
3. **F5** no Opa

### Testes das regras de humor
Precisa só do Node.js instalado:
```
node tests/run-all.js
```
Cada arquivo em `tests/` tem frases reais e o humor esperado. Ao mexer em
`src/humor-regras.js`, rode os testes para garantir que nada antigo quebrou —
e, ao corrigir um caso novo, acrescente a frase em um dos testes.
