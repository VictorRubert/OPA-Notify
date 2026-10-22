# Opa!Notify v1.4.0

## Notificações em outras abas e no sistema

- **Avisos em outras abas**: mostra o mesmo cartão nas páginas HTTP/HTTPS abertas, sem executar nelas o monitor de atendimentos. Ao clicar em um recebimento, volta à janela/aba de origem e abre o atendimento; na saída da fila, o cartão mantém a ação de copiar o protocolo.
- **Notificações do sistema**: mostra “Um atendimento novo foi recebido!” ou “Um atendimento acabou de sair da sua fila!”, seguido de `protocolo - empresa`. O clique retorna ao Opa. O som continua sendo controlado pela opção de som da extensão, evitando duplicação pelo sistema.
- As duas opções ficam no popup, são independentes e vêm ativadas. **Aviso visual** controla o cartão na aba do Opa. Desligar **Extensão ativa** interrompe a detecção de novos eventos.
- A aba do Opa deve permanecer aberta. Páginas internas do Chrome, Chrome Web Store e outras páginas protegidas podem bloquear os cartões. Notificações do sistema dependem das permissões do Chrome e do sistema e do modo Não perturbe.
- A atualização solicita acesso a sites HTTP/HTTPS para exibir os cartões e a permissão `notifications`. O conteúdo das outras abas não é enviado a servidores; a detecção continua restrita ao Opa.
- Para instalar, carregue a raiz deste repositório em `chrome://extensions` → Modo do desenvolvedor → Carregar sem compactação. Após atualizar, recarregue a extensão e a aba do Opa.
- Para testar: use as simulações no popup com a aba do Opa ativa, depois alterne para outro site. Teste também os canais desativados e o clique nos avisos. Monitores reais dependem de uma sessão autorizada no Opa.
- Testes automatizados: `node --test tests/notifications.test.cjs` (APIs Chrome simuladas). Não substituem a validação em uma instalação real da extensão. O Chromium gerenciado do ambiente em nuvem bloqueia extensões adicionais por política administrativa.

---

# Opa!Notify v1.3.2

Extensão Chrome independente para avisar quando um atendimento é recebido ou finalizado em **Meus atendimentos** no Opa! Suite.

## O que a extensão faz

- Lê apenas a lista exibida quando o filtro `Meus atendimentos` está selecionado.
- Salva o identificador interno, o protocolo `OPA...` e o nome da empresa.
- Compara a leitura atual com a leitura anterior.
- Usa o protocolo como identificador principal, evitando depender somente da quantidade.
- Notifica quando um protocolo novo entra na fila.
- Mantém no popup o histórico dos 5 últimos atendimentos recebidos, com empresa, protocolo, data e horário.
- Pode notificar quando um protocolo deixa de aparecer na fila.
- Mostra os avisos no canto superior esquerdo da tela.
- Toca um som padrão, o som integrado **Pop** ou um arquivo personalizado.
- Permite silenciar, ajustar o volume e escolher a duração do aviso.
- No aviso de recebimento, o clique procura, destaca e abre o atendimento.
- No aviso de finalização, o clique copia o protocolo e exibe `Protocolo copiado`.
- Ignora leituras enquanto a busca da lista está preenchida, evitando falsos avisos de finalização.
- Confirma o desaparecimento por alguns segundos antes de avisar, reduzindo falsos positivos durante atualizações da página.
- Após 8 horas sem leitura, cria uma nova base silenciosa para evitar alertas em massa no início do expediente.

## Destaque roxo do atendimento mais recente

