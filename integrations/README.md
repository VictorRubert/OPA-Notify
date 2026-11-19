# Termostato integrado

`../termostato/` é uma cópia integral do ZIP Termostato 2.22.0, sem edições,
incluindo manifest, testes, documentação e ícones. O Chrome utiliza o manifest
da raiz da Notify. Não instale o manifest interno junto com a Notify.

## Arquivos de integração

- `../manifest.json`: carrega os scripts originais, na ordem do manifest do
  Termostato, com `termostato.js` imediatamente antes de `src/main.js`.
- `termostato.js`: aguarda as preferências antes do bootstrap original, conecta
  os controles da Notify ao objeto CONFIG em memória, limpa os selos ao desligar,
  cancela o cronômetro de pendência e verifica a preferência novamente antes do clique.
  Não modifica arquivos originais nem substitui as regras de humor/pendência.
- `termostato-originals.json`: versão e SHA-256 de cada arquivo original do ZIP.
- `../popup/` e `../background.js`: controles e valores iniciais das preferências.

Os três controles começam ligados. `enabled` (Ativar Opa!Notify) também pausa
o módulo. Desativar não desfaz pendências já marcadas nem apaga o cache.
Uma ação já enviada ao Opa pode terminar sua confirmação após desativar.
O Termostato só reconhece os seletores da interface nova, nos dois domínios da
Notify; o monitor original da Notify continua atendendo a interface antiga.

O armazenamento original usa a chave `ixcOpa`, sem colisão com as preferências
da Notify. O cache da extensão Termostato separada não migra automaticamente:
o Chrome separa o armazenamento por extensão. Desative a instalação separada e
recarregue o Opa antes de usar a integração.

## Atualizar apenas o Termostato

1. Substitua `termostato/` pelo conteúdo completo do novo ZIP, preservando os bytes.
2. Compare o manifest novo com o anterior. Revise a ordem de carregamento,
   permissões, seletores e interfaces públicas usadas por `termostato.js`.
3. Atualize `t.VERSAO` no adaptador e a versão exibida no popup.
4. Gere novamente `termostato-originals.json` a partir dos arquivos do ZIP de
   origem (não de arquivos editados). Registre a nova versão e hashes SHA-256.
5. Execute `node termostato/tests/run-all.js`, `node --test tests/*.test.cjs`
   e `node tests/termostato.browser.cjs`, além dos testes de regressão da Notify.
6. Aumente a versão da Notify e empacote a raiz com toda a pasta `termostato/`.

Teste no Opa real antes de distribuir: os testes de navegador utilizam uma
interface fictícia e APIs Chrome simuladas. Mudanças do fornecedor podem exigir
ajustes no adaptador; substituir a pasta não garante compatibilidade futura.
