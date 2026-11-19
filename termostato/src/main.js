/* =========================================================
   BOOTSTRAP + OBSERVER
   - Um único MutationObserver para tudo
   - Debounce: várias mutações seguidas = 1 análise
   - Ignora mutações causadas pela própria extensão ([data-ixc])
   - Detecta troca de atendimento pelo data-customer-service-id da conversa aberta
   ========================================================= */

(function () {
  const { CONFIG, dom, pendencia, humor, termometro, lista, storage, log } = IXCOpa;

  let atendimentoAtual = null;
  let debounceTimer = null;

  let observer = null;
  let intervalo = null;

  // Extensão recarregada (↻) sem F5 na aba: esta cópia antiga se desliga em silêncio
  function desligarSeInvalido() {
    if (IXCOpa.contextoValido()) return false;
    if (observer) observer.disconnect();
    clearInterval(intervalo);
    clearTimeout(debounceTimer);
    console.info('[Termostato] Extensão foi atualizada: dê F5 nesta aba para carregar a versão nova');
    return true;
  }

  function atualizar(origem) {
    if (desligarSeInvalido()) return;
    const id = dom.getAtendimentoId();
    if (id !== atendimentoAtual) {
      log('Main', `Atendimento mudou: ${atendimentoAtual} → ${id}`);
      atendimentoAtual = id;
      pendencia.reset();
      const antigo = document.getElementById(termometro.ID);
      if (antigo) antigo.remove();
    }

    try {
      // roda mesmo sem atendimento aberto, para o diagnóstico mostrar "sem atendimento aberto"
      if (CONFIG.PENDENCIA_ATIVA) pendencia.check(origem);
    } catch (e) {
      console.error('[Termostato][Pendência]', e);
    }

    try {
      if (CONFIG.HUMOR_ATIVO) {
        const r = id ? humor.analisarAtendimento() : null;
        // Só grava se as mensagens do atendimento já carregaram
        const carregou = id && dom.getClientMessages().length + dom.getAgentMessages().length > 0;
        lista.setAoVivo(carregou ? id : null, carregou ? r : null);
        if (CONFIG.HUMOR_NA_LISTA) lista.renderTodos();
        if (CONFIG.HUMOR_NO_CABECALHO && r) termometro.render(r);
        if (r) log('Humor', `${r.emoji} ${r.label} (média ${r.media.toFixed(2)})`, r.detalhes);
      }
    } catch (e) {
      console.error('[Termostato][Humor]', e);
    }
  }

  function agendar(origem) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => atualizar(origem), CONFIG.DEBOUNCE_MS);
  }

  function ehNossa(m) {
    if (IXCOpa.isOwnNode(m.target)) return true;
    const nos = [...m.addedNodes, ...m.removedNodes];
    return nos.length > 0 && nos.every((n) => IXCOpa.isOwnNode(n));
  }

  function iniciar() {
    // Observa o body inteiro: o Opa recria a conversa e a lista ao navegar,
    // então observar um nó interno faria o observer "morrer".
    observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => !ehNossa(m))) agendar('observer');
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    intervalo = setInterval(() => atualizar('fallback'), CONFIG.FALLBACK_INTERVAL);
    atualizar('boot');
    console.log(`[Termostato] Extensão carregada v${IXCOpa.VERSAO} (pendência + termômetro de humor)`);
  }

  storage.carregar().then(iniciar);
})();