- Todo atendimento novo detectado pode receber um fundo roxo escuro e mais sutil no cartão da fila do Opa.
- A cor usada como referência continua sendo o roxo `#7C3AED`, mas aplicada de forma menos vibrante.
- Apenas um atendimento fica marcado por vez.
- A marcação não é removida ao abrir, clicar, atualizar a página ou fechar o popup.
- Quando outro atendimento novo é recebido, o destaque anterior é removido e transferido para o novo atendimento.
- Caso vários atendimentos entrem na mesma leitura, o protocolo mais recente fica marcado.
- O popup possui a opção **Destaque roxo no atendimento novo**, que ativa ou desativa essa alteração visual.
- O popup também possui **Tipo de preenchimento**, com duas opções:
  - **Degradê sutil**: sugestão principal; escurece o fundo com roxo apenas em degradê, mantendo o atendimento visível sem ficar chamativo demais.
  - **Preenchimento total**: deixa todo o cartão com um fundo roxo escuro uniforme.
- Ao desativar a opção, os atendimentos voltam ao visual normal do Opa.
- O popup permite digitar um protocolo visível e aplicar o destaque manualmente para teste.
- Um teste substitui a marcação atual, mas não entra no histórico e não reproduz som.
- O botão **Remover marcação atual** retira imediatamente o destaque roxo do atendimento marcado.
- Após a remoção manual, nenhum atendimento fica marcado até a chegada de um novo atendimento ou a execução de outro teste por protocolo.


## Destaque do motivo não preenchido

- Quando um atendimento está aberto, a extensão verifica o campo **Informar motivo do atendimento**.
- Se o campo estiver com o valor padrão `Selecione...`, o próprio campo é preenchido com roxo no mesmo padrão visual da etiqueta `NOVO`.
- Ao escolher um motivo válido, o destaque roxo do campo some automaticamente.
- O popup possui a opção **Destacar motivo não preenchido**, permitindo ativar ou desativar essa verificação.
- O seletor principal utilizado é `#select2-select_motivos-container`, com fallbacks para campos Select2 relacionados a motivo.

## Histórico de atendimentos

O popup mostra os 5 últimos atendimentos realmente recebidos pela extensão:

- O atendimento mais recente aparece primeiro e recebe a identificação **Atual**.
- São exibidos nome da empresa, protocolo, data e horário do recebimento.
- A primeira leitura e os testes simulados não entram no histórico.
- O histórico permanece salvo ao fechar o popup ou reiniciar o Chrome.
- A opção **Refazer leitura inicial** não apaga o histórico.

## Avisos

### Atendimento recebido

Exibe:

- Ícone de sino;
- Texto `Novo atendimento recebido`;
- Nome da empresa;
- Protocolo.

Ao clicar, a extensão tenta abrir o atendimento correspondente.

### Atendimento finalizado

Exibe:

- Ícone de copiar;
- Texto `Atendimento Finalizado`;
- Nome da empresa;
- Protocolo.

Ao clicar, o protocolo é copiado para a área de transferência e o aviso muda para `Protocolo copiado`.

A opção **Avisar atendimento finalizado** pode ser ativada ou desativada no popup da extensão.

## Instalação manual

1. Extraia a pasta `OpaNotify-v1.3.2`.
2. Abra `chrome://extensions` no Google Chrome.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta `OpaNotify-v1.3.2`.
6. Abra `https://suporte.ixcsoft.com.br/`.
7. Deixe o filtro **Meus atendimentos** selecionado.

A primeira leitura cria apenas a base inicial. Ela não avisa os atendimentos que já estavam na tela.

## Testes

No popup da extensão existem estes testes:

- **Testar destaque roxo**, usando um protocolo digitado pelo usuário;
- **Remover marcação atual**, para retirar manualmente o destaque roxo;
- **Simular atendimento recebido**;
- **Simular atendimento finalizado**;
- **Testar som**.

Para testar o aviso de finalização, clique no cartão exibido e confirme se o texto muda para `Protocolo copiado`.

## Sons

- A opção **Pop** usa o arquivo `sounds/pop.mp3` incluído na própria extensão.
- Também é possível selecionar um arquivo personalizado.
- Formatos aceitos: MP3, WAV e OGG.
- Tamanho máximo: 2 MB.
- O arquivo é salvo localmente no armazenamento da própria extensão.

