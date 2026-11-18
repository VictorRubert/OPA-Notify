# Política de Privacidade do Opa!Notify

Última atualização em 18 de novembro de 2026.

O Opa!Notify é uma extensão para acompanhar a fila **Meus atendimentos** no Opa! Suite. Esta política descreve os dados acessados pela extensão, onde ficam armazenados e como são usados.

## Dados acessados e finalidade

- A extensão lê, nas páginas do Opa! Suite, os identificadores e protocolos dos atendimentos, o nome da empresa ou do contato, as etiquetas, o estado do motivo e os dados necessários para identificar entradas, saídas e novas mensagens de clientes. Esses dados permitem comparar a fila, organizar os cartões por etiqueta e abrir a conversa ao clicar em um aviso.
- Quando o Opa disponibiliza uma nova mensagem do cliente, a extensão lê seu identificador e até 500 caracteres do texto para mostrar a prévia no cartão. Fotos, áudios e vídeos são indicados por frases genéricas, sem mostrar o nome do arquivo. Se o texto não estiver disponível, o cartão mostra “Mensagem recebida”. Os cartões podem aparecer na aba do Opa e, se a opção correspondente estiver ligada, em outras abas HTTP ou HTTPS. As notificações do sistema são usadas para entradas e saídas da fila e podem mostrar protocolo e nome da empresa ou do contato. Mensagens de clientes não geram notificações do sistema.
- Para mostrar a inatividade na interface nova, a extensão lê a data e a direção da última mensagem. Quando o Opa omite a data da mensagem, usa a data de atualização do atendimento. A etiqueta aparece no cartão e esses horários não são guardados no histórico.
- A extensão usa as preferências escolhidas no popup, como canais de aviso, som, volume, duração, posição, etiquetas e destaque visual. Se o usuário escolher um arquivo de áudio personalizado, ele é salvo para reproduzir o som do alerta.

## Armazenamento e conservação

O armazenamento local da extensão no Chrome contém as preferências, o áudio personalizado, a base atual de atendimentos, o histórico dos cinco últimos atendimentos recebidos e dados temporários necessários para evitar avisos duplicados ou confirmar uma saída da fila. A base e o histórico podem conter protocolo, identificador, nome da empresa ou do contato e horário. O texto das mensagens de clientes não é salvo nesse histórico nem na base de atendimentos.

O armazenamento de sessão do Chrome contém identificadores e horários de eventos recentes, resultados de entrega dos avisos e, enquanto uma notificação do sistema de entrada ou saída estiver ativa, os dados necessários para abri-la no Opa. Esses dados de sessão são descartados quando a sessão do navegador termina. A base e o histórico locais permanecem enquanto os dados da extensão estiverem no Chrome. O usuário pode remover esses dados apagando os dados da extensão ou desinstalando-a.

A função **Copiar diagnóstico** só é executada quando o usuário a aciona. O texto copiado informa configurações, versões, horários, contagens e resultados de entrega, sem incluir nomes de clientes, protocolos ou conteúdo de conversas. O envio desse diagnóstico a outra pessoa depende de uma ação do usuário.

## Acesso a páginas e compartilhamento

O monitoramento da fila e das mensagens funciona nas páginas `suporte.ixcsoft.com.br` e `opasuiteapi.ixcsoft.com.br`. Na interface nova, a extensão observa a conexão que o próprio Opa abriu e repete consultas de leitura da fila já usadas pela página para verificar mudanças. A comunicação com o Opa segue a sessão do usuário nesse serviço.

A permissão para acessar páginas HTTP e HTTPS permite apresentar os cartões de aviso em outras abas, quando essa opção está ativada. Nelas, a extensão usa o endereço da aba para entregar o cartão e abrir a aba correta do Opa ao clicar. O cartão pode mostrar nome da empresa e texto de mensagem na tela dessas abas. A extensão não lê o conteúdo das páginas de outros sites para monitorar atendimentos.

O Opa!Notify não envia os dados acessados a servidores próprios do desenvolvedor, não usa serviços de análise de comportamento, não exibe publicidade e não vende dados. O Opa! Suite e o Chrome tratam os dados sob suas próprias políticas e configurações.

## Controles do usuário

No popup da extensão, o usuário pode desativar o Opa!Notify, os avisos visuais, os cartões em outras abas, as notificações do sistema, os avisos de novas mensagens e o agrupamento por etiqueta. A opção **Refazer leitura inicial** substitui a base de comparação da fila, sem apagar o histórico dos cinco últimos recebimentos.

## Contato e alterações

Esta política pode ser atualizada quando as funcionalidades ou o tratamento de dados mudarem. Para dúvidas ou solicitações sobre o Opa!Notify, abra uma solicitação no repositório do projeto. [Contato pelo GitHub Issues](https://github.com/VictorRubert/OPA-Notify/issues)
