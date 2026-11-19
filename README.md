# Opa!Notify v1.6.7

Extensão Chrome que avisa quando um atendimento entra ou sai de **Meus atendimentos** no [Opa! Suite](https://suporte.ixcsoft.com.br/).

## Compatibilidade

Endereços suportados: `https://suporte.ixcsoft.com.br/` e `https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress`. As rotas dos dois domínios são reconhecidas, permitindo navegar sem perder o monitoramento.

Reconhece automaticamente a interface antiga e a nova (Chrome 111 ou superior). Na interface nova, acompanha as listas completas pela conexão Socket.IO já aberta pelo Opa e revalida a fila a cada 15 segundos, repetindo apenas as consultas de leitura capturadas nessa sessão, com os mesmos filtros e sem trocar de fila; rolar a fila não é tratado como saída de atendimento. Usa o nome do contato quando não há empresa vinculada.

Após instalar ou atualizar, **recarregue a aba do Opa** para conectar o monitor à nova interface. Mantenha **Em andamento → Meus atendimentos** selecionado, sem busca ou filtros adicionais. Listas paginadas só são comparadas depois de recebidas todas as páginas. Sem uma lista completa, a extensão aguarda em vez de gerar alertas de saída. A confirmação de saída exige uma nova resposta do servidor.

## Funcionalidades

- Cartões no Opa e em outras abas, além de notificações do sistema, com protocolo e empresa.
- Histórico dos 5 últimos atendimentos recebidos.
- Destaque roxo e etiqueta **NOVO** no atendimento mais recente.
- Destaque e lembrete para motivo não preenchido.
- Na interface nova, etiqueta de inatividade no cartão: laranja quando aguarda o cliente e vermelha quando aguarda resposta do atendente. O tempo vem da última mensagem; se o Opa omitir a data dela, usa o horário de atualização do atendimento. Mensagens automáticas não recebem essa etiqueta.
- Sons integrados ou personalizados em MP3, WAV ou OGG (até 2 MB).
- Atendimentos cujo único status é **ASSUMIDO AGENTE SMITH** não geram avisos de entrada, saída ou mensagem, nem recebem o destaque de novo atendimento. Outras etiquetas, como prioridade ou cliente, não mudam essa regra.

Os avisos de recebimento e de mensagem abrem a conversa ao clicar. A conversa que já estiver aberta na tela do atendente não gera avisos. O cartão de saída permite copiar o protocolo.

Na interface nova, um cartão que aparece em **Meus atendimentos** após a leitura inicial também pode gerar o aviso de entrada. Se o protocolo ainda estiver indisponível, o aviso mostra o nome e abre a conversa pelo identificador do cartão. Quando a lista completa confirma o protocolo, o histórico é atualizado sem repetir o aviso.

## Instalação e atualização

1. Baixe e extraia o ZIP da versão ou clone este repositório.
2. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
4. Abra o Opa e selecione **Meus atendimentos**.

Para atualizar uma instalação manual, substitua os arquivos na pasta utilizada, recarregue a extensão e a aba do Opa. A primeira leitura após cada recarga cria uma base silenciosa, sem avisar sobre atendimentos já existentes.

## Configurações

O popup reúne o estado da fila, os cinco atendimentos recentes e atalhos para Notificações, Etiquetas, Visual, Som e Manutenção. Os controles têm foco visível para uso por teclado e respeitam a preferência de movimento reduzido.

- **Notificações:** ativação, aviso visual, duração de 5 a 30 segundos, posição em um dos quatro cantos (padrão: superior esquerdo), avisos em outras abas, notificações do sistema e aviso de atendimento finalizado. Os canais podem ser ativados ou desativados separadamente.
- **Avisar novas mensagens do cliente** vem ligado para todos os atendimentos nas novas instalações. A atualização respeita a preferência já salva. Escolha todos os atendimentos ou somente etiquetas prioritárias. Na interface nova, a extensão lê o identificador e a direção da mensagem quando o Opa os disponibiliza. Se várias mensagens chegam entre duas leituras e o Opa expõe apenas a última, pode haver um único aviso. O cartão mostra a empresa e o texto recebido; fotos, áudios e vídeos aparecem como “Enviou uma foto”, “Enviou um áudio” e “Enviou um vídeo”. Avisos de mensagem não tocam som nem geram notificações do sistema. Quando o Opa não disponibiliza o texto, mostra “Mensagem recebida”. Na antiga, a extensão acompanha o indicador de não lida e o contador quando disponível.
- **Agrupar por etiqueta** começa desligado. Ao ativar, **Somente as listadas** já vem preenchido. A fila usa as etiquetas **AGENTE SMITH** na ordem **AJUDA → FINALIZADO → AJUDANDO → PAUSA → ASSUMIDO**, de cima para baixo. Os demais atendimentos ficam em **Sem grupo**. Você pode editar as listas e a ordem no popup.
- **Visual:** destaque roxo, tipo de preenchimento e controles de destaque, pisca e pop-up do motivo.
- **Som:** escolha do áudio, arquivo personalizado e volume.
- **Manutenção:** remoção da marcação atual, **Refazer leitura inicial**, que recria a base sem apagar o histórico, e **Copiar diagnóstico**.

## Permissões e limites

A aba do Opa precisa permanecer aberta, com **Meus atendimentos** selecionado e sem busca preenchida. A revalidação automática da interface nova depende de capturar as consultas do Opa após a recarga. Há também uma verificação adicional a cada minuto pelo serviço da extensão, mesmo quando outra aba está ativa. O Chrome pode atrasar alarmes; abas suspensas ou descartadas e uma fila que o próprio Opa não atualiza em segundo plano impedem a detecção. O acesso a sites HTTP/HTTPS permite exibir cartões em outras abas; o monitor de atendimentos funciona apenas no Opa. Páginas protegidas do Chrome podem bloquear os cartões.

As notificações do sistema exigem permissão e podem ser ocultadas pelo modo Não perturbe. Alterações no HTML do Opa podem exigir atualização dos seletores da extensão.

## Testes

Em caso de falha, **Copiar diagnóstico**, em Manutenção, copia as versões, configurações dos canais, resultados de entrega e nomes/contagens dos eventos da fila, sem conversas ou dados dos clientes. Para os testes automatizados de lógica, execute com Node.js:

```sh
node --test tests/*.test.cjs
```

Para verificar a leitura e os destaques nas duas interfaces com exemplos fictícios, execute `node tests/interfaces.browser.cjs`. O ciclo integrado de recarga, recebimento e saída é verificado com `node tests/queue-flow.browser.cjs`; a detecção automática sem trocar de fila, com `node tests/queue-refresh.browser.cjs` em um ambiente com Playwright e Chromium (`CHROMIUM_PATH` permite escolher o executável).

Os testes usam APIs Chrome e eventos de rede simulados; a integração deve ser validada em uma instalação real da extensão.

Consulte a [Política de Privacidade](PRIVACY.md).

O agrupamento e o acompanhamento de mensagens usam o Opa!Alert de JanineMilena como referência. [Licença MIT](LICENSE).
