# Cadastro do Termofy na Chrome Web Store

## Nome

Termofy

## Descrição curta

Alertas e priorização dos atendimentos do Opa! Suite, com etiquetas, inatividade e humor do cliente.

## Descrição completa

O Termofy ajuda atendentes a acompanhar e priorizar a fila **Meus atendimentos** no Opa! Suite.

Receba avisos quando um atendimento entra ou sai da fila e quando chega uma mensagem do cliente. Clique no aviso de entrada ou de mensagem para abrir a conversa. Os avisos podem aparecer na aba do Opa, em outras abas e, para entradas e saídas, como notificações do sistema. Cada canal pode ser configurado no popup.

Organize os cartões por etiquetas, destaque atendimentos novos e veja há quanto tempo um cliente aguarda resposta ou há quanto tempo o atendente aguarda o cliente. O histórico mostra os cinco últimos atendimentos recebidos.

O Termostato integrado mostra um selo de humor calculado localmente a partir das últimas mensagens carregadas na conversa. Na interface nova, também pode marcar a pendência externa automaticamente conforme as regras configuradas. Humor e pendência podem ser desativados separadamente.

Funciona nas interfaces antiga e nova do Opa! Suite nos endereços `suporte.ixcsoft.com.br` e `opasuiteapi.ixcsoft.com.br`. Para acompanhar a fila, mantenha uma aba do Opa aberta em **Em andamento → Meus atendimentos**. Busca e filtros adicionais pausam a comparação da fila.

O Termofy não exige conta própria e não envia o conteúdo dos atendimentos a servidores do desenvolvedor. Consulte a política de privacidade para saber quais dados são acessados e armazenados no Chrome.

## Único propósito

**Acompanhar e priorizar os atendimentos do usuário no Opa! Suite.** Alertas, organização por etiquetas, indicadores de inatividade e humor, e pendência externa automática são recursos desse mesmo fluxo de atendimento.

## Imagens

- [Captura do popup, 1280 × 800](termofy-popup-1280x800.png): interface real da extensão renderizada com empresas e protocolos fictícios. Use como captura de tela.
- [Arte promocional, 1280 × 800](termofy-1280x800.png): ilustração das funções. Use apenas em um campo que aceite material promocional ilustrado; ela não representa uma captura literal do Opa.

## Pacote para upload

Use **`Termofy-v2.0.7-ChromeWebStore.zip`**. Ele é gerado a partir do ZIP da versão 2.0.7 já testada, com `manifest.json` na raiz e sem `termostato/manifest.json`, testes ou documentação interna. Os scripts e estilos do Termostato continuam no pacote; a pasta original do repositório não é alterada.

Para recriar o pacote:

```sh
python3 store/build-store-package.py /workspace/releases/Termofy-v2.0.7.zip /workspace/releases/Termofy-v2.0.7-ChromeWebStore.zip
```

Envie o arquivo ZIP diretamente. Não compacte a pasta que contém o ZIP.

## Política de privacidade

URL pública para colar no cadastro: **https://github.com/VictorRubert/OPA-Notify/blob/main/PRIVACY.md**

O repositório é público e a URL pode ser aberta sem login. A política está em [PRIVACY.md](../PRIVACY.md); publique as alterações antes de preencher o cadastro para manter o texto público atualizado.

## Uso de dados

Marque as seguintes categorias:

| Categoria do formulário | Marcar | Motivo |
| --- | --- | --- |
| Informações de identificação pessoal | **Sim** | Nomes de contatos, clientes ou atendentes e identificadores exibidos pelo Opa podem aparecer nos cartões, avisos e armazenamento local. |
| Comunicações pessoais | **Sim** | A prévia de mensagens e as transcrições de áudio carregadas pelo Opa são lidas para avisos e análise local de humor. |
| Conteúdo do site | **Sim** | Protocolos, etiquetas, horários, estado da fila e demais elementos das páginas do Opa são lidos para acompanhar os atendimentos. |
| Informações sobre saúde | Não | A extensão não busca essa categoria para suas funções. |
| Informações financeiras e de pagamento | Não | A extensão não busca essa categoria para suas funções. |
| Informações de autenticação | Não | A extensão usa a sessão já aberta no Opa e não lê senhas ou credenciais. |
| Local | Não | A extensão não solicita localização. |
| Histórico da Web | Não | A extensão não registra histórico de navegação; usa o endereço da aba para entregar avisos opcionais. |
| Atividade do usuário | **Sim** | Na interface nova, a extensão observa os eventos de rede da fila do Opa e repete consultas de leitura já feitas pela página. Não registra cliques, teclado ou rolagem para análise. |

As três declarações no rodapé do formulário podem ser marcadas: a extensão não vende dados, não os usa para objetivos alheios ao acompanhamento dos atendimentos e não os usa para crédito ou empréstimo. O Opa! Suite continua processando as próprias conversas e as ações feitas na sessão do atendente; a extensão não envia esses dados a um servidor próprio.

**Correção em relação ao exemplo do formulário:** marque também **Comunicações pessoais** e **Atividade do usuário**. A extensão lê texto de mensagens e transcrições e observa eventos de rede da fila do Opa, mesmo sem armazenar o texto no histórico local nem analisar a navegação fora do Opa.

## Justificativas de permissões, se solicitadas

- `storage`: salva configurações, base da fila, histórico recente e resultados locais do Termostato.
- `notifications`: mostra avisos do sistema de entrada e saída da fila.
- `alarms`: agenda verificações periódicas da fila enquanto o Chrome está aberto.
- `tabs`: encontra a aba do Opa, abre a conversa ao clicar no aviso e entrega cartões em outras abas quando ativados.
- `scripting`: injeta os cartões opcionais em outras abas.
- `offscreen`: reproduz o áudio configurado para avisos de atendimento.
- Acesso `http://*/*` e `https://*/*`: permite mostrar cartões em outras abas quando o usuário ativa essa opção. A leitura da fila e das mensagens ocorre apenas nos dois domínios do Opa citados acima.

O preenchimento e a publicação do cadastro na Chrome Web Store dependem do acesso à conta de desenvolvedor e da revisão da loja.