## Recriar a base

Use **Refazer leitura inicial** quando quiser que a lista atual seja considerada conhecida. Isso é útil depois de instalar, atualizar ou testar a extensão.

## Seletores utilizados

- Filtro pessoal selecionado:
  `button[data-id="meus_atendimentos"].selected_filtro_user_status`
- Atendimento:
  `.chat[data-id]`
- Empresa:
  `.corpo > .title`
- Protocolo:
  texto no formato `OPA` seguido por ao menos seis números.

## Observação

A extensão depende da estrutura atual do HTML do Opa! Suite. Caso as classes ou atributos da página sejam alterados, os seletores do arquivo `content/content.js` precisarão ser revisados.
## Novidades da versão 1.2.5

- Adicionada a etiqueta fixa `NOVO` nos atendimentos destacados em roxo.
- A etiqueta é inserida junto às etiquetas do próprio atendimento, no canto inferior direito, como o último item da área de tags.
- A etiqueta segue as mesmas regras do preenchimento roxo: aparece quando o destaque roxo está ativo e existe um atendimento marcado; desaparece ao remover a marcação, desativar o destaque roxo ou quando outro atendimento assume o destaque.
- Não há opção para desligar apenas a etiqueta `NOVO`; ela faz parte do destaque visual.


## Versão 1.2.5

- Adicionada a opção **Somente Etiqueta** no campo **Tipo de preenchimento**.
- Quando esta opção está ativa, o preenchimento roxo é removido e permanece apenas a etiqueta **NOVO** no atendimento marcado.
- As opções existentes foram mantidas: **Degradê sutil** e **Preenchimento total**.
- A opção de ativar/desativar o destaque roxo continua controlando toda a marcação visual do atendimento.


## Novidades da versão 1.3.2

- O destaque de **motivo não preenchido** agora usa vermelho forte e vibrante.
- Quando o motivo estiver em `Selecione...`, o campo pisca 5 vezes e depois fica vermelho estático até o motivo ser preenchido.
- A opção **Destacar motivo não preenchido** continua podendo ser ativada ou desativada.

## Novidades da versão 1.2.7

- Adicionada a opção **Destacar motivo não preenchido**.
- Quando o campo **Informar motivo do atendimento** estiver em `Selecione...`, a extensão pisca o campo em vermelho forte 5 vezes e depois mantém o campo vermelho estático enquanto não houver motivo preenchido.
- Ao selecionar um motivo válido, o destaque é removido automaticamente.
- A opção pode ser ativada ou desativada no popup.


## v1.3.2 — aviso de motivo antes de trocar de atendimento

Quando o atendimento atual estiver sem motivo (`Selecione...`) e o atendente tentar abrir outro atendimento, a extensão exibe um modal dentro da página do Opa. O atendente pode voltar ao atendimento atual ou continuar mesmo assim. A troca normal não é afetada quando existe um motivo preenchido.


## v1.3.2
- Corrigido o destaque do motivo sem preenchimento: o campo pisca 5 vezes via JavaScript e depois permanece vermelho estático.


## v1.3.2
- Novo atendimento não dispara o aviso de motivo ao ser aberto.
- Nova opção para ativar/desativar o pisca-pisca do motivo.
- O destaque vermelho do motivo permanece estático quando o pisca está desativado.


## Cobrança de motivo

- A cobrança do popup pode ser ligada ou desligada nas configurações.
- Ao trocar de atendimento, se o motivo estiver preenchido, nenhuma cobrança é feita.
- Se o motivo estiver vazio e o atendimento estiver nos 5 últimos registros, a cobrança só ocorre após 5 minutos desde a entrada na fila.
- Se o atendimento não estiver mais nos 5 últimos registros, ele é considerado antigo e a cobrança ocorre normalmente.
- A abertura de um atendimento novo não gera cobrança imediata.
