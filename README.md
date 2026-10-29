# Opa!Notify v1.5.1

Extensão Chrome que avisa quando um atendimento entra ou sai de **Meus atendimentos** no [Opa! Suite](https://suporte.ixcsoft.com.br/).

## Compatibilidade

Endereços suportados: `https://suporte.ixcsoft.com.br/` e `https://opasuiteapi.ixcsoft.com.br/customer-service/in-progress`. As rotas dos dois domínios são reconhecidas, permitindo navegar sem perder o monitoramento.

Reconhece automaticamente a interface antiga e a nova (Chrome 111 ou superior). Na interface nova, acompanha as listas completas recebidas pela conexão Socket.IO já aberta pelo Opa; rolar a fila não é tratado como saída de atendimento. Usa o nome do contato quando não há empresa vinculada.

Após instalar ou atualizar, **recarregue a aba do Opa** para conectar o monitor à nova interface. Mantenha **Em andamento → Meus atendimentos** selecionado, sem busca ou filtros adicionais. Listas paginadas só são comparadas depois de recebidas todas as páginas. Sem uma lista completa, a extensão aguarda em vez de gerar alertas de saída.

## Funcionalidades

- Cartões no Opa e em outras abas, além de notificações do sistema, com protocolo e empresa.
- Histórico dos 5 últimos atendimentos recebidos.
- Destaque roxo e etiqueta **NOVO** no atendimento mais recente.
- Destaque e lembrete para motivo não preenchido.
- Sons integrados ou personalizados em MP3, WAV ou OGG (até 2 MB).

O cartão de recebimento abre o atendimento; o cartão de saída copia o protocolo. O clique na notificação do sistema retorna ao Opa.

## Instalação e atualização

1. Baixe e extraia o ZIP da versão ou clone este repositório.
2. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
4. Abra o Opa e selecione **Meus atendimentos**.

Para atualizar uma instalação manual, substitua os arquivos na pasta utilizada, recarregue a extensão e a aba do Opa. A primeira leitura cria uma base silenciosa, sem avisar sobre atendimentos já existentes.

## Configurações

- **Notificações:** ativação, aviso visual, duração de 5 a 30 segundos, posição em um dos quatro cantos (padrão: superior esquerdo), avisos em outras abas, notificações do sistema e aviso de atendimento finalizado. Os canais podem ser ativados ou desativados separadamente.
- **Visual:** destaque roxo, tipo de preenchimento e controles de destaque, pisca e pop-up do motivo.
- **Som:** escolha do áudio, arquivo personalizado, volume e teste.
- **Teste e manutenção:** simulações, teste e remoção de destaque e **Refazer leitura inicial**, que recria a base sem apagar o histórico.

## Permissões e limites

A aba do Opa precisa permanecer aberta, com **Meus atendimentos** selecionado e sem busca preenchida. A extensão solicita uma leitura adicional a cada minuto, mesmo quando outra aba está ativa. O Chrome pode atrasar alarmes; abas suspensas ou descartadas e uma fila que o próprio Opa não atualiza em segundo plano impedem a detecção. O acesso a sites HTTP/HTTPS permite exibir cartões em outras abas; o monitor de atendimentos funciona apenas no Opa. Páginas protegidas do Chrome podem bloquear os cartões.

As notificações do sistema exigem permissão e podem ser ocultadas pelo modo Não perturbe. Alterações no HTML do Opa podem exigir atualização dos seletores da extensão.

## Testes

Use as simulações do popup com o Opa aberto. Para os testes automatizados de lógica, execute com Node.js:

```sh
node --test tests/*.test.cjs
```

Para verificar a leitura e os destaques nas duas interfaces com exemplos fictícios, execute `node tests/interfaces.browser.cjs` em um ambiente com Playwright e Chromium (`CHROMIUM_PATH` permite escolher o executável).

Os testes usam APIs Chrome e eventos de rede simulados; a integração deve ser validada em uma instalação real da extensão.

Licença: [MIT](LICENSE).
